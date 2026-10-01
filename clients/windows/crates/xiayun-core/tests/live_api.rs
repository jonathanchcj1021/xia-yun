use std::time::Duration;

use xiayun_core::{AuthMaterial, CloudClient, ReqwestTransport};

fn api_base() -> String {
    std::env::var("XIAYUN_API").unwrap_or_else(|_| "http://127.0.0.1:43123".into())
}

async fn server_up(base: &str) -> bool {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .unwrap();
    client
        .get(base)
        .send()
        .await
        .map(|response| response.status().as_u16() < 500)
        .unwrap_or(false)
}

#[tokio::test]
async fn live_native_session_roundtrip() {
    let base = api_base();
    if !server_up(&base).await {
        if std::env::var("XIAYUN_REQUIRE_LIVE").ok().as_deref() == Some("1") {
            panic!("匣雲 API 沒有在 {base} 回應");
        }
        eprintln!("略過 live API：{base} 沒有在聽");
        return;
    }

    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis();
    let email = format!("windows-{stamp}@example.com");
    let password = "native-password";
    let transport = ReqwestTransport::new().expect("client");
    let mut cloud = CloudClient::new(transport, base, AuthMaterial::None);

    let registered = cloud
        .register(&email, password)
        .await
        .expect("register");
    assert_eq!(registered.auth.method_name(), "bearer");
    assert_eq!(registered.user.email, email);

    let me = cloud.me().await.expect("me");
    assert_eq!(me.email, email);

    let note = cloud
        .create_note("窗邊", "第一則從 Windows 客戶端來的筆記")
        .await
        .expect("note");
    assert_eq!(note.kind, "text");
    let fetched = cloud.get_item(&note.id).await.expect("get");
    assert_eq!(fetched.body.as_deref(), Some("第一則從 Windows 客戶端來的筆記"));

    let listed = cloud.list_items().await.expect("list");
    assert!(listed.iter().any(|item| item.id == note.id));
    assert!(listed.iter().all(|item| item.body.is_none()));

    let downloaded = cloud.download(&note.id, true).await.expect("download");
    assert!(downloaded.bytes.windows("Windows".len()).any(|window| window == b"Windows") || downloaded.bytes.windows("筆記".as_bytes().len()).any(|window| window == "筆記".as_bytes()));

    let gif = b"GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;";
    let image = cloud
        .upload("dot.gif", "image/gif", gif, Some("image"))
        .await
        .expect("upload");
    assert_eq!(image.kind, "image");
    let preview = cloud.download(&image.id, false).await.expect("preview");
    assert!(preview.bytes.starts_with(b"GIF89a"));
    assert!(preview.mime.starts_with("image/gif"));

    cloud.delete_item(&note.id).await.expect("delete note");
    cloud.delete_item(&image.id).await.expect("delete image");
    let error = cloud.get_item(&note.id).await.unwrap_err();
    assert_eq!(error.code.as_deref(), Some("NOT_FOUND"));

    let passkey = cloud.passkey_options(&email).await.unwrap_err();
    assert_eq!(passkey.code.as_deref(), Some("WEBAUTHN"));

    let material = cloud.auth().clone();
    let base = cloud.base_url().to_string();
    cloud.logout().await.expect("logout");
    let signed_out = CloudClient::new(ReqwestTransport::new().unwrap(), base, material);
    let denied = signed_out.me().await.unwrap_err();
    assert_eq!(denied.code.as_deref(), Some("UNAUTHENTICATED"));
}
