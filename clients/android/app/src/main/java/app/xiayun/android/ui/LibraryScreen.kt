package app.xiayun.android.ui

import android.graphics.Bitmap
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
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
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.union
import androidx.compose.material3.Scaffold
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
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
import app.xiayun.core.LinkPreview
import app.xiayun.core.UNGROUPED_LABEL
import app.xiayun.core.Upload
import app.xiayun.core.canonicalGroup
import app.xiayun.core.formatBytes
import app.xiayun.core.formatCatalogDate
import app.xiayun.core.libraryGroupNames
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
    onCreateNote: (String, String, String?) -> Unit,
    onUpdateNote: (String, String, String, String?) -> Unit,
    onAddTag: (CloudItem, String) -> Unit,
    onRemoveTag: (CloudItem, String) -> Unit,
    onMove: (CloudItem, String?) -> Unit,
    onOpen: (CloudItem) -> Unit,
    onCloseDetail: () -> Unit,
    onAskDelete: (CloudItem) -> Unit,
    onCancelDelete: () -> Unit,
    onConfirmDelete: () -> Unit,
    onAskDeleteGroup: (String, Int) -> Unit,
    onCancelGroupDelete: () -> Unit,
    onConfirmGroupDelete: () -> Unit,
    onClearBanner: () -> Unit,
    onBanner: (String) -> Unit,
    fetchContent: suspend (String, Boolean) -> ApiResult<ByteArray>,
    previewLink: suspend (String) -> ApiResult<LinkPreview>,
    onSignOut: () -> Unit,
    onToggleBiometric: (enable: Boolean) -> Unit,
    onOpenServer: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var menu by remember { mutableStateOf(false) }
    var noteOpen by remember { mutableStateOf(false) }
    var editingId by remember { mutableStateOf<String?>(null) }
    var noteTitle by remember { mutableStateOf("") }
    var noteBody by remember { mutableStateOf("") }
    var noteGroup by remember { mutableStateOf<String?>(null) }
    var noteCustom by remember { mutableStateOf(false) }
    var noteCustomName by remember { mutableStateOf("") }
    var noteGroupMenu by remember { mutableStateOf(false) }
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
            groups = libraryGroupNames(state.items.orEmpty()),
            busy = state.updatingId == detail.id,
            onBack = onCloseDetail,
            onDelete = { onAskDelete(detail) },
            onAddTag = { onAddTag(detail, it) },
            onRemoveTag = { onRemoveTag(detail, it) },
            onMove = { onMove(detail, it) },
            onBanner = onBanner,
            fetchContent = fetchContent,
            previewLink = previewLink,
            onEdit = {
                editingId = detail.id
                noteTitle = detail.name
                noteBody = detail.body.orEmpty()
                noteGroup = detail.group
                noteCustom = false
                noteCustomName = ""
                noteError = null
                noteOpen = true
            },
        )
    } else {
        Scaffold(
            contentWindowInsets = WindowInsets.systemBars
                .union(WindowInsets.navigationBars)
                .union(WindowInsets.ime),
            topBar = {
                TopAppBar(
                    title = {
                        Column {
                            Text(LocalAppCopy.current.libraryTitle)
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
                        LanguageSwitcher()
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
                                text = { Text(LocalAppCopy.current.logout) },
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
                    Column(
                        Modifier.aboveSystemBars().padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
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
                                editingId = null
                                noteTitle = ""
                                noteBody = ""
                                noteGroup = null
                                noteCustom = false
                                noteCustomName = ""
                                noteError = null
                                noteOpen = true
                            },
                            enabled = !state.savingNote,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Icon(Icons.Filled.EditNote, contentDescription = null)
                            Text(LocalAppCopy.current.newNote, modifier = Modifier.padding(start = 6.dp))
                        }
                    }
                }
            },
        ) { padding ->
            when {
                state.loading && state.items == null -> Box(
                    Modifier.fillMaxSize().padding(padding),
                    contentAlignment = Alignment.Center,
                ) { CircularProgressIndicator() }
                state.error != null && state.items.isNullOrEmpty() -> Column(
                    Modifier.fillMaxSize().padding(padding).padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    Text(state.error, color = MaterialTheme.colorScheme.error)
                    TextButton(onClick = onRefresh) { Text("再試一次") }
                }
                else -> LibraryBrowser(
                    items = state.items.orEmpty(),
                    notice = state.notice,
                    banner = state.banner,
                    updatingId = state.updatingId,
                    onOpen = onOpen,
                    onDelete = onAskDelete,
                    onDeleteGroup = onAskDeleteGroup,
                    onAddTag = onAddTag,
                    onRemoveTag = onRemoveTag,
                    onMove = onMove,
                    onClearBanner = onClearBanner,
                    previewLink = previewLink,
                    modifier = Modifier.fillMaxSize().padding(padding),
                )
            }
        }
    }

    if (noteOpen) {
        Dialog(
            onDismissRequest = { if (!state.savingNote) noteOpen = false },
            properties = DialogProperties(
                usePlatformDefaultWidth = false,
                decorFitsSystemWindows = false,
            ),
        ) {
            Box(
                Modifier
                    .fillMaxSize()
                    .safeScreenPadding()
                    .padding(20.dp),
                contentAlignment = Alignment.Center,
            ) {
                Surface(shape = RoundedCornerShape(24.dp), tonalElevation = 2.dp) {
                    Column(
                        Modifier
                            .widthIn(max = 480.dp)
                            .verticalScroll(rememberScrollState())
                            .padding(20.dp),
                    ) {
                        Text(
                            if (editingId == null) LocalAppCopy.current.newNote else LocalAppCopy.current.editNote,
                            style = MaterialTheme.typography.titleLarge,
                        )
                        Spacer(Modifier.height(12.dp))
                        OutlinedTextField(
                            value = noteTitle,
                            onValueChange = { noteTitle = it },
                            label = { Text(LocalAppCopy.current.noteTitle) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Spacer(Modifier.height(8.dp))
                        MarkdownEditor(value = noteBody, onValueChange = { noteBody = it })
                        if (noteError != null) {
                            Spacer(Modifier.height(8.dp))
                            Text(noteError!!, color = MaterialTheme.colorScheme.error)
                        }
                        Spacer(Modifier.height(8.dp))
                        val groups = libraryGroupNames(state.items.orEmpty())
                        Box {
                            OutlinedButton(onClick = { noteGroupMenu = true }, modifier = Modifier.fillMaxWidth()) {
                                Text(
                                    if (noteCustom) "新分組" else "放到 ${canonicalGroup(noteGroup) ?: UNGROUPED_LABEL}",
                                )
                            }
                            DropdownMenu(expanded = noteGroupMenu, onDismissRequest = { noteGroupMenu = false }) {
                                groups.forEach { name ->
                                    DropdownMenuItem(
                                        text = { Text(name) },
                                        onClick = {
                                            noteGroupMenu = false
                                            noteCustom = false
                                            noteGroup = if (name == UNGROUPED_LABEL) null else name
                                        },
                                    )
                                }
                                DropdownMenuItem(
                                    text = { Text("新分組…") },
                                    onClick = {
                                        noteGroupMenu = false
                                        noteCustom = true
                                    },
                                )
                            }
                        }
                        Spacer(Modifier.height(8.dp))
                        NoteLinkPreview(text = noteBody, load = previewLink)
                        if (noteCustom) {
                            Spacer(Modifier.height(8.dp))
                            OutlinedTextField(
                                value = noteCustomName,
                                onValueChange = { noteCustomName = it },
                                label = { Text("新分組名稱") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }
                        Spacer(Modifier.height(8.dp))
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.End,
                        ) {
                            TextButton(
                                onClick = { noteOpen = false },
                                enabled = !state.savingNote,
                            ) { Text(LocalAppCopy.current.cancel) }
                            TextButton(
                                onClick = {
                                    if (noteTitle.isBlank()) {
                                        noteError = LocalAppCopy.current.titleRequired
                                    } else {
                                        noteError = null
                                        noteOpen = false
                                        val group = if (noteCustom) noteCustomName else noteGroup
                                        val id = editingId
                                        if (id == null) onCreateNote(noteTitle, noteBody, group)
                                        else onUpdateNote(id, noteTitle, noteBody, group)
                                    }
                                },
                                enabled = !state.savingNote,
                            ) { Text(LocalAppCopy.current.save) }
                        }
                    }
                }
            }
        }
    }

    val pendingGroup = state.pendingGroup
    val pending = state.pendingDelete
    if (pendingGroup != null) {
        AlertDialog(
            onDismissRequest = { if (!state.deleting) onCancelGroupDelete() },
            title = { Text("刪除這個分組？") },
            text = { Text("刪除「${pendingGroup.name}」入面全部 ${pendingGroup.count} 個項目？") },
            confirmButton = {
                TextButton(onClick = onConfirmGroupDelete, enabled = !state.deleting) { Text("刪除") }
            },
            dismissButton = {
                TextButton(onClick = onCancelGroupDelete, enabled = !state.deleting) { Text("取消") }
            },
        )
    } else if (pending != null) {
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
internal fun Banner(message: String, onClear: () -> Unit, modifier: Modifier = Modifier) {
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DetailScreen(
    item: CloudItem,
    loading: Boolean,
    groups: List<String>,
    busy: Boolean,
    onBack: () -> Unit,
    onDelete: () -> Unit,
    onAddTag: (String) -> Unit,
    onRemoveTag: (String) -> Unit,
    onMove: (String?) -> Unit,
    onBanner: (String) -> Unit,
    fetchContent: suspend (String, Boolean) -> ApiResult<ByteArray>,
    previewLink: suspend (String) -> ApiResult<LinkPreview>,
    onEdit: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var tagDraft by remember(item.id) { mutableStateOf<String?>(null) }
    var moveMenu by remember(item.id) { mutableStateOf(false) }
    var customGroup by remember(item.id) { mutableStateOf(false) }
    var customName by remember(item.id) { mutableStateOf("") }
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
        contentWindowInsets = WindowInsets.systemBars
            .union(WindowInsets.navigationBars)
            .union(WindowInsets.ime),
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
                "${typeLabel(item.type)} · ${formatCatalogDate(item.createdAt)} · ${formatBytes(item.size)}",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                canonicalGroup(item.group) ?: UNGROUPED_LABEL,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (item.tags.isEmpty()) {
                Text("還沒有標籤", color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                Column {
                    item.tags.forEach { tag ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(tag, modifier = Modifier.weight(1f))
                            TextButton(onClick = { onRemoveTag(tag) }, enabled = !busy) { Text("移除") }
                        }
                    }
                }
            }
            if (tagDraft != null) {
                OutlinedTextField(
                    value = tagDraft.orEmpty(),
                    onValueChange = { tagDraft = it },
                    label = { Text("加上標籤") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Row {
                    TextButton(onClick = {
                        onAddTag(tagDraft.orEmpty())
                        tagDraft = null
                    }, enabled = !busy) { Text("加上") }
                    TextButton(onClick = { tagDraft = null }) { Text("取消") }
                }
            } else {
                TextButton(onClick = { tagDraft = "" }, enabled = !busy) { Text("加標籤") }
            }
            Box {
                OutlinedButton(onClick = { moveMenu = true }, enabled = !busy) {
                    Text("移到 ${canonicalGroup(item.group) ?: UNGROUPED_LABEL}")
                }
                DropdownMenu(expanded = moveMenu, onDismissRequest = { moveMenu = false }) {
                    groups.forEach { name ->
                        DropdownMenuItem(
                            text = { Text(name) },
                            onClick = {
                                moveMenu = false
                                customGroup = false
                                onMove(if (name == UNGROUPED_LABEL) null else name)
                            },
                        )
                    }
                    DropdownMenuItem(
                        text = { Text("新分組…") },
                        onClick = {
                            moveMenu = false
                            customGroup = true
                        },
                    )
                }
            }
            if (customGroup) {
                OutlinedTextField(
                    value = customName,
                    onValueChange = { customName = it },
                    label = { Text("新分組名稱") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                TextButton(onClick = {
                    onMove(customName)
                    customGroup = false
                    customName = ""
                }, enabled = !busy) { Text("移過去") }
            }
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
                            if (item.body.isNullOrBlank()) {
                                Text(LocalAppCopy.current.emptyNote)
                            } else {
                                MarkdownPreview(item.body.orEmpty())
                            }
                        }
                        Spacer(Modifier.height(12.dp))
                        NoteLinkPreview(text = item.body.orEmpty(), load = previewLink)
                        Spacer(Modifier.height(8.dp))
                        OutlinedButton(onClick = onEdit) { Text(LocalAppCopy.current.edit) }
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
            Row(
                Modifier.aboveSystemBars(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
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
