package app.xiayun.android.ui

import android.content.Context
import android.content.Intent
import android.net.Uri
import app.xiayun.core.BaseUrls
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp

enum class AppLang(val code: String) {
    ZhHant("zh-Hant"),
    ZhHans("zh-Hans"),
    En("en"),
}

data class AppCopy(
    val brand: String,
    val loginTitle: String,
    val registerTitle: String,
    val loginLead: String,
    val registerLead: String,
    val login: String,
    val createAccount: String,
    val email: String,
    val password: String,
    val confirmPassword: String,
    val passwordMismatch: String,
    val passkey: String,
    val libraryTitle: String,
    val logout: String,
    val newNote: String,
    val editNote: String,
    val noteTitle: String,
    val noteBody: String,
    val save: String,
    val cancel: String,
    val preview: String,
    val heading: String,
    val bold: String,
    val list: String,
    val link: String,
    val code: String,
    val edit: String,
    val langLabel: String,
    val titleRequired: String,
    val emptyNote: String,
    val creating: String = "建立中…",
    val loggingIn: String = "登入中…",
    val passkeyLogin: String = "用通行密鑰登入",
    val passkeyWaiting: String = "等待裝置確認…",
    val emailFirst: String = "請先輸入電子郵件",
    val passwordShort: String = "密碼至少需要 8 個字元",
    val passwordRequired: String = "請輸入密碼",
    val server: String = "伺服器位址",
    val serverHelp: String = "一般安裝會連到預設伺服器。只有要改位址時才填這裡。",
    val address: String = "位址",
    val backToBiometric: String = "回到生物辨識",
    val lockTitle: String = "匣雲已鎖定",
    val lockBody: String = "用生物辨識開啟已儲存的工作階段。",
    val unlock: String = "以生物辨識解鎖",
    val usePassword: String = "改用密碼登入",
    val missingSession: String = "找不到已儲存的工作階段，請重新登入",
    val offerTitle: String = "用生物辨識解鎖？",
    val offerBody: String = "下次開啟匣雲時，可以用指紋或臉部辨識還原這次登入，不必再輸入密碼。",
    val offerYes: String = "啟用",
    val offerNo: String = "暫時不要",
    val refresh: String = "重新整理",
    val more: String = "更多",
    val biometricOn: String = "啟用生物辨識解鎖",
    val biometricOff: String = "關閉生物辨識解鎖",
    val uploading: String = "正在上傳…",
    val savingNoteProgress: String = "正在儲存筆記…",
    val typeFile: String = "檔案",
    val typeImage: String = "圖片",
    val typeNote: String = "筆記",
    val retry: String = "再試一次",
    val newGroup: String = "新分組",
    val newGroupMenu: String = "新分組…",
    val newGroupName: String = "新分組名稱",
    val putInGroup: String = "放到 {name}",
    val deleteGroupTitle: String = "刪除這個分組？",
    val deleteGroupBody: String = "刪除「{name}」入面全部 {count} 個項目？",
    val deleteItemTitle: String = "刪除這個項目？",
    val deleteItemBody: String = "「{name}」刪除後無法復原。",
    val delete: String = "刪除",
    val close: String = "關閉",
    val cannotSaveFile: String = "無法儲存檔案",
    val back: String = "返回",
    val noTags: String = "還沒有標籤",
    val removeTag: String = "移除",
    val addTag: String = "加上標籤",
    val add: String = "加上",
    val addTagShort: String = "加標籤",
    val moveTo: String = "移到 {name}",
    val moveAction: String = "移過去",
    val imageFailed: String = "圖片無法顯示",
    val download: String = "下載",
    val tooLarge: String = "檔案超過 32 MB 上限",
    val cannotRead: String = "無法讀取這個檔案",
    val search: String = "搜尋名稱或筆記內文",
    val filterType: String = "類型",
    val filterSort: String = "排序",
    val allTypes: String = "全部",
    val newest: String = "最新",
    val oldest: String = "最舊",
    val byName: String = "名稱",
    val showingCount: String = "顯示 {count} 項",
    val watchingTag: String = "正在看標籤「{tag}」",
    val clear: String = "清除",
    val filtersCleared: String = "已清除篩選",
    val tagCleared: String = "已清除標籤篩選",
    val emptyTitle: String = "匣子還是空的",
    val emptyBody: String = "上傳檔案、圖片，或寫一則筆記。內容只屬於這個帳號。",
    val noMatchTitle: String = "架子上沒有對得上的東西",
    val noMatchBody: String = "名稱、筆記內文、類型或標籤對不上。可以把條件清掉，再從整座書庫看起。",
    val clearFilters: String = "清除篩選",
    val emptyGroup: String = "這個分組還沒有東西。可以從別的架子移過來。",
    val moveNewTitle: String = "移到新分組",
    val groupName: String = "分組名稱",
    val groupExample: String = "例如 京都行",
    val removeTagTitle: String = "移除標籤？",
    val removeTagBody: String = "從「{name}」移除「{tag}」。",
    val collapseGroup: String = "收合{name}，共{count} 項",
    val expandGroup: String = "展開{name}，共{count} 項",
    val deleteNamed: String = "刪除{name}",
    val tagExample: String = "例如 待寄",
    val tagFor: String = "為{name}加上標籤",
    val ungrouped: String = "未分組",
    val sampleToken: String = "文字",
    val notePlaced: String = "已把筆記「{title}」放進「{group}」",
    val tagTooLong: String = "標籤請留在十二個字以內",
    val tagExists: String = "「{name}」已經有標籤「{tag}」",
    val tagAdded: String = "已為「{name}」加上「{tag}」",
    val tagRemoved: String = "已從「{name}」移除「{tag}」",
    val moved: String = "已把「{name}」移到「{group}」",
    val groupDeleted: String = "已刪除「{name}」入面 {count} 個項目",
    val groupTooLong: String = "分組名稱請留在四十個字以內",
    val notSignedIn: String = "尚未登入",
    val badServer: String = "伺服器位址不正確",
    val sessionExpired: String = "工作階段已失效，請重新登入",
    val openProduct: String = "關於匣雲",
    val openFiles: String = "在瀏覽器開啟檔案",
    val bioKey: String = "無法建立生物辨識金鑰",
    val bioUnavailable: String = "這台裝置無法使用生物辨識解鎖",
    val bioEnableTitle: String = "啟用生物辨識解鎖",
    val bioEnableSubtitle: String = "確認後，下次開啟匣雲會用生物辨識還原這個工作階段",
    val bioSaveFailed: String = "無法儲存生物辨識工作階段",
    val bioChanged: String = "生物辨識已變更，請改用密碼登入",
    val bioReadFailed: String = "無法讀取已儲存的工作階段",
    val bioUnlockTitle: String = "解鎖匣雲",
    val bioUnlockSubtitle: String = "使用生物辨識開啟已儲存的工作階段",
    val bioUsePassword: String = "改用密碼",
    val bioDecryptFailed: String = "無法解開已儲存的工作階段，請改用密碼登入",
    val bioIncomplete: String = "生物辨識沒有完成",
    val passkeyNone: String = "這台裝置沒有回傳通行密鑰",
    val passkeyCancelled: String = "已取消通行密鑰登入",
    val passkeyUnavailable: String = "這台裝置目前無法使用通行密鑰",
    val passkeyUnavailableDetail: String = "這台裝置目前無法使用通行密鑰：{detail}",
    val passkeyFailed: String = "通行密鑰登入沒有完成",
    val network: String = "無法連線，請確認伺服器位址後再試",
    val generic: String = "伺服器沒有完成這個請求",
    val passkeyMissing: String = "伺服器尚未提供通行密鑰登入",
    val passkeyFormat: String = "伺服器回傳的通行密鑰格式無法辨識",
    val passkeyResponse: String = "通行密鑰回應格式不正確",
    val noSession: String = "登入沒有回傳工作階段，請稍後再試",
    val patchMissing: String = "伺服器尚未提供分組與標籤更新",
    val groupDeleteMissing: String = "伺服器尚未提供整組刪除",
    val dateTimePattern: String = "M月d日 HH:mm",
    val datePattern: String = "yyyy年M月d日",
    val unnamedFile: String = "未命名檔案",
    val shareTitle: String = "分享到匣雲",
    val shareLoginTitle: String = "請先登入匣雲",
    val shareLoginBody: String = "從其他 App 分享前，要先用現有帳號登入匣雲。",
    val shareOpenApp: String = "打開匣雲",
    val shareGroupTitle: String = "放到哪個分組？",
    val shareTextLead: String = "這則文字會存成筆記",
    val shareImageLead: String = "這張圖片會存成圖片",
    val shareLinkTitle: String = "連結",
    val shareFallbackTitle: String = "分享",
    val shareSaved: String = "已存進匣雲",
    val shareUnsupported: String = "匣雲只能接收文字、連結或圖片",
    val shareSaving: String = "正在存進匣雲…",
    val shareNewGroup: String = "或輸入新分組名稱",
    val shareGroupsFailed: String = "讀不到現有分組，仍可存到未分組或新名稱",
)

