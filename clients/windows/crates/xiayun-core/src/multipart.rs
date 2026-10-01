use crate::error::{err, ClientError};

pub struct MultipartBody {
    pub content_type: String,
    pub bytes: Vec<u8>,
}

pub fn encode_upload(
    file_name: &str,
    mime: &str,
    bytes: &[u8],
    fields: &[(&str, &str)],
) -> Result<MultipartBody, ClientError> {
    let mut boundary = format!("XiayunBoundary{:016x}", rand_tag());
    let mut attempts = 0;
    while payload_contains(bytes, fields, &boundary) {
        attempts += 1;
        if attempts > 4 {
            return Err(err("無法建立上傳內容"));
        }
        boundary = format!("XiayunBoundary{:016x}{attempts}", rand_tag());
    }

    let mut body = Vec::new();
    for (name, value) in fields {
        push_text(&mut body, &boundary, name, value);
    }
    push_file(&mut body, &boundary, file_name, mime, bytes);
    body.extend_from_slice(format!("--{boundary}--\r\n").as_bytes());

    Ok(MultipartBody {
        content_type: format!("multipart/form-data; boundary={boundary}"),
        bytes: body,
    })
}

fn payload_contains(bytes: &[u8], fields: &[(&str, &str)], boundary: &str) -> bool {
    let needle = boundary.as_bytes();
    if find_slice(bytes, needle) {
        return true;
    }
    fields
        .iter()
        .any(|(_, value)| find_slice(value.as_bytes(), needle))
}

fn find_slice(haystack: &[u8], needle: &[u8]) -> bool {
    haystack.windows(needle.len()).any(|window| window == needle)
}

fn push_text(body: &mut Vec<u8>, boundary: &str, name: &str, value: &str) {
    body.extend_from_slice(
        format!(
            "--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n"
        )
        .as_bytes(),
    );
}

fn push_file(body: &mut Vec<u8>, boundary: &str, file_name: &str, mime: &str, bytes: &[u8]) {
    let safe_name = file_name.replace(['"', '\r', '\n', '\\'], "_");
    body.extend_from_slice(
        format!(
            "--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{safe_name}\"\r\nContent-Type: {mime}\r\n\r\n"
        )
        .as_bytes(),
    );
    body.extend_from_slice(bytes);
    body.extend_from_slice(b"\r\n");
}

fn rand_tag() -> u64 {
    let mut bytes = [0u8; 8];
    rand::RngCore::fill_bytes(&mut rand::thread_rng(), &mut bytes);
    u64::from_le_bytes(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn multipart_contains_fields_file_and_has_known_length() {
        let body = encode_upload(
            "照片.png",
            "image/png",
            b"png-bytes",
            &[("name", "照片.png"), ("type", "image")],
        )
        .unwrap();
        let text = String::from_utf8_lossy(&body.bytes);
        assert!(body.content_type.starts_with("multipart/form-data; boundary="));
        assert!(text.contains("name=\"file\""));
        assert!(text.contains("filename=\"照片.png\""));
        assert!(text.contains("name=\"name\""));
        assert!(text.contains("name=\"type\""));
        assert!(text.contains("image"));
        assert!(body.bytes.windows(b"png-bytes".len()).any(|w| w == b"png-bytes"));
        assert!(body.bytes.len() < 32 * 1024 * 1024 + 1024 * 1024);
    }
}
