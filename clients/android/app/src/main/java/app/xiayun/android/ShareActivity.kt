package app.xiayun.android

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import app.xiayun.android.ui.LanguageSwitcher
import app.xiayun.android.ui.LocalAppCopy
import app.xiayun.android.ui.LocalAppLang
import app.xiayun.android.ui.LocalSetLang
import app.xiayun.android.ui.ReadUpload
import app.xiayun.android.ui.XiaYunTheme
import app.xiayun.android.ui.copyFor
import app.xiayun.android.ui.displayGroup
import app.xiayun.android.ui.formatShareError
import app.xiayun.android.ui.readAppLang
import app.xiayun.android.ui.readUpload
import app.xiayun.android.ui.safeScreenPadding
import app.xiayun.android.ui.writeAppLang
import app.xiayun.core.ApiError
import app.xiayun.core.ApiResult
import app.xiayun.core.AuthSession
import app.xiayun.core.MAX_GROUP_CHARS
import app.xiayun.core.UNGROUPED_LABEL
import app.xiayun.core.assembleShareText
import app.xiayun.core.canonicalGroup
import app.xiayun.core.libraryGroupNames
import app.xiayun.core.shareNote
import app.xiayun.core.shareSession
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class ShareActivity : FragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val container = (application as XiaYunApplication).container
        val incoming = incomingShare(intent)
        setContent {
            val context = LocalContext.current
            var lang by remember { mutableStateOf(readAppLang(context)) }
            CompositionLocalProvider(
                LocalAppCopy provides copyFor(lang),
                LocalAppLang provides lang,
                LocalSetLang provides { next ->
                    writeAppLang(context, next)
                    lang = next
                },
            ) {
                XiaYunTheme {
                    ShareScreen(
                        container = container,
                        incoming = incoming,
                        onOpenApp = {
                            startActivity(Intent(this, MainActivity::class.java))
                        },
                        onClose = { finish() },
                    )
                }
            }
        }
    }
}

sealed class IncomingShare {
    data class Text(val raw: String) : IncomingShare()
    data class Image(val uri: Uri) : IncomingShare()
    data object Unsupported : IncomingShare()
}

fun incomingShare(intent: Intent): IncomingShare {
    if (intent.action != Intent.ACTION_SEND) return IncomingShare.Unsupported
    val type = intent.type?.substringBefore(';')?.trim()?.lowercase().orEmpty()
    if (type.startsWith("image/")) {
        val uri = streamUri(intent) ?: return IncomingShare.Unsupported
        return IncomingShare.Image(uri)
    }
    val text = sharePayload(intent)
    if (text != null && (type.isEmpty() || type == "text/plain" || type.startsWith("text/"))) {
        return IncomingShare.Text(text)
    }
    return IncomingShare.Unsupported
}

