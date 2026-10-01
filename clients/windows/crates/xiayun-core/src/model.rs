use serde::{Deserialize, Serialize};

use crate::error::err;

/// 原生客戶端優先使用 Bearer。沒有 token 時才保留 `session` cookie。
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum AuthMaterial {
    None,
    Bearer { token: String },
    SessionCookie { value: String },
}

impl std::fmt::Debug for AuthMaterial {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::None => write!(f, "None"),
            Self::Bearer { .. } => write!(f, "Bearer"),
            Self::SessionCookie { .. } => write!(f, "SessionCookie"),
        }
    }
}

impl AuthMaterial {
    pub fn method_name(&self) -> &'static str {
        match self {
            Self::None => "none",
            Self::Bearer { .. } => "bearer",
            Self::SessionCookie { .. } => "cookie",
        }
    }

    pub fn is_signed_in(&self) -> bool {
        !matches!(self, Self::None)
    }

    /// Bearer 優先於 cookie。兩者都有時只留 token。
    pub fn from_login(token: Option<String>, cookie: Option<String>) -> Result<Self, super::ClientError> {
        if let Some(token) = token.filter(|value| !value.is_empty()) {
            return Ok(Self::Bearer { token });
        }
        if let Some(value) = cookie.filter(|value| !value.is_empty()) {
            return Ok(Self::SessionCookie { value });
        }
        Err(err("伺服器沒有回傳登入憑證"))
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PublicUser {
    pub id: String,
    pub email: String,
    pub created_at: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub id: String,
    #[serde(rename = "ownerId")]
    pub owner_id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub name: String,
    pub size: u64,
    pub mime_type: Option<String>,
    pub created_at: String,
    pub excerpt: Option<String>,
    pub body: Option<String>,
}

#[derive(Clone, Debug)]
pub struct AuthSession {
    pub user: PublicUser,
    pub auth: AuthMaterial,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SavedSession {
    pub base_url: String,
    pub user: PublicUser,
    pub auth: AuthMaterial,
}

#[derive(Clone, Debug)]
pub struct ContentBlob {
    pub mime: String,
    pub bytes: Vec<u8>,
    pub filename: String,
}
