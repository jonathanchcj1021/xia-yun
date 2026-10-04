package app.xiayun.android.ui

import android.content.Context
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
)

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
            OutlinedButton(onClick = { onValueChange(insert(value, "## ", "")) }) { Text(copy.heading) }
            OutlinedButton(onClick = { onValueChange(insert(value, "**", "**")) }) { Text(copy.bold) }
            OutlinedButton(onClick = { onValueChange(insert(value, "\n- ", "")) }) { Text(copy.list) }
            OutlinedButton(onClick = { onValueChange(insert(value, "[", "](https://)")) }) { Text(copy.link) }
            OutlinedButton(onClick = { onValueChange(insert(value, "`", "`")) }) { Text(copy.code) }
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

private fun insert(value: String, before: String, after: String): String {
    val selected = "文字"
    return value + before + selected + after
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