private val zhHant = AppCopy(
    brand = "匣雲",
    loginTitle = "登入匣雲",
    registerTitle = "建立匣雲帳號",
    loginLead = "檔案、圖片與筆記，只留在這個帳號。",
    registerLead = "密碼至少 8 個字元。這個帳號之後也可以在瀏覽器登入。",
    login = "登入",
    createAccount = "建立帳號",
    email = "電子郵件",
    password = "密碼",
    confirmPassword = "再輸入一次密碼",
    passwordMismatch = "兩次輸入的密碼不一樣",
    passkey = "通行密鑰",
    libraryTitle = "我的匣子",
    logout = "登出",
    newNote = "新增筆記",
    editNote = "編輯筆記",
    noteTitle = "標題",
    noteBody = "內文",
    save = "儲存",
    cancel = "取消",
    preview = "預覽",
    heading = "標題",
    bold = "粗體",
    list = "清單",
    link = "連結",
    code = "程式碼",
    edit = "編輯",
    langLabel = "語言",
    titleRequired = "請填寫筆記標題",
    emptyNote = "（沒有內文）",
)

private val zhHans = zhHant.copy(
    loginTitle = "登录匣云",
    registerTitle = "建立匣云账号",
    loginLead = "文件、图片和笔记，只留在这个账号。",
    registerLead = "密码至少 8 个字符。这个账号之后也可以在浏览器登录。",
    login = "登录",
    createAccount = "建立账号",
    email = "电子邮件",
    password = "密码",
    confirmPassword = "再输入一次密码",
    passwordMismatch = "两次输入的密码不一样",
    passkey = "通行密钥",
    libraryTitle = "我的匣子",
    logout = "登出",
    newNote = "新增笔记",
    editNote = "编辑笔记",
    noteTitle = "标题",
    noteBody = "正文",
    save = "保存",
    cancel = "取消",
    preview = "预览",
    heading = "标题",
    bold = "粗体",
    list = "列表",
    link = "链接",
    code = "代码",
    edit = "编辑",
    langLabel = "语言",
    titleRequired = "请填写笔记标题",
    emptyNote = "（没有正文）",
    creating = "建立中…",
    loggingIn = "登录中…",
    passkeyLogin = "用通行密钥登录",
    passkeyWaiting = "等待设备确认…",
    emailFirst = "请先输入电子邮件",
    passwordShort = "密码至少需要 8 个字符",
    passwordRequired = "请输入密码",
    server = "服务器地址",
    serverHelp = "一般安装会连到默认服务器。只有要改地址时才填这里。",
    address = "地址",
    backToBiometric = "回到生物识别",
    lockTitle = "匣云已锁定",
    lockBody = "用生物识别打开已保存的会话。",
    unlock = "以生物识别解锁",
    usePassword = "改用密码登录",
    missingSession = "找不到已保存的会话，请重新登录",
    offerTitle = "用生物识别解锁？",
    offerBody = "下次打开匣云时，可以用指纹或面部识别还原这次登录，不必再输入密码。",
    offerYes = "启用",
    offerNo = "暂时不要",
    refresh = "重新整理",
    more = "更多",
    biometricOn = "启用生物识别解锁",
    biometricOff = "关闭生物识别解锁",
    uploading = "正在上传…",
    savingNoteProgress = "正在保存笔记…",
    typeFile = "文件",
    typeImage = "图片",
    typeNote = "笔记",
    retry = "再试一次",
    newGroup = "新分组",
    newGroupMenu = "新分组…",
    newGroupName = "新分组名称",
    putInGroup = "放到 {name}",
    deleteGroupTitle = "删除这个分组？",
    deleteGroupBody = "删除「{name}」里面全部 {count} 个项目？",
    deleteItemTitle = "删除这个项目？",
    deleteItemBody = "「{name}」删除后无法恢复。",
    delete = "删除",
    close = "关闭",
    cannotSaveFile = "无法保存文件",
    back = "返回",
    noTags = "还没有标签",
    removeTag = "移除",
    addTag = "加上标签",
    add = "加上",
    addTagShort = "加标签",
    moveTo = "移到 {name}",
    moveAction = "移过去",
    imageFailed = "图片无法显示",
    download = "下载",
    tooLarge = "文件超过 32 MB 上限",
    cannotRead = "无法读取这个文件",
    search = "搜索名称或笔记正文",
    filterType = "类型",
    filterSort = "排序",
    allTypes = "全部",
    newest = "最新",
    oldest = "最旧",
    byName = "名称",
    showingCount = "显示 {count} 项",
    watchingTag = "正在看标签「{tag}」",
    clear = "清除",
    filtersCleared = "已清除筛选",
    tagCleared = "已清除标签筛选",
    emptyTitle = "匣子还是空的",
    emptyBody = "上传文件、图片，或写一则笔记。内容只属于这个账号。",
    noMatchTitle = "架子上没有对得上的东西",
    noMatchBody = "名称、笔记正文、类型或标签对不上。可以把条件清掉，再从整座书库看起。",
    clearFilters = "清除筛选",
    emptyGroup = "这个分组还没有东西。可以从别的架子移过来。",
    moveNewTitle = "移到新分组",
    groupName = "分组名称",
    groupExample = "例如 京都行",
    removeTagTitle = "移除标签？",
    removeTagBody = "从「{name}」移除「{tag}」。",
    collapseGroup = "收合{name}，共{count} 项",
    expandGroup = "展开{name}，共{count} 项",
    deleteNamed = "删除{name}",
    tagExample = "例如 待寄",
    tagFor = "为{name}加上标签",
    ungrouped = "未分组",
    sampleToken = "文字",
    notePlaced = "已把笔记「{title}」放进「{group}」",
    tagTooLong = "标签请留在十二个字以内",
    tagExists = "「{name}」已经有标签「{tag}」",
    tagAdded = "已为「{name}」加上「{tag}」",
    tagRemoved = "已从「{name}」移除「{tag}」",
    moved = "已把「{name}」移到「{group}」",
    groupDeleted = "已删除「{name}」里面 {count} 个项目",
    groupTooLong = "分组名称请留在四十个字以内",
    notSignedIn = "尚未登录",
    badServer = "服务器地址不正确",
    sessionExpired = "会话已失效，请重新登录",
    openProduct = "关于匣云",
    bioKey = "无法建立生物识别密钥",
    bioUnavailable = "这台设备无法使用生物识别解锁",
    bioEnableTitle = "启用生物识别解锁",
    bioEnableSubtitle = "确认后，下次打开匣云会用生物识别还原这个会话",
    bioSaveFailed = "无法保存生物识别会话",
    bioChanged = "生物识别已变更，请改用密码登录",
    bioReadFailed = "无法读取已保存的会话",
    bioUnlockTitle = "解锁匣云",
    bioUnlockSubtitle = "使用生物识别打开已保存的会话",
    bioUsePassword = "改用密码",
    bioDecryptFailed = "无法解开已保存的会话，请改用密码登录",
    bioIncomplete = "生物识别没有完成",
    passkeyNone = "这台设备没有回传通行密钥",
    passkeyCancelled = "已取消通行密钥登录",
    passkeyUnavailable = "这台设备目前无法使用通行密钥",
    passkeyUnavailableDetail = "这台设备目前无法使用通行密钥：{detail}",
    passkeyFailed = "通行密钥登录没有完成",
    network = "无法连线，请确认服务器地址后再试",
    generic = "服务器没有完成这个请求",
    passkeyMissing = "服务器尚未提供通行密钥登录",
    passkeyFormat = "服务器回传的通行密钥格式无法辨识",
    passkeyResponse = "通行密钥响应格式不正确",
    noSession = "登录没有回传会话，请稍后再试",
    patchMissing = "服务器尚未提供分组和标签更新",
    groupDeleteMissing = "服务器尚未提供整组删除",
    unnamedFile = "未命名文件",
    openFiles = "在浏览器打开文件",
    shareTitle = "分享到匣云",
    shareLoginTitle = "请先登录匣云",
    shareLoginBody = "从其他应用分享前，要先用现有账号登录匣云。",
    shareOpenApp = "打开匣云",
    shareGroupTitle = "放到哪个分组？",
    shareTextLead = "这段文字会存成笔记",
    shareImageLead = "这张图片会存成图片",
    shareLinkTitle = "链接",
    shareFallbackTitle = "分享",
    shareSaved = "已存进匣云",
    shareUnsupported = "匣云只能接收文字、链接或图片",
    shareSaving = "正在存进匣云…",
    shareNewGroup = "或输入新分组名称",
    shareGroupsFailed = "读不到现有分组，仍可存到未分组或新名称",
)

