//! Windows Hello：本機解鎖用 UserConsentVerifier，通行密鑰用 WebAuthn API。
//! 這段程式在 Linux 建置機上不會執行，因此尚未在實機上測試提示視窗。

use std::mem::MaybeUninit;

use serde_json::Value;
use windows::core::{w, HSTRING, PCWSTR};
use windows::Win32::Foundation::{HWND, LocalFree, HLOCAL};
use windows::core::BOOL;
use windows::Win32::Networking::WindowsWebServices::{
    WebAuthNAuthenticatorGetAssertion, WebAuthNAuthenticatorMakeCredential, WebAuthNFreeAssertion,
    WebAuthNFreeCredentialAttestation, WebAuthNIsUserVerifyingPlatformAuthenticatorAvailable,
    WEBAUTHN_ASSERTION, WEBAUTHN_ATTESTATION_CONVEYANCE_PREFERENCE_NONE,
    WEBAUTHN_AUTHENTICATOR_ATTACHMENT_PLATFORM,
    WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS,
    WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS_CURRENT_VERSION,
    WEBAUTHN_AUTHENTICATOR_MAKE_CREDENTIAL_OPTIONS,
    WEBAUTHN_AUTHENTICATOR_MAKE_CREDENTIAL_OPTIONS_CURRENT_VERSION, WEBAUTHN_CLIENT_DATA,
    WEBAUTHN_CLIENT_DATA_CURRENT_VERSION, WEBAUTHN_COSE_CREDENTIAL_PARAMETER,
    WEBAUTHN_COSE_CREDENTIAL_PARAMETERS, WEBAUTHN_CREDENTIALS, WEBAUTHN_CREDENTIAL_ATTESTATION,
    WEBAUTHN_CREDENTIAL_EX, WEBAUTHN_CREDENTIAL_EX_CURRENT_VERSION, WEBAUTHN_CREDENTIAL_LIST,
    WEBAUTHN_CTAP_TRANSPORT_BLE, WEBAUTHN_CTAP_TRANSPORT_INTERNAL, WEBAUTHN_CTAP_TRANSPORT_NFC,
    WEBAUTHN_CTAP_TRANSPORT_USB, WEBAUTHN_EXTENSIONS, WEBAUTHN_HASH_ALGORITHM_SHA_256,
    WEBAUTHN_RP_ENTITY_INFORMATION, WEBAUTHN_RP_ENTITY_INFORMATION_CURRENT_VERSION,
    WEBAUTHN_USER_ENTITY_INFORMATION, WEBAUTHN_USER_ENTITY_INFORMATION_CURRENT_VERSION,
    WEBAUTHN_USER_VERIFICATION_REQUIREMENT_DISCOURAGED,
    WEBAUTHN_USER_VERIFICATION_REQUIREMENT_PREFERRED,
    WEBAUTHN_USER_VERIFICATION_REQUIREMENT_REQUIRED,
};
use windows::Win32::Security::Cryptography::{
    CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
};
use windows::Security::Credentials::UI::{
    UserConsentVerificationResult, UserConsentVerifier, UserConsentVerifierAvailability,
};

use crate::error::{err, ClientError};
use crate::passkey::{
    authentication_response_json, client_data_json, registration_response_json,
    AuthenticationChallenge, CredentialDescriptor, RegistrationChallenge,
};

use super::HelloStatus;

const CREDENTIAL_TYPE: PCWSTR = w!("public-key");

pub fn hello_status() -> HelloStatus {
    match platform_available() {
        Ok(true) => HelloStatus {
            available: true,
            reason: String::new(),
        },
        Ok(false) => HelloStatus {
            available: false,
            reason: "這台 Windows 沒有可用的 Windows Hello。請先到系統設定開啟 PIN、指紋或臉部辨識。"
                .into(),
        },
        Err(error) => HelloStatus {
            available: false,
            reason: error.message,
        },
    }
}

