use serde_json::{json, Value};

use crate::error::{err, ClientError};
use crate::model::{AuthMaterial, AuthSession, ContentBlob, Item, PublicUser};
use crate::multipart::encode_upload;
use crate::passkey::{parse_authentication_options, parse_registration_options, AuthenticationChallenge, RegistrationChallenge};
use crate::transport::{HttpRequest, RawResponse, Transport};
use crate::validate::{
    ensure_upload_size, is_uuid, normalize_email, normalize_note_body, normalize_note_title,
    normalize_password, normalize_upload_type, sanitize_item_name,
};

pub struct CloudClient<T: Transport> {
    transport: T,
    base_url: String,
    auth: AuthMaterial,
}

impl<T: Transport> CloudClient<T> {
    pub fn new(transport: T, base_url: impl Into<String>, auth: AuthMaterial) -> Self {
        Self {
            transport,
            base_url: base_url.into(),
            auth,
        }
    }

    pub fn auth(&self) -> &AuthMaterial {
        &self.auth
    }

    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    pub async fn register(&mut self, email: &str, password: &str) -> Result<AuthSession, ClientError> {
        let email = normalize_email(email)?;
        let password = normalize_password(password)?;
        let registered = self
            .submit_auth(
                "POST",
                "/api/auth/register",
                json!({ "email": email, "password": password }),
                true,
            )
            .await?;
        if matches!(registered.auth, AuthMaterial::Bearer { .. }) {
            self.auth = registered.auth.clone();
            return Ok(registered);
        }
        match self.login(&email, &password).await {
            Ok(session) => Ok(session),
            Err(_) => {
                self.auth = registered.auth.clone();
                Ok(registered)
            }
        }
    }

    pub async fn login(&mut self, email: &str, password: &str) -> Result<AuthSession, ClientError> {
        let email = normalize_email(email)?;
        let password = normalize_password(password)?;
        let session = self
            .submit_auth(
                "POST",
                "/api/auth/login",
                json!({ "email": email, "password": password, "client": "native" }),
                false,
            )
            .await?;
        self.auth = session.auth.clone();
        let user = self.me().await?;
        Ok(AuthSession {
            user,
            auth: self.auth.clone(),
        })
    }

    pub async fn me(&self) -> Result<PublicUser, ClientError> {
        let response = self.request("GET", "/api/auth/me", &self.auth, None, &[]).await?;
        let value = decode_json(&response)?;
        parse_user(&value)
    }

    pub async fn logout(&self) -> Result<(), ClientError> {
        let response = self
            .request("POST", "/api/auth/logout", &self.auth, None, &[])
            .await?;
        if response.status == 401 || (200..300).contains(&response.status) {
            return Ok(());
        }
        Err(error_from_response(&response))
    }

    pub async fn passkey_options(&self, email: &str) -> Result<AuthenticationChallenge, ClientError> {
        let email = normalize_email(email)?;
        let response = self
            .request(
                "POST",
                "/api/auth/passkey/login/options",
                &AuthMaterial::None,
                Some(json!({ "email": email })),
                &[("Origin", origin_header(&self.base_url))],
            )
            .await?;
        let value = decode_json(&response)?;
        parse_authentication_options(&value, &self.base_url)
    }

    pub async fn passkey_verify(
        &mut self,
        email: &str,
        assertion: &Value,
    ) -> Result<AuthSession, ClientError> {
        let email = normalize_email(email)?;
        let session = self
            .submit_auth(
                "POST",
                "/api/auth/passkey/login/verify",
                json!({ "email": email, "response": assertion, "client": "native" }),
                false,
            )
            .await?;
        self.auth = session.auth.clone();
        let user = self.me().await?;
        Ok(AuthSession {
            user,
            auth: self.auth.clone(),
        })
    }