private val en = AppCopy(
    brand = "Xia Yun",
    loginTitle = "Log in to Xia Yun",
    registerTitle = "Create a Xia Yun account",
    loginLead = "Files, pictures, and notes stay in this account.",
    registerLead = "Use at least 8 characters. You can use the same account in the browser.",
    login = "Log in",
    createAccount = "Create account",
    email = "Email",
    password = "Password",
    confirmPassword = "Confirm password",
    passwordMismatch = "The two passwords do not match",
    passkey = "Passkey",
    libraryTitle = "My box",
    logout = "Log out",
    newNote = "New note",
    editNote = "Edit note",
    noteTitle = "Title",
    noteBody = "Body",
    save = "Save",
    cancel = "Cancel",
    preview = "Preview",
    heading = "Heading",
    bold = "Bold",
    list = "List",
    link = "Link",
    code = "Code",
    edit = "Edit",
    langLabel = "Language",
    titleRequired = "Enter a note title",
    emptyNote = "(empty note)",
    creating = "Creating…",
    loggingIn = "Logging in…",
    passkeyLogin = "Log in with a passkey",
    passkeyWaiting = "Waiting for the device…",
    emailFirst = "Enter your email first",
    passwordShort = "Use at least 8 characters",
    passwordRequired = "Enter your password",
    server = "Server address",
    serverHelp = "The installed app uses the default server. Fill this in only when you need a different address.",
    address = "Address",
    backToBiometric = "Back to biometrics",
    lockTitle = "Xia Yun is locked",
    lockBody = "Use biometrics to open the saved session.",
    unlock = "Unlock with biometrics",
    usePassword = "Use a password instead",
    missingSession = "No saved session. Log in again.",
    offerTitle = "Unlock with biometrics?",
    offerBody = "Next time you open Xia Yun, a fingerprint or face can restore this login.",
    offerYes = "Turn on",
    offerNo = "Not now",
    refresh = "Refresh",
    more = "More",
    biometricOn = "Turn on biometric unlock",
    biometricOff = "Turn off biometric unlock",
    uploading = "Uploading…",
    savingNoteProgress = "Saving the note…",
    typeFile = "File",
    typeImage = "Picture",
    typeNote = "Note",
    retry = "Try again",
    newGroup = "New group",
    newGroupMenu = "New group…",
    newGroupName = "New group name",
    putInGroup = "Put in {name}",
    deleteGroupTitle = "Delete this group?",
    deleteGroupBody = "Delete all {count} items in “{name}”?",
    deleteItemTitle = "Delete this item?",
    deleteItemBody = "“{name}” cannot be restored.",
    delete = "Delete",
    close = "Close",
    cannotSaveFile = "Could not save the file",
    back = "Back",
    noTags = "No tags yet",
    removeTag = "Remove",
    addTag = "Add a tag",
    add = "Add",
    addTagShort = "Add tag",
    moveTo = "Move to {name}",
    moveAction = "Move",
    imageFailed = "This picture cannot be shown",
    download = "Download",
    tooLarge = "The file is over the 32 MB limit",
    cannotRead = "Could not read this file",
    search = "Search names or note text",
    filterType = "Type",
    filterSort = "Sort",
    allTypes = "All",
    newest = "Newest",
    oldest = "Oldest",
    byName = "Name",
    showingCount = "Showing {count}",
    watchingTag = "Tag “{tag}”",
    clear = "Clear",
    filtersCleared = "Filters cleared",
    tagCleared = "Tag filter cleared",
    emptyTitle = "This box is empty",
    emptyBody = "Upload a file or picture, or write a note. It stays in this account.",
    noMatchTitle = "Nothing on the shelf matches",
    noMatchBody = "The name, note, type, or tag does not match. Clear the filters and look through the library.",
    clearFilters = "Clear filters",
    emptyGroup = "This group is empty. You can move something here from another shelf.",
    moveNewTitle = "Move to a new group",
    groupName = "Group name",
    groupExample = "For example, Kyoto",
    removeTagTitle = "Remove this tag?",
    removeTagBody = "Remove “{tag}” from “{name}”.",
    collapseGroup = "Collapse {name}, {count} items",
    expandGroup = "Expand {name}, {count} items",
    deleteNamed = "Delete {name}",
    tagExample = "For example, to send",
    tagFor = "Add a tag to {name}",
    ungrouped = "Ungrouped",
    sampleToken = "text",
    notePlaced = "Note “{title}” is in “{group}”",
    tagTooLong = "Keep the tag within twelve characters",
    tagExists = "“{name}” already has the tag “{tag}”",
    tagAdded = "Added “{tag}” to “{name}”",
    tagRemoved = "Removed “{tag}” from “{name}”",
    moved = "Moved “{name}” to “{group}”",
    groupDeleted = "Deleted {count} items in “{name}”",
    groupTooLong = "Keep the group name within forty characters",
    notSignedIn = "Not signed in",
    badServer = "That server address is not valid",
    sessionExpired = "This session expired. Log in again.",
    openProduct = "About Xia Yun",
    bioKey = "Could not create a biometric key",
    bioUnavailable = "This device cannot use biometric unlock",
    bioEnableTitle = "Turn on biometric unlock",
    bioEnableSubtitle = "After you confirm, Xia Yun can restore this session with biometrics",
    bioSaveFailed = "Could not save the biometric session",
    bioChanged = "Biometrics changed. Log in with your password.",
    bioReadFailed = "Could not read the saved session",
    bioUnlockTitle = "Unlock Xia Yun",
    bioUnlockSubtitle = "Use biometrics to open the saved session",
    bioUsePassword = "Use password",
    bioDecryptFailed = "Could not unlock the saved session. Log in with your password.",
    bioIncomplete = "Biometrics did not finish",
    passkeyNone = "This device did not return a passkey",
    passkeyCancelled = "Passkey login was cancelled",
    passkeyUnavailable = "This device cannot use a passkey right now",
    passkeyUnavailableDetail = "This device cannot use a passkey right now: {detail}",
    passkeyFailed = "Passkey login did not finish",
    network = "Could not connect. Check the server address and try again.",
    generic = "The server did not finish this request",
    passkeyMissing = "This server does not offer passkey login yet",
    passkeyFormat = "The passkey from the server could not be read",
    passkeyResponse = "The passkey response is not valid",
    noSession = "Login did not return a session. Try again later.",
    patchMissing = "This server cannot update groups and tags yet",
    groupDeleteMissing = "This server cannot delete a whole group yet",
    dateTimePattern = "MMM d, HH:mm",
    datePattern = "MMM d, yyyy",
    unnamedFile = "Untitled file",
    openFiles = "Open files in the browser",
    shareTitle = "Share to Xia Yun",
    shareLoginTitle = "Log in to Xia Yun first",
    shareLoginBody = "Log in with your existing Xia Yun account before sharing from another app.",
    shareOpenApp = "Open Xia Yun",
    shareGroupTitle = "Which group?",
    shareTextLead = "This text is saved as a note",
    shareImageLead = "This picture is saved as an image",
    shareLinkTitle = "Link",
    shareFallbackTitle = "Share",
    shareSaved = "Saved to Xia Yun",
    shareUnsupported = "Xia Yun can accept text, a link, or a picture",
    shareSaving = "Saving to Xia Yun…",
    shareNewGroup = "Or type a new group name",
    shareGroupsFailed = "Existing groups could not be loaded. You can still use Ungrouped or a new name.",
)