pub fn verify_user(message: &str) -> Result<(), ClientError> {
    let availability = UserConsentVerifier::CheckAvailabilityAsync()
        .map_err(|error| err(format!("無法詢問 Windows Hello：{error}")))?
        .get()
        .map_err(|error| err(format!("無法詢問 Windows Hello：{error}")))?;
    if availability != UserConsentVerifierAvailability::Available {
        return Err(err(availability_message(availability)));
    }
    let prompt = HSTRING::from(message);
    let result = UserConsentVerifier::RequestVerificationAsync(&prompt)
        .map_err(|error| err(format!("Windows Hello 沒有完成：{error}")))?
        .get()
        .map_err(|error| err(format!("Windows Hello 沒有完成：{error}")))?;
    if result == UserConsentVerificationResult::Verified {
        Ok(())
    } else {
        Err(err(verification_message(result)))
    }
}

pub fn sign_assertion(
    parent_hwnd: isize,
    challenge: &AuthenticationChallenge,
) -> Result<Value, ClientError> {
    let mut client_json = client_data_json("webauthn.get", &challenge.challenge, &challenge.origin);
    let mut allow = CredentialList::new(&challenge.allow_credentials)?;
    allow.prepare();
    let rp_id = HSTRING::from(&challenge.rp_id);
    let client_data = client_data(&mut client_json);
    let mut options = WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS::default();
    options.dwVersion = WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS_CURRENT_VERSION;
    options.dwTimeoutMilliseconds = challenge.timeout_ms;
    options.CredentialList = empty_legacy_list();
    options.Extensions = empty_extensions();
    options.dwAuthenticatorAttachment = WEBAUTHN_AUTHENTICATOR_ATTACHMENT_PLATFORM;
    options.dwUserVerificationRequirement = uv_native(&challenge.user_verification);
    options.pwszU2fAppId = PCWSTR::null();
    options.pAllowCredentialList = allow.as_ptr();
    let assertion = unsafe {
        WebAuthNAuthenticatorGetAssertion(
            hwnd(parent_hwnd),
            &rp_id,
            &client_data,
            Some(&options),
        )
        .map_err(|error| err(format!("Windows Hello 沒有完成通行密鑰登入：{error}")))?
    };
    let value = unsafe { assertion_json(assertion, &client_json) };
    unsafe { WebAuthNFreeAssertion(assertion as *const _) };
    drop(allow);
    value
}

