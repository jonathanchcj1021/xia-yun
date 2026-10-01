# 匣雲 iOS

用 SwiftUI 寫的匣雲客戶端。同一個帳號可以註冊、登入，列出、上傳、預覽、下載與刪除自己的檔案、圖片與文字筆記。介面是繁體中文。

這個目錄是獨立的 Xcode 專案，不修改網頁或 API。

## 用 Xcode 打開

需要 macOS、Xcode 16（或更新）與 iOS 17 以上的模擬器或裝置。

打開 `clients/ios/XiaYun.xcodeproj`，方案選 **XiaYun**，目標選 iPhone 或 iPad 模擬器，然後 Run。不要把 `clients/ios` 當成 Swift Package 打開；`Package.swift` 只用來在沒有 iOS SDK 的環境編譯並測試 API 核心。

Bundle ID 是 `app.xiayun.ios`。簽章用 Automatic，請在 Signing 填上自己的 Team 才能裝到真機。

## 伺服器

預設位址是 `http://127.0.0.1:43123`。登入畫面與設定裡可以改。

- 模擬器的 `127.0.0.1` 是模擬器自己。若 API 跑在 Mac 上，模擬器通常仍可連 `127.0.0.1`。
- 真機的 `127.0.0.1` 是手機自己。請改成電腦的區域網址，例如 `http://192.168.1.20:43123`。
- App 允許任意 HTTP，因為個人伺服器常常還沒有 HTTPS。這寫在 `NSAppTransportSecurity`。

## 登入

註冊與登入都用電子郵件與密碼。密碼 8–128 字元。

`POST /api/auth/login` 會帶 `client: "native"`。回應若有 `token`，之後的請求只送 `Authorization: Bearer <token>`，不再附 cookie。註冊目前只設定 `session` cookie，沒有 `token` 時才改送 `Cookie`。伺服器一旦看到 `Authorization`，就不會再退回 cookie，所以兩者不會一起送。

登入成功後，工作階段存在這台裝置的 Keychain。若裝置有 Face ID、Touch ID 或 Optic ID，App 會詢問要不要用它在下次打開時解鎖這份登入。生物辨識沒有上傳。拒絕之後可以在設定裡再打開。Face ID 的用途字串在 `Info.plist`。

通行密鑰登入會先 `POST /api/auth/passkey/login/options`，再用 AuthenticationServices 做 assertion，最後 `POST /api/auth/passkey/login/verify`，本體是 `{ email, response, client: "native" }`。`response` 的形狀對齊 WebAuthn `AuthenticationResponseJSON`。驗證請求會加 `Origin: https://<rpId>`，讓伺服器比對的 origin 與系統寫進 `clientDataJSON` 的值一致。

若這支路由回 404，畫面顯示「這台伺服器尚未提供通行密鑰登入。」，不會當掉。其他錯誤顯示伺服器的繁體中文說明。

通行密鑰要能在真機完成，還需要：

1. 這個帳號先在網頁註冊通行密鑰。
2. `XiaYun.entitlements` 的 Associated Domains 改成伺服器的 rpId（選項裡的 `rpId`，通常是沒有埠號的主機名），例如 `webcredentials:cloud.example?mode=developer`。
3. 該網域提供 Apple 要求的 `apple-app-site-association`。`localhost` 只適合開發模式，IP 位址通常無法作為通行密鑰的 rpId。

## 項目

登入後可以上傳檔案、從照片加入圖片、寫筆記、預覽點陣圖、下載與刪除。筆記用 JSON `{ type: "text", title, body }`。檔案用 multipart 欄位 `file`，並帶 `name` 與 `type`（`file` 或 `image`）。顯示名稱放在 `name`，因為這支 API 的 multipart 解析器不接受 `filename*`。超過 32 MB 不會送出。

## 在沒有 Xcode 的環境跑測試

核心（請求、Bearer、cookie、multipart、通行密鑰 JSON、驗證規則）不依賴 UIKit。安裝 Swift 工具鏈後：

```bash
cd clients/ios
swift test
```

若本機已有 API：

```bash
# 在倉庫根目錄
npm install
npm run dev
```

另開一個終端機：

```bash
cd clients/ios
XIAYUN_BASE_URL=http://127.0.0.1:43123 swift test --filter LiveAPITests
```

沒有設定 `XIAYUN_BASE_URL` 時，這組測試會跳過。

## 這份環境沒能做的事

這裡是 Linux，沒有 Xcode、iOS 模擬器或 iPhone。因此沒有編譯 SwiftUI App，也沒有在模擬器或裝置上操作畫面。Face ID、Touch ID、Keychain 的生物辨識保護，以及 AuthenticationServices 的通行密鑰視窗，都沒有在裝置上測試過。不要把單元測試或對 API 的 HTTP 呼叫當成 Face ID 已通過裝置測試。
