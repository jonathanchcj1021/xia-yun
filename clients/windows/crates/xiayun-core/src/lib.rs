//! 匣雲 Windows 客戶端與伺服器之間的協定。
//! 介面文字與錯誤訊息使用繁體中文。

mod client;
mod error;
mod hello;
mod model;
mod multipart;
mod passkey;
mod session;
mod transport;
mod validate;

pub use client::CloudClient;
pub use error::ClientError;
pub use hello::{
    create_credential, hello_status, protect_key, sign_assertion, unprotect_key, verify_user,
    HelloStatus,
};
pub use model::{AuthMaterial, AuthSession, ContentBlob, Item, PublicUser, SavedSession};
pub use passkey::{
    authentication_response_json, client_data_json, parse_authentication_options,
    parse_registration_options, registration_response_json, AuthenticationChallenge,
    RegistrationChallenge,
};
pub use session::{
    clear_session_files, has_saved_session, peek_meta, read_sealed_session, save_session,
    unlock_with_hello, SessionMeta,
};
pub use transport::{HttpRequest, RawResponse, ReqwestTransport};
pub use validate::{
    mime_from_name, normalize_base_url, normalize_email, normalize_password, sanitize_item_name,
    MAX_UPLOAD_BYTES,
};

pub const DEFAULT_BASE_URL: &str = "http://127.0.0.1:43123";
pub const USER_AGENT: &str = "XiayunWindows/0.1";