pub fn create_credential(
    parent_hwnd: isize,
    challenge: &RegistrationChallenge,
) -> Result<Value, ClientError> {
    let mut client_json =
        client_data_json("webauthn.create", &challenge.challenge, &challenge.origin);
    let rp_id = HSTRING::from(&challenge.rp_id);
    let rp_name = HSTRING::from(&challenge.rp_name);
    let user_name = HSTRING::from(&challenge.user_name);
    let display = HSTRING::from(&challenge.user_display_name);
    let mut user_id = challenge.user_id.clone();
    let rp = WEBAUTHN_RP_ENTITY_INFORMATION {
        dwVersion: WEBAUTHN_RP_ENTITY_INFORMATION_CURRENT_VERSION,
        pwszId: PCWSTR::from_raw(rp_id.as_ptr()),
        pwszName: PCWSTR::from_raw(rp_name.as_ptr()),
        pwszIcon: PCWSTR::null(),
    };
    let user = WEBAUTHN_USER_ENTITY_INFORMATION {
        dwVersion: WEBAUTHN_USER_ENTITY_INFORMATION_CURRENT_VERSION,
        cbId: user_id.len() as u32,
        pbId: user_id.as_mut_ptr(),
        pwszName: PCWSTR::from_raw(user_name.as_ptr()),
        pwszIcon: PCWSTR::null(),
        pwszDisplayName: PCWSTR::from_raw(display.as_ptr()),
    };
    let mut params: Vec<WEBAUTHN_COSE_CREDENTIAL_PARAMETER> = challenge
        .algorithms
        .iter()
        .map(|alg| WEBAUTHN_COSE_CREDENTIAL_PARAMETER {
            dwVersion: 1,
            pwszCredentialType: CREDENTIAL_TYPE,
            lAlg: *alg,
        })
        .collect();
    let parameters = WEBAUTHN_COSE_CREDENTIAL_PARAMETERS {
        cCredentialParameters: params.len() as u32,
        pCredentialParameters: params.as_mut_ptr(),
    };
    let mut exclude = CredentialList::new(&challenge.exclude)?;
    exclude.prepare();
    let mut options = WEBAUTHN_AUTHENTICATOR_MAKE_CREDENTIAL_OPTIONS::default();
    options.dwVersion = WEBAUTHN_AUTHENTICATOR_MAKE_CREDENTIAL_OPTIONS_CURRENT_VERSION;
    options.dwTimeoutMilliseconds = challenge.timeout_ms;
    options.CredentialList = empty_legacy_list();
    options.Extensions = empty_extensions();
    options.dwAuthenticatorAttachment = WEBAUTHN_AUTHENTICATOR_ATTACHMENT_PLATFORM;
    options.bRequireResidentKey = win_bool(false);
    options.dwUserVerificationRequirement = uv_native(&challenge.user_verification);
    options.dwAttestationConveyancePreference = WEBAUTHN_ATTESTATION_CONVEYANCE_PREFERENCE_NONE;
    options.pExcludeCredentialList = exclude.as_ptr();
    options.bPreferResidentKey = win_bool(true);
    let client_data = client_data(&mut client_json);
    let attestation = unsafe {
        WebAuthNAuthenticatorMakeCredential(
            hwnd(parent_hwnd),
            &rp,
            &user,
            &parameters,
            &client_data,
            Some(&options),
        )
        .map_err(|error| err(format!("Windows Hello 沒有完成通行密鑰登記：{error}")))?
    };
    let value = unsafe { registration_json(attestation, &client_json) };
    unsafe { WebAuthNFreeCredentialAttestation(Some(attestation as *const _)) };
    drop(exclude);
    value
}

pub fn protect_key(key: &[u8; 32]) -> Result<Vec<u8>, ClientError> {
    crypt(true, key)
}

pub fn unprotect_key(blob: &[u8]) -> Result<[u8; 32], ClientError> {
    let plain = crypt(false, blob)?;
    let bytes: [u8; 32] = plain
        .as_slice()
        .try_into()
        .map_err(|_| err("工作階段金鑰長度不正確"))?;
    Ok(bytes)
}

fn crypt(protect: bool, input: &[u8]) -> Result<Vec<u8>, ClientError> {
    unsafe {
        let mut data_in = CRYPT_INTEGER_BLOB {
            cbData: input.len() as u32,
            pbData: input.as_ptr() as *mut u8,
        };
        let mut data_out = CRYPT_INTEGER_BLOB {
            cbData: 0,
            pbData: std::ptr::null_mut(),
        };
        let description = w!("Xiayun session");
        let result = if protect {
            CryptProtectData(
                &data_in,
                description,
                None,
                None,
                None,
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut data_out,
            )
        } else {
            CryptUnprotectData(
                &mut data_in,
                None,
                None,
                None,
                None,
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut data_out,
            )
        };
        result.map_err(|error| err(format!("無法保護本機登入：{error}")))?;
        if data_out.pbData.is_null() || data_out.cbData == 0 {
            return Err(err("無法保護本機登入"));
        }
        let bytes = std::slice::from_raw_parts(data_out.pbData, data_out.cbData as usize).to_vec();
        let _ = LocalFree(Some(HLOCAL(data_out.pbData.cast())));
        Ok(bytes)
    }
}

