import { supabase, isConfigured } from './supabaseClient';
import { tauriDb } from './tauriService';
import { hashPassword, verifyPassword, isDefaultPasswordHash } from '../utils/authUtils';
import { User } from '../types';

/**
 * Authentication lives in two trust domains:
 *
 *  • cloud — T_USER is authoritative; the bcrypt password hash lives directly
 *            in T_USER.PASSWORD and is verified client-side. No RPC layer.
 *  • local — the on-disk SQLite copy owns its own hash in the same column and
 *            is the only source of truth while offline.
 *
 * The cloud is used only when Supabase is configured AND reachable; anything
 * else falls back to the local database. Keeping that decision in one place is
 * what stops the two paths from drifting apart.
 */

export interface AuthFlags {
    isOnline: boolean;
    isDesktop: boolean;
}

export interface SignInResult {
    user: User | null;
    /** The stored hash is still the seeded default ⇒ force a change. */
    needsPasswordChange: boolean;
    /** The account exists locally but this workstation never cached a hash. */
    offlineCredentialMissing: boolean;
    /** Which copy answered — needed to tell a server rejection from a local one. */
    source: 'cloud' | 'local';
}

const normalize = (username: string) => (username || '').trim().toLowerCase();

/**
 * Inserts a T_USER row, guaranteeing the NOT NULL PASSWORD column is satisfied
 * even when the caller does not yet supply a hash. Used for both cloud and
 * local creation.
 */
export const insertUserRow = async <T>(
    insert: (payload: Record<string, any>) => Promise<T>,
    payload: Record<string, any>
): Promise<T> => {
    const rowPayload = { ...payload };
    if (rowPayload.PASSWORD === undefined || rowPayload.PASSWORD === null) {
        rowPayload.PASSWORD = '';
    }
    return insert(rowPayload);
};

/**
 * After a successful ONLINE login the user has just proven knowledge of their
 * plaintext, so a local hash can be derived for this workstation. That hash is
 * the only thing allowing the account to sign in while offline.
 */
const cacheLocalCredential = async (
    credential: Pick<User, 'ID_USER' | 'USERNAME' | 'ROLE'> &
        Partial<Pick<User, 'ALLOWED_PAGES' | 'ALLOWED_OPERATIONS'>>,
    password: string
): Promise<void> => {
    if (!tauriDb.isAvailable()) return;
    try {
        const hash = await hashPassword(password);
        const updated = await tauriDb.updateItem('T_USER', 'ID_USER', credential.ID_USER, { PASSWORD: hash });
        if (updated) return;
        // No local row yet: create a complete one, otherwise USERNAME / ROLE
        // (both NOT NULL) would reject a password-only insert.
        await tauriDb.upsertItem('T_USER', { ...credential, PASSWORD: hash });
    } catch (err) {
        console.warn('Could not cache the offline credential for this workstation:', err);
    }
};

const readLocalUsers = async (flags: AuthFlags): Promise<User[]> => {
    if (!flags.isDesktop) return [];
    try {
        const localDb = await tauriDb.getDatabase();
        return (localDb.T_USER || []) as User[];
    } catch (err) {
        console.error('Failed to read local users:', err);
        return [];
    }
};

/**
 * Verifies credentials against the local SQLite copy.
 * `fallbackUsers` is the in-memory table, used by the web build when the
 * desktop database is absent.
 */
const signInLocally = async (
    username: string,
    password: string,
    flags: AuthFlags,
    fallbackUsers: User[]
): Promise<SignInResult> => {
    const target = normalize(username);
    const localUsers = await readLocalUsers(flags);
    const candidates = localUsers.length > 0 ? localUsers : fallbackUsers;

    const found = candidates.find(u => normalize(u.USERNAME || '') === target);
    if (!found) {
        return { user: null, needsPasswordChange: false, offlineCredentialMissing: false, source: 'local' };
    }

    // An empty hash means the row was mirrored from the cloud, which no longer
    // ships hashes: this account simply never signed in on this machine.
    if (!found.PASSWORD) {
        return { user: null, needsPasswordChange: false, offlineCredentialMissing: true, source: 'local' };
    }

    const { valid, needsRehash } = await verifyPassword(password, found.PASSWORD);
    if (!valid) {
        return { user: null, needsPasswordChange: false, offlineCredentialMissing: false, source: 'local' };
    }

    const user: User = { ...found };
    if (needsRehash) {
        try {
            user.PASSWORD = await hashPassword(password);
            if (flags.isDesktop) {
                tauriDb.updateItem('T_USER', 'ID_USER', user.ID_USER, { PASSWORD: user.PASSWORD })
                    .catch(err => console.warn('Local rehash deferred:', err));
            }
        } catch (err) {
            console.warn('Could not rehash password on login:', err);
        }
    }

    return {
        user,
        needsPasswordChange: isDefaultPasswordHash(user.PASSWORD),
        offlineCredentialMissing: false,
        source: 'local',
    };
};

/**
 * Network-level failure: the server was never reached, so nothing is known
 * about the credentials. Anything else — a missing function, a rejected key, a
 * wrong password — is a definitive answer from the server.
 */