    pub async fn passkey_register_options(&self) -> Result<RegistrationChallenge, ClientError> {
        let response = self
            .request(
                "POST",
                "/api/auth/passkey/register/options",
                &self.auth,
                None,
                &[("Origin", origin_header(&self.base_url))],
            )
            .await?;
        let value = decode_json(&response)?;
        parse_registration_options(&value, &self.base_url)
    }

    pub async fn passkey_register_verify(&self, response_json: &Value) -> Result<(), ClientError> {
        let response = self
            .request(
                "POST",
                "/api/auth/passkey/register/verify",
                &self.auth,
                Some(response_json.clone()),
                &[("Origin", origin_header(&self.base_url))],
            )
            .await?;
        decode_json(&response)?;
        Ok(())
    }

    pub async fn list_items(&self) -> Result<Vec<Item>, ClientError> {
        let response = self.request("GET", "/api/items", &self.auth, None, &[]).await?;
        let value = decode_json(&response)?;
        let items = value
            .get("items")
            .and_then(Value::as_array)
            .ok_or_else(|| err("伺服器沒有回傳項目清單"))?;
        items.iter().map(parse_item).collect()
    }

    pub async fn get_item(&self, id: &str) -> Result<Item, ClientError> {
        ensure_id(id)?;
        let response = self
            .request("GET", &format!("/api/items/{id}"), &self.auth, None, &[])
            .await?;
        let value = decode_json(&response)?;
        let item = value
            .get("item")
            .ok_or_else(|| err("找不到這個項目"))?;
        parse_item(item)
    }

    pub async fn create_note(&self, title: &str, body: &str) -> Result<Item, ClientError> {
        let title = normalize_note_title(title)?;
        let body = normalize_note_body(body)?;
        let response = self
            .request(
                "POST",
                "/api/items",
                &self.auth,
                Some(json!({ "type": "text", "title": title, "body": body })),
                &[],
            )
            .await?;
        let value = decode_json(&response)?;
        parse_item(value.get("item").ok_or_else(|| err("伺服器沒有回傳筆記"))?)
    }

    pub async fn upload(
        &self,
        file_name: &str,
        mime: &str,
        bytes: &[u8],
        type_hint: Option<&str>,
    ) -> Result<Item, ClientError> {
        ensure_upload_size(bytes.len() as u64)?;
        let name = sanitize_item_name(file_name);
        let mime = crate::validate::normalize_mime(mime);
        let kind = normalize_upload_type(type_hint, &mime)?;
        let multipart = encode_upload(&name, &mime, bytes, &[("name", name.as_str()), ("type", kind.as_str())])?;
        let response = self
            .request_bytes(
                "POST",
                "/api/items",
                &self.auth,
                &multipart.content_type,
                multipart.bytes,
                &[],
            )
            .await?;
        let value = decode_json(&response)?;
        parse_item(value.get("item").ok_or_else(|| err("伺服器沒有回傳檔案"))?)
    }

    pub async fn delete_item(&self, id: &str) -> Result<(), ClientError> {
        ensure_id(id)?;
        let response = self
            .request("DELETE", &format!("/api/items/{id}"), &self.auth, None, &[])
            .await?;
        decode_json(&response)?;
        Ok(())
    }

    pub async fn download(&self, id: &str, attachment: bool) -> Result<ContentBlob, ClientError> {
        ensure_id(id)?;
        let path = if attachment {
            format!("/api/items/{id}/content?disposition=attachment")
        } else {
            format!("/api/items/{id}/content")
        };
        let response = self.request("GET", &path, &self.auth, None, &[]).await?;
        if !(200..300).contains(&response.status) {
            return Err(error_from_response(&response));
        }
        let mime = header_value(&response.headers, "content-type")
            .unwrap_or_else(|| "application/octet-stream".to_string());
        let filename = filename_from_disposition(
            header_value(&response.headers, "content-disposition").as_deref(),
        )
        .unwrap_or_else(|| "下載".to_string());
        Ok(ContentBlob {
            mime,
            bytes: response.body,
            filename,
        })
    }

