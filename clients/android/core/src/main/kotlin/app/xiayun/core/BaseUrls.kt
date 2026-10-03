package app.xiayun.core

import java.net.URI
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

object BaseUrls {
    const val DEFAULT = "https://xia-yun.jonathanchcj1021.workers.dev"

    fun normalize(input: String): String? {
        val trimmed = input.trim().trimEnd('/')
        if (trimmed.isEmpty()) return null
        val uri = try {
            URI(trimmed)
        } catch (_: Exception) {
            return null
        }
        val scheme = uri.scheme?.lowercase()
        if (scheme != "http" && scheme != "https") return null
        if (uri.host.isNullOrBlank()) return null
        if (!uri.path.isNullOrEmpty() && uri.path != "/") return null
        if (uri.rawQuery != null || uri.rawFragment != null) return null
        return trimmed
    }
}

data class DeviceHints(
    val fingerprint: String = "",
    val model: String = "",
    val hardware: String = "",
    val product: String = "",
    val manufacturer: String = "",
    val brand: String = "",
    val device: String = "",
)

fun isEmulator(hints: DeviceHints): Boolean {
    val fingerprint = hints.fingerprint.lowercase()
    val model = hints.model.lowercase()
    val hardware = hints.hardware.lowercase()
    val product = hints.product.lowercase()
    val manufacturer = hints.manufacturer.lowercase()
    return fingerprint.startsWith("generic") ||
        fingerprint.startsWith("unknown") ||
        fingerprint.contains("emulator") ||
        fingerprint.contains("sdk_gphone") ||
        model.contains("emulator") ||
        model.contains("android sdk built for") ||
        model.contains("sdk_gphone") ||
        hardware.contains("goldfish") ||
        hardware.contains("ranchu") ||
        product.contains("sdk_gphone") ||
        product.contains("emulator") ||
        product.contains("simulator") ||
        manufacturer.contains("genymotion") ||
        (hints.brand.lowercase().startsWith("generic") && hints.device.lowercase().startsWith("generic"))
}

private val rasterMimeTypes = setOf(
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/avif",
    "image/bmp",
)

fun normalizeMime(value: String): String {
    val base = value.substringBefore(';').trim().lowercase()
    return when (base) {
        "image/jpg", "image/pjpeg" -> "image/jpeg"
        "image/x-png" -> "image/png"
        "" -> "application/octet-stream"
        else -> base
    }
}

fun hintedItemType(mime: String): String =
    if (normalizeMime(mime) in rasterMimeTypes) "image" else "file"

fun sanitizeFileName(value: String): String {
    val base = value.substringAfterLast('/').substringAfterLast('\\')
        .replace(Regex("[\\u0000-\\u001f]"), "")
        .trim()
    if (base.isEmpty()) return "未命名檔案"
    return base.take(Limits.MAX_ITEM_NAME)
}

fun formatBytes(bytes: Long): String {
    if (bytes < 1024) return "$bytes B"
    if (bytes < 1024 * 1024) {
        val value = bytes / 1024.0
        return if (value >= 10) "${value.toInt()} KB" else String.format(Locale.US, "%.1f KB", value)
    }
    return String.format(Locale.US, "%.1f MB", bytes / (1024.0 * 1024.0))
}

private val timestampFormatter: DateTimeFormatter =
    DateTimeFormatter.ofPattern("M月d日 HH:mm", Locale.TAIWAN)

private val catalogDateFormatter: DateTimeFormatter =
    DateTimeFormatter.ofPattern("yyyy年M月d日", Locale.TAIWAN)

fun formatTimestamp(iso: String, zone: ZoneId = ZoneId.systemDefault()): String {
    if (iso.isBlank()) return ""
    return try {
        timestampFormatter.format(Instant.parse(iso).atZone(zone))
    } catch (_: Exception) {
        iso
    }
}

fun formatCatalogDate(iso: String, zone: ZoneId = ZoneId.systemDefault()): String {
    if (iso.isBlank()) return ""
    return try {
        catalogDateFormatter.format(Instant.parse(iso).atZone(zone))
    } catch (_: Exception) {
        iso
    }
}

fun contentUrl(base: String, id: String, attachment: Boolean): String? {
    val normalized = BaseUrls.normalize(base) ?: return null
    val suffix = if (attachment) "?disposition=attachment" else ""
    return "$normalized/api/items/$id/content$suffix"
}

fun typeLabel(type: String): String = when (type) {
    "image" -> "圖片"
    "text" -> "筆記"
    else -> "檔案"
}