const isTransportFailure = (err: any): boolean => {
    const msg = String(err?.message || '');
    return (
        err instanceof TypeError ||
        err?.status === 0 ||
        err?.status === 502 ||
        err?.status === 503 ||
        err?.status === 504 ||
        /fetch|network|timeout|unreachable|failed to reach/i.test(msg)
    );
};

const signInCloud = async (username: string, password: string): Promise<SignInResult> => {
    const { data, error } = await supabase!
        .from('T_USER')
        .select('*')
        .ilike('USERNAME', username.trim())
        .limit(1)
        .maybeSingle();
    if (error) throw error;

    if (!data) {
        return { user: null, needsPasswordChange: false, offlineCredentialMissing: false, source: 'cloud' };
    }

    const hash = (data as Record<string, any>).PASSWORD as string | null | undefined;
    const { valid } = await verifyPassword(password, hash);
    if (!valid) {
        return { user: null, needsPasswordChange: false, offlineCredentialMissing: false, source: 'cloud' };
    }

    const user: User = {
        ID_USER: Number((data as Record<string, any>).ID_USER),
        USERNAME: String((data as Record<string, any>).USERNAME),
        ROLE: (data as Record<string, any>).ROLE,
        ALLOWED_PAGES: (data as Record<string, any>).ALLOWED_PAGES ?? undefined,
        ALLOWED_OPERATIONS: (data as Record<string, any>).ALLOWED_OPERATIONS ?? undefined,
    };

    await cacheLocalCredential(user, password);

    return {
        user,
        needsPasswordChange: isDefaultPasswordHash(hash),
        offlineCredentialMissing: false,
        source: 'cloud',
    };
};

/**
 * Resolves the account for the given credentials.
 *
 * The cloud copy is asked whenever it is configured — NOT when `isOnline` says
 * so. That flag is driven by write failures and only recovers on a browser
 * `online` event, so it can stay false on a perfectly connected machine; a
 * stale false sent logins to an old local hash and rejected correct passwords.
 *
 * Local verification is used only when no cloud is configured, or when the
 * server could not be reached. A rejection from the server is final: falling
 * through to the local copy would let a stale hash override it.
 */
export const signIn = async (
    username: string,
    password: string,
    flags: AuthFlags,
    fallbackUsers: User[] = []
): Promise<SignInResult> => {
    if (!isConfigured || !supabase) {
        return signInLocally(username, password, flags, fallbackUsers);
    }

    try {
        return await signInCloud(username, password);
    } catch (err) {
        if (!isTransportFailure(err)) throw err;
        // Cloud unreachable: a previously cached credential still works offline.
        return signInLocally(username, password, flags, fallbackUsers);
    }
};

/**
 * Turns a PostgREST/Postgres failure into something the person at the desk can
 * act on.
 */
export const authErrorMessage = (err: any): string => {
    const code = String(err?.code || '');
    const msg = String(err?.message || err?.details || '');

    if (code === 'PGRST301' || /invalid api key|jwt|no api key/i.test(msg)) {
        return 'مفتاح الاتصال بقاعدة البيانات غير صالح. أعد إعداد الرابط والمفتاح من شاشة الدخول.';
    }
    if (code === 'PGRST000' || /fetch|network|timeout|unreachable/i.test(msg)) {
        return 'تعذّر الوصول إلى قاعدة البيانات السحابية. تحقق من الاتصال بالإنترنت.';
    }
    return `خطأ في التحقق من كلمة المرور: ${msg || 'سبب غير معروف'}`;
};

/**
 * A user row that lives only in this workstation's SQLite copy. Writing a
 * password for it cannot touch the cloud since no row exists there.
 */
export const CLOUD_USER_MISSING = 'USER_NOT_IN_CLOUD';

/**
 * Inserts a T_USER row straight into the cloud and returns the stored row.
 *
 * The generic `addItem` cannot be used for this: it swallows a rejected cloud
 * insert and re-writes the row to the local SQLite, so the caller believes it
 * was stored in the cloud and receives a workstation-only ID_USER.
 */
export const insertCloudUser = async (payload: Record<string, any>): Promise<User> => {
    const sb = supabase;
    if (!sb) throw new Error('CLOUD_NOT_CONFIGURED');

    return insertUserRow<User>(async (rowPayload) => {
        const { data, error } = await sb.from('T_USER').insert(rowPayload).select().single();
        if (error) throw error;
        return data as User;
    }, payload);
};

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Sets/changes a password. The hash is derived client-side and written straight
 * to T_USER.PASSWORD in the cloud (when configured) and cached locally.
 */
export const setUserPassword = async (user: User | { ID_USER: number }, password: string): Promise<void> => {
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
        throw new Error('PASSWORD_TOO_SHORT');
    }

    const hash = await hashPassword(password);

    if (supabase) {
        const { data, error } = await supabase
            .from('T_USER')
            .update({ PASSWORD: hash })
            .eq('ID_USER', user.ID_USER)
            .select('ID_USER')
            .maybeSingle();
        if (error) throw error;
        if (!data) {
            const missing = new Error(CLOUD_USER_MISSING) as Error & { code: string };
            missing.code = CLOUD_USER_MISSING;
            throw missing;
        }
    }

    if ('USERNAME' in user) {
        await cacheLocalCredential(user, password);
    }
};