fun fill(template: String, values: Map<String, String>): String {
    var result = template
    for ((key, value) in values) result = result.replace("{$key}", value)
    return result
}

fun displayGroup(name: String, copy: AppCopy): String =
    if (name == app.xiayun.core.UNGROUPED_LABEL) copy.ungrouped else name

fun openProductPage(context: Context) {
    val page = Intent(Intent.ACTION_VIEW, Uri.parse("${BaseUrls.DEFAULT}/product"))
    context.startActivity(page)
}

fun openFilesPage(context: Context) {
    val page = Intent(Intent.ACTION_VIEW, Uri.parse("${BaseUrls.DEFAULT}/files"))
    context.startActivity(page)
}

fun itemStamp(type: String, createdAt: String, size: Long, copy: AppCopy): String {
    val whenText = if (type == "text") {
        app.xiayun.core.formatCatalogDate(createdAt, pattern = copy.datePattern)
    } else {
        app.xiayun.core.formatTimestamp(createdAt, pattern = copy.dateTimePattern)
    }
    return "${displayType(type, copy)} · $whenText · ${app.xiayun.core.formatBytes(size)}"
}

fun displayType(type: String, copy: AppCopy): String = when (type) {
    "image" -> copy.typeImage
    "text" -> copy.typeNote
    else -> copy.typeFile
}

