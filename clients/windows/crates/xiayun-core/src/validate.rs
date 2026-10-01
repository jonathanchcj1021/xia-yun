use crate::error::{err, ClientError};

pub const MAX_UPLOAD_BYTES: u64 = 32 * 1024 * 1024;
pub const MAX_EMAIL_LENGTH: usize = 254;
pub const MIN_PASSWORD_LENGTH: usize = 8;
pub const MAX_PASSWORD_LENGTH: usize = 128;
pub const MAX_NOTE_TITLE: usize = 200;
pub const MAX_NOTE_BODY: usize = 100_000;
pub const MAX_ITEM_NAME: usize = 255;

const RASTER_MIME: &[&str] = &[
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/avif",
    "image/bmp",
];

pub fn normalize_email(value: &str) -> Result<String, ClientError> {
    let email = value.trim().to_lowercase();
    if email.is_empty() || email.len() > MAX_EMAIL_LENGTH || !email_ok(&email) {
        return Err(err("請輸入有效的電子郵件"));
    }
    Ok(email)
}

fn email_ok(email: &str) -> bool {
    let mut parts = email.split('@');
    let Some(local) = parts.next() else {
        return false;
    };
    let Some(domain) = parts.next() else {
        return false;
    };
    if parts.next().is_some() || local.is_empty() || domain.is_empty() {
        return false;
    }
    if local.chars().any(char::is_whitespace) || domain.chars().any(char::is_whitespace) {
        return false;
    }
    domain.contains('.') && !domain.starts_with('.') && !domain.ends_with('.')
}

pub fn normalize_password(value: &str) -> Result<String, ClientError> {
    if value.is_empty() {
        return Err(err("請輸入密碼"));
    }
    if value.len() < MIN_PASSWORD_LENGTH {
        return Err(err("密碼至少需要 8 個字元"));
    }
    if value.len() > MAX_PASSWORD_LENGTH {
        return Err(err("密碼最長 128 個字元"));
    }
    Ok(value.to_string())
}

pub fn normalize_note_title(value: &str) -> Result<String, ClientError> {
    let title = value.trim();
    if title.is_empty() {
        return Err(err("請填寫筆記標題"));
    }
    if title.chars().count() > MAX_NOTE_TITLE {
        return Err(err("筆記標題最長 200 個字元"));
    }
    Ok(title.to_string())
}

pub fn normalize_note_body(value: &str) -> Result<String, ClientError> {
    if value.chars().count() > MAX_NOTE_BODY {
        return Err(err("筆記內文最長 10 萬個字元"));
    }
    Ok(value.to_string())
}

pub fn sanitize_item_name(value: &str) -> String {
    let base = value.rsplit(['/', '\\']).next().unwrap_or(value);
    let cleaned: String = base
        .chars()
        .filter(|ch| !ch.is_control())
        .collect::<String>()
        .trim()
        .chars()
        .take(MAX_ITEM_NAME)
        .collect();
    if cleaned.is_empty() {
        "未命名檔案".to_string()
    } else {
        cleaned
    }
}

pub fn is_raster_mime(mime: &str) -> bool {
    RASTER_MIME.contains(&normalize_mime(mime).as_str())
}

pub fn normalize_mime(value: &str) -> String {
    let base = value
        .split(';')
        .next()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();
    match base.as_str() {
        "image/jpg" | "image/pjpeg" => "image/jpeg".to_string(),
        "image/x-png" => "image/png".to_string(),
        "" => "application/octet-stream".to_string(),
        _ => base,
    }
}

pub fn mime_from_name(name: &str) -> String {
    let lower = name.rsplit('.').next().unwrap_or("").to_ascii_lowercase();
    let mime = match lower.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "avif" => "image/avif",
        "bmp" => "image/bmp",
        "txt" | "md" => "text/plain",
        "json" => "application/json",
        "pdf" => "application/pdf",
        _ => "application/octet-stream",
    };
    mime.to_string()
}

pub fn normalize_upload_type(hint: Option<&str>, mime: &str) -> Result<String, ClientError> {
    match hint.map(str::trim).filter(|value| !value.is_empty()) {
        None => Ok(if is_raster_mime(mime) {
            "image".to_string()
        } else {
            "file".to_string()
        }),
        Some("file") => Ok("file".to_string()),
        Some("image") => {
            if is_raster_mime(mime) {
                Ok("image".to_string())
            } else {
                Err(err("這個檔案不是可預覽的點陣圖片"))
            }
        }
        Some(_) => Err(err("type 只能是 file 或 image")),
    }
}

