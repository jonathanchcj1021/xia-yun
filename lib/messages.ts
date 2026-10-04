import type { Locale } from "@/lib/locale";

export type Copy = {
  brand: string;
  eyebrow: string;
  headline: string;
  lead: string;
  createAccount: string;
  login: string;
  loginNote: string;
  afterLogin: string;
  sampleFile: string;
  sampleFileText: string;
  sampleImage: string;
  sampleImageText: string;
  sampleNote: string;
  sampleNoteText: string;
  downloadApp: string;
  downloadTitle: string;
  downloadLead: string;
  downloadAction: string;
  downloadHint: string;
  langLabel: string;
  langZhHant: string;
  langZhHans: string;
  langEn: string;
  email: string;
  password: string;
  confirmPassword: string;
  registerTitle: string;
  loginTitle: string;
  registerLead: string;
  loginLead: string;
  submitRegister: string;
  submitLogin: string;
  passwordMismatch: string;
  passkey: string;
  logout: string;
  newNote: string;
  noteTitle: string;
  noteBody: string;
  saveNote: string;
  saving: string;
  cancel: string;
  edit: string;
  preview: string;
  write: string;
  heading: string;
  bold: string;
  list: string;
  link: string;
  code: string;
  group: string;
  newGroup: string;
  ungrouped: string;
  libraryIntro: string;
  creating: string;
  loggingIn: string;
  passkeyLogin: string;
  passkeyWaiting: string;
  haveAccount: string;
  noAccount: string;
  network: string;
  emailFirst: string;
  search: string;
  allTypes: string;
  newest: string;
  oldest: string;
  byName: string;
  emptyNote: string;
  close: string;
  editNote: string;
  noteDialogLead: string;
};

const zhHant: Copy = {
  brand: "匣雲",
  eyebrow: "同一個帳號，許多裝置",
  headline: "檔案、圖片與筆記，放在匣雲裡。",
  lead: "匣雲把你的檔案、圖片和文字筆記收在同一個帳號。手機或電腦登入後都能打開，內容不會公開。",
  createAccount: "建立帳號",
  login: "登入",
  loginNote: "登入可以用電子郵件與密碼，或用已註冊的通行密鑰。",
  afterLogin: "登入之後可以做這些事",
  sampleFile: "檔案",
  sampleFileText: "合約、壓縮檔，以及要在另一台裝置打開的東西。",
  sampleImage: "圖片",
  sampleImageText: "上傳後直接預覽，也可以再下載原檔。",
  sampleNote: "筆記",
  sampleNoteText: "用 Markdown 寫標題、清單和連結，內文只留在你的帳號。",
  downloadApp: "下載 Android 版",
  downloadTitle: "安裝匣雲",
  downloadLead: "Android 安裝檔只從這個網站下載。",
  downloadAction: "下載匣雲",
  downloadHint: "安裝前，Android 必須允許安裝未知的應用程式。",
  langLabel: "語言",
  langZhHant: "繁體中文",
  langZhHans: "简体中文",
  langEn: "English",
  email: "電子郵件",
  password: "密碼",
  confirmPassword: "再輸入一次密碼",
  registerTitle: "建立匣雲帳號",
  loginTitle: "登入匣雲",
  registerLead: "密碼至少 8 個字元。這個帳號之後也可以在瀏覽器登入。",
  loginLead: "檔案、圖片與筆記，只留在這個帳號。",
  submitRegister: "建立帳號",
  submitLogin: "登入",
  passwordMismatch: "兩次輸入的密碼不一樣",
  passkey: "通行密鑰",
  logout: "登出",
  newNote: "新增筆記",
  noteTitle: "標題",
  noteBody: "內文",
  saveNote: "儲存筆記",
  saving: "儲存中…",
  cancel: "取消",
  edit: "編輯",
  preview: "預覽",
  write: "編寫",
  heading: "標題",
  bold: "粗體",
  list: "清單",
  link: "連結",
  code: "程式碼",
  group: "分組",
  newGroup: "新分組名稱",
  ungrouped: "未分組",
  libraryIntro: "標題與內文會存在這個帳號，不會變成公開頁面。",
  creating: "建立中…",
  loggingIn: "登入中…",
  passkeyLogin: "用通行密鑰登入",
  passkeyWaiting: "等待裝置確認…",
  haveAccount: "已經有帳號了？",
  noAccount: "還沒有帳號？",
  network: "無法連線，請稍後再試",
  emailFirst: "請先輸入電子郵件",
  search: "搜尋名稱或筆記",
  allTypes: "全部",
  newest: "最新",
  oldest: "最舊",
  byName: "名稱",
  emptyNote: "（沒有內文）",
  close: "關閉",
  editNote: "編輯筆記",
  noteDialogLead: "標題會顯示在清單裡。內文用 Markdown 編寫，旁邊是預覽。",
};