fn platform_available() -> Result<bool, ClientError> {
    let consent = UserConsentVerifier::CheckAvailabilityAsync()
        .map_err(|error| err(format!("無法詢問 Windows Hello：{error}")))?
        .get()
        .map_err(|error| err(format!("無法詢問 Windows Hello：{error}")))?;
    if consent == UserConsentVerifierAvailability::Available {
        return Ok(true);
    }
    let present = unsafe { WebAuthNIsUserVerifyingPlatformAuthenticatorAvailable() }
        .map_err(|error| err(format!("無法詢問 Windows Hello：{error}")))?;
    Ok(is_true(present))
}

fn win_bool(value: bool) -> BOOL {
    BOOL(i32::from(value))
}

fn is_true(value: BOOL) -> bool {
    value.0 != 0
}

fn availability_message(value: UserConsentVerifierAvailability) -> String {
    if value == UserConsentVerifierAvailability::DeviceNotPresent {
        "這台電腦沒有 Windows Hello 裝置。".into()
    } else if value == UserConsentVerifierAvailability::NotConfiguredForUser {
        "Windows Hello 尚未設定。請先到系統設定建立 PIN、指紋或臉部辨識。".into()
    } else if value == UserConsentVerifierAvailability::DisabledByPolicy {
        "系統政策停用了 Windows Hello。".into()
    } else if value == UserConsentVerifierAvailability::DeviceBusy {
        "Windows Hello 目前忙碌，請稍後再試。".into()
    } else {
        "Windows Hello 目前無法使用。".into()
    }
}

fn verification_message(value: UserConsentVerificationResult) -> String {
    if value == UserConsentVerificationResult::Canceled {
        "已取消 Windows Hello。".into()
    } else if value == UserConsentVerificationResult::RetriesExhausted {
        "Windows Hello 重試次數已用完。".into()
    } else if value == UserConsentVerificationResult::DeviceBusy {
        "Windows Hello 目前忙碌，請稍後再試。".into()
    } else {
        "Windows Hello 沒有通過。".into()
    }
}

fn uv_native(policy: &str) -> u32 {
    match policy {
        "required" => WEBAUTHN_USER_VERIFICATION_REQUIREMENT_REQUIRED,
        "discouraged" => WEBAUTHN_USER_VERIFICATION_REQUIREMENT_DISCOURAGED,
        _ => WEBAUTHN_USER_VERIFICATION_REQUIREMENT_PREFERRED,
    }
}

fn hwnd(parent: isize) -> HWND {
    HWND(parent as *mut std::ffi::c_void)
}

fn client_data(json: &mut [u8]) -> WEBAUTHN_CLIENT_DATA {
    WEBAUTHN_CLIENT_DATA {
        dwVersion: WEBAUTHN_CLIENT_DATA_CURRENT_VERSION,
        cbClientDataJSON: json.len() as u32,
        pbClientDataJSON: json.as_mut_ptr(),
        pwszHashAlgId: WEBAUTHN_HASH_ALGORITHM_SHA_256,
    }
}

fn empty_legacy_list() -> WEBAUTHN_CREDENTIALS {
    WEBAUTHN_CREDENTIALS {
        cCredentials: 0,
        pCredentials: std::ptr::null_mut(),
    }
}

fn empty_extensions() -> WEBAUTHN_EXTENSIONS {
    WEBAUTHN_EXTENSIONS {
        cExtensions: 0,
        pExtensions: std::ptr::null_mut(),
    }
}

unsafe fn assertion_json(assertion: *mut WEBAUTHN_ASSERTION, client_json: &[u8]) -> Result<Value, ClientError> {
    if assertion.is_null() {
        return Err(err("Windows Hello 沒有回傳通行密鑰"));
    }
    let assertion = &*assertion;
    let credential_id = read_bytes(assertion.Credential.pbId, assertion.Credential.cbId);
    let authenticator_data = read_bytes(assertion.pbAuthenticatorData, assertion.cbAuthenticatorData);
    let signature = read_bytes(assertion.pbSignature, assertion.cbSignature);
    let user_handle = read_bytes(assertion.pbUserId, assertion.cbUserId);
    if credential_id.is_empty() || signature.is_empty() {
        return Err(err("Windows Hello 沒有回傳通行密鑰"));
    }
    Ok(authentication_response_json(
        &credential_id,
        client_json,
        &authenticator_data,
        &signature,
        Some(&user_handle),
    ))
}