    async fn submit_auth(
        &self,
        method: &str,
        path: &str,
        body: Value,
        created: bool,
    ) -> Result<AuthSession, ClientError> {
        let response = self
            .request(method, path, &AuthMaterial::None, Some(body), &[])
            .await?;
        let expected = if created { 201 } else { 200 };
        if response.status != expected && !(200..300).contains(&response.status) {
            return Err(error_from_response(&response));
        }
        let value = serde_json::from_slice::<Value>(&response.body)
            .map_err(|_| err("伺服器回應不是 JSON"))?;
        let user = parse_user(&value)?;
        let token = value
            .get("token")
            .and_then(Value::as_str)
            .map(str::to_string);
        let cookie = session_cookie(&response.headers);
        let auth = AuthMaterial::from_login(token, cookie)?;
        Ok(AuthSession { user, auth })
    }

    async fn request(
        &self,
        method: &str,
        path: &str,
        auth: &AuthMaterial,
        json_body: Option<Value>,
        extra: &[(&str, String)],
    ) -> Result<RawResponse, ClientError> {
        let bytes = match &json_body {
            Some(value) => serde_json::to_vec(value).map_err(|_| err("無法建立請求"))?,
            None => Vec::new(),
        };
        let content_type = if json_body.is_some() {
            Some("application/json")
        } else {
            None
        };
        self.request_bytes(method, path, auth, content_type.unwrap_or(""), bytes, extra)
            .await
    }

    async fn request_bytes(
        &self,
        method: &str,
        path: &str,
        auth: &AuthMaterial,
        content_type: &str,
        body: Vec<u8>,
        extra: &[(&str, String)],
    ) -> Result<RawResponse, ClientError> {
        let mut headers = Vec::new();
        apply_auth(&mut headers, auth);
        for (name, value) in extra {
            headers.push(((*name).to_string(), value.clone()));
        }
        if !content_type.is_empty() {
            headers.push(("Content-Type".into(), content_type.to_string()));
        }
        if !body.is_empty() {
            headers.push(("Content-Length".into(), body.len().to_string()));
        }
        self.transport
            .send(HttpRequest {
                method: method.to_string(),
                url: format!("{}{path}", self.base_url.trim_end_matches('/')),
                headers,
                body,
            })
            .await
    }
}

fn origin_header(base_url: &str) -> String {
    base_url.trim_end_matches('/').to_string()
}

fn apply_auth(headers: &mut Vec<(String, String)>, auth: &AuthMaterial) {
    match auth {
        AuthMaterial::None => {}
        AuthMaterial::Bearer { token } => {
            headers.push(("Authorization".into(), format!("Bearer {token}")));
        }
        AuthMaterial::SessionCookie { value } => {
            headers.push(("Cookie".into(), format!("session={value}")));
        }
    }
}

fn decode_json(response: &RawResponse) -> Result<Value, ClientError> {
    if !(200..300).contains(&response.status) {
        return Err(error_from_response(response));
    }
    if response.body.is_empty() {
        return Ok(Value::Null);
    }
    serde_json::from_slice(&response.body).map_err(|_| err("伺服器回應不是 JSON"))
}

fn error_from_response(response: &RawResponse) -> ClientError {
    if let Ok(value) = serde_json::from_slice::<Value>(&response.body) {
        let message = value
            .get("error")
            .and_then(Value::as_str)
            .unwrap_or("請求失敗")
            .to_string();
        let code = value
            .get("code")
            .and_then(Value::as_str)
            .map(str::to_string);
        return ClientError { message, code };
    }
    err(format!("請求失敗（{}）", response.status))
}

fn parse_user(value: &Value) -> Result<PublicUser, ClientError> {
    let user = value.get("user").unwrap_or(value);
    Ok(PublicUser {
        id: user
            .get("id")
            .and_then(Value::as_str)
            .ok_or_else(|| err("伺服器沒有回傳使用者"))?
            .to_string(),
        email: user
            .get("email")
            .and_then(Value::as_str)
            .ok_or_else(|| err("伺服器沒有回傳使用者"))?
            .to_string(),
        created_at: user
            .get("createdAt")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
    })
}

