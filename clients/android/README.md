# 匣雲 Android

Kotlin / Jetpack Compose 客戶端。介面是繁體中文。只放在 `clients/android`，呼叫既有的 HTTP API。

## 伺服器

一般安裝預設連到 `https://macro-important-port-dollar.trycloudflare.com`。登入畫面裡的伺服器位址可以改成別的位址，但沒有改過的話不會連到本機。

登入與通行密鑰驗證會送 `client: "native"`，並把回應的 `token` 放進 `Authorization: Bearer`。註冊回應只有 `session` cookie；這顆 cookie 的值與 bearer token 是同一組工作階段密鑰，客戶端會把它當成 Bearer 使用。

## 建置

需要 JDK 17 以上與 Android SDK（compileSdk 35）。在 `local.properties` 設定 `sdk.dir`。

```bash
cd clients/android
./gradlew :core:test :app:assembleDebug
```

除錯 APK：`app/build/outputs/apk/debug/app-debug.apk`

`:core:test` 用 MockWebServer 測 API 客戶端，不需要模擬器。

## 這個客戶端會做的事

- 電子郵件與密碼註冊、登入。
- 登入成功後可以啟用生物辨識。下次開啟時，用系統生物辨識解開已儲存的工作階段。
- 通行密鑰登入會呼叫 `/api/auth/passkey/login/options` 與 `/api/auth/passkey/login/verify`。若伺服器回 404，或這台裝置無法完成 Credential Manager，會顯示錯誤，不會當掉。
- 列出、上傳、預覽圖片、新增筆記、下載、刪除自己的項目。單一檔案上限 32 MB。
- 分組與標籤會用 `PATCH /api/items/{id}` 寫回。清單可以依分組摺疊，並用名稱、筆記內文、類型與標籤一起篩選，排序為最新、最舊或名稱。分組標題可以一次刪除整組，包含未分組。
