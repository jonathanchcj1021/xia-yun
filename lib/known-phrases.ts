import type { Locale } from "@/lib/locale";

const phrases: Record<string, { "zh-Hans": string; en: string }> = {
  "請提供 JSON 內容": { "zh-Hans": "请提供 JSON 内容", en: "Send JSON in the request" },
  "請輸入有效的電子郵件": { "zh-Hans": "请输入有效的电子邮件", en: "Enter a valid email" },
  "請檢查密碼": { "zh-Hans": "请检查密码", en: "Check the password" },
  "這個電子郵件已經註冊": { "zh-Hans": "这个电子邮件已经注册", en: "This email is already registered" },
  "client 只能是 native": { "zh-Hans": "client 只能是 native", en: "client can only be native" },
  "電子郵件或密碼不正確": { "zh-Hans": "电子邮件或密码不正确", en: "The email or password is wrong" },
  "尚未登入": { "zh-Hans": "尚未登录", en: "Not signed in" },
  "請提供通行密鑰註冊結果": { "zh-Hans": "请提供通行密钥注册结果", en: "Send the passkey registration result" },
  "通行密鑰驗證失敗": { "zh-Hans": "通行密钥验证失败", en: "Passkey verification failed" },
  "請提供通行密鑰登入結果": { "zh-Hans": "请提供通行密钥登录结果", en: "Send the passkey login result" },
  "這個帳號在這個網站還沒有通行密鑰。請先用密碼登入，再按「註冊通行密鑰」。": {
    "zh-Hans": "这个账号在这个网站还没有通行密钥。请先用密码登录，再按「注册通行密钥」。",
    en: "This account has no passkey on this site yet. Log in with a password, then register a passkey.",
  },
  "暫時無法讀取內容": { "zh-Hans": "暂时无法读取内容", en: "The content cannot be read right now" },
  "暫時無法儲存內容": { "zh-Hans": "暂时无法保存内容", en: "The content cannot be saved right now" },
  "暫時無法處理內容": { "zh-Hans": "暂时无法处理内容", en: "The content cannot be handled right now" },
  "請提供要刪除的分組": { "zh-Hans": "请提供要删除的分组", en: "Say which group to delete" },
  "分組格式不正確": { "zh-Hans": "分组格式不正确", en: "That group name is not valid" },
  "請用 JSON 建立筆記，或用 multipart 上傳檔案": {
    "zh-Hans": "请用 JSON 建立笔记，或用 multipart 上传文件",
    en: "Create a note with JSON, or upload a file with multipart",
  },
  "JSON 只接受 type 為 text 的筆記": {
    "zh-Hans": "JSON 只接受 type 为 text 的笔记",
    en: "JSON only accepts a note whose type is text",
  },
  "請填寫筆記標題": { "zh-Hans": "请填写笔记标题", en: "Enter a note title" },
  "筆記內文格式不正確": { "zh-Hans": "笔记正文格式不正确", en: "The note body is not valid" },
  "標籤格式不正確": { "zh-Hans": "标签格式不正确", en: "That tag is not valid" },
  "上傳請求需要 Content-Length": { "zh-Hans": "上传请求需要 Content-Length", en: "The upload needs Content-Length" },
  "檔案超過 32 MB 上限": { "zh-Hans": "文件超过 32 MB 上限", en: "The file is over the 32 MB limit" },
  "無法讀取上傳內容": { "zh-Hans": "无法读取上传内容", en: "Could not read the upload" },
  "請選擇要上傳的檔案": { "zh-Hans": "请选择要上传的文件", en: "Choose a file to upload" },
  "這個檔案不是可預覽的點陣圖片": {
    "zh-Hans": "这个文件不是可预览的点阵图片",
    en: "This file is not a picture that can be previewed",
  },
  "type 只能是 file 或 image": { "zh-Hans": "type 只能是 file 或 image", en: "type can only be file or image" },
  "找不到這個項目": { "zh-Hans": "找不到这个项目", en: "This item was not found" },
  "找不到檔案內容": { "zh-Hans": "找不到文件内容", en: "The file content was not found" },
};

export function localizePhrase(message: string, locale: Locale) {
  if (locale === "zh-Hant") return message;
  return phrases[message]?.[locale] ?? message;
}
