# 匣雲

同一個帳號，在手機與電腦瀏覽器之間存放檔案、圖片與文字筆記。這個版本是 HTTP API 與響應式網頁；不包含 iOS、Android 或桌面執行檔。項目只屬於登入的使用者，沒有分享給其他帳號的功能。

帳號資料與項目中繼資料存在本機 SQLite。檔案位元組存在 git 忽略的 `data/` 目錄。沒有外部物件儲存、沒有第三方登入。

## 本機執行

需要 Node.js 22 以上（使用內建的 `node:sqlite`）。

```bash
npm install
npm run dev
```

開發伺服器聽在 `0.0.0.0:43123`。用瀏覽器打開 [http://127.0.0.1:43123](http://127.0.0.1:43123)。通行密鑰請改開 [http://localhost:43123](http://localhost:43123)，瀏覽器不接受 IP 位址當 WebAuthn RP ID。

資料庫檔案是 `data/app.sqlite`，上傳內容在 `data/blobs/`。這兩個路徑都在 `.gitignore` 裡。

## 這個版本有什麼

- 電子郵件與密碼註冊、登入、登出。密碼以 bcrypt 儲存（先做 SHA-256，避免 bcrypt 只取前 72 位元組）。
- 已登入後可以註冊 WebAuthn 通行密鑰。登入頁可以用密碼，或用通行密鑰（Face ID、Android 生物辨識、Windows Hello 或安全金鑰，由瀏覽器與作業系統決定）。
- 工作階段是名為 `session` 的 httpOnly cookie。`Secure` 只在請求是 HTTPS 時打開，所以本機 HTTP 可以用。原生客戶端可在登入時加 `client: "native"`，回應會多給同一顆工作階段的 `token`，之後用 `Authorization: Bearer` 呼叫 API。
- 登入後可以列出自己的項目、拖放或選擇檔案上傳、預覽點陣圖片、新增文字筆記、下載、刪除。
- 每個項目有類型（`file`、`image`、`text`）、名稱、大小、建立時間與擁有者。

## 原生 App

這個版本沒有 iOS、Android 或 Windows 執行檔。網頁上的通行密鑰會交給瀏覽器的 WebAuthn；原生 App 之後用同一支 API，以系統生物辨識完成通行密鑰，並用 Bearer token 保持登入。

## HTTP API

工作階段用 cookie。錯誤一律是 JSON：`{ "error": "繁體中文說明", "code": "ERROR_CODE" }`。未登入回 `401`，`code` 為 `UNAUTHENTICATED`。讀取或刪除別人的項目回 `404`，不透露項目是否存在。

| 方法 | 路徑 | 說明 |
| --- | --- | --- |
| POST | `/api/auth/register` | JSON `{ "email", "password" }`。成功 `201`，並設定 cookie。 |
| POST | `/api/auth/login` | JSON `{ "email", "password", "client"? }`。成功 `200`，並設定 cookie。`client` 為 `"native"` 時，JSON 另含 `token`。 |
| POST | `/api/auth/logout` | 讓 cookie 或 `Authorization: Bearer` 對應的工作階段失效。 |
| GET | `/api/auth/me` | 目前使用者。接受 cookie 或 Bearer。 |
| POST | `/api/auth/passkey/register/options` | 已登入（cookie 或 Bearer）。回傳 WebAuthn 註冊選項。 |
| POST | `/api/auth/passkey/register/verify` | 已登入。JSON 本體是瀏覽器的註冊結果。 |
| POST | `/api/auth/passkey/login/options` | JSON `{ "email" }`。這個網站已有通行密鑰時回傳 WebAuthn 登入選項；否則 `400`，請改用密碼登入後按「註冊通行密鑰」。 |
| POST | `/api/auth/passkey/login/verify` | JSON `{ "email", "response", "client"? }`。成功時設定 cookie；`client` 為 `"native"` 時另含 `token`。 |
| GET | `/api/items` | 自己的項目，新的在前。清單不含筆記全文，文字項目有 `excerpt`。每筆都有 `group`（`null` 表示未分組）與 `tags`。 |
| POST | `/api/items` | 檔案用 `multipart/form-data`；筆記用 JSON `{ "type": "text", "title", "body" }`。兩者都可選帶 `group` 與 `tags`。 |
| GET | `/api/items/[id]` | 單筆中繼資料。筆記含 `body`。含 `group` 與 `tags`。 |
| PATCH | `/api/items/[id]` | JSON `{ "group"?, "tags"? }`。省略的欄位不變。`group` 為 `null` 或 `""` 表示未分組。`tags` 會整份取代。只限擁有者；未登入 `401`。 |
| GET | `/api/items/[id]/content` | 下載或內嵌圖片。`?disposition=attachment` 強制下載。 |
| DELETE | `/api/items` | JSON `{ "group": string \| null }`。`null` 或 `""` 刪除這個帳號的未分組項目；其他字串只刪該分組。檔案與圖片的內容一併刪除。回 `{ "deleted": number }`。未登入 `401`。 |
| DELETE | `/api/items/[id]` | 刪除自己的項目與檔案內容。 |

上傳欄位：`file`（必填）、`name`（選填，顯示名稱）、`type`（選填，`file` 或 `image`）。未指定類型時，可預覽的點陣圖（JPEG、PNG、GIF、WebP、AVIF、BMP）會存成 `image`，其餘（含 SVG）存成 `file`。

## 之後的原生客戶端要注意

- 網頁登入只設定 httpOnly cookie `session`（`SameSite=Lax`、`Path=/`、30 天），JavaScript 讀不到。原生客戶端要在 `POST /api/auth/login` 或 `POST /api/auth/passkey/login/verify` 加上 `"client": "native"`，把回應裡的 `token` 存起來，之後送 `Authorization: Bearer <token>`。這顆 token 與 cookie 是同一筆工作階段。
- `GET /api/auth/me`、所有 `/api/items`，以及通行密鑰註冊兩支路由接受 Bearer。若請求帶了 `Authorization` 但 token 無效，不會再退回 cookie。
- 通行密鑰的 RP ID 是請求的 hostname，不含連接埠，而且只會拿來登入同一個網站。在 `localhost` 註冊的密鑰不能用在 Cloudflare 網域或其他 hostname。這個網站還沒有通行密鑰時，登入選項回 `400`：`這個帳號在這個網站還沒有通行密鑰。請先用密碼登入，再按「註冊通行密鑰」。` 瀏覽器會拒絕 IP 位址（例如 `127.0.0.1`）當 RP ID，所以本機請用 `http://localhost:43123`。WebAuthn 需要 HTTPS，或 `http://localhost`。
- 挑戰 5 分鐘內有效，而且只能用一次。登入必須帶電子郵件，這個版本不會做無帳號提示的 discoverable 登入。
- `Secure` 只在 HTTPS 時設定。本機 HTTP 不會加 `Secure`。
- 這個版本沒有 CORS 標頭。原生 App 不是瀏覽器，不需要 CORS；瀏覽器跨網域呼叫則尚未開放。
- 單一檔案上限 **32 MB**。整個 multipart 請求不得超過 33 MB，否則 `413` / `PAYLOAD_TOO_LARGE`。`Content-Length` 若存在且不是數字，回 `411`。沒有這個標頭時，伺服器仍會邊讀邊計算，超過 33 MB 就停止。
- 登入後的 `/files` 依分組瀏覽檔案與圖片（不含筆記），每一列有名稱、大小與上傳時間。
- 筆記只能用 JSON，不能用 multipart。標題 1–200 字元，內文最多 10 萬字元，內文可以是空字串。
- 密碼 8–128 字元，由伺服器雜湊。客戶端送原始密碼。
- 登出只作廢目前這顆 cookie，或請求裡的 Bearer token 對應的工作階段。其他裝置保持登入。
- 清單一次回傳全部項目，沒有分頁。時間是 UTC 的 ISO 8601 字串（`createdAt`）。
- 圖片預覽用 `GET /api/items/[id]/content`（預設 inline）。下載加上 `?disposition=attachment`。
- 沒有把項目分享給其他帳號的 API。

## 從其他 App 存進匣雲

Android 的分享畫面接受系統分享單上的 `text/plain` 與 `image/*`。文字和網址存成筆記，圖片走原本的上傳，點陣圖存成圖片項目。儲存前要先登入，並選擇既有分組、未分組，或輸入新分組名稱。

iOS 的 Share Extension 在 `clients/ios/XiaYunShare`，接受文字、網址與圖片，規則相同。主 App 與擴充功能共用鑰匙圈存取群組 `group.app.xiayun.ios`，所以既有登入要在裝了這個版本的匣雲裡打開一次，分享畫面才讀得到。這個目錄還沒有簽章與開發團隊，這裡不能產出可安裝的 iOS 套件。

## Windows 命令列（cmd）

用 `curl.exe`，不要用 PowerShell 的 `curl` 別名。下面的網址是正式站。把佔位符換成自己的值，不要把真密碼或權杖寫進這個檔案。

登入。回應 JSON 含 `token`：

```bat
curl.exe -s -X POST "https://xia-yun.jonathanchcj1021.workers.dev/api/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"you@example.com\",\"password\":\"YOUR_PASSWORD\",\"client\":\"native\"}"
```

上傳一個檔案。回應 JSON 的 `item.id` 是項目 id：

```bat
curl.exe -s -X POST "https://xia-yun.jonathanchcj1021.workers.dev/api/items" -H "Authorization: Bearer %TOKEN%" -F "file=@C:\path\to\file.bin"
```

依 id 下載到本機路徑：

```bat
curl.exe -L -o "C:\path\to\saved.bin" -H "Authorization: Bearer %TOKEN%" "https://xia-yun.jonathanchcj1021.workers.dev/api/items/%FILE_ID%/content?disposition=attachment"
```
