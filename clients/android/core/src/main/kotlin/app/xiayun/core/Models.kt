package app.xiayun.core

import kotlinx.serialization.Serializable

object ClientMessages {
    const val NETWORK = "無法連線，請確認伺服器位址後再試"
    const val GENERIC = "伺服器沒有完成這個請求"
    const val PASSKEY_MISSING = "伺服器尚未提供通行密鑰登入"
    const val PASSKEY_FORMAT = "伺服器回傳的通行密鑰格式無法辨識"
    const val PASSKEY_RESPONSE = "通行密鑰回應格式不正確"
    const val NO_SESSION = "登入沒有回傳工作階段，請稍後再試"
    const val TOO_LARGE = "檔案超過 32 MB 上限"
    const val BAD_URL = "伺服器位址不正確"
    const val NOTE_TITLE = "請填寫筆記標題"
    const val NOTE_TITLE_LONG = "筆記標題最長 200 個字元"
    const val NOTE_BODY = "筆記內文格式不正確"
    const val NOTE_BODY_LONG = "筆記內文最長 10 萬個字元"
    const val NEED_EMAIL = "請先輸入電子郵件"
}

object Limits {
    const val MAX_UPLOAD_BYTES = 32L * 1024 * 1024
    const val MIN_PASSWORD = 8
    const val MAX_PASSWORD = 128
    const val MAX_NOTE_TITLE = 200
    const val MAX_NOTE_BODY = 100_000
    const val MAX_ITEM_NAME = 255
}

@Serializable
data class PublicUser(
    val id: String,
    val email: String,
    val createdAt: String = "",
)

@Serializable
data class AuthSession(
    val token: String,
    val email: String = "",
    val userId: String = "",
) {
    fun hasToken(): Boolean = token.isNotBlank()
}

@Serializable
data class CloudItem(
    val id: String,
    val ownerId: String = "",
    val type: String,
    val name: String,
    val size: Long = 0,
    val mimeType: String? = null,
    val createdAt: String = "",
    val excerpt: String? = null,
    val body: String? = null,
    val group: String? = null,
    val tags: List<String> = emptyList(),
)

@Serializable
data class LinkPreview(
    val url: String,
    val title: String? = null,
    val description: String? = null,
    val image: String? = null,
    val site: String = "",
)

data class ItemPatchResult(
    val item: CloudItem,
    val echoedGroup: Boolean,
    val echoedTags: Boolean,
)

data class Upload(
    val filename: String,
    val displayName: String?,
    val mimeType: String,
    val bytes: ByteArray,
    val group: String? = null,
)

data class ApiError(
    val status: Int,
    val code: String?,
    val message: String,
)

sealed class ApiResult<out T> {
    data class Ok<T>(val value: T) : ApiResult<T>()
    data class Err(val error: ApiError) : ApiResult<Nothing>()
}

inline fun <T, R> ApiResult<T>.map(transform: (T) -> R): ApiResult<R> = when (this) {
    is ApiResult.Ok -> ApiResult.Ok(transform(value))
    is ApiResult.Err -> this
}
