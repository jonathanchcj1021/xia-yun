use std::fs;
use std::path::Path;

use base64::Engine;
use tauri::State;
use xiayun_core::{
    create_credential, has_saved_session, hello_status, mime_from_name, normalize_base_url,
    peek_meta, save_session, sign_assertion, unlock_with_hello, AuthMaterial, AuthSession,
    CloudClient, Item, PublicUser, SavedSession, MAX_UPLOAD_BYTES,
};

use crate::{transport, AppState, Settings};

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusView {
    pub base_url: String,
    pub hello_available: bool,
    pub hello_reason: String,
    pub saved_email: Option<String>,
    pub has_saved_session: bool,
    pub user: Option<PublicUser>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionView {
    pub base_url: String,
    pub user: PublicUser,
    pub auth_method: String,
    pub persist_error: Option<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewView {
    pub mime: String,
    pub data_url: String,
}

#[tauri::command]
pub fn app_status(state: State<'_, AppState>) -> StatusView {
    let hello = hello_status();
    let base_url = base_url(&state);
    let meta = peek_meta(&state.dir);
    StatusView {
        base_url,
        hello_available: hello.available,
        hello_reason: hello.reason,
        saved_email: meta.map(|meta| meta.email),
        has_saved_session: has_saved_session(&state.dir),
        user: state.user.lock().expect("user").clone(),
    }
}

#[tauri::command]
pub fn set_base_url(state: State<'_, AppState>, base_url: String) -> Result<String, String> {
    let base_url = normalize_base_url(&base_url).map_err(|error| error.to_string())?;
    let previous = base_url_of(&state);
    if previous != base_url {
        clear_memory(&state);
        xiayun_core::clear_session_files(&state.dir);
    }
    *state.settings.lock().expect("settings") = Settings {
        base_url: base_url.clone(),
    };
    let bytes = serde_json::to_vec_pretty(&Settings {
        base_url: base_url.clone(),
    })
    .map_err(|_| "無法儲存伺服器位址".to_string())?;
    fs::write(state.dir.join("settings.json"), bytes).map_err(|_| "無法儲存伺服器位址".to_string())?;
    Ok(base_url)
}

#[tauri::command]
pub async fn register_account(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    email: String,
    password: String,
) -> Result<SessionView, String> {
    let _ = app;
    let mut client = cloud(&state)?;
    let session = client
        .register(&email, &password)
        .await
        .map_err(|error| error.to_string())?;
    remember(&state, &session)
}

#[tauri::command]
pub async fn login_account(
    state: State<'_, AppState>,
    email: String,
    password: String,
) -> Result<SessionView, String> {
    let mut client = cloud(&state)?;
    let session = client
        .login(&email, &password)
        .await
        .map_err(|error| error.to_string())?;
    remember(&state, &session)
}

#[tauri::command]
pub async fn passkey_login(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    email: String,
) -> Result<SessionView, String> {
    let mut client = cloud(&state)?;
    let challenge = client
        .passkey_options(&email)
        .await
        .map_err(|error| error.to_string())?;
    let hwnd = window_hwnd(&app);
    let assertion = tauri::async_runtime::spawn_blocking(move || sign_assertion(hwnd, &challenge))
        .await
        .map_err(|_| "Windows Hello 工作被中斷".to_string())?
        .map_err(|error| error.to_string())?;
    let session = client
        .passkey_verify(&email, &assertion)
        .await
        .map_err(|error| error.to_string())?;
    remember(&state, &session)
}

#[tauri::command]
pub async fn register_passkey(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let client = cloud(&state)?;
    let challenge = client
        .passkey_register_options()
        .await
        .map_err(|error| error.to_string())?;
    let hwnd = window_hwnd(&app);
    let response = tauri::async_runtime::spawn_blocking(move || create_credential(hwnd, &challenge))
        .await
        .map_err(|_| "Windows Hello 工作被中斷".to_string())?
        .map_err(|error| error.to_string())?;
    client
        .passkey_register_verify(&response)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn unlock_session(state: State<'_, AppState>) -> Result<SessionView, String> {
    let dir = state.dir.clone();
    let saved = tauri::async_runtime::spawn_blocking(move || unlock_with_hello(&dir))
        .await
        .map_err(|_| "Windows Hello 工作被中斷".to_string())?
        .map_err(|error| error.to_string())?;
    let current = base_url_of(&state);
    if saved.base_url != current {
        return Err("已儲存的登入屬於另一個伺服器。請改回原來的位址，或用密碼重新登入。".into());
    }
    *state.auth.lock().expect("auth") = saved.auth.clone();
    let client = cloud(&state)?;
    match client.me().await {
        Ok(user) => {
            *state.user.lock().expect("user") = Some(user.clone());
            Ok(SessionView {
                base_url: current,
                auth_method: saved.auth.method_name().into(),
                user,
                persist_error: None,
            })
        }
        Err(error) => {
            clear_memory(&state);
            xiayun_core::clear_session_files(&state.dir);
            Err(format!("儲存的登入已失效，請重新登入。{error}"))
        }
    }
}

#[tauri::command]
pub async fn logout_account(state: State<'_, AppState>) -> Result<(), String> {
    let client = cloud(&state)?;
    let _ = client.logout().await;
    clear_memory(&state);
    xiayun_core::clear_session_files(&state.dir);
    Ok(())
}

#[tauri::command]
pub async fn list_items(state: State<'_, AppState>) -> Result<Vec<Item>, String> {
    cloud(&state)?
        .list_items()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn create_note(
    state: State<'_, AppState>,
    title: String,
    body: String,
) -> Result<Item, String> {
    cloud(&state)?
        .create_note(&title, &body)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn upload_file(
    state: State<'_, AppState>,
    path: String,
    name: Option<String>,
    kind: Option<String>,
) -> Result<Item, String> {
    let file = Path::new(&path);
    let meta = fs::metadata(file).map_err(|_| "無法讀取檔案".to_string())?;
    if !meta.is_file() {
        return Err("請選擇一個檔案".into());
    }
    if meta.len() > MAX_UPLOAD_BYTES {
        return Err("檔案超過 32 MB 上限".into());
    }
    let bytes = fs::read(file).map_err(|_| "無法讀取檔案".to_string())?;
    let file_name = name
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            file.file_name()
                .map(|value| value.to_string_lossy().into_owned())
        })
        .unwrap_or_else(|| "未命名檔案".into());
    let mime = mime_from_name(&file_name);
    cloud(&state)?
        .upload(&file_name, &mime, &bytes, kind.as_deref())
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn get_item(state: State<'_, AppState>, id: String) -> Result<Item, String> {
    cloud(&state)?
        .get_item(&id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn preview_image(state: State<'_, AppState>, id: String) -> Result<PreviewView, String> {
    let blob = cloud(&state)?
        .download(&id, false)
        .await
        .map_err(|error| error.to_string())?;
    let mime = blob
        .mime
        .split(';')
        .next()
        .unwrap_or("application/octet-stream")
        .trim()
        .to_string();
    if !mime.starts_with("image/") || mime == "image/svg+xml" {
        return Err("這個項目不能預覽成圖片".into());
    }
    let encoded = base64::engine::general_purpose::STANDARD.encode(&blob.bytes);
    Ok(PreviewView {
        mime: mime.clone(),
        data_url: format!("data:{mime};base64,{encoded}"),
    })
}

#[tauri::command]
pub async fn download_item(
    state: State<'_, AppState>,
    id: String,
    dest: String,
) -> Result<(), String> {
    let blob = cloud(&state)?
        .download(&id, true)
        .await
        .map_err(|error| error.to_string())?;
    fs::write(&dest, blob.bytes).map_err(|_| "無法寫入下載檔案".to_string())
}

#[tauri::command]
pub async fn delete_item(state: State<'_, AppState>, id: String) -> Result<(), String> {
    cloud(&state)?
        .delete_item(&id)
        .await
        .map_err(|error| error.to_string())
}

fn cloud(state: &AppState) -> Result<CloudClient<xiayun_core::ReqwestTransport>, String> {
    Ok(CloudClient::new(
        transport(state),
        base_url_of(state),
        state.auth.lock().expect("auth").clone(),
    ))
}

fn remember(state: &AppState, session: &AuthSession) -> Result<SessionView, String> {
    *state.auth.lock().expect("auth") = session.auth.clone();
    *state.user.lock().expect("user") = Some(session.user.clone());
    let base_url = base_url_of(state);
    let persist_error = save_session(
        &state.dir,
        &SavedSession {
            base_url: base_url.clone(),
            user: session.user.clone(),
            auth: session.auth.clone(),
        },
    )
    .err()
    .map(|error| error.to_string());
    Ok(SessionView {
        base_url,
        user: session.user.clone(),
        auth_method: session.auth.method_name().into(),
        persist_error,
    })
}

fn clear_memory(state: &AppState) {
    *state.auth.lock().expect("auth") = AuthMaterial::None;
    *state.user.lock().expect("user") = None;
}

fn base_url(state: &AppState) -> String {
    base_url_of(state)
}

fn base_url_of(state: &AppState) -> String {
    state.settings.lock().expect("settings").base_url.clone()
}

fn window_hwnd(app: &tauri::AppHandle) -> isize {
    #[cfg(windows)]
    {
        use tauri::Manager;
        return app
            .get_webview_window("main")
            .and_then(|window| window.hwnd().ok())
            .map(|hwnd| hwnd.0 as isize)
            .unwrap_or(0);
    }
    #[cfg(not(windows))]
    {
        let _ = app;
        0
    }
}
