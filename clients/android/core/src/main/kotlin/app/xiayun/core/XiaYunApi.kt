package app.xiayun.core

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import okhttp3.CookieJar
import okhttp3.Headers
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

class XiaYunApi internal constructor(
    private val baseUrlProvider: () -> String,
    private val http: OkHttpClient,
) {
    constructor(baseUrlProvider: () -> String) : this(baseUrlProvider, defaultClient())

    constructor(baseUrl: String) : this({ baseUrl }, defaultClient())

    suspend fun login(email: String, password: String): ApiResult<AuthSession> {
        val payload = buildJsonObject {
            put("email", email.trim())
            put("password", password)
            put("client", "native")
        }
        return postAuth("/api/auth/login", payload)
    }

    suspend fun register(email: String, password: String): ApiResult<AuthSession> {
        val payload = buildJsonObject {
            put("email", email.trim())
            put("password", password)
        }
        return postAuth("/api/auth/register", payload)
    }

    suspend fun logout(session: AuthSession): ApiResult<Unit> {
        val builder = authed("/api/auth/logout", session) ?: return badUrl()
        val raw = execute(builder.post("{}".toRequestBody(JSON)).build())
        return raw.map { }
    }

    suspend fun me(session: AuthSession): ApiResult<PublicUser> {
        val builder = authed("/api/auth/me", session) ?: return badUrl()
        val raw = execute(builder.get().build())
        return raw.decode { body ->
            val user = apiJson.parseToJsonElement(body.text()).jsonObject["user"]?.jsonObject
                ?: error("missing user")
            apiJson.decodeFromJsonElement(PublicUser.serializer(), user)
        }
    }

    suspend fun listItems(session: AuthSession): ApiResult<List<CloudItem>> {
        val builder = authed("/api/items", session) ?: return badUrl()
        val raw = execute(builder.get().build())
        return raw.decode { body ->
            val array = apiJson.parseToJsonElement(body.text()).jsonObject["items"]?.jsonArray
                ?: return@decode emptyList()
            array.map { apiJson.decodeFromJsonElement(CloudItem.serializer(), normalizeItemElement(it)) }
        }
    }

    suspend fun linkPreview(url: String): ApiResult<LinkPreview> {
        val builder = anonymous("/api/link-preview", mapOf("url" to url)) ?: return badUrl()
        val raw = execute(builder.get().build())
        return raw.decode { body ->
            val preview = apiJson.parseToJsonElement(body.text()).jsonObject["preview"]?.jsonObject
                ?: error("missing preview")
            apiJson.decodeFromJsonElement(LinkPreview.serializer(), preview)
        }
    }

    suspend fun getItem(session: AuthSession, id: String): ApiResult<CloudItem> {
        val builder = authed("/api/items/$id", session) ?: return badUrl()
        val raw = execute(builder.get().build())
        return raw.decode { parseItem(it.text()) }
    }

    suspend fun content(session: AuthSession, id: String, attachment: Boolean): ApiResult<ByteArray> {
        val query = if (attachment) mapOf("disposition" to "attachment") else emptyMap()
        val builder = authed("/api/items/$id/content", session, query) ?: return badUrl()
        val raw = execute(builder.get().header("Accept", "*/*").build())
        return raw.map { it.bytes }
    }

    suspend fun patchItem(
        session: AuthSession,
        id: String,
        group: String? = null,
        tags: List<String>? = null,
        setGroup: Boolean = false,
        setTags: Boolean = false,
    ): ApiResult<ItemPatchResult?> {
        if (!setGroup && !setTags) {
            return ApiResult.Err(ApiError(0, "VALIDATION", ClientMessages.GENERIC))
        }
        val payload = buildJsonObject {
            if (setGroup) {
                val cleaned = canonicalGroup(group)
                if (cleaned == null) put("group", JsonNull) else put("group", cleaned)
            }
            if (setTags) {
                putJsonArray("tags") {
                    (tags ?: emptyList()).forEach { add(it) }
                }
            }
        }
        val builder = authed("/api/items/$id", session) ?: return badUrl()
        val raw = execute(builder.patch(encode(payload).toRequestBody(JSON)).build())
        if (raw is ApiResult.Err && raw.error.status == 405) {
            return ApiResult.Err(raw.error.copy(message = "伺服器尚未提供分組與標籤更新"))
        }
        return raw.decode { body ->
            val text = body.text()
            if (text.isBlank()) return@decode null
            val root = apiJson.parseToJsonElement(text).jsonObject
            val element = root["item"] ?: root
            if (element !is JsonObject || element["id"] == null) return@decode null
            ItemPatchResult(
                item = apiJson.decodeFromJsonElement(CloudItem.serializer(), normalizeItemElement(element)),
                echoedGroup = element.containsKey("group"),
                echoedTags = element.containsKey("tags"),
            )
        }
    }

    suspend fun deleteItems(session: AuthSession, ids: List<String>): ApiResult<Int> {
        val payload = buildJsonObject {
            put("ids", JsonArray(ids.map { JsonPrimitive(it) }))
        }
        val builder = authed("/api/items/bulk-delete", session) ?: return badUrl()
        val raw = execute(builder.post(encode(payload).toRequestBody(JSON)).build())
        return raw.decode { body ->
            val value = apiJson.parseToJsonElement(body.text()).jsonObject["deleted"] as? JsonPrimitive
                ?: error("missing deleted")
            value.intOrNull ?: value.longOrNull?.toInt() ?: error("missing deleted")
        }
    }

    suspend fun deleteItem(session: AuthSession, id: String): ApiResult<Unit> {
        val builder = authed("/api/items/$id", session) ?: return badUrl()
        val raw = execute(builder.delete().build())
        return raw.map { }
    }

    suspend fun deleteGroup(session: AuthSession, group: String?): ApiResult<Int> {
        val payload = buildJsonObject {
            val cleaned = canonicalGroup(group)
            if (cleaned == null) put("group", JsonNull) else put("group", cleaned)
        }
        val builder = authed("/api/items", session) ?: return badUrl()
        val raw = execute(builder.delete(encode(payload).toRequestBody(JSON)).build())
        if (raw is ApiResult.Err && raw.error.status == 405) {
            return ApiResult.Err(raw.error.copy(message = "伺服器尚未提供整組刪除"))
        }
        return raw.decode { body ->
            val value = apiJson.parseToJsonElement(body.text()).jsonObject["deleted"] as? JsonPrimitive
                ?: error("missing deleted")
            value.intOrNull ?: value.longOrNull?.toInt() ?: error("missing deleted")
        }
    }

    suspend fun createNote(
        session: AuthSession,
        title: String,
        body: String,
        group: String? = null,
    ): ApiResult<CloudItem> {
        val trimmed = title.trim()
        if (trimmed.isEmpty()) {
            return ApiResult.Err(ApiError(0, "VALIDATION", ClientMessages.NOTE_TITLE))
        }
        if (trimmed.length > Limits.MAX_NOTE_TITLE) {
            return ApiResult.Err(ApiError(0, "VALIDATION", ClientMessages.NOTE_TITLE_LONG))
        }
        if (body.length > Limits.MAX_NOTE_BODY) {
            return ApiResult.Err(ApiError(0, "VALIDATION", ClientMessages.NOTE_BODY_LONG))
        }
        val payload = buildJsonObject {
            put("type", "text")
            put("title", trimmed)
            put("body", body)
            val cleaned = canonicalGroup(group)
            if (cleaned != null) put("group", cleaned)
        }
        val builder = authed("/api/items", session) ?: return badUrl()
        val raw = execute(builder.post(encode(payload).toRequestBody(JSON)).build())
        return raw.decode { parseItem(it.text()) }
    }

    suspend fun updateNote(session: AuthSession, id: String, title: String, body: String): ApiResult<CloudItem> {
        val trimmed = title.trim()
        if (trimmed.isEmpty()) {
            return ApiResult.Err(ApiError(0, "VALIDATION", ClientMessages.NOTE_TITLE))
        }
        if (trimmed.length > Limits.MAX_NOTE_TITLE) {
            return ApiResult.Err(ApiError(0, "VALIDATION", ClientMessages.NOTE_TITLE_LONG))
        }
        if (body.length > Limits.MAX_NOTE_BODY) {
            return ApiResult.Err(ApiError(0, "VALIDATION", ClientMessages.NOTE_BODY_LONG))
        }
        val payload = buildJsonObject {
            put("title", trimmed)
            put("body", body)
        }
        val builder = authed("/api/items/$id", session) ?: return badUrl()
        val raw = execute(builder.patch(encode(payload).toRequestBody(JSON)).build())
        return raw.decode { parseItem(it.text()) }
    }

    suspend fun upload(session: AuthSession, upload: Upload): ApiResult<CloudItem> {
        if (upload.bytes.size.toLong() > Limits.MAX_UPLOAD_BYTES) {
            return ApiResult.Err(ApiError(413, "PAYLOAD_TOO_LARGE", ClientMessages.TOO_LARGE))
        }
        val filename = sanitizeFileName(upload.filename)
        val display = sanitizeFileName(upload.displayName?.takeIf { it.isNotBlank() } ?: filename)
        val mime = normalizeMime(upload.mimeType)
        val type = hintedItemType(mime)
        val multipartBuilder = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("name", display)
            .addFormDataPart("type", type)
        val cleanedGroup = canonicalGroup(upload.group)
        if (cleanedGroup != null) {
            multipartBuilder.addFormDataPart("group", cleanedGroup)
        }
        val multipart = multipartBuilder
            .addFormDataPart(
                "file",
                filename,
                upload.bytes.toRequestBody(mime.toMediaType()),
            )
            .build()
        val builder = authed("/api/items", session) ?: return badUrl()
        val raw = execute(builder.post(multipart).build())
        return raw.decode { parseItem(it.text()) }
    }

    suspend fun passkeyOptions(email: String): ApiResult<String> {
        val payload = buildJsonObject { put("email", email.trim()) }
        val builder = anonymous("/api/auth/passkey/login/options") ?: return badUrl()
        val raw = execute(builder.post(encode(payload).toRequestBody(JSON)).build())
        return when (raw) {
            is ApiResult.Err -> raw
            is ApiResult.Ok -> {
                val requestJson = extractPasskeyRequestJson(raw.value.text())
                if (requestJson == null) {
                    ApiResult.Err(ApiError(raw.value.code, "WEBAUTHN", ClientMessages.PASSKEY_FORMAT))
                } else {
                    ApiResult.Ok(requestJson)
                }
            }
        }
    }

    suspend fun passkeyVerify(email: String, authenticationResponseJson: String): ApiResult<AuthSession> {
        val body = passkeyVerifyBody(email, authenticationResponseJson)
            ?: return ApiResult.Err(ApiError(0, "VALIDATION", ClientMessages.PASSKEY_RESPONSE))
        val builder = anonymous("/api/auth/passkey/login/verify") ?: return badUrl()
        val raw = execute(builder.post(body.toRequestBody(JSON)).build())
        return when (raw) {
            is ApiResult.Err -> raw
            is ApiResult.Ok -> sessionFrom(raw.value)
        }
    }

    private suspend fun postAuth(path: String, payload: JsonObject): ApiResult<AuthSession> {
        val builder = anonymous(path) ?: return badUrl()
        val raw = execute(builder.post(encode(payload).toRequestBody(JSON)).build())
        return when (raw) {
            is ApiResult.Err -> raw
            is ApiResult.Ok -> sessionFrom(raw.value)
        }
    }

    private fun sessionFrom(raw: Raw): ApiResult<AuthSession> {
        val cookie = sessionCookie(raw.headers.values("Set-Cookie"))
        var jsonToken: String? = null
        var email = ""
        var userId = ""
        val text = raw.text()
        if (text.isNotBlank()) {
            try {
                val obj = apiJson.parseToJsonElement(text).jsonObject
                jsonToken = obj.optString("token")
                val user = obj["user"] as? JsonObject
                if (user != null) {
                    email = user.optString("email").orEmpty()
                    userId = user.optString("id").orEmpty()
                }
            } catch (_: Exception) {
                if (cookie == null && jsonToken == null) {
                    return ApiResult.Err(ApiError(raw.code, null, ClientMessages.GENERIC))
                }
            }
        }
        val token = bearerFrom(jsonToken, cookie)
            ?: return ApiResult.Err(ApiError(raw.code, null, ClientMessages.NO_SESSION))
        return ApiResult.Ok(AuthSession(token = token, email = email, userId = userId))
    }

    private fun parseItem(text: String): CloudItem {
        val item = apiJson.parseToJsonElement(text).jsonObject["item"]
            ?: error("missing item")
        return apiJson.decodeFromJsonElement(CloudItem.serializer(), normalizeItemElement(item))
    }

    private fun normalizeItemElement(element: JsonElement): JsonObject {
        val source = element as? JsonObject ?: return buildJsonObject { }
        val fields = source.toMutableMap()
        val group = fields["group"]
        val cleanedGroup = when (group) {
            null, is JsonNull -> null
            is JsonPrimitive -> group.contentOrNull?.let { canonicalGroup(it) }
            else -> null
        }
        if (cleanedGroup == null) fields.remove("group") else fields["group"] = JsonPrimitive(cleanedGroup)
        val tags = when (val raw = fields["tags"]) {
            is JsonArray -> raw.mapNotNull { entry ->
                val text = (entry as? JsonPrimitive)?.contentOrNull ?: return@mapNotNull null
                normalizeTag(text).takeIf { it.isNotEmpty() }
            }
            else -> emptyList()
        }
        fields["tags"] = JsonArray(tags.map { JsonPrimitive(it) })
        return JsonObject(fields)
    }

    private fun anonymous(path: String, query: Map<String, String> = emptyMap()): Request.Builder? {
        val url = buildUrl(path, query) ?: return null
        return Request.Builder()
            .url(url)
            .header("Accept", "application/json")
            .header("User-Agent", USER_AGENT)
    }

    private fun authed(
        path: String,
        session: AuthSession,
        query: Map<String, String> = emptyMap(),
    ): Request.Builder? {
        if (!session.hasToken()) return null
        return anonymous(path, query)?.header("Authorization", "Bearer ${session.token}")
    }

    private fun buildUrl(path: String, query: Map<String, String>): String? {
        val base = BaseUrls.normalize(baseUrlProvider()) ?: return null
        val builder = "$base/".toHttpUrlOrNull()?.newBuilder() ?: return null
        path.trim('/').split('/').filter { it.isNotEmpty() }.forEach { builder.addPathSegment(it) }
        query.forEach { (key, value) -> builder.addQueryParameter(key, value) }
        return builder.build().toString()
    }

    private suspend fun execute(request: Request): ApiResult<Raw> = withContext(Dispatchers.IO) {
        try {
            http.newCall(request).execute().use { response ->
                val bytes = response.body?.bytes() ?: ByteArray(0)
                val raw = Raw(response.code, bytes, response.headers, response.request.url.encodedPath)
                if (!response.isSuccessful) {
                    ApiResult.Err(parseError(raw))
                } else {
                    ApiResult.Ok(raw)
                }
            }
        } catch (_: IOException) {
            ApiResult.Err(ApiError(0, "NETWORK", ClientMessages.NETWORK))
        }
    }

    private fun parseError(raw: Raw): ApiError {
        val text = raw.text()
        var message: String? = null
        var code: String? = null
        if (text.isNotBlank()) {
            try {
                val obj = apiJson.parseToJsonElement(text).jsonObject
                code = obj.optString("code")
                message = obj.optString("error")
            } catch (_: Exception) {
                message = null
            }
        }
        if (message.isNullOrBlank()) {
            message = if (raw.code == 404 && raw.path.contains("/api/auth/passkey/")) {
                ClientMessages.PASSKEY_MISSING
            } else {
                ClientMessages.GENERIC
            }
        }
        return ApiError(raw.code, code, message)
    }

    private inline fun <T> ApiResult<Raw>.decode(block: (Raw) -> T): ApiResult<T> = when (this) {
        is ApiResult.Err -> this
        is ApiResult.Ok -> try {
            ApiResult.Ok(block(value))
        } catch (_: Exception) {
            ApiResult.Err(ApiError(value.code, null, ClientMessages.GENERIC))
        }
    }

    private fun encode(obj: JsonObject): String = apiJson.encodeToString(JsonObject.serializer(), obj)

    private fun badUrl(): ApiResult<Nothing> = ApiResult.Err(ApiError(0, "VALIDATION", ClientMessages.BAD_URL))

    private class Raw(
        val code: Int,
        val bytes: ByteArray,
        val headers: Headers,
        val path: String,
    ) {
        fun text(): String = bytes.toString(Charsets.UTF_8)
    }

    companion object {
        private val JSON = "application/json; charset=utf-8".toMediaType()
        private const val USER_AGENT = "XiaYun-Android"

        fun defaultClient(): OkHttpClient = OkHttpClient.Builder()
            .cookieJar(CookieJar.NO_COOKIES)
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(90, TimeUnit.SECONDS)
            .writeTimeout(120, TimeUnit.SECONDS)
            .build()
    }
}
