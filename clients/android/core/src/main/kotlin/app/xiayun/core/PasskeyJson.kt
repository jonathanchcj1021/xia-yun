package app.xiayun.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

internal val apiJson = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
}

internal fun JsonObject.optString(key: String): String? {
    val element = this[key] ?: return null
    if (element !is JsonPrimitive || element is JsonNull || !element.isString) return null
    return element.content.takeIf { it.isNotBlank() }
}

fun extractPasskeyRequestJson(body: String): String? {
    val root = try {
        apiJson.parseToJsonElement(body) as? JsonObject
    } catch (_: Exception) {
        return null
    } ?: return null
    val candidate = when {
        root.optString("challenge") != null -> root
        root["publicKey"] is JsonObject && (root["publicKey"] as JsonObject).optString("challenge") != null ->
            root["publicKey"] as JsonObject
        root["options"] is JsonObject && (root["options"] as JsonObject).optString("challenge") != null ->
            root["options"] as JsonObject
        else -> return null
    }
    return apiJson.encodeToString(JsonObject.serializer(), candidate)
}

fun passkeyVerifyBody(email: String, authenticationResponseJson: String): String? {
    val response = try {
        apiJson.parseToJsonElement(authenticationResponseJson) as? JsonObject
    } catch (_: Exception) {
        return null
    } ?: return null
    if (response.optString("id") == null) return null
    if (response["response"] !is JsonObject) return null
    val payload = buildJsonObject {
        put("email", email.trim())
        put("response", response)
        put("client", "native")
    }
    return apiJson.encodeToString(JsonObject.serializer(), payload)
}
