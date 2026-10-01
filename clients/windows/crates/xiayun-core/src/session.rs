use std::fs;
use std::path::{Path, PathBuf};

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use serde::{Deserialize, Serialize};

use crate::error::{err, ClientError};
use crate::hello::{protect_key, unprotect_key, verify_user};
use crate::model::SavedSession;

const SEALED_NAME: &str = "session.sealed";
const KEY_NAME: &str = "session.key";
const META_NAME: &str = "session-meta.json";
const MAGIC: &[u8] = b"XYS1";

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SessionMeta {
    pub email: String,
    pub base_url: String,
}

pub fn save_session(dir: &Path, session: &SavedSession) -> Result<(), ClientError> {
    fs::create_dir_all(dir).map_err(|_| err("無法建立本機資料夾"))?;
    let mut key = [0u8; 32];
    rand::RngCore::fill_bytes(&mut rand::thread_rng(), &mut key);
    let plaintext = serde_json::to_vec(session).map_err(|_| err("無法儲存登入狀態"))?;
    let sealed = seal(&key, &plaintext)?;
    let protected = protect_key(&key)?;
    write_private(&dir.join(SEALED_NAME), &sealed)?;
    write_private(&dir.join(KEY_NAME), &protected)?;
    let meta = SessionMeta {
        email: session.user.email.clone(),
        base_url: session.base_url.clone(),
    };
    let meta_bytes = serde_json::to_vec_pretty(&meta).map_err(|_| err("無法儲存登入狀態"))?;
    write_private(&dir.join(META_NAME), &meta_bytes)?;
    Ok(())
}

pub fn unlock_with_hello(dir: &Path) -> Result<SavedSession, ClientError> {
    verify_user("使用 Windows Hello 解鎖匣雲")?;
    read_sealed_session(dir)
}

pub fn read_sealed_session(dir: &Path) -> Result<SavedSession, ClientError> {
    let protected = fs::read(dir.join(KEY_NAME)).map_err(|_| err("找不到已儲存的登入"))?;
    let key = unprotect_key(&protected)?;
    let sealed = fs::read(dir.join(SEALED_NAME)).map_err(|_| err("找不到已儲存的登入"))?;
    let plaintext = open(&key, &sealed)?;
    serde_json::from_slice(&plaintext).map_err(|_| err("已儲存的登入已損壞"))
}

pub fn peek_meta(dir: &Path) -> Option<SessionMeta> {
    let bytes = fs::read(dir.join(META_NAME)).ok()?;
    serde_json::from_slice(&bytes).ok()
}

pub fn has_saved_session(dir: &Path) -> bool {
    dir.join(SEALED_NAME).is_file() && dir.join(KEY_NAME).is_file()
}

pub fn clear_session_files(dir: &Path) {
    for name in [SEALED_NAME, KEY_NAME, META_NAME] {
        let _ = fs::remove_file(dir.join(name));
    }
}

pub fn seal(key: &[u8; 32], plaintext: &[u8]) -> Result<Vec<u8>, ClientError> {
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| err("無法保護登入狀態"))?;
    let mut nonce_bytes = [0u8; 12];
    rand::RngCore::fill_bytes(&mut rand::thread_rng(), &mut nonce_bytes);
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce_bytes), plaintext)
        .map_err(|_| err("無法保護登入狀態"))?;
    let mut out = Vec::with_capacity(4 + 12 + ciphertext.len());
    out.extend_from_slice(MAGIC);
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&ciphertext);
    Ok(out)
}

pub fn open(key: &[u8; 32], blob: &[u8]) -> Result<Vec<u8>, ClientError> {
    if blob.len() < 4 + 12 + 16 || &blob[..4] != MAGIC {
        return Err(err("已儲存的登入已損壞"));
    }
    let nonce = &blob[4..16];
    let ciphertext = &blob[16..];
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| err("已儲存的登入已損壞"))?;
    cipher
        .decrypt(Nonce::from_slice(nonce), ciphertext)
        .map_err(|_| err("已儲存的登入已損壞"))
}

fn write_private(path: &PathBuf, bytes: &[u8]) -> Result<(), ClientError> {
    #[cfg(unix)]
    {
        use std::io::Write;
        use std::os::unix::fs::OpenOptionsExt;
        let mut file = fs::OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .mode(0o600)
            .open(path)
            .map_err(|_| err("無法寫入本機登入狀態"))?;
        file.write_all(bytes)
            .map_err(|_| err("無法寫入本機登入狀態"))?;
        return Ok(());
    }
    #[cfg(not(unix))]
    {
        fs::write(path, bytes).map_err(|_| err("無法寫入本機登入狀態"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{AuthMaterial, PublicUser};

    #[test]
    fn seal_roundtrip_and_file_restore_without_hello_prompt() {
        let key = [7u8; 32];
        let blob = seal(&key, b"token").unwrap();
        assert_eq!(open(&key, &blob).unwrap(), b"token");
        assert!(open(&[9u8; 32], &blob).is_err());

        let dir = std::env::temp_dir().join(format!(
            "xiayun-session-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        let session = SavedSession {
            base_url: "http://127.0.0.1:43123".into(),
            user: PublicUser {
                id: "11111111-1111-4111-8111-111111111111".into(),
                email: "a@b.co".into(),
                created_at: "2026-01-01T00:00:00.000Z".into(),
            },
            auth: AuthMaterial::Bearer {
                token: "secret-token".into(),
            },
        };
        save_session(&dir, &session).unwrap();
        let restored = read_sealed_session(&dir).unwrap();
        assert_eq!(restored, session);
        assert_eq!(peek_meta(&dir).unwrap().email, "a@b.co");
        assert!(has_saved_session(&dir));
        let unlocked = unlock_with_hello(&dir);
        if cfg!(windows) {
            let _ = unlocked;
        } else {
            assert!(unlocked.is_err());
            assert!(has_saved_session(&dir));
        }
        clear_session_files(&dir);
        assert!(!has_saved_session(&dir));
        let _ = fs::remove_dir_all(&dir);
    }
}