fun knownMessage(message: String, copy: AppCopy): String {
    val table = mapOf(
        app.xiayun.core.ClientMessages.NETWORK to copy.network,
        app.xiayun.core.ClientMessages.GENERIC to copy.generic,
        app.xiayun.core.ClientMessages.PASSKEY_MISSING to copy.passkeyMissing,
        app.xiayun.core.ClientMessages.PASSKEY_FORMAT to copy.passkeyFormat,
        app.xiayun.core.ClientMessages.PASSKEY_RESPONSE to copy.passkeyResponse,
        app.xiayun.core.ClientMessages.NO_SESSION to copy.noSession,
        app.xiayun.core.ClientMessages.TOO_LARGE to copy.tooLarge,
        app.xiayun.core.ClientMessages.BAD_URL to copy.badServer,
        app.xiayun.core.ClientMessages.NOTE_TITLE to copy.titleRequired,
        app.xiayun.core.ClientMessages.NEED_EMAIL to copy.emailFirst,
        "伺服器尚未提供分組與標籤更新" to copy.patchMissing,
        "伺服器尚未提供整組刪除" to copy.groupDeleteMissing,
        "尚未登入" to copy.notSignedIn,
        "無法讀取這個檔案" to copy.cannotRead,
    )
    return table[message] ?: message
}

