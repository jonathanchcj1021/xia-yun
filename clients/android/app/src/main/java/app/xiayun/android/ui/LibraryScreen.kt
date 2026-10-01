package app.xiayun.android.ui

import android.graphics.Bitmap
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.EditNote
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.UploadFile
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.xiayun.core.ApiResult
import app.xiayun.core.CloudItem
import app.xiayun.core.Upload
import app.xiayun.core.formatBytes
import app.xiayun.core.formatTimestamp
import app.xiayun.core.typeLabel
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LibraryScreen(
    email: String,
    state: LibraryUiState,
    biometricEnabled: Boolean,
    biometricAvailable: Boolean,
    onRefresh: () -> Unit,
    onUpload: (List<Upload>) -> Unit,
    onCreateNote: (String, String) -> Unit,
    onOpen: (CloudItem) -> Unit,
    onCloseDetail: () -> Unit,
    onAskDelete: (CloudItem) -> Unit,
    onCancelDelete: () -> Unit,
    onConfirmDelete: () -> Unit,
    onClearBanner: () -> Unit,
    onBanner: (String) -> Unit,
    fetchContent: suspend (String, Boolean) -> ApiResult<ByteArray>,
    onSignOut: () -> Unit,
    onToggleBiometric: (enable: Boolean) -> Unit,
    onOpenServer: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var menu by remember { mutableStateOf(false) }
    var noteOpen by remember { mutableStateOf(false) }
    var noteTitle by remember { mutableStateOf("") }
    var noteBody by remember { mutableStateOf("") }
    var noteError by remember { mutableStateOf<String?>(null) }
    val openFiles = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
        scope.launch {
            val uploads = mutableListOf<Upload>()
            for (uri in uris) {
                when (val read = context.contentResolver.readUpload(uri)) {
                    is ReadUpload.Ok -> uploads += read.upload
                    ReadUpload.TooLarge -> {
                        onBanner("檔案超過 32 MB 上限")
                        return@launch
                    }
                    is ReadUpload.Failed -> {
                        onBanner(read.message)
                        return@launch
                    }
                }
            }
            onUpload(uploads)
        }
    }
    val openImages = rememberLauncherForActivityResult(
        ActivityResultContracts.PickMultipleVisualMedia(10),
    ) { uris ->
        scope.launch {
            val uploads = mutableListOf<Upload>()
            for (uri in uris) {
                when (val read = context.contentResolver.readUpload(uri)) {
                    is ReadUpload.Ok -> uploads += read.upload
                    ReadUpload.TooLarge -> {
                        onBanner("檔案超過 32 MB 上限")
                        return@launch
                    }
                    is ReadUpload.Failed -> {
                        onBanner(read.message)
                        return@launch
                    }
                }
            }
            onUpload(uploads)
        }
    }

    val detail = state.detail
    if (detail != null) {
        BackHandler { onCloseDetail() }
        DetailScreen(
            item = detail,
            loading = state.detailLoading,
            onBack = onCloseDetail,
            onDelete = { onAskDelete(detail) },
            onBanner = onBanner,
            fetchContent = fetchContent,
        )
    } else {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Column {
                            Text("我的匣子")
                            if (email.isNotBlank()) {
                                Text(
                                    email,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    },
                    actions = {
                        IconButton(onClick = onRefresh) {
                            Icon(Icons.Filled.Refresh, contentDescription = "重新整理")
                        }
                        IconButton(onClick = { menu = true }) {
                            Icon(Icons.Filled.MoreVert, contentDescription = "更多")
                        }
                        DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                            DropdownMenuItem(
                                text = { Text("伺服器位址") },
                                onClick = {
                                    menu = false
                                    onOpenServer()
                                },
                            )
                            if (biometricAvailable) {
                                DropdownMenuItem(
                                    text = {
                                        Text(if (biometricEnabled) "關閉生物辨識解鎖" else "啟用生物辨識解鎖")
                                    },
                                    onClick = {
                                        menu = false
                                        onToggleBiometric(!biometricEnabled)
                                    },
                                )
                            }
                            DropdownMenuItem(
                                text = { Text("登出") },
                                onClick = {
                                    menu = false
                                    onSignOut()
                                },
                            )
                        }
                    },
                )
            },
            bottomBar = {
                Surface(tonalElevation = 2.dp) {
                    Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (state.uploading || state.savingNote) {
                            LinearProgressIndicator(Modifier.fillMaxWidth())
                            Text(
                                if (state.savingNote) "正在儲存筆記…" else "正在上傳…",
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(
                                onClick = { openFiles.launch(arrayOf("*/*")) },
                                enabled = !state.uploading,
                                modifier = Modifier.weight(1f),
                            ) {
                                Icon(Icons.Filled.UploadFile, contentDescription = null)
                                Text("檔案", modifier = Modifier.padding(start = 6.dp))
                            }
                            OutlinedButton(
                                onClick = {
                                    openImages.launch(
                                        androidx.activity.result.PickVisualMediaRequest(
                                            ActivityResultContracts.PickVisualMedia.ImageOnly,
                                        ),
                                    )
                                },
                                enabled = !state.uploading,
                                modifier = Modifier.weight(1f),
                            ) {
                                Icon(Icons.Filled.Image, contentDescription = null)
                                Text("圖片", modifier = Modifier.padding(start = 6.dp))
                            }
                        }
                        Button(
                            onClick = {
                                noteTitle = ""
                                noteBody = ""
                                noteError = null
                                noteOpen = true
                            },
                            enabled = !state.savingNote,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Icon(Icons.Filled.EditNote, contentDescription = null)
                            Text("新增筆記", modifier = Modifier.padding(start = 6.dp))
                        }
                    }
                }
            },
        ) { padding ->
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.TopCenter) {
                when {
                    state.loading && state.items == null -> CircularProgressIndicator(Modifier.padding(48.dp))
                    state.error != null && state.items.isNullOrEmpty() -> Column(
                        Modifier.padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(state.error, color = MaterialTheme.colorScheme.error)
                        TextButton(onClick = onRefresh) { Text("再試一次") }
                    }
                    state.items.isNullOrEmpty() -> Column(
                        Modifier.padding(28.dp).widthIn(max = 420.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Mark()
                        Spacer(Modifier.height(12.dp))
                        Text("匣子還是空的", style = MaterialTheme.typography.titleLarge)
                        Spacer(Modifier.height(8.dp))
                        Text(
                            "上傳檔案、圖片，或寫一則筆記。內容只屬於這個帳號。",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    else -> LazyColumn(
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.widthIn(max = 720.dp),
                    ) {
                        if (!state.banner.isNullOrBlank()) {
                            item {
                                Banner(state.banner, onClearBanner)
                            }
                        }
                        items(state.items, key = { it.id }) { item ->
                            ItemRow(item, onClick = { onOpen(item) }, onDelete = { onAskDelete(item) })
                        }
                    }
                }
                if (!state.banner.isNullOrBlank() && !state.items.isNullOrEmpty()) {
                    // banner is inside the list
                } else if (!state.banner.isNullOrBlank() && state.items.isNullOrEmpty()) {
                    Banner(state.banner, onClearBanner, Modifier.padding(16.dp))
                }
            }
        }
    }

    if (noteOpen) {
        AlertDialog(
            onDismissRequest = { if (!state.savingNote) noteOpen = false },
            title = { Text("新增筆記") },
            text = {
                Column {
                    OutlinedTextField(
                        value = noteTitle,
                        onValueChange = { noteTitle = it },
                        label = { Text("標題") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = noteBody,
                        onValueChange = { noteBody = it },
                        label = { Text("內文") },
                        modifier = Modifier.fillMaxWidth().heightIn(min = 120.dp),
                    )
                    if (noteError != null) {
                        Spacer(Modifier.height(8.dp))
                        Text(noteError!!, color = MaterialTheme.colorScheme.error)
                    }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (noteTitle.isBlank()) {
                            noteError = "請填寫筆記標題"
                        } else {
                            noteOpen = false
                            onCreateNote(noteTitle, noteBody)
                        }
                    },
                    enabled = !state.savingNote,
                ) { Text("儲存") }
            },
            dismissButton = {
                TextButton(onClick = { noteOpen = false }, enabled = !state.savingNote) { Text("取消") }
            },
        )
    }

    val pending = state.pendingDelete
    if (pending != null) {
        AlertDialog(
            onDismissRequest = { if (!state.deleting) onCancelDelete() },
            title = { Text("刪除這個項目？") },
            text = { Text("「${pending.name}」刪除後無法復原。") },
            confirmButton = {
                TextButton(onClick = onConfirmDelete, enabled = !state.deleting) { Text("刪除") }
            },
            dismissButton = {
                TextButton(onClick = onCancelDelete, enabled = !state.deleting) { Text("取消") }
            },
        )
    }
}