fn parse_item(value: &Value) -> Result<Item, ClientError> {
    Ok(Item {
        id: required_str(value, "id")?,
        owner_id: value
            .get("ownerId")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        kind: required_str(value, "type")?,
        name: required_str(value, "name")?,
        size: value.get("size").and_then(Value::as_u64).unwrap_or(0),
        mime_type: value
            .get("mimeType")
            .and_then(Value::as_str)
            .map(str::to_string),
        created_at: value
            .get("createdAt")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        excerpt: value
            .get("excerpt")
            .and_then(Value::as_str)
            .map(str::to_string),
        body: match value.get("body") {
            Some(Value::String(text)) => Some(text.clone()),
            Some(Value::Null) | None => None,
            _ => None,
        },
    })
}

fn required_str(value: &Value, key: &str) -> Result<String, ClientError> {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| err("伺服器回應缺少欄位"))
}

fn session_cookie(headers: &[(String, String)]) -> Option<String> {
    for (name, value) in headers {
        if !name.eq_ignore_ascii_case("set-cookie") {
            continue;
        }
        for part in value.split(',') {
            let part = part.trim();
            let Some(rest) = part.split(';').next() else {
                continue;
            };
            let Some((key, cookie)) = rest.split_once('=') else {
                continue;
            };
            if key.trim().eq_ignore_ascii_case("session") {
                let cookie = cookie.trim();
                if !cookie.is_empty() {
                    return Some(cookie.to_string());
                }
            }
        }
    }
    None
}

fn header_value(headers: &[(String, String)], name: &str) -> Option<String> {
    headers
        .iter()
        .find(|(key, _)| key.eq_ignore_ascii_case(name))
        .map(|(_, value)| value.clone())
}

fn filename_from_disposition(value: Option<&str>) -> Option<String> {
    let value = value?;
    if let Some(index) = value.find("filename*=UTF-8''") {
        let encoded = &value[index + "filename*=UTF-8''".len()..];
        let encoded = encoded.split(';').next().unwrap_or(encoded);
        return urlencoding_decode(encoded).filter(|text| !text.is_empty());
    }
    None
}

fn urlencoding_decode(value: &str) -> Option<String> {
    let mut out = Vec::new();
    let bytes = value.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        match bytes[index] {
            b'%' if index + 2 < bytes.len() => {
                let hex = std::str::from_utf8(&bytes[index + 1..index + 3]).ok()?;
                out.push(u8::from_str_radix(hex, 16).ok()?);
                index += 3;
            }
            byte => {
                out.push(byte);
                index += 1;
            }
        }
    }
    String::from_utf8(out).ok()
}

