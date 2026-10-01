use serde_json::{json, Value};

use crate::error::{err, ClientError};
use crate::validate::{ensure_passkey_host, origin_of, rp_id_of};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuthenticationChallenge {
    pub challenge: String,
    pub rp_id: String,
    pub origin: String,
    pub timeout_ms: u32,
    pub user_verification: String,
    pub allow_credentials: Vec<CredentialDescriptor>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CredentialDescriptor {
    pub id: Vec<u8>,
    pub transports: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RegistrationChallenge {
    pub challenge: String,
    pub rp_id: String,
    pub rp_name: String,
    pub origin: String,
    pub user_id: Vec<u8>,
    pub user_name: String,
    pub user_display_name: String,
    pub timeout_ms: u32,
    pub user_verification: String,
    pub algorithms: Vec<i32>,
    pub exclude: Vec<CredentialDescriptor>,
}

pub fn parse_authentication_options(
    value: &Value,
    base_url: &str,
) -> Result<AuthenticationChallenge, ClientError> {
    let public_key = public_key_options(value)?;
    let challenge = required_string(public_key, "challenge", "通行密鑰挑戰不完整")?;
    let rp_id = public_key
        .get("rpId")
        .and_then(Value::as_str)
        .map(str::to_string)
        .unwrap_or(rp_id_of(base_url)?);
    ensure_passkey_host(&rp_id)?;
    Ok(AuthenticationChallenge {
        challenge,
        rp_id,
        origin: origin_of(base_url),
        timeout_ms: timeout_of(public_key),
        user_verification: user_verification_of(public_key),
        allow_credentials: credentials_of(public_key, "allowCredentials")?,
    })
}

pub fn parse_registration_options(
    value: &Value,
    base_url: &str,
) -> Result<RegistrationChallenge, ClientError> {
    let public_key = public_key_options(value)?;
    let challenge = required_string(public_key, "challenge", "通行密鑰挑戰不完整")?;
    let rp = public_key.get("rp").and_then(Value::as_object);
    let rp_id = rp
        .and_then(|rp| rp.get("id"))
        .and_then(Value::as_str)
        .map(str::to_string)
        .unwrap_or(rp_id_of(base_url)?);
    ensure_passkey_host(&rp_id)?;
    let rp_name = rp
        .and_then(|rp| rp.get("name"))
        .and_then(Value::as_str)
        .unwrap_or("匣雲")
        .to_string();
    let user = public_key
        .get("user")
        .and_then(Value::as_object)
        .ok_or_else(|| err("通行密鑰註冊資料不完整"))?;
    let user_id = user
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| err("通行密鑰註冊資料不完整"))?;
    let user_id = base64url_decode(user_id)?;
    let user_name = user
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let user_display_name = user
        .get("displayName")
        .and_then(Value::as_str)
        .unwrap_or(&user_name)
        .to_string();
    let algorithms = public_key
        .get("pubKeyCredParams")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.get("alg").and_then(Value::as_i64))
                .map(|alg| alg as i32)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let algorithms = if algorithms.is_empty() {
        vec![-7, -257]
    } else {
        algorithms
    };
    let user_verification = public_key
        .get("authenticatorSelection")
        .and_then(|selection| selection.get("userVerification"))
        .and_then(Value::as_str)
        .unwrap_or("preferred")
        .to_string();
    Ok(RegistrationChallenge {
        challenge,
        rp_id,
        rp_name,
        origin: origin_of(base_url),
        user_id,
        user_name,
        user_display_name,
        timeout_ms: timeout_of(public_key),
        user_verification,
        algorithms,
        exclude: credentials_of(public_key, "excludeCredentials")?,
    })
}

pub fn client_data_json(kind: &str, challenge: &str, origin: &str) -> Vec<u8> {
    serde_json::to_vec(&json!({
        "type": kind,
        "challenge": challenge,
        "origin": origin,
        "crossOrigin": false,
    }))
    .expect("clientDataJSON")
}

pub fn authentication_response_json(
    credential_id: &[u8],
    client_data: &[u8],
    authenticator_data: &[u8],
    signature: &[u8],
    user_handle: Option<&[u8]>,
) -> Value {
    let id = base64url_encode(credential_id);
    let mut response = json!({
        "clientDataJSON": base64url_encode(client_data),
        "authenticatorData": base64url_encode(authenticator_data),
        "signature": base64url_encode(signature),
    });
    if let Some(handle) = user_handle.filter(|handle| !handle.is_empty()) {
        response["userHandle"] = json!(base64url_encode(handle));
    }
    json!({
        "id": id,
        "rawId": id,
        "type": "public-key",
        "authenticatorAttachment": "platform",
        "clientExtensionResults": {},
        "response": response,
    })
}

pub fn registration_response_json(
    credential_id: &[u8],
    client_data: &[u8],
    attestation_object: &[u8],
) -> Value {
    let id = base64url_encode(credential_id);
    json!({
        "id": id,
        "rawId": id,
        "type": "public-key",
        "authenticatorAttachment": "platform",
        "clientExtensionResults": {},
        "response": {
            "clientDataJSON": base64url_encode(client_data),
            "attestationObject": base64url_encode(attestation_object),
            "transports": ["internal"],
        },
    })
}

