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
  openLibrary: string;
  dropTitle: string;
  dropHint: string;
  chooseFile: string;
  registerPasskey: string;
  passkeyReady: string;
  passkeyCancelled: string;
  passkeyDuplicate: string;
  passkeyOrigin: string;
  passkeyFailed: string;
  requestFailed: string;
  uploadProgress: string;
  uploadOne: string;
  uploadFailed: string;
  saveFailed: string;
  deleteFailed: string;
  deleteGroupFailed: string;
  copyFailed: string;
  updateFailed: string;
  filterType: string;
  filterSort: string;
  tagPrefix: string;
  clear: string;
  loadingItems: string;
  loadErrorTitle: string;
  retry: string;
  emptyTitle: string;
  emptyBody: string;
  noMatchTitle: string;
  noMatchBody: string;
  deleteGroup: string;
  addTag: string;
  moveToGroup: string;
  copied: string;
  copyAction: string;
  view: string;
  download: string;
  remove: string;
  deleteUngrouped: string;
  deleteNamedGroup: string;
  irreversible: string;
  deleting: string;
  deleteItemTitle: string;
  deleteItemBody: string;
  imageLead: string;
  imageFailed: string;
  notePrivate: string;
  readingNote: string;
  readNoteFailed: string;
  addTagTitle: string;
  addTagLead: string;
  removeTag: string;
  newTag: string;
  add: string;
  moveTitle: string;
  moveLead: string;
  groupName: string;
  groupExample: string;
  move: string;
  newGroupPlaceholder: string;
  sampleToken: string;
  notFoundTitle: string;
  notFoundBody: string;
  backHome: string;
  filesNav: string;
  filesTitle: string;
  filesLead: string;
  filesBack: string;
  filesLibrary: string;
  filesEmpty: string;
  filesEmptyFolder: string;
  filesCount: string;
  uploadGroup: string;
  deleteSelected: string;
  deleteSelectedTitle: string;
  deleteSelectedBody: string;
  selectedCount: string;
  selectFile: string;
  pageErrorTitle: string;
  pageErrorBody: string;
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
  openLibrary: "進入書庫",
  dropTitle: "把檔案拖到這裡",
  dropHint: "點陣圖片會顯示預覽。單一檔案上限 32 MB。一次可以拖入多個檔案。",
  chooseFile: "選擇檔案",
  registerPasskey: "註冊通行密鑰",
  passkeyReady: "通行密鑰已註冊。下次可以用它登入這個帳號。",
  passkeyCancelled: "通行密鑰已取消，或這台裝置拒絕了要求。",
  passkeyDuplicate: "這支通行密鑰已經註冊過。",
  passkeyOrigin: "這個網址不能使用通行密鑰。請改用 localhost 或網域名稱。",
  passkeyFailed: "通行密鑰沒有完成。",
  requestFailed: "伺服器沒有完成這個請求",
  uploadProgress: "正在上傳 {current}/{total}：{name}",
  uploadOne: "正在上傳 {name}",
  uploadFailed: "上傳時無法連線，請稍後再試",
  saveFailed: "儲存筆記時無法連線",
  deleteFailed: "刪除時無法連線",
  deleteGroupFailed: "刪除分組時無法連線",
  copyFailed: "無法複製這則筆記",
  updateFailed: "無法更新這個項目",
  filterType: "類型",
  filterSort: "排序",
  tagPrefix: "標籤",
  clear: "清除",
  loadingItems: "正在載入項目",
  loadErrorTitle: "讀取項目時發生問題",
  retry: "再試一次",
  emptyTitle: "匣子還是空的",
  emptyBody: "上傳一個檔案，或寫下第一則筆記。內容只會出現在這個帳號。",
  noMatchTitle: "沒有符合的項目",
  noMatchBody: "試著清掉搜尋、類型或標籤，項目還在這個帳號裡。",
  deleteGroup: "刪除分組",
  addTag: "標籤",
  moveToGroup: "移到分組",
  copied: "已複製",
  copyAction: "複製",
  view: "查看",
  download: "下載",
  remove: "刪除",
  deleteUngrouped: "刪除未分組入面全部 {count} 個項目？",
  deleteNamedGroup: "刪除「{name}」入面全部 {count} 個項目？",
  irreversible: "這些項目會從你的帳號移除，無法復原。",
  deleting: "刪除中…",
  deleteItemTitle: "刪除這個項目？",
  deleteItemBody: "「{name}」會從你的帳號移除，無法復原。",
  imageLead: "圖片預覽。下載會取得原始檔案。",
  imageFailed: "無法顯示這張圖片。你可以改為下載原檔。",
  notePrivate: "這則筆記只存在你的帳號裡。",
  readingNote: "正在讀取筆記",
  readNoteFailed: "無法讀取這則筆記。",
  addTagTitle: "加上標籤",
  addTagLead: "點清單上的標籤可以篩選。這裡可以新增或拿掉。",
  removeTag: "移除",
  newTag: "新標籤",
  add: "新增",
  moveTitle: "移到分組",
  moveLead: "空白或未分組會把項目放到最後一個區段。",
  groupName: "分組名稱",
  groupExample: "例如工作",
  move: "移動",
  newGroupPlaceholder: "輸入新分組，會蓋過上面的選擇",
  sampleToken: "文字",
  notFoundTitle: "找不到這個頁面",
  notFoundBody: "這個網址沒有對應的頁面。回到匣雲首頁繼續。",
  backHome: "回到首頁",
  filesNav: "檔案",
  filesTitle: "檔案",
  filesLead: "依分組瀏覽檔案與圖片。筆記留在書庫。",
  filesBack: "返回分組",
  filesLibrary: "回到書庫",
  filesEmpty: "還沒有檔案或圖片。",
  filesEmptyFolder: "這個分組裡還沒有檔案。",
  filesCount: "{count} 個",
  uploadGroup: "上傳到這個分組",
  deleteSelected: "刪除所選",
  deleteSelectedTitle: "刪除這 {count} 個檔案？",
  deleteSelectedBody: "這 {count} 個檔案會從你的帳號移除，無法復原。",
  selectedCount: "已選 {count} 個",
  selectFile: "選取 {name}",
  pageErrorTitle: "頁面暫時無法顯示",
  pageErrorBody: "匣雲遇到沒有預期的問題。再試一次，或重新整理瀏覽器。",
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
  openLibrary: "进入书库",
  dropTitle: "把文件拖到这里",
  dropHint: "点阵图片会显示预览。单个文件上限 32 MB。一次可以拖入多个文件。",
  chooseFile: "选择文件",
  registerPasskey: "注册通行密钥",
  passkeyReady: "通行密钥已注册。下次可以用它登录这个账号。",
  passkeyCancelled: "通行密钥已取消，或这台设备拒绝了请求。",
  passkeyDuplicate: "这支通行密钥已经注册过。",
  passkeyOrigin: "这个网址不能使用通行密钥。请改用 localhost 或域名。",
  passkeyFailed: "通行密钥没有完成。",
  requestFailed: "服务器没有完成这个请求",
  uploadProgress: "正在上传 {current}/{total}：{name}",
  uploadOne: "正在上传 {name}",
  uploadFailed: "上传时无法连线，请稍后再试",
  saveFailed: "保存笔记时无法连线",
  deleteFailed: "删除时无法连线",
  deleteGroupFailed: "删除分组时无法连线",
  copyFailed: "无法复制这则笔记",
  updateFailed: "无法更新这个项目",
  filterType: "类型",
  filterSort: "排序",
  tagPrefix: "标签",
  clear: "清除",
  loadingItems: "正在加载项目",
  loadErrorTitle: "读取项目时发生问题",
  retry: "再试一次",
  emptyTitle: "匣子还是空的",
  emptyBody: "上传一个文件，或写下第一则笔记。内容只会出现在这个账号。",
  noMatchTitle: "没有符合的项目",
  noMatchBody: "试着清掉搜索、类型或标签，项目还在这个账号里。",
  deleteGroup: "删除分组",
  addTag: "标签",
  moveToGroup: "移到分组",
  copied: "已复制",
  copyAction: "复制",
  view: "查看",
  download: "下载",
  remove: "删除",
  deleteUngrouped: "删除未分组里面全部 {count} 个项目？",
  deleteNamedGroup: "删除「{name}」里面全部 {count} 个项目？",
  irreversible: "这些项目会从你的账号移除，无法恢复。",
  deleting: "删除中…",
  deleteItemTitle: "删除这个项目？",
  deleteItemBody: "「{name}」会从你的账号移除，无法恢复。",
  imageLead: "图片预览。下载会取得原始文件。",
  imageFailed: "无法显示这张图片。你可以改为下载原档。",
  notePrivate: "这则笔记只存在你的账号里。",
  readingNote: "正在读取笔记",
  readNoteFailed: "无法读取这则笔记。",
  addTagTitle: "加上标签",
  addTagLead: "点列表上的标签可以筛选。这里可以新增或拿掉。",
  removeTag: "移除",
  newTag: "新标签",
  add: "新增",
  moveTitle: "移到分组",
  moveLead: "空白或未分组会把项目放到最后一个区段。",
  groupName: "分组名称",
  groupExample: "例如工作",
  move: "移动",
  newGroupPlaceholder: "输入新分组，会盖过上面的选择",
  sampleToken: "文字",
  notFoundTitle: "找不到这个页面",
  notFoundBody: "这个网址没有对应的页面。回到匣云首页继续。",
  backHome: "回到首页",
  filesNav: "文件",
  filesTitle: "文件",
  filesLead: "按分组浏览文件和图片。笔记留在书库。",
  filesBack: "返回分组",
  filesLibrary: "回到书库",
  filesEmpty: "还没有文件或图片。",
  filesEmptyFolder: "这个分组里还没有文件。",
  filesCount: "{count} 个",
  uploadGroup: "上传到这个分组",
  deleteSelected: "删除所选",
  deleteSelectedTitle: "删除这 {count} 个文件？",
  deleteSelectedBody: "这 {count} 个文件会从你的账号移除，无法恢复。",
  selectedCount: "已选 {count} 个",
  selectFile: "选取 {name}",
  pageErrorTitle: "页面暂时无法显示",
  pageErrorBody: "匣云遇到没有预期的问题。再试一次，或重新整理浏览器。",
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
  openLibrary: "Open library",
  dropTitle: "Drop files here",
  dropHint: "Pictures show a preview. Each file can be up to 32 MB. You can drop more than one.",
  chooseFile: "Choose a file",
  registerPasskey: "Register a passkey",
  passkeyReady: "Passkey registered. You can use it to log in next time.",
  passkeyCancelled: "The passkey was cancelled, or this device refused the request.",
  passkeyDuplicate: "This passkey is already registered.",
  passkeyOrigin: "This address cannot use a passkey. Use localhost or a domain name.",
  passkeyFailed: "The passkey did not finish.",
  requestFailed: "The server did not finish this request",
  uploadProgress: "Uploading {current}/{total}: {name}",
  uploadOne: "Uploading {name}",
  uploadFailed: "Could not connect while uploading. Try again later.",
  saveFailed: "Could not connect while saving the note",
  deleteFailed: "Could not connect while deleting",
  deleteGroupFailed: "Could not connect while deleting the group",
  copyFailed: "Could not copy this note",
  updateFailed: "Could not update this item",
  filterType: "Type",
  filterSort: "Sort",
  tagPrefix: "Tag",
  clear: "Clear",
  loadingItems: "Loading items",
  loadErrorTitle: "Could not load your items",
  retry: "Try again",
  emptyTitle: "This box is empty",
  emptyBody: "Upload a file or write a first note. It stays in this account.",
  noMatchTitle: "Nothing matches",
  noMatchBody: "Clear the search, type, or tag. The items are still in this account.",
  deleteGroup: "Delete group",
  addTag: "Tag",
  moveToGroup: "Move to group",
  copied: "Copied",
  copyAction: "Copy",
  view: "View",
  download: "Download",
  remove: "Delete",
  deleteUngrouped: "Delete all {count} ungrouped items?",
  deleteNamedGroup: "Delete all {count} items in “{name}”?",
  irreversible: "These items leave your account and cannot be restored.",
  deleting: "Deleting…",
  deleteItemTitle: "Delete this item?",
  deleteItemBody: "“{name}” leaves your account and cannot be restored.",
  imageLead: "Picture preview. Download gets the original file.",
  imageFailed: "This picture cannot be shown. You can download the original.",
  notePrivate: "This note stays in your account.",
  readingNote: "Loading the note",
  readNoteFailed: "Could not read this note.",
  addTagTitle: "Add a tag",
  addTagLead: "Tags in the list can filter. Add or remove them here.",
  removeTag: "Remove",
  newTag: "New tag",
  add: "Add",
  moveTitle: "Move to a group",
  moveLead: "Leave this blank to put the item in the ungrouped section.",
  groupName: "Group name",
  groupExample: "For example, Work",
  move: "Move",
  newGroupPlaceholder: "Type a new group. It overrides the choice above.",
  sampleToken: "text",
  notFoundTitle: "This page is not here",
  notFoundBody: "This address does not match a page. Go back to the Xia Yun homepage.",
  backHome: "Back to the homepage",
  filesNav: "Files",
  filesTitle: "Files",
  filesLead: "Browse files and pictures by group. Notes stay in the library.",
  filesBack: "Back to folders",
  filesLibrary: "Back to the library",
  filesEmpty: "No files or pictures yet.",
  filesEmptyFolder: "This folder has no files yet.",
  filesCount: "{count}",
  uploadGroup: "Upload into this group",
  deleteSelected: "Delete selected",
  deleteSelectedTitle: "Delete these {count} files?",
  deleteSelectedBody: "These {count} files leave your account and cannot be restored.",
  selectedCount: "{count} selected",
  selectFile: "Select {name}",
  pageErrorTitle: "This page cannot be shown",
  pageErrorBody: "Xia Yun hit an unexpected problem. Try again, or reload the browser.",
};

export const messages: Record<Locale, Copy> = {
  "zh-Hant": zhHant,
  "zh-Hans": zhHans,
  en,
};