@Composable
private fun ShareScreen(
    container: AppContainer,
    incoming: IncomingShare,
    onOpenApp: () -> Unit,
    onClose: () -> Unit,
) {
    val copy = LocalAppCopy.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val lifecycleOwner = LocalLifecycleOwner.current
    var storedSession by remember { mutableStateOf(container.sessionStore.readPlain()) }
    val liveSession by container.session.collectAsState()
    val session = shareSession(liveSession, storedSession)
    DisposableEffect(lifecycleOwner, container) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                storedSession = container.sessionStore.readPlain()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }
    var groups by remember { mutableStateOf(listOf(UNGROUPED_LABEL)) }
    var selected by remember { mutableStateOf(UNGROUPED_LABEL) }
    var custom by remember { mutableStateOf("") }
    var groupsFailed by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var saving by remember { mutableStateOf(false) }
    var saved by remember { mutableStateOf(false) }

    LaunchedEffect(session?.token) {
        val current = session
        if (current == null || incoming is IncomingShare.Unsupported) return@LaunchedEffect
        when (val listed = container.api().listItems(current)) {
            is ApiResult.Ok -> groups = libraryGroupNames(listed.value)
            is ApiResult.Err -> {
                error = formatShareError(listed.error, copy)
                if (listed.error.status != 401) groupsFailed = true
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .safeScreenPadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(copy.shareTitle, style = MaterialTheme.typography.headlineSmall)
        LanguageSwitcher()
        when {
            session == null || !session.hasToken() -> {
                Text(copy.shareLoginTitle, style = MaterialTheme.typography.titleMedium)
                Text(copy.shareLoginBody)
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                Button(onClick = onOpenApp, modifier = Modifier.fillMaxWidth()) {
                    Text(copy.shareOpenApp)
                }
            }
            incoming is IncomingShare.Unsupported -> {
                Text(copy.shareUnsupported)
                OutlinedButton(onClick = onClose, modifier = Modifier.fillMaxWidth()) {
                    Text(copy.close)
                }
            }
            saved -> {
                Text(copy.shareSaved, style = MaterialTheme.typography.titleMedium)
                Button(onClick = onClose, modifier = Modifier.fillMaxWidth()) {
                    Text(copy.close)
                }
            }
            else -> {
                Text(
                    if (incoming is IncomingShare.Image) copy.shareImageLead else copy.shareTextLead,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (incoming is IncomingShare.Text) {
                    val draft = shareNote(incoming.raw, copy.shareLinkTitle, copy.shareFallbackTitle)
                    Text(draft?.title ?: copy.shareFallbackTitle, style = MaterialTheme.typography.titleMedium)
                    Text(incoming.raw, maxLines = 6)
                }
                Text(copy.shareGroupTitle, style = MaterialTheme.typography.titleMedium)
                if (groupsFailed) {
                    Text(copy.shareGroupsFailed, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        groups.forEach { name ->
                            FilterChip(
                                selected = custom.isBlank() && selected == name,
                                onClick = {
                                    selected = name
                                    custom = ""
                                },
                                label = { Text(displayGroup(name, copy)) },
                            )
                        }
                    }
                }
                OutlinedTextField(
                    value = custom,
                    onValueChange = { custom = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text(copy.shareNewGroup) },
                    placeholder = { Text(copy.groupExample) },
                    singleLine = true,
                )
                Button(
                    onClick = {
                        if (saving) return@Button
                        val typed = custom.trim()
                        if (typed.length > MAX_GROUP_CHARS) {
                            error = copy.groupTooLong
                            return@Button
                        }
                        val signedIn = shareSession(container.session.value, container.sessionStore.readPlain())
                        if (signedIn == null) {
                            storedSession = null
                            error = formatShareError(
                                ApiError(401, "UNAUTHENTICATED", copy.shareLoginBody),
                                copy,
                            )
                            return@Button
                        }
                        storedSession = signedIn
                        val group = canonicalGroup(if (typed.isEmpty()) selected else typed)
                        error = null
                        saving = true
                        scope.launch {
                            val result = saveIncoming(container, context, copy, incoming, signedIn, group)
                            saving = false
                            when (result) {
                                is ApiResult.Ok -> saved = true
                                is ApiResult.Err -> error = formatShareError(result.error, copy)
                            }
                        }
                    },
                    enabled = !saving,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    if (saving) {
                        CircularProgressIndicator()
                    } else {
                        Text(if (saving) copy.shareSaving else copy.save)
                    }
                }
                OutlinedButton(onClick = onClose, enabled = !saving, modifier = Modifier.fillMaxWidth()) {
                    Text(copy.cancel)
                }
            }
        }
    }
}

@Suppress("DEPRECATION")
private fun streamUri(intent: Intent): Uri? {
    val direct = if (Build.VERSION.SDK_INT >= 33) {
        intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
    } else {
        intent.getParcelableExtra(Intent.EXTRA_STREAM) as? Uri
    }
    if (direct != null) return direct
    val clip = intent.clipData ?: return null
    if (clip.itemCount == 0) return null
    return clip.getItemAt(0).uri
}

private fun sharePayload(intent: Intent): String? {
    val clip = intent.clipData?.takeIf { it.itemCount > 0 }?.getItemAt(0)
    return assembleShareText(
        extraText = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString(),
        extraSubject = intent.getCharSequenceExtra(Intent.EXTRA_SUBJECT)?.toString(),
        clipText = clip?.text?.toString(),
        clipHtml = clip?.htmlText,
    )
}

private suspend fun saveIncoming(
    container: AppContainer,
    context: android.content.Context,
    copy: app.xiayun.android.ui.AppCopy,
    incoming: IncomingShare,
    signedIn: AuthSession,
    group: String?,
): ApiResult<app.xiayun.core.CloudItem> = when (incoming) {
    is IncomingShare.Text -> {
        val draft = shareNote(incoming.raw, copy.shareLinkTitle, copy.shareFallbackTitle)
        val title = draft?.title?.trim().orEmpty().ifBlank { copy.shareFallbackTitle.trim() }
        val body = draft?.body.orEmpty()
        if (draft == null || title.isEmpty()) {
            ApiResult.Err(ApiError(0, "VALIDATION", copy.shareUnsupported))
        } else {
            container.api().createNote(signedIn, title, body, group)
        }
    }
    is IncomingShare.Image -> {
        val read = withContext(Dispatchers.IO) {
            context.contentResolver.readUpload(
                incoming.uri,
                copy.cannotRead,
                copy.unnamedFile,
            )
        }
        when (read) {
            ReadUpload.TooLarge -> ApiResult.Err(ApiError(413, "PAYLOAD_TOO_LARGE", copy.tooLarge))
            is ReadUpload.Failed -> ApiResult.Err(ApiError(0, "VALIDATION", read.message))
            is ReadUpload.Ok -> container.api().upload(signedIn, read.upload.copy(group = group))
        }
    }
    IncomingShare.Unsupported -> ApiResult.Err(ApiError(0, "VALIDATION", copy.shareUnsupported))
}