pub fn base64url_encode(bytes: &[u8]) -> String {
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;
    use base64::Engine;
    URL_SAFE_NO_PAD.encode(bytes)
}

pub fn base64url_decode(value: &str) -> Result<Vec<u8>, ClientError> {
    use base64::engine::general_purpose::{URL_SAFE, URL_SAFE_NO_PAD};
    use base64::Engine;
    URL_SAFE_NO_PAD
        .decode(value)
        .or_else(|_| URL_SAFE.decode(value))
        .map_err(|_| err("通行密鑰資料不是有效的 base64url"))
}

fn public_key_options(value: &Value) -> Result<&Value, ClientError> {
    let object = value
        .as_object()
        .ok_or_else(|| err("通行密鑰選項格式不正確"))?;
    if let Some(options) = object.get("options") {
        return public_key_options(options);
    }
    if let Some(public_key) = object.get("publicKey") {
        return Ok(public_key);
    }
    if object.contains_key("challenge") {
        return Ok(value);
    }
    Err(err("通行密鑰選項格式不正確"))
}

fn required_string(value: &Value, key: &str, message: &str) -> Result<String, ClientError> {
    value
        .get(key)
        .and_then(Value::as_str)
        .filter(|text| !text.is_empty())
        .map(str::to_string)
        .ok_or_else(|| err(message))
}

fn timeout_of(value: &Value) -> u32 {
    value
        .get("timeout")
        .and_then(Value::as_u64)
        .map(|timeout| timeout.min(u32::MAX as u64) as u32)
        .filter(|timeout| *timeout > 0)
        .unwrap_or(60_000)
}

fn user_verification_of(value: &Value) -> String {
    value
        .get("userVerification")
        .and_then(Value::as_str)
        .unwrap_or("preferred")
        .to_string()
}

fn credentials_of(value: &Value, key: &str) -> Result<Vec<CredentialDescriptor>, ClientError> {
    let Some(items) = value.get(key).and_then(Value::as_array) else {
        return Ok(Vec::new());
    };
    let mut credentials = Vec::new();
    for item in items {
        let Some(id) = item.get("id").and_then(Value::as_str) else {
            continue;
        };
        let transports = item
            .get("transports")
            .and_then(Value::as_array)
            .map(|list| {
                list.iter()
                    .filter_map(Value::as_str)
                    .map(str::to_string)
                    .collect()
            })
            .unwrap_or_default();
        credentials.push(CredentialDescriptor {
            id: base64url_decode(id)?,
            transports,
        });
    }
    Ok(credentials)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_simplewebauthn_authentication_options() {
        let value = json!({
            "challenge": "abc",
            "timeout": 60000,
            "rpId": "localhost",
            "allowCredentials": [{
                "id": "AQID",
                "type": "public-key",
                "transports": ["internal"]
            }],
            "userVerification": "preferred"
        });
        let parsed = parse_authentication_options(&value, "http://localhost:43123").unwrap();
        assert_eq!(parsed.rp_id, "localhost");
        assert_eq!(parsed.origin, "http://localhost:43123");
        assert_eq!(parsed.allow_credentials[0].id, vec![1, 2, 3]);
        assert_eq!(parsed.allow_credentials[0].transports, vec!["internal"]);
    }

    #[test]
    fn parses_wrapped_and_registration_options() {
        let value = json!({
            "publicKey": {
                "challenge": "abc",
                "rp": { "id": "localhost", "name": "匣雲" },
                "user": { "id": "AQID", "name": "a@b.co", "displayName": "a@b.co" },
                "pubKeyCredParams": [{ "type": "public-key", "alg": -7 }],
                "authenticatorSelection": { "userVerification": "required" }
            }
        });
        let parsed = parse_registration_options(&value, "http://127.0.0.1:43123").unwrap();
        assert_eq!(parsed.user_id, vec![1, 2, 3]);
        assert_eq!(parsed.algorithms, vec![-7]);
        assert_eq!(parsed.user_verification, "required");
        assert_eq!(parsed.origin, "http://127.0.0.1:43123");
    }

    #[test]
    fn assertion_json_is_base64url_without_padding() {
        let value = authentication_response_json(b"id", b"{\"type\":\"webauthn.get\"}", b"auth", b"sig", None);
        assert_eq!(value["type"], "public-key");
        assert_eq!(value["id"], value["rawId"]);
        assert!(value["response"].get("userHandle").is_none());
        assert!(!value["response"]["signature"].as_str().unwrap().contains('='));
        let created = client_data_json("webauthn.get", "abc", "http://localhost:43123");
        let parsed: Value = serde_json::from_slice(&created).unwrap();
        assert_eq!(parsed["origin"], "http://localhost:43123");
        assert_eq!(parsed["challenge"], "abc");
    }
}