@Composable
private fun Banner(message: String, onClear: () -> Unit, modifier: Modifier = Modifier) {
    Card(modifier.fillMaxWidth()) {
        Row(
            Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(message, modifier = Modifier.weight(1f), color = MaterialTheme.colorScheme.error)
            TextButton(onClick = onClear) { Text("關閉") }
        }
    }
}

@Composable
private fun ItemRow(item: CloudItem, onClick: () -> Unit, onDelete: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(iconFor(item.type), contentDescription = typeLabel(item.type), tint = MaterialTheme.colorScheme.primary)
            Column(Modifier.padding(start = 12.dp).weight(1f)) {
                Text(item.name, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.titleMedium)
                Text(
                    "${typeLabel(item.type)} · ${formatBytes(item.size)} · ${formatTimestamp(item.createdAt)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (!item.excerpt.isNullOrBlank()) {
                    Text(
                        item.excerpt!!,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }
            IconButton(onClick = onDelete) {
                Icon(Icons.Filled.Delete, contentDescription = "刪除")
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DetailScreen(
    item: CloudItem,
    loading: Boolean,
    onBack: () -> Unit,
    onDelete: () -> Unit,
    onBanner: (String) -> Unit,
    fetchContent: suspend (String, Boolean) -> ApiResult<ByteArray>,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var bitmap by remember(item.id) { mutableStateOf<Bitmap?>(null) }
    var previewFailed by remember(item.id) { mutableStateOf(false) }
    var previewLoading by remember(item.id) { mutableStateOf(item.type == "image") }
    val createDocument = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("*/*")) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            when (val result = fetchContent(item.id, true)) {
                is ApiResult.Ok -> {
                    val wrote = try {
                        context.contentResolver.openOutputStream(uri)?.use { stream ->
                            stream.write(result.value)
                            true
                        } ?: false
                    } catch (_: Exception) {
                        false
                    }
                    if (!wrote) onBanner("無法儲存檔案")
                }
                is ApiResult.Err -> onBanner(result.error.message)
            }
        }
    }

    LaunchedEffect(item.id, item.type) {
        if (item.type != "image") return@LaunchedEffect
        when (val result = fetchContent(item.id, false)) {
            is ApiResult.Ok -> {
                val decoded = decodeSampled(result.value, 1600)
                if (decoded == null) previewFailed = true else bitmap = decoded
            }
            is ApiResult.Err -> previewFailed = true
        }
        previewLoading = false
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(item.name, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
                    }
                },
            )
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
        ) {
            Text(
                "${typeLabel(item.type)} · ${formatBytes(item.size)} · ${formatTimestamp(item.createdAt)}",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(16.dp))
            when (item.type) {
                "image" -> {
                    when {
                        previewLoading -> CircularProgressIndicator()
                        previewFailed || bitmap == null -> Text("圖片無法顯示", color = MaterialTheme.colorScheme.error)
                        else -> Image(
                            bitmap = bitmap!!.asImageBitmap(),
                            contentDescription = item.name,
                            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)),
                            contentScale = ContentScale.Fit,
                        )
                    }
                }
                "text" -> {
                    if (loading && item.body == null) {
                        CircularProgressIndicator()
                    } else {
                        SelectionContainer {
                            Text(item.body.orEmpty(), style = MaterialTheme.typography.bodyLarge)
                        }
                    }
                }
                else -> {
                    Icon(
                        Icons.Filled.Description,
                        contentDescription = null,
                        modifier = Modifier.size(56.dp),
                        tint = MaterialTheme.colorScheme.primary,
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(item.mimeType ?: "檔案", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Spacer(Modifier.height(20.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = {
                    val name = if (item.type == "text" && !item.name.endsWith(".txt", ignoreCase = true)) {
                        "${item.name}.txt"
                    } else {
                        item.name
                    }
                    createDocument.launch(name)
                }) {
                    Icon(Icons.Filled.Download, contentDescription = null)
                    Text("下載", modifier = Modifier.padding(start = 6.dp))
                }
                OutlinedButton(onClick = onDelete) {
                    Icon(Icons.Filled.Delete, contentDescription = null)
                    Text("刪除", modifier = Modifier.padding(start = 6.dp))
                }
            }
        }
    }
}

private fun iconFor(type: String) = when (type) {
    "image" -> Icons.Filled.Image
    "text" -> Icons.Filled.EditNote
    else -> Icons.Filled.Description
}