fun copyFor(lang: AppLang) = when (lang) {
    AppLang.ZhHant -> zhHant
    AppLang.ZhHans -> zhHans
    AppLang.En -> en
}

fun parseAppLang(code: String?) = when (code) {
    "zh-Hans" -> AppLang.ZhHans
    "en" -> AppLang.En
    else -> AppLang.ZhHant
}

private const val PREFS = "xia-yun"
private const val KEY = "xy-lang"

fun readAppLang(context: Context): AppLang {
    val stored = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)
    return parseAppLang(stored)
}

fun writeAppLang(context: Context, lang: AppLang) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, lang.code).apply()
}

val LocalAppCopy = compositionLocalOf { zhHant }
val LocalAppLang = compositionLocalOf { AppLang.ZhHant }
val LocalSetLang = compositionLocalOf<(AppLang) -> Unit> { {} }

@Composable
fun LanguageSwitcher() {
    val current = LocalAppLang.current
    val copy = LocalAppCopy.current
    val setLang = LocalSetLang.current
    Row(
        modifier = Modifier.horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        AppLang.entries.forEach { lang ->
            val label = when (lang) {
                AppLang.ZhHant -> "繁體"
                AppLang.ZhHans -> "简体"
                AppLang.En -> "EN"
            }
            FilterChip(
                selected = lang == current,
                onClick = { setLang(lang) },
                label = { Text(label) },
            )
        }
    }
    Text(copy.langLabel, modifier = Modifier.padding(0.dp), style = MaterialTheme.typography.labelSmall)
}

