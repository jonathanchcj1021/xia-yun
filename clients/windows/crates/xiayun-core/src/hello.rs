use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HelloStatus {
    pub available: bool,
    pub reason: String,
}

#[cfg(windows)]
#[path = "hello_windows.rs"]
mod platform;

#[cfg(not(windows))]
mod platform {
    use super::HelloStatus;
    use crate::error::{err, ClientError};
    use crate::passkey::{AuthenticationChallenge, RegistrationChallenge};

    pub fn hello_status() -> HelloStatus {
        HelloStatus {
            available: false,
            reason: "這台電腦沒有 Windows Hello API。登入按鈕仍會呼叫伺服器，但無法在這裡喚起系統驗證。"
                .into(),
        }
    }

    pub fn verify_user(_message: &str) -> Result<(), ClientError> {
        Err(err(hello_status().reason))
    }

    pub fn sign_assertion(
        _parent_hwnd: isize,
        _challenge: &AuthenticationChallenge,
    ) -> Result<serde_json::Value, ClientError> {
        Err(err(hello_status().reason))
    }

    pub fn create_credential(
        _parent_hwnd: isize,
        _challenge: &RegistrationChallenge,
    ) -> Result<serde_json::Value, ClientError> {
        Err(err(hello_status().reason))
    }

    pub fn protect_key(key: &[u8; 32]) -> Result<Vec<u8>, ClientError> {
        Ok(key.to_vec())
    }

    pub fn unprotect_key(blob: &[u8]) -> Result<[u8; 32], ClientError> {
        let bytes: [u8; 32] = blob
            .try_into()
            .map_err(|_| err("工作階段金鑰長度不正確"))?;
        Ok(bytes)
    }
}

pub use platform::{
    create_credential, hello_status, protect_key, sign_assertion, unprotect_key, verify_user,
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn this_machine_reports_whether_hello_exists() {
        let status = hello_status();
        if cfg!(windows) {
            let _ = status;
        } else {
            assert!(!status.available);
            assert!(verify_user("解鎖").is_err());
        }
    }
}