fn ensure_id(id: &str) -> Result<(), ClientError> {
    if is_uuid(id) {
        Ok(())
    } else {
        Err(err("找不到這個項目"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::VecDeque;
    use std::sync::Mutex;

    struct Script {
        requests: Mutex<Vec<HttpRequest>>,
        responses: Mutex<VecDeque<RawResponse>>,
    }

    impl Script {
        fn new(responses: Vec<RawResponse>) -> Self {
            Self {
                requests: Mutex::new(Vec::new()),
                responses: Mutex::new(responses.into()),
            }
        }
    }

    impl Transport for Script {
        async fn send(&self, request: HttpRequest) -> Result<RawResponse, ClientError> {
            self.requests.lock().unwrap().push(request);
            self.responses
                .lock()
                .unwrap()
                .pop_front()
                .ok_or_else(|| err("測試沒有下一個回應"))
        }
    }

    fn json_response(status: u16, value: Value, extra: &[(&str, &str)]) -> RawResponse {
        let mut headers = vec![("content-type".into(), "application/json".into())];
        for (name, header) in extra {
            headers.push(((*name).to_string(), (*header).to_string()));
        }
        RawResponse {
            status,
            headers,
            body: serde_json::to_vec(&value).unwrap(),
        }
    }

    fn user_json() -> Value {
        json!({
            "id": "11111111-1111-4111-8111-111111111111",
            "email": "a@b.co",
            "createdAt": "2026-01-01T00:00:00.000Z"
        })
    }

    #[tokio::test]
    async fn login_prefers_bearer_and_sends_it_next() {
        let script = Script::new(vec![
            json_response(
                200,
                json!({ "user": user_json(), "token": "tok-1" }),
                &[("set-cookie", "session=cookie-1; HttpOnly; Path=/")],
            ),
            json_response(200, json!({ "user": user_json() }), &[]),
            json_response(200, json!({ "items": [] }), &[]),
        ]);
        let mut client = CloudClient::new(script, "http://127.0.0.1:43123", AuthMaterial::None);
        let session = client.login("A@B.co", "password1").await.unwrap();
        assert!(matches!(session.auth, AuthMaterial::Bearer { .. }));
        client.list_items().await.unwrap();
        let requests = client.transport.requests.lock().unwrap().clone();
        let login = &requests[0];
        let login_body: Value = serde_json::from_slice(&login.body).unwrap();
        assert_eq!(login_body["client"], "native");
        assert_eq!(login_body["email"], "a@b.co");
        assert!(header(&login.headers, "authorization").is_none());
        assert_eq!(
            header(&requests[2].headers, "authorization").as_deref(),
            Some("Bearer tok-1")
        );
        assert!(header(&requests[2].headers, "cookie").is_none());
    }

    #[tokio::test]
    async fn login_without_token_uses_session_cookie() {
        let script = Script::new(vec![
            json_response(
                200,
                json!({ "user": user_json() }),
                &[("set-cookie", "session=cookie-2; HttpOnly")],
            ),
            json_response(200, json!({ "user": user_json() }), &[]),
        ]);
        let mut client = CloudClient::new(script, "http://127.0.0.1:43123/", AuthMaterial::None);
        client.login("a@b.co", "password1").await.unwrap();
        let requests = client.transport.requests.lock().unwrap().clone();
        assert_eq!(
            header(&requests[1].headers, "cookie").as_deref(),
            Some("session=cookie-2")
        );
        assert!(header(&requests[1].headers, "authorization").is_none());
    }

    #[tokio::test]
    async fn register_body_has_no_client_and_falls_back_to_cookie() {
        let script = Script::new(vec![
            json_response(
                201,
                json!({ "user": user_json() }),
                &[("set-cookie", "session=reg-cookie; HttpOnly")],
            ),
            json_response(401, json!({ "error": "電子郵件或密碼不正確", "code": "INVALID_CREDENTIALS" }), &[]),
        ]);
        let mut client = CloudClient::new(script, "http://127.0.0.1:43123", AuthMaterial::None);
        let session = client.register("a@b.co", "password1").await.unwrap();
        assert!(matches!(session.auth, AuthMaterial::SessionCookie { .. }));
        let requests = client.transport.requests.lock().unwrap().clone();
        let body: Value = serde_json::from_slice(&requests[0].body).unwrap();
        assert!(body.get("client").is_none());
        assert_eq!(requests[0].url, "http://127.0.0.1:43123/api/auth/register");
    }

    #[tokio::test]
    async fn passkey_verify_sends_native_client_and_origin() {
        let assertion = json!({
            "id": "abc",
            "rawId": "abc",
            "type": "public-key",
            "response": { "clientDataJSON": "e30", "authenticatorData": "e30", "signature": "e30" },
            "clientExtensionResults": {}
        });
        let script = Script::new(vec![
            json_response(
                200,
                json!({
                    "challenge": "abc",
                    "rpId": "localhost",
                    "allowCredentials": [],
                    "userVerification": "preferred"
                }),
                &[],
            ),
            json_response(
                200,
                json!({ "user": user_json(), "token": "pk-token" }),
                &[],
            ),
            json_response(200, json!({ "user": user_json() }), &[]),
        ]);
        let mut client = CloudClient::new(script, "http://localhost:43123", AuthMaterial::None);
        let options = client.passkey_options("a@b.co").await.unwrap();
        assert_eq!(options.rp_id, "localhost");
        let session = client.passkey_verify("a@b.co", &assertion).await.unwrap();
        assert_eq!(session.auth.method_name(), "bearer");
        let requests = client.transport.requests.lock().unwrap().clone();
        let options_body: Value = serde_json::from_slice(&requests[0].body).unwrap();
        assert_eq!(options_body["email"], "a@b.co");
        assert_eq!(
            header(&requests[0].headers, "origin").as_deref(),
            Some("http://localhost:43123")
        );
        let verify_body: Value = serde_json::from_slice(&requests[1].body).unwrap();
        assert_eq!(verify_body["client"], "native");
        assert_eq!(verify_body["response"]["id"], "abc");
        assert!(header(&requests[1].headers, "content-length").is_some());
    }

    #[tokio::test]
    async fn upload_rejects_oversize_without_a_request_and_sends_multipart() {
        let script = Script::new(vec![]);
        let client = CloudClient::new(script, "http://127.0.0.1:43123", AuthMaterial::Bearer { token: "t".into() });
        let big = vec![0u8; (32 * 1024 * 1024) + 1];
        let error = client.upload("a.bin", "application/octet-stream", &big, None).await.unwrap_err();
        assert!(error.message.contains("32 MB"));
        assert!(client.transport.requests.lock().unwrap().is_empty());

        let script = Script::new(vec![json_response(
            201,
            json!({
                "item": {
                    "id": "11111111-1111-4111-8111-111111111111",
                    "ownerId": "11111111-1111-4111-8111-111111111111",
                    "type": "image",
                    "name": "a.png",
                    "size": 3,
                    "mimeType": "image/png",
                    "createdAt": "2026-01-01T00:00:00.000Z",
                    "excerpt": null,
                    "body": null
                }
            }),
            &[],
        )]);
        let client = CloudClient::new(script, "http://127.0.0.1:43123", AuthMaterial::Bearer { token: "t".into() });
        let item = client.upload("a.png", "image/png", b"png", Some("image")).await.unwrap();
        assert_eq!(item.kind, "image");
        let request = client.transport.requests.lock().unwrap()[0].clone();
        assert_eq!(
            header(&request.headers, "content-length").unwrap(),
            request.body.len().to_string()
        );
        assert!(header(&request.headers, "content-type")
            .unwrap()
            .starts_with("multipart/form-data"));
        assert!(header(&request.headers, "authorization").unwrap() == "Bearer t");
        assert!(request.body.windows(3).any(|window| window == b"png"));
    }

    #[tokio::test]
    async fn note_and_api_error_use_server_message() {
        let script = Script::new(vec![
            json_response(400, json!({ "error": "請填寫筆記標題", "code": "VALIDATION" }), &[]),
        ]);
        let client = CloudClient::new(script, "http://127.0.0.1:43123", AuthMaterial::Bearer { token: "t".into() });
        let error = client.create_note("   ", "").await.unwrap_err();
        assert!(error.message.contains("標題"));
        assert!(client.transport.requests.lock().unwrap().is_empty());

        let script = Script::new(vec![json_response(
            401,
            json!({ "error": "尚未登入", "code": "UNAUTHENTICATED" }),
            &[],
        )]);
        let client = CloudClient::new(script, "http://127.0.0.1:43123", AuthMaterial::None);
        let error = client.list_items().await.unwrap_err();
        assert_eq!(error.code.as_deref(), Some("UNAUTHENTICATED"));
        assert_eq!(error.message, "尚未登入");
    }

    fn header(headers: &[(String, String)], name: &str) -> Option<String> {
        headers
            .iter()
            .find(|(key, _)| key.eq_ignore_ascii_case(name))
            .map(|(_, value)| value.clone())
    }
}
