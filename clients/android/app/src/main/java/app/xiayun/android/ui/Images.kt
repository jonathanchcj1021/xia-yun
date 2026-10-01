package app.xiayun.android.ui

import android.content.ContentResolver
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.provider.OpenableColumns
import app.xiayun.core.Limits
import app.xiayun.core.Upload
import app.xiayun.core.sanitizeFileName
import kotlin.math.max

sealed class ReadUpload {
    data class Ok(val upload: Upload) : ReadUpload()
    data object TooLarge : ReadUpload()
    data class Failed(val message: String) : ReadUpload()
}

fun ContentResolver.readUpload(uri: Uri): ReadUpload {
    val name = queryDisplayName(uri)
    val mime = getType(uri) ?: "application/octet-stream"
    openFileDescriptor(uri, "r")?.use { descriptor ->
        val size = descriptor.statSize
        if (size > Limits.MAX_UPLOAD_BYTES) return ReadUpload.TooLarge
    }
    val bytes = try {
        openInputStream(uri)?.use { input ->
            val output = java.io.ByteArrayOutputStream()
            val buffer = ByteArray(16 * 1024)
            var total = 0L
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                total += read
                if (total > Limits.MAX_UPLOAD_BYTES) return ReadUpload.TooLarge
                output.write(buffer, 0, read)
            }
            output.toByteArray()
        }
    } catch (_: Exception) {
        null
    } ?: return ReadUpload.Failed("無法讀取這個檔案")
    return ReadUpload.Ok(
        Upload(
            filename = name,
            displayName = name,
            mimeType = mime,
            bytes = bytes,
        ),
    )
}

private fun ContentResolver.queryDisplayName(uri: Uri): String {
    val projected = try {
        query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (index >= 0 && cursor.moveToFirst()) cursor.getString(index) else null
        }
    } catch (_: Exception) {
        null
    }
    return sanitizeFileName(projected ?: uri.lastPathSegment ?: "未命名檔案")
}

fun decodeSampled(bytes: ByteArray, maxSide: Int): Bitmap? {
    return try {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        var sample = 1
        val largest = max(bounds.outWidth, bounds.outHeight)
        while (largest / sample > maxSide) sample *= 2
        val options = BitmapFactory.Options().apply { inSampleSize = sample }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)
    } catch (_: Exception) {
        null
    } catch (_: OutOfMemoryError) {
        null
    }
}
