import { supabase, isConfigured } from './supabaseClient';
import { tauriDb } from './tauriService';
import { hashPassword, verifyPassword, isDefaultPasswordHash } from '../utils/authUtils';
import { User } from '../types';

/**
 * Authentication lives in two trust domains:
 *
 *  • cloud — T_USER is authoritative, passwords never leave Postgres
 *            (public.verify_login / public.set_user_password).
 *  • local — the on-disk SQLite copy owns its own T_USER_SECRET-free hash column
 *            and is the only source of truth while offline.
 *
 * The cloud is used only when Supabase is configured AND reachable; anything
 * else falls back to the local database. Keeping that decision in one place is
 * what stops the two paths from drifting apart.
 */

export interface AuthFlags {
    isOnline: boolean;
    isDesktop: boolean;
}

export interface LoginDiagnostic {
    /** The username exists in the cloud T_USER at all. */
    userFound: boolean;
    totalUsers: number;
    secretRows: number;
    /** State of the stored hash — never the hash itself. */
    secretState: 'MISSING' | 'EMPTY' | 'OK' | 'CORRUPT' | 'UNKNOWN';
    hasPasswordColumn: boolean;
}

export interface SignInResult {
    user: User | null;
    /** The stored hash is still the seeded default ⇒ force a change. */
    needsPasswordChange: boolean;
    /** The account exists locally but this workstation never cached a hash. */
    offlineCredentialMissing: boolean;
    /** Which copy answered — needed to tell a server rejection from a local one. */
    source: 'cloud' | 'local';
    /** Why the cloud rejected the account, when public.diag_login is deployed. */
    diagnostic?: LoginDiagnostic | null;
}

const normalize = (username: string) => (username || '').trim().toLowerCase();

/**
 * A pre-migration database still has T_USER.PASSWORD as NOT NULL, while a
 * migrated one no longer has the column at all. Retrying lets the app run on
 * both sides of that migration without a hard deploy ordering.
 */
const isPasswordColumnError = (err: any): boolean => {
    const msg = String(err?.message || err?.details || err?.toString?.() || '');
    const code = String(err?.code || '');
    return (
        code === '23502' || // not-null violation on PASSWORD
        code === 'PGRST204' || // column not found in schema cache
        code === '42703' || // undefined_column
        /PASSWORD/i.test(msg)
    );
};

export const insertUserRow = async <T>(
    insert: (payload: Record<string, any>) => Promise<T>,
    payload: Record<string, any>
): Promise<T> => {
    try {
        return await insert({ ...payload });
    } catch (err) {
        if (!isPasswordColumnError(err)) throw err;
        // Column still NOT NULL ⇒ satisfy it with an empty placeholder.
        return await insert({ ...payload, PASSWORD: '' });
    }
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

/**
 * Asks public.diag_login (supabase/09_diagnose_login_rpc.sql) why the account
 * was rejected. Purely diagnostic: every failure here is swallowed, because a
 * missing diagnostic must never turn into a second error on the login screen.
 */
const diagnoseCloudAccount = async (username: string): Promise<LoginDiagnostic | null> => {
    try {
        const { data, error } = await supabase!.rpc('diag_login', { p_username: username });
        if (error || !data) return null;
        const row = data as Record<string, any>;
        return {
            userFound: row.USER_FOUND === true,
            totalUsers: Number(row.TOTAL_USERS ?? -1),
            secretRows: Number(row.SECRET_ROWS ?? -1),
            secretState: (row.SECRET as LoginDiagnostic['secretState']) || 'UNKNOWN',
            hasPasswordColumn: row.HAS_PASSWORD_COLUMN === true,
        };
    } catch {
        return null;
    }
};

const signInCloud = async (username: string, password: string): Promise<SignInResult> => {
    const { data, error } = await supabase!.rpc('verify_login', {
        p_username: username,
        p_password: password,
    });
    if (error) throw error;
    if (!data) {
        // verify_login returns NULL for "no user", "no hash" and "wrong
        // password" alike, so ask the diagnostic function which one it was.
        // Absent (not deployed yet) ⇒ null, and the message stays generic.
        const diagnostic = await diagnoseCloudAccount(username);
        return {
            user: null,
            needsPasswordChange: false,
            offlineCredentialMissing: false,
            source: 'cloud',
            diagnostic,
        };
    }

    const row = data as Record<string, any>;
    const user: User = {
        ID_USER: Number(row.ID_USER),
        USERNAME: String(row.USERNAME),
        ROLE: row.ROLE,
        ALLOWED_PAGES: row.ALLOWED_PAGES ?? undefined,
        ALLOWED_OPERATIONS: row.ALLOWED_OPERATIONS ?? undefined,
    };

    await cacheLocalCredential(user, password);

    return {
        user,
        needsPasswordChange: row.NEEDS_PASSWORD_CHANGE === true,
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
 * act on. A missing function or a revoked grant is a setup mistake, not a wrong
 * password — reporting it as "verification failed" hides a one-line fix.
 */
export const authErrorMessage = (err: any): string => {
    const code = String(err?.code || '');
    const msg = String(err?.message || err?.details || '');

    if (code === 'PGRST202' || code === '42883' || /could not find the function|function .* does not exist/i.test(msg)) {
        return 'دالة التحقق غير موجودة في قاعدة البيانات. نفّذ supabase/03_password_hardening.sql ثم أعد المحاولة.';
    }
    if (code === '42501' || /permission denied/i.test(msg)) {
        return 'صلاحية تنفيذ verify_login مسحوبة. أعد تنفيذ supabase/03_password_hardening.sql لاستعادة GRANT EXECUTE.';
    }
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
 * secret for it fails the T_USER_SECRET → T_USER foreign key, so the accounts
 * are checked first and the caller can explain the real cause.
 */
export const CLOUD_USER_MISSING = 'USER_NOT_IN_CLOUD';

const assertCloudUserExists = async (idUser: number): Promise<void> => {
    const sb = supabase;
    if (!sb) throw new Error('CLOUD_NOT_CONFIGURED');

    const { data, error } = await sb
        .from('T_USER')
        .select('ID_USER')
        .eq('ID_USER', idUser)
        .maybeSingle();
    if (error) throw error;
    if (data) return;

    const missing = new Error(CLOUD_USER_MISSING) as Error & { code: string };
    missing.code = CLOUD_USER_MISSING;
    throw missing;
};

/**
 * Inserts a T_USER row straight into the cloud and returns the stored row.
 *
 * The generic `addItem` cannot be used for this: it swallows a rejected cloud
 * insert and re-writes the row to the local SQLite, so the caller believes it
 * was stored in the cloud and receives a workstation-only ID_USER. Setting a
 * password against that id is what produced the bare foreign key error
 * "violates foreign key constraint t_user_secret_id_user_fkey".
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
 * Sets a password in the cloud. Postgres does the hashing
 * (public.set_user_password), so the hash never crosses the wire.
 * Local / web-offline callers hash in the browser and write the row themselves.
 */
export const setUserPassword = async (user: User | { ID_USER: number }, password: string): Promise<void> => {
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
        throw new Error('PASSWORD_TOO_SHORT');
    }
    if (!supabase) {
        throw new Error('CLOUD_NOT_CONFIGURED');
    }

    await assertCloudUserExists(user.ID_USER);

    const { error } = await supabase.rpc('set_user_password', {
        p_id_user: user.ID_USER,
        p_password: password,
    });
    if (error) throw error;

    if ('USERNAME' in user) {
        await cacheLocalCredential(user, password);
    }
};
