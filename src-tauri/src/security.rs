//! Local data protection:
//! - Windows EFS encryption for the local SQLite database files (per-user,
//!   authenticated by the user's certificate) so copying the file to another
//!   Windows account/machine yields unreadable ciphertext.
//! - AES-256-GCM encrypted + authenticated backups (passphrase based,
//!   PBKDF2-HMAC-SHA256 key derivation) so backups are portable yet unreadable
//!   without the passphrase.

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use std::path::{Path, PathBuf};

pub const BACKUP_MAGIC: &[u8; 8] = b"GOFT3BK2";
const PBKDF2_ROUNDS: u32 = 200_000;
const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 12;
const HEADER_LEN: usize = 8 + SALT_LEN + NONCE_LEN;

pub fn is_encrypted_backup(data: &[u8]) -> bool {
    data.len() >= HEADER_LEN && &data[..8] == BACKUP_MAGIC
}

fn derive_key(passphrase: &str, salt: &[u8]) -> [u8; 32] {
    let mut key = [0u8; 32];
    pbkdf2::pbkdf2_hmac::<sha2::Sha256>(passphrase.as_bytes(), salt, PBKDF2_ROUNDS, &mut key);
    key
}

/// Encrypts a backup payload. Output layout:
/// magic(8) || salt(16) || nonce(12) || AES-256-GCM ciphertext+tag
pub fn encrypt_backup(plain: &[u8], passphrase: &str) -> Result<Vec<u8>, String> {
    let mut salt = [0u8; SALT_LEN];
    let mut nonce_bytes = [0u8; NONCE_LEN];
    getrandom::getrandom(&mut salt).map_err(|e| format!("RNG error: {}", e))?;
    getrandom::getrandom(&mut nonce_bytes).map_err(|e| format!("RNG error: {}", e))?;

    let key = derive_key(passphrase, &salt);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|_| "Invalid key length".to_string())?;
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce_bytes), plain)
        .map_err(|_| "Encryption failed".to_string())?;

    let mut out = Vec::with_capacity(HEADER_LEN + ciphertext.len());
    out.extend_from_slice(BACKUP_MAGIC);
    out.extend_from_slice(&salt);
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&ciphertext);
    Ok(out)
}

pub fn decrypt_backup(data: &[u8], passphrase: &str) -> Result<Vec<u8>, String> {
    if !is_encrypted_backup(data) {
        return Err("NOT_ENCRYPTED".to_string());
    }
    let salt = &data[8..8 + SALT_LEN];
    let nonce_bytes = &data[8 + SALT_LEN..HEADER_LEN];
    let ciphertext = &data[HEADER_LEN..];

    let key = derive_key(passphrase, salt);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|_| "Invalid key length".to_string())?;
    cipher
        .decrypt(Nonce::from_slice(nonce_bytes), ciphertext)
        .map_err(|_| "WRONG_PASSPHRASE".to_string())
}

#[cfg(windows)]
fn efs_encrypt(path: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    let wide: Vec<u16> = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0u16))
        .collect();
    let ok = unsafe { windows_sys::Win32::Storage::FileSystem::EncryptFileW(wide.as_ptr()) };
    if ok == 0 {
        return Err(format!(
            "EncryptFileW failed (os error {})",
            std::io::Error::last_os_error()
        ));
    }
    Ok(())
}

#[cfg(not(windows))]
fn efs_encrypt(_path: &Path) -> Result<(), String> {
    Err("EFS encryption is only supported on Windows".to_string())
}

/// Encrypts goft3_local.db and its WAL/SHM journals with Windows EFS.
/// Safe to call repeatedly (EFS is idempotent).
pub fn harden_local_db_files(db_path: &Path) {
    let mut targets: Vec<PathBuf> = vec![db_path.to_path_buf()];
    for suffix in ["-wal", "-shm"] {
        let mut os = db_path.as_os_str().to_os_string();
        os.push(suffix);
        targets.push(PathBuf::from(os));
    }
    for target in targets {
        if target.exists() {
            match efs_encrypt(&target) {
                Ok(()) => {}
                Err(e) => eprintln!(
                    "[security] Could not EFS-encrypt {:?}: {} (continuing without file encryption)",
                    target, e
                ),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backup_roundtrip() {
        let payload = b"{\"T_USER\":[]}";
        let enc = encrypt_backup(payload, "strong-pass-123").unwrap();
        assert!(is_encrypted_backup(&enc));
        assert_ne!(&enc[HEADER_LEN..], &payload[..]);
        assert_eq!(decrypt_backup(&enc, "strong-pass-123").unwrap(), payload.to_vec());
        assert!(decrypt_backup(&enc, "wrong-pass-123").is_err());
    }

    #[test]
    fn legacy_plain_is_detected() {
        assert!(!is_encrypted_backup(b"{ \"a\": 1 }"));
        assert_eq!(decrypt_backup(b"plain json", "x").unwrap_err(), "NOT_ENCRYPTED");
    }
}
