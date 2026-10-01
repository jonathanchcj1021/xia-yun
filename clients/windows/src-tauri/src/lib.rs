mod commands;

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use tauri::Manager;
use xiayun_core::{AuthMaterial, ReqwestTransport, DEFAULT_BASE_URL};

pub struct AppState {
    pub http: ReqwestTransport,
    pub dir: PathBuf,
    pub settings: Mutex<Settings>,
    pub auth: Mutex<AuthMaterial>,
    pub user: Mutex<Option<xiayun_core::PublicUser>>,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub base_url: String,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            fs::create_dir_all(&dir)?;
            let settings = load_settings(&dir);
            let http = ReqwestTransport::new().expect("HTTP client");
            app.manage(AppState {
                http,
                dir,
                settings: Mutex::new(settings),
                auth: Mutex::new(AuthMaterial::None),
                user: Mutex::new(None),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_status,
            commands::set_base_url,
            commands::register_account,
            commands::login_account,
            commands::passkey_login,
            commands::register_passkey,
            commands::unlock_session,
            commands::logout_account,
            commands::list_items,
            commands::create_note,
            commands::upload_file,
            commands::get_item,
            commands::preview_image,
            commands::download_item,
            commands::delete_item,
        ])
        .run(tauri::generate_context!())
        .expect("匣雲視窗無法啟動");
}

fn load_settings(dir: &std::path::Path) -> Settings {
    let path = dir.join("settings.json");
    if let Ok(bytes) = fs::read(&path) {
        if let Ok(settings) = serde_json::from_slice::<Settings>(&bytes) {
            if xiayun_core::normalize_base_url(&settings.base_url).is_ok() {
                return settings;
            }
        }
    }
    Settings {
        base_url: DEFAULT_BASE_URL.to_string(),
    }
}

pub fn transport(state: &AppState) -> ReqwestTransport {
    state.http.clone()
}
