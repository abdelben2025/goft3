import { hash, compare } from 'bcrypt-ts/browser';

const SALT_ROUNDS = 10;

// Valid bcrypt hash of the seeded default password "admin123" (see src-tauri/src/db.rs)
export const DEFAULT_ADMIN_PASSWORD_HASH =
    '$2b$10$rA9vBL8p087PyWkp4gge1OkLV2tTLhb.ABfM2k/b.LlpyLoaKM68C';

export const isDefaultPasswordHash = (storedHash: string | null | undefined): boolean => {
    if (!storedHash) return false;
    return storedHash.trim() === DEFAULT_ADMIN_PASSWORD_HASH;
};

/**
 * Computes legacy SHA-256 hash for backward compatibility.
 */
export async function legacySha256(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Modern secure password hashing using pure TypeScript Bcrypt designed for browser environments.
 */
export async function hashPassword(password: string): Promise<string> {
    return hash(password, SALT_ROUNDS);
}

/**
 * Verifies a password against the stored hash.
 * Supports seamless migration from legacy SHA-256 or plaintext passwords to Bcrypt.
 */
export async function verifyPassword(
    password: string,
    storedHash: string | null | undefined
): Promise<{ valid: boolean; needsRehash: boolean }> {
    if (!storedHash) {
        return { valid: false, needsRehash: false };
    }

    const trimmedHash = storedHash.trim();

    // Check if the hash is a modern Bcrypt hash ($2a$, $2b$, or $2y$)
    const isBcrypt = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(trimmedHash);

    if (isBcrypt) {
        try {
            const isValid = await compare(password, trimmedHash);
            return { valid: isValid, needsRehash: false };
        } catch (e) {
            console.error("Error verifying bcrypt hash:", e);
            return { valid: false, needsRehash: false };
        }
    }

    // Check against legacy SHA-256 hash
    try {
        const legacyHash = await legacySha256(password);
        if (legacyHash === trimmedHash || legacyHash.toLowerCase() === trimmedHash.toLowerCase()) {
            return { valid: true, needsRehash: true };
        }
    } catch (e) {
        console.error("Error calculating legacy SHA-256:", e);
    }

    return { valid: false, needsRehash: false };
}
