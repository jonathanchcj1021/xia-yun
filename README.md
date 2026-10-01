# 匣雲

同一個帳號，在手機與電腦瀏覽器之間存放檔案、圖片與文字筆記。這個版本是 HTTP API 與響應式網頁；不包含 iOS、Android 或桌面執行檔。項目只屬於登入的使用者，沒有分享給其他帳號的功能。

帳號資料與項目中繼資料存在本機 SQLite。檔案位元組存在 git 忽略的 `data/` 目錄。沒有外部物件儲存、沒有第三方登入。

## 本機執行

需要 Node.js 22 以上（使用內建的 `node:sqlite`）。

```bash
npm install
npm run dev
```

開發伺服器聽在 `0.0.0.0:43123`。用瀏覽器打開 [http://127.0.0.1:43123](http://127.0.0.1:43123)。

資料庫檔案是 `data/app.sqlite`，上傳內容在 `data/blobs/`。這兩個路徑都在 `.gitignore` 裡。

## 這個版本有什麼

- 電子郵件與密碼註冊、登入、登出。密碼以 bcrypt 儲存（先做 SHA-256，避免 bcrypt 只取前 72 位元組）。
- 工作階段是名為 `session` 的 httpOnly cookie。`Secure` 只在請求是 HTTPS 時打開，所以本機 HTTP 可以用。
- 登入後可以列出自己的項目、拖放或選擇檔案上傳、預覽點陣圖片、新增文字筆記、下載、刪除。
- 每個項目有類型（`file`、`image`、`text`）、名稱、大小、建立時間與擁有者。

## 下一步：WebAuthn 與生物辨識

這個版本只有電子郵件與密碼，沒有 Face ID、passkey 或 WebAuthn。下一步是在網頁加上 WebAuthn（通行密鑰）；原生 App 再使用系統生物辨識（例如 Face ID）。那些客戶端會呼叫這支 API，不在這個版本裡。

## HTTP API

工作階段用 cookie。錯誤一律是 JSON：`{ "error": "繁體中文說明", "code": "ERROR_CODE" }`。未登入回 `401`，`code` 為 `UNAUTHENTICATED`。讀取或刪除別人的項目回 `404`，不透露項目是否存在。

| 方法 | 路徑 | 說明 |
| --- | --- | --- |
| POST | `/api/auth/register` | JSON `{ "email", "password" }`。成功 `201`，並設定 cookie。 |
| POST | `/api/auth/login` | JSON `{ "email", "password" }`。成功 `200`，並設定 cookie。 |
| POST | `/api/auth/logout` | 只讓這次工作階段失效。 |
| GET | `/api/auth/me` | 目前使用者。 |
| GET | `/api/items` | 自己的項目，新的在前。清單不含筆記全文，文字項目有 `excerpt`。 |
| POST | `/api/items` | 檔案用 `multipart/form-data`；筆記用 JSON `{ "type": "text", "title", "body" }`。 |
| GET | `/api/items/[id]` | 單筆中繼資料。筆記含 `body`。 |
| GET | `/api/items/[id]/content` | 下載或內嵌圖片。`?disposition=attachment` 強制下載。 |
| DELETE | `/api/items/[id]` | 刪除自己的項目與檔案內容。 |

上傳欄位：`file`（必填）、`name`（選填，顯示名稱）、`type`（選填，`file` 或 `image`）。未指定類型時，可預覽的點陣圖（JPEG、PNG、GIF、WebP、AVIF、BMP）會存成 `image`，其餘（含 SVG）存成 `file`。

## 之後的原生客戶端要注意

- 沒有 `Authorization: Bearer`。登入與註冊的 `Set-Cookie` 是 httpOnly 的 `session`（`SameSite=Lax`、`Path=/`、30 天）。原生 HTTP 客戶端必須自己保存並在之後的請求帶上 `Cookie`。網頁的 JavaScript 讀不到這顆 cookie。
- `Secure` 只在 HTTPS 時設定。本機 HTTP 不會加 `Secure`。
- 這個版本沒有 CORS 標頭。原生 App 不是瀏覽器，不需要 CORS；瀏覽器跨網域呼叫則尚未開放。
- 單一檔案上限 **32 MB**。`multipart` 請求必須帶 `Content-Length`，整個請求不得超過 33 MB，否則 `413` / `PAYLOAD_TOO_LARGE` 或 `411`。
- 筆記只能用 JSON，不能用 multipart。標題 1–200 字元，內文最多 10 萬字元，內文可以是空字串。
- 密碼 8–128 字元，由伺服器雜湊。客戶端送原始密碼。
- 登出只作廢目前這顆 cookie 對應的工作階段，其他裝置保持登入。
- 清單一次回傳全部項目，沒有分頁。時間是 UTC 的 ISO 8601 字串（`createdAt`）。
- 圖片預覽用 `GET /api/items/[id]/content`（預設 inline）。下載加上 `?disposition=attachment`。
- 沒有分享 API，也還沒有 WebAuthn。