unsafe fn registration_json(
    attestation: *mut WEBAUTHN_CREDENTIAL_ATTESTATION,
    client_json: &[u8],
) -> Result<Value, ClientError> {
    if attestation.is_null() {
        return Err(err("Windows Hello 沒有回傳通行密鑰"));
    }
    let attestation = &*attestation;
    let credential_id = read_bytes(attestation.pbCredentialId, attestation.cbCredentialId);
    let object = read_bytes(attestation.pbAttestationObject, attestation.cbAttestationObject);
    if credential_id.is_empty() || object.is_empty() {
        return Err(err("Windows Hello 沒有回傳通行密鑰"));
    }
    Ok(registration_response_json(
        &credential_id,
        client_json,
        &object,
    ))
}

unsafe fn read_bytes(ptr: *const u8, len: u32) -> Vec<u8> {
    if ptr.is_null() || len == 0 {
        return Vec::new();
    }
    std::slice::from_raw_parts(ptr, len as usize).to_vec()
}

struct CredentialList {
    ids: Vec<Vec<u8>>,
    creds: Vec<WEBAUTHN_CREDENTIAL_EX>,
    ptrs: Vec<*mut WEBAUTHN_CREDENTIAL_EX>,
    list: WEBAUTHN_CREDENTIAL_LIST,
    transports: Vec<u32>,
}

impl CredentialList {
    fn new(credentials: &[CredentialDescriptor]) -> Result<Self, ClientError> {
        let transports = credentials
            .iter()
            .map(|credential| transport_mask(&credential.transports))
            .collect();
        Ok(Self {
            ids: credentials
                .iter()
                .map(|credential| credential.id.clone())
                .collect(),
            creds: Vec::new(),
            ptrs: Vec::new(),
            list: unsafe { MaybeUninit::zeroed().assume_init() },
            transports,
        })
    }

    fn prepare(&mut self) {
        self.creds = self
            .ids
            .iter_mut()
            .zip(self.transports.iter())
            .map(|(id, transports)| WEBAUTHN_CREDENTIAL_EX {
                dwVersion: WEBAUTHN_CREDENTIAL_EX_CURRENT_VERSION,
                cbId: id.len() as u32,
                pbId: id.as_mut_ptr(),
                pwszCredentialType: CREDENTIAL_TYPE,
                dwTransports: *transports,
            })
            .collect();
        self.ptrs = self.creds.iter_mut().map(|cred| cred as *mut _).collect();
        self.list = WEBAUTHN_CREDENTIAL_LIST {
            cCredentials: self.ptrs.len() as u32,
            ppCredentials: if self.ptrs.is_empty() {
                std::ptr::null_mut()
            } else {
                self.ptrs.as_mut_ptr()
            },
        };
    }

    fn as_ptr(&mut self) -> *mut WEBAUTHN_CREDENTIAL_LIST {
        if self.list.cCredentials == 0 {
            std::ptr::null_mut()
        } else {
            &mut self.list
        }
    }
}

fn transport_mask(transports: &[String]) -> u32 {
    let mut mask = 0u32;
    for transport in transports {
        mask |= match transport.as_str() {
            "ble" => WEBAUTHN_CTAP_TRANSPORT_BLE,
            "internal" => WEBAUTHN_CTAP_TRANSPORT_INTERNAL,
            "nfc" => WEBAUTHN_CTAP_TRANSPORT_NFC,
            "usb" => WEBAUTHN_CTAP_TRANSPORT_USB,
            _ => 0,
        };
    }
    mask
}
