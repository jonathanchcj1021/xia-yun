package app.xiayun.android.ui

import android.content.ContentResolver
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.provider.OpenableColumns
import app.xiayun.core.ChunkedUpload
import app.xiayun.core.Limits
import app.xiayun.core.Upload
import app.xiayun.core.sanitizeFileName
import java.io.ByteArrayOutputStream
import java.io.Closeable
import java.io.IOException
import java.io.InputStream
import kotlin.math.max

sealed class StagedFile {
    data class Small(val upload: Upload) : StagedFile()
    data class Large(
        val uri: Uri,
        val filename: String,
        val mimeType: String,
        val size: Long,
        val group: String? = null,
    ) : StagedFile()
}

sealed class StageResult {
    data class Ready(val file: StagedFile) : StageResult()
    data object TooLarge : StageResult()
    data class Failed(val message: String) : StageResult()
}

class SequentialReader private constructor(private val input: InputStream) : Closeable {
    fun read(length: Int): ByteArray {
        val out = ByteArray(length)
        var filled = 0
        while (filled < length) {
            val read = input.read(out, filled, length - filled)
            if (read < 0) throw IOException("無法讀取這個檔案")
            filled += read
        }
        return out
    }

    override fun close() {
        input.close()
    }

    companion object {
        fun open(resolver: ContentResolver, uri: Uri): SequentialReader {
            val input = resolver.openInputStream(uri) ?: throw IOException("無法讀取這個檔案")
            return SequentialReader(input)
        }
    }
}

fun ContentResolver.stageUpload(uri: Uri, unreadable: String, unnamed: String): StageResult {
    val name = queryDisplayName(uri, unnamed)
    val mime = getType(uri) ?: "application/octet-stream"
    val size = try {
        measuredSize(uri)
    } catch (_: Exception) {
        return StageResult.Failed(unreadable)
    }
    if (size > Limits.MAX_UPLOAD_BYTES) return StageResult.TooLarge
    if (size > Limits.SINGLE_UPLOAD_BYTES) {
        return StageResult.Ready(StagedFile.Large(uri, name, mime, size))
    }
    val bytes = try {
        readSmall(uri)
    } catch (error: IOException) {
        if (error.message == "too-large") return StageResult.TooLarge
        return StageResult.Failed(unreadable)
    } catch (_: Exception) {
        return StageResult.Failed(unreadable)
    }
    return StageResult.Ready(
        StagedFile.Small(
            Upload(
                filename = name,
                displayName = name,
                mimeType = mime,
                bytes = bytes,
            ),
        ),
    )
}

fun StagedFile.withGroup(group: String?): StagedFile = when (this) {
    is StagedFile.Small -> copy(upload = upload.copy(group = group))
    is StagedFile.Large -> copy(group = group)
}

fun StagedFile.toChunked(): ChunkedUpload? = when (this) {
    is StagedFile.Large -> ChunkedUpload(filename, filename, mimeType, size, group)
    is StagedFile.Small -> null
}

private fun ContentResolver.measuredSize(uri: Uri): Long {
    val queried = try {
        query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { cursor ->
            val index = cursor.getColumnIndex(OpenableColumns.SIZE)
            if (index >= 0 && cursor.moveToFirst() && !cursor.isNull(index)) cursor.getLong(index) else null
        }
    } catch (_: Exception) {
        null
    }
    if (queried != null && queried >= 0) return queried
    val stat = openFileDescriptor(uri, "r")?.use { it.statSize } ?: -1L
    if (stat >= 0) return stat
    openInputStream(uri)?.use { input ->
        val buffer = ByteArray(16 * 1024)
        var total = 0L
        while (true) {
            val read = input.read(buffer)
            if (read < 0) return total
            total += read
            if (total > Limits.MAX_UPLOAD_BYTES) return Limits.MAX_UPLOAD_BYTES + 1
        }
    }
    throw IOException("無法讀取這個檔案")
}

private fun ContentResolver.readSmall(uri: Uri): ByteArray {
    val input = openInputStream(uri) ?: throw IOException("無法讀取這個檔案")
    input.use { stream ->
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(16 * 1024)
        var total = 0L
        while (true) {
            val read = stream.read(buffer)
            if (read < 0) break
            total += read
            if (total > Limits.SINGLE_UPLOAD_BYTES) throw IOException("too-large")
            output.write(buffer, 0, read)
        }
        return output.toByteArray()
    }
}

private fun ContentResolver.queryDisplayName(uri: Uri, unnamed: String): String {
    val projected = try {
        query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (index >= 0 && cursor.moveToFirst()) cursor.getString(index) else null
        }
    } catch (_: Exception) {
        null
    }
    return sanitizeFileName(projected ?: uri.lastPathSegment ?: unnamed)
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