@Composable
fun MarkdownEditor(value: String, onValueChange: (String) -> Unit) {
    val copy = LocalAppCopy.current
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            modifier = Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            OutlinedButton(onClick = { onValueChange(insert(value, "## ", "", copy.sampleToken)) }) { Text(copy.heading) }
            OutlinedButton(onClick = { onValueChange(insert(value, "**", "**", copy.sampleToken)) }) { Text(copy.bold) }
            OutlinedButton(onClick = { onValueChange(insert(value, "\n- ", "", copy.sampleToken)) }) { Text(copy.list) }
            OutlinedButton(onClick = { onValueChange(insert(value, "[", "](https://)", copy.sampleToken)) }) { Text(copy.link) }
            OutlinedButton(onClick = { onValueChange(insert(value, "`", "`", copy.sampleToken)) }) { Text(copy.code) }
        }
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            label = { Text(copy.noteBody) },
            modifier = Modifier.fillMaxWidth().heightIn(min = 140.dp),
        )
        Surface(tonalElevation = 1.dp, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp)) {
                Text(copy.preview, style = MaterialTheme.typography.labelMedium)
                if (value.isBlank()) {
                    Text("—", color = MaterialTheme.colorScheme.onSurfaceVariant)
                } else {
                    MarkdownPreview(value)
                }
            }
        }
    }
}

