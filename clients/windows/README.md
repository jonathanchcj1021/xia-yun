# 匣雲 Windows 客戶端

個人雲端的 Windows 桌面程式：註冊、登入、列出、上傳、預覽圖片、寫筆記、下載與刪除自己的項目。介面是繁體中文。實作用 Tauri 2（Rust 加上一個小網頁介面），產物是 Windows `.exe`。

預設伺服器是 `http://127.0.0.1:43123`，可在登入畫面改。原生請求帶 `client: "native"`，並優先使用回應裡的 `token`，之後送 `Authorization: Bearer <token>`。若伺服器沒有 token，才改帶 `session` cookie。

## Windows 上產生 exe

需要 Node.js 22、Rust stable，以及 [Tauri 的 Windows 前置](https://v2.tauri.app/start/prerequisites/)（WebView2、Visual Studio C++ 建置工具）。

```powershell
cd clients\windows
npm install
npm run tauri build
```

應用程式在：

`clients\windows\target\release\xiayun.exe`

NSIS 安裝檔在 `clients\windows\target\release\bundle\nsis\`。目標電腦若沒有 WebView2，安裝程式會下載它。

只編譯 exe、不打包安裝檔：

```powershell
cd clients\windows
npm install
npm run build
cargo build --release --manifest-path src-tauri\Cargo.toml
```

## 在 Linux 交叉編譯

不需要付費授權。用 MSVC 目標與 [cargo-xwin](https://github.com/rust-cross/cargo-xwin)（它會下載 Windows SDK）：

```bash
cd clients/windows
npm install
npm run build
rustup target add x86_64-pc-windows-msvc
cargo install cargo-xwin --locked
cargo xwin build --release --target x86_64-pc-windows-msvc -p xiayun-windows
```

exe 在 `clients/windows/target/x86_64-pc-windows-msvc/release/xiayun.exe`。

要一併做 NSIS 安裝檔：

```bash
npm run tauri build -- --runner cargo-xwin --target x86_64-pc-windows-msvc
```

這台 Linux 建置機無法啟動 Windows exe，也無法喚起 Windows Hello。

## Windows Hello 與通行密鑰

- 登入頁的「使用 Windows Hello 登入」會先呼叫 `POST /api/auth/passkey/login/options`，再以 Windows WebAuthn API（`WebAuthNAuthenticatorGetAssertion`）向系統要斷言，最後 `POST /api/auth/passkey/login/verify`，並帶 `client: "native"`。
- 登入後可以「登記 Windows Hello」，走 `POST /api/auth/passkey/register/options` 與 `verify`。
- 下次啟動若有已儲存的工作階段，會先用 `UserConsentVerifier` 做本機 Windows Hello 解鎖，通過後才讀出 token。Windows 上金鑰以 DPAPI 保護。
- 通行密鑰的 RP ID 不能是 IP。本機請把伺服器設成 `http://localhost:43123`，不要用 `127.0.0.1`。
- 這些系統視窗沒有在這台建置機上實機測試。

## 測試

不需要開視窗：

```bash
cd clients/windows
cargo test -p xiayun-core
```

若要打正在跑的匣雲 API（埠 `43123`）：

```bash
XIAYUN_REQUIRE_LIVE=1 cargo test -p xiayun-core --test live_api
```

單一檔案上限 32 MB。項目只屬於登入的使用者。