pub fn ensure_upload_size(size: u64) -> Result<(), ClientError> {
    if size > MAX_UPLOAD_BYTES {
        Err(err("檔案超過 32 MB 上限"))
    } else {
        Ok(())
    }
}

pub fn is_uuid(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() != 36 {
        return false;
    }
    let groups = [8, 4, 4, 4, 12];
    let mut index = 0;
    for (group_index, group) in groups.iter().enumerate() {
        if group_index > 0 {
            if bytes.get(index) != Some(&b'-') {
                return false;
            }
            index += 1;
        }
        for _ in 0..*group {
            let Some(byte) = bytes.get(index) else {
                return false;
            };
            if !byte.is_ascii_hexdigit() {
                return false;
            }
            index += 1;
        }
    }
    if index != 36 {
        return false;
    }
    // RFC 9562 版本與變體。伺服器只接受這個範圍。
    let version = bytes[14];
    let variant = bytes[19];
    (b'1'..=b'8').contains(&version)
        && matches!(variant, b'8' | b'9' | b'a' | b'b' | b'A' | b'B')
}

pub fn normalize_base_url(value: &str) -> Result<String, ClientError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(err("請輸入伺服器位址"));
    }
    let url = reqwest::Url::parse(trimmed).map_err(|_| err("伺服器位址格式不正確"))?;
    if url.scheme() != "http" && url.scheme() != "https" {
        return Err(err("伺服器位址只接受 http 或 https"));
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err(err("伺服器位址不能包含帳號或密碼"));
    }
    if url.host_str().is_none() {
        return Err(err("伺服器位址格式不正確"));
    }
    if url.path() != "/" && url.path() != "" {
        return Err(err("伺服器位址不要包含路徑"));
    }
    if url.query().is_some() || url.fragment().is_some() {
        return Err(err("伺服器位址不要包含查詢參數"));
    }
    let host = url.host_str().unwrap();
    let port = url.port();
    let origin = match (url.scheme(), port) {
        ("http", None) | ("http", Some(80)) => format!("http://{host}"),
        ("https", None) | ("https", Some(443)) => format!("https://{host}"),
        (_, Some(port)) => format!("{}://{host}:{port}", url.scheme()),
        _ => format!("{}://{host}", url.scheme()),
    };
    Ok(origin)
}

pub fn origin_of(base_url: &str) -> String {
    base_url.trim_end_matches('/').to_string()
}

pub fn rp_id_of(base_url: &str) -> Result<String, ClientError> {
    let url = reqwest::Url::parse(base_url).map_err(|_| err("伺服器位址格式不正確"))?;
    let host = url.host_str().ok_or_else(|| err("伺服器位址格式不正確"))?;
    Ok(host.to_string())
}

pub fn ensure_passkey_host(rp_id: &str) -> Result<(), ClientError> {
    if rp_id.parse::<std::net::IpAddr>().is_ok() {
        return Err(err(
            "通行密鑰的主機名稱不能是 IP 位址。請把伺服器改成 http://localhost:43123 後再試。",
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn email_and_password_rules_match_the_server() {
        assert!(normalize_email("  A@B.Co ").unwrap() == "a@b.co");
        assert!(normalize_email("nope").is_err());
        assert!(normalize_password("short").is_err());
        assert!(normalize_password("long-enough").is_ok());
        assert!(normalize_password(&"x".repeat(129)).is_err());
    }

    #[test]
    fn base_url_strips_trailing_slash_and_rejects_paths() {
        assert_eq!(
            normalize_base_url("http://127.0.0.1:43123/").unwrap(),
            "http://127.0.0.1:43123"
        );
        assert!(normalize_base_url("http://127.0.0.1:43123/api").is_err());
        assert!(normalize_base_url("ftp://127.0.0.1").is_err());
        assert!(ensure_passkey_host("127.0.0.1").is_err());
        assert!(ensure_passkey_host("localhost").is_ok());
    }

    #[test]
    fn upload_type_follows_raster_hint() {
        assert_eq!(
            normalize_upload_type(None, "image/jpeg").unwrap(),
            "image"
        );
        assert_eq!(
            normalize_upload_type(Some("file"), "image/png").unwrap(),
            "file"
        );
        assert!(normalize_upload_type(Some("image"), "text/plain").is_err());
        assert!(ensure_upload_size(MAX_UPLOAD_BYTES).is_ok());
        assert!(ensure_upload_size(MAX_UPLOAD_BYTES + 1).is_err());
    }
}
