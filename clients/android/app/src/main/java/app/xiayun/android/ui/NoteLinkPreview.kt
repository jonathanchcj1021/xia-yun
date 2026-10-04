package app.xiayun.android.ui

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.xiayun.core.ApiResult
import app.xiayun.core.LinkPreview
import app.xiayun.core.firstHttpUrl
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL

@Composable
fun NoteLinkPreview(
    text: String,
    load: suspend (String) -> ApiResult<LinkPreview>,
    modifier: Modifier = Modifier,
) {
    val url = firstHttpUrl(text) ?: return
    var preview by remember(url) { mutableStateOf<LinkPreview?>(null) }
    var bitmap by remember(url) { mutableStateOf<Bitmap?>(null) }
    LaunchedEffect(url) {
        val loaded = when (val result = load(url)) {
            is ApiResult.Ok -> result.value
            is ApiResult.Err -> null
        }
        preview = loaded
        val image = loaded?.image
        bitmap = if (image.isNullOrBlank()) null else fetchBitmap(image)
    }
    val site = preview?.site?.takeIf { it.isNotBlank() } ?: hostOf(url)
    Card(modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp)) {
        Column {
            if (bitmap != null) {
                Image(
                    bitmap = bitmap!!.asImageBitmap(),
                    contentDescription = null,
                    modifier = Modifier.fillMaxWidth().height(160.dp).clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp)),
                    contentScale = ContentScale.Crop,
                )
            }
            Column(Modifier.padding(12.dp)) {
                Text(
                    preview?.title?.takeIf { it.isNotBlank() } ?: site,
                    style = MaterialTheme.typography.titleSmall,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    preview?.description?.takeIf { it.isNotBlank() } ?: site,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

private fun hostOf(url: String): String = try {
    URL(url).host.ifBlank { url }
} catch (_: Exception) {
    url
}

private suspend fun fetchBitmap(url: String): Bitmap? = withContext(Dispatchers.IO) {
    val connection = (URL(url).openConnection() as? HttpURLConnection) ?: return@withContext null
    try {
        connection.connectTimeout = 5000
        connection.readTimeout = 5000
        connection.instanceFollowRedirects = true
        if (connection.responseCode !in 200..299) return@withContext null
        connection.inputStream.use { BitmapFactory.decodeStream(it) }
    } catch (_: Exception) {
        null
    } finally {
        connection.disconnect()
    }
}