private fun insert(value: String, before: String, after: String, token: String): String {
    return value + before + token + after
}

@Composable
fun MarkdownPreview(source: String) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        source.replace("\r\n", "\n").split("\n").forEach { raw ->
            val line = raw.trimEnd()
            when {
                line.startsWith("```") -> Unit
                line.startsWith("### ") -> Text(inline(line.removePrefix("### ")), style = MaterialTheme.typography.titleMedium)
                line.startsWith("## ") -> Text(inline(line.removePrefix("## ")), style = MaterialTheme.typography.titleLarge)
                line.startsWith("# ") -> Text(inline(line.removePrefix("# ")), style = MaterialTheme.typography.headlineSmall)
                line.startsWith("- ") -> Text(inline("• ${line.removePrefix("- ")}"))
                line.isBlank() -> Unit
                else -> Text(inline(line))
            }
        }
    }
}

private fun inline(source: String) = buildAnnotatedString {
    var index = 0
    while (index < source.length) {
        if (source.startsWith("**", index)) {
            val end = source.indexOf("**", index + 2)
            if (end > index) {
                withStyle(SpanStyle(fontWeight = FontWeight.Bold)) {
                    append(source.substring(index + 2, end))
                }
                index = end + 2
                continue
            }
        }
        if (source[index] == '`') {
            val end = source.indexOf('`', index + 1)
            if (end > index) {
                withStyle(SpanStyle(fontFamily = FontFamily.Monospace)) {
                    append(source.substring(index + 1, end))
                }
                index = end + 1
                continue
            }
        }
        val link = Regex("""\[([^\]]+)\]\((https?://[^)\s]+)\)""").find(source, index)
        if (link != null && link.range.first == index) {
            append(link.groupValues[1])
            index = link.range.last + 1
            continue
        }
        append(source[index])
        index += 1
    }
}