const zhHans: Copy = {
  ...zhHant,
  eyebrow: "同一个账号，许多设备",
  headline: "文件、图片和笔记，放在匣云里。",
  lead: "匣云把你的文件、图片和文字笔记收在同一个账号。手机或电脑登录后都能打开，内容不会公开。",
  createAccount: "建立账号",
  login: "登录",
  loginNote: "可以用电子邮件和密码登录，或使用已注册的通行密钥。",
  afterLogin: "登录之后可以做这些事",
  sampleFile: "文件",
  sampleFileText: "合同、压缩包，以及要在另一台设备打开的东西。",
  sampleImage: "图片",
  sampleImageText: "上传后直接预览，也可以再下载原档。",
  sampleNote: "笔记",
  sampleNoteText: "用 Markdown 写标题、列表和链接，正文只留在你的账号。",
  downloadApp: "下载 Android 版",
  downloadTitle: "安装匣云",
  downloadLead: "Android 安装包只从这个网站下载。",
  downloadAction: "下载匣云",
  downloadHint: "安装前，Android 必须允许安装未知的应用。",
  langLabel: "语言",
  email: "电子邮件",
  password: "密码",
  confirmPassword: "再输入一次密码",
  registerTitle: "建立匣云账号",
  loginTitle: "登录匣云",
  registerLead: "密码至少 8 个字符。这个账号之后也可以在浏览器登录。",
  loginLead: "文件、图片和笔记，只留在这个账号。",
  submitRegister: "建立账号",
  submitLogin: "登录",
  passwordMismatch: "两次输入的密码不一样",
  passkey: "通行密钥",
  logout: "登出",
  newNote: "新增笔记",
  noteTitle: "标题",
  noteBody: "正文",
  saveNote: "保存笔记",
  saving: "保存中…",
  cancel: "取消",
  edit: "编辑",
  preview: "预览",
  write: "编写",
  heading: "标题",
  bold: "粗体",
  list: "列表",
  link: "链接",
  code: "代码",
  group: "分组",
  newGroup: "新分组名称",
  ungrouped: "未分组",
  libraryIntro: "标题和正文会存在这个账号，不会变成公开页面。",
  creating: "建立中…",
  loggingIn: "登录中…",
  passkeyLogin: "用通行密钥登录",
  passkeyWaiting: "等待设备确认…",
  haveAccount: "已经有账号了？",
  noAccount: "还没有账号？",
  network: "无法连线，请稍后再试",
  emailFirst: "请先输入电子邮件",
  search: "搜索名称或笔记",
  allTypes: "全部",
  newest: "最新",
  oldest: "最旧",
  byName: "名称",
  emptyNote: "（没有正文）",
  close: "关闭",
  editNote: "编辑笔记",
  noteDialogLead: "标题会显示在列表里。正文用 Markdown 编写，旁边是预览。",
};

const en: Copy = {
  brand: "Xia Yun",
  eyebrow: "One account, every device",
  headline: "Files, pictures, and notes, kept in Xia Yun.",
  lead: "Xia Yun keeps your files, pictures, and notes in one account. Open them from a phone or a computer. Nothing here is public.",
  createAccount: "Create account",
  login: "Log in",
  loginNote: "Log in with email and password, or with a passkey you already registered.",
  afterLogin: "After you log in",
  sampleFile: "Files",
  sampleFileText: "Contracts, archives, and anything you want on another device.",
  sampleImage: "Pictures",
  sampleImageText: "Preview after upload, and download the original later.",
  sampleNote: "Notes",
  sampleNoteText: "Write headings, lists, and links in Markdown. The text stays in your account.",
  downloadApp: "Download for Android",
  downloadTitle: "Install Xia Yun",
  downloadLead: "The Android package is only downloaded from this site.",
  downloadAction: "Download Xia Yun",
  downloadHint: "Before installing, allow Android to install unknown apps.",
  langLabel: "Language",
  langZhHant: "繁體中文",
  langZhHans: "简体中文",
  langEn: "English",
  email: "Email",
  password: "Password",
  confirmPassword: "Confirm password",
  registerTitle: "Create a Xia Yun account",
  loginTitle: "Log in to Xia Yun",
  registerLead: "Use at least 8 characters. You can use the same account in the browser.",
  loginLead: "Files, pictures, and notes stay in this account.",
  submitRegister: "Create account",
  submitLogin: "Log in",
  passwordMismatch: "The two passwords do not match",
  passkey: "Passkey",
  logout: "Log out",
  newNote: "New note",
  noteTitle: "Title",
  noteBody: "Body",
  saveNote: "Save note",
  saving: "Saving…",
  cancel: "Cancel",
  edit: "Edit",
  preview: "Preview",
  write: "Write",
  heading: "Heading",
  bold: "Bold",
  list: "List",
  link: "Link",
  code: "Code",
  group: "Group",
  newGroup: "New group name",
  ungrouped: "Ungrouped",
  libraryIntro: "The title and body stay in this account. They are not a public page.",
  creating: "Creating…",
  loggingIn: "Logging in…",
  passkeyLogin: "Log in with a passkey",
  passkeyWaiting: "Waiting for the device…",
  haveAccount: "Already have an account?",
  noAccount: "No account yet?",
  network: "Could not connect. Try again later.",
  emailFirst: "Enter your email first",
  search: "Search names or notes",
  allTypes: "All",
  newest: "Newest",
  oldest: "Oldest",
  byName: "Name",
  emptyNote: "(empty note)",
  close: "Close",
  editNote: "Edit note",
  noteDialogLead: "The title shows in the list. Write the body in Markdown and check the preview.",
};

export const messages: Record<Locale, Copy> = {
  "zh-Hant": zhHant,
  "zh-Hans": zhHans,
  en,
};
