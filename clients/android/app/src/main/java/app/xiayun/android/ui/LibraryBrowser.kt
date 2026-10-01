package app.xiayun.android.ui

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.EditNote
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Image
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.xiayun.core.CloudItem
import app.xiayun.core.LibrarySort
import app.xiayun.core.LibraryTypeFilter
import app.xiayun.core.UNGROUPED_LABEL
import app.xiayun.core.canonicalGroup
import app.xiayun.core.formatBytes
import app.xiayun.core.formatCatalogDate
import app.xiayun.core.libraryGroupNames
import app.xiayun.core.organizeLibrary
import app.xiayun.core.typeLabel

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class, ExperimentalFoundationApi::class)
@Composable
fun LibraryBrowser(
    items: List<CloudItem>,
    notice: String?,
    banner: String?,
    updatingId: String?,
    onOpen: (CloudItem) -> Unit,
    onDelete: (CloudItem) -> Unit,
    onAddTag: (CloudItem, String) -> Unit,
    onRemoveTag: (CloudItem, String) -> Unit,
    onMove: (CloudItem, String?) -> Unit,
    onClearBanner: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var query by remember { mutableStateOf("") }
    var typeFilter by remember { mutableStateOf(LibraryTypeFilter.All) }
    var sort by remember { mutableStateOf(LibrarySort.Newest) }
    var tagFilter by remember { mutableStateOf<String?>(null) }
    var collapsed by remember { mutableStateOf(setOf<String>()) }
    var tagDraft by remember { mutableStateOf<Pair<String, String>?>(null) }
    var newGroupFor by remember { mutableStateOf<CloudItem?>(null) }
    var newGroupName by remember { mutableStateOf("") }
    var removeTarget by remember { mutableStateOf<Pair<CloudItem, String>?>(null) }
    var filterMessage by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(notice) { filterMessage = null }

    val organized = organizeLibrary(items, query, typeFilter, sort, tagFilter)
    val groupNames = libraryGroupNames(items)
    val shownNotice = filterMessage ?: notice

    fun clearFilters() {
        query = ""
        typeFilter = LibraryTypeFilter.All
        tagFilter = null
        filterMessage = "已清除篩選"
    }

    LazyColumn(
        modifier = modifier,
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        item {
            Column(Modifier.widthIn(max = 720.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    placeholder = { Text("搜尋名稱或筆記內文") },
                )
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(
                        "類型",
                        modifier = Modifier.align(Alignment.CenterVertically),
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    TypeChoice(LibraryTypeFilter.All, "全部", typeFilter) { typeFilter = it }
                    TypeChoice(LibraryTypeFilter.File, "檔案", typeFilter) { typeFilter = it }
                    TypeChoice(LibraryTypeFilter.Image, "圖片", typeFilter) { typeFilter = it }
                    TypeChoice(LibraryTypeFilter.Text, "筆記", typeFilter) { typeFilter = it }
                }
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(
                        "排序",
                        modifier = Modifier.align(Alignment.CenterVertically),
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    SortChoice(LibrarySort.Newest, "最新", sort) { sort = it }
                    SortChoice(LibrarySort.Oldest, "最舊", sort) { sort = it }
                    SortChoice(LibrarySort.Name, "名稱", sort) { sort = it }
                    Text(
                        "顯示 ${organized.visible.size} 項",
                        modifier = Modifier.align(Alignment.CenterVertically),
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
        if (tagFilter != null) {
            item {
                Surface(
                    modifier = Modifier.widthIn(max = 720.dp).fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    color = MaterialTheme.colorScheme.primaryContainer,
                ) {
                    Row(
                        Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text("正在看標籤「$tagFilter」", modifier = Modifier.weight(1f))
                        TextButton(onClick = {
                            tagFilter = null
                            filterMessage = "已清除標籤篩選"
                        }) { Text("清除") }
                    }
                }
            }
        }
        if (!shownNotice.isNullOrBlank()) {
            item {
                Text(
                    shownNotice,
                    modifier = Modifier.widthIn(max = 720.dp).fillMaxWidth(),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        if (!banner.isNullOrBlank()) {
            item {
                Banner(banner, onClearBanner, Modifier.widthIn(max = 720.dp))
            }
        }
        when {
            items.isEmpty() -> item {
                EmptyCopy(
                    title = "匣子還是空的",
                    body = "上傳檔案、圖片，或寫一則筆記。內容只屬於這個帳號。",
                )
            }
            organized.filtering && organized.visible.isEmpty() -> item {
                Column(Modifier.widthIn(max = 420.dp).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                    EmptyCopy(
                        title = "架子上沒有對得上的東西",
                        body = "名稱、筆記內文、類型或標籤對不上。可以把條件清掉，再從整座書庫看起。",
                    )
                    TextButton(onClick = { clearFilters() }) { Text("清除篩選") }
                }
            }
            else -> {
                organized.shelves.forEach { shelf ->
                    if (organized.filtering && shelf.items.isEmpty()) return@forEach
                    val open = shelf.name !in collapsed
                    item(key = "group-${shelf.name}") {
                        GroupHeader(
                            name = shelf.name,
                            count = shelf.items.size,
                            open = open,
                            muted = shelf.name == UNGROUPED_LABEL,
                            onToggle = {
                                collapsed = if (open) collapsed + shelf.name else collapsed - shelf.name
                            },
                        )
                    }
                    if (!open) return@forEach
                    if (shelf.items.isEmpty()) {
                        item(key = "empty-${shelf.name}") {
                            Text(
                                "這個分組還沒有東西。可以從別的架子移過來。",
                                modifier = Modifier.widthIn(max = 720.dp).fillMaxWidth().padding(bottom = 8.dp),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    } else {
                        items(shelf.items, key = { it.id }) { item ->
                            ItemCard(
                                item = item,
                                tagFilter = tagFilter,
                                busy = updatingId == item.id,
                                drafting = tagDraft?.first == item.id,
                                draft = if (tagDraft?.first == item.id) tagDraft?.second.orEmpty() else "",
                                groupNames = groupNames,
                                onOpen = { onOpen(item) },
                                onDelete = { onDelete(item) },
                                onToggleTag = { tag ->
                                    tagFilter = if (tagFilter == tag) null else tag
                                    if (tagFilter == null) filterMessage = null
                                },
                                onStartTag = { tagDraft = item.id to "" },
                                onDraft = { tagDraft = item.id to it },
                                onCancelTag = { tagDraft = null },
                                onSubmitTag = {
                                    onAddTag(item, tagDraft?.second.orEmpty())
                                    tagDraft = null
                                },
                                onLongPressTag = { tag -> removeTarget = item to tag },
                                onMove = { group ->
                                    val name = canonicalGroup(group) ?: UNGROUPED_LABEL
                                    collapsed = collapsed - name
                                    onMove(item, group)
                                },
                                onNewGroup = {
                                    newGroupName = ""
                                    newGroupFor = item
                                },
                            )
                        }
                    }
                }
            }
        }
    }

    val creating = newGroupFor
    if (creating != null) {
        AlertDialog(
            onDismissRequest = { newGroupFor = null },
            title = { Text("移到新分組") },
            text = {
                OutlinedTextField(
                    value = newGroupName,
                    onValueChange = { newGroupName = it },
                    singleLine = true,
                    label = { Text("分組名稱") },
                    placeholder = { Text("例如 京都行") },
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        val name = canonicalGroup(newGroupName) ?: UNGROUPED_LABEL
                        collapsed = collapsed - name
                        onMove(creating, newGroupName)
                        newGroupFor = null
                    },
                    enabled = updatingId != creating.id,
                ) { Text("移過去") }
            },
            dismissButton = {
                TextButton(onClick = { newGroupFor = null }) { Text("取消") }
            },
        )
    }

    val removing = removeTarget
    if (removing != null) {
        AlertDialog(
            onDismissRequest = { removeTarget = null },
            title = { Text("移除標籤？") },
            text = { Text("從「${removing.first.name}」移除「${removing.second}」。") },
            confirmButton = {
                TextButton(onClick = {
                    onRemoveTag(removing.first, removing.second)
                    if (tagFilter == removing.second) tagFilter = null
                    removeTarget = null
                }) { Text("移除") }
            },
            dismissButton = {
                TextButton(onClick = { removeTarget = null }) { Text("取消") }
            },
        )
    }
}

@Composable
private fun EmptyCopy(title: String, body: String) {
    Column(
        Modifier.widthIn(max = 420.dp).padding(top = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Mark()
        Spacer(Modifier.height(12.dp))
        Text(title, style = MaterialTheme.typography.titleLarge)
        Spacer(Modifier.height(8.dp))
        Text(body, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TypeChoice(
    value: LibraryTypeFilter,
    label: String,
    selected: LibraryTypeFilter,
    onSelect: (LibraryTypeFilter) -> Unit,
) {
    FilterChip(selected = selected == value, onClick = { onSelect(value) }, label = { Text(label) })
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SortChoice(
    value: LibrarySort,
    label: String,
    selected: LibrarySort,
    onSelect: (LibrarySort) -> Unit,
) {
    FilterChip(selected = selected == value, onClick = { onSelect(value) }, label = { Text(label) })
}

@Composable
private fun GroupHeader(
    name: String,
    count: Int,
    open: Boolean,
    muted: Boolean,
    onToggle: () -> Unit,
) {
    Row(
        Modifier
            .widthIn(max = 720.dp)
            .fillMaxWidth()
            .padding(top = 8.dp, bottom = 2.dp)
            .semantics { contentDescription = if (open) "收合$name，共$count 項" else "展開$name，共$count 項" }
            .clickable(onClick = onToggle)
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            name,
            modifier = Modifier.weight(1f),
            style = MaterialTheme.typography.titleLarge,
            color = if (muted) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            count.toString(),
            modifier = Modifier.padding(horizontal = 8.dp),
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Icon(
            Icons.Filled.ExpandMore,
            contentDescription = null,
            modifier = Modifier.rotate(if (open) 0f else -90f),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@OptIn(ExperimentalLayoutApi::class, ExperimentalFoundationApi::class)
@Composable
private fun ItemCard(
    item: CloudItem,
    tagFilter: String?,
    busy: Boolean,
    drafting: Boolean,
    draft: String,
    groupNames: List<String>,
    onOpen: () -> Unit,
    onDelete: () -> Unit,
    onToggleTag: (String) -> Unit,
    onStartTag: () -> Unit,
    onDraft: (String) -> Unit,
    onCancelTag: () -> Unit,
    onSubmitTag: () -> Unit,
    onLongPressTag: (String) -> Unit,
    onMove: (String?) -> Unit,
    onNewGroup: () -> Unit,
) {
    var menu by remember { mutableStateOf(false) }
    Card(modifier = Modifier.widthIn(max = 720.dp).fillMaxWidth()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Row(Modifier.weight(1f).clickable(onClick = onOpen), verticalAlignment = Alignment.CenterVertically) {
                    Icon(iconFor(item.type), contentDescription = typeLabel(item.type), tint = MaterialTheme.colorScheme.primary)
                    Column(Modifier.padding(start = 12.dp).weight(1f)) {
                        Text(item.name, maxLines = 2, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.titleMedium)
                        Text(
                            "${typeLabel(item.type)} · ${formatCatalogDate(item.createdAt)} · ${formatBytes(item.size)}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                IconButton(onClick = onDelete) {
                    Icon(Icons.Filled.Delete, contentDescription = "刪除")
                }
            }
            if (!item.excerpt.isNullOrBlank()) {
                Text(
                    item.excerpt!!,
                    modifier = Modifier.clickable(onClick = onOpen),
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            if (item.tags.isEmpty()) {
                Text("還沒有標籤", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
            } else {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    item.tags.forEach { tag ->
                        val selected = tagFilter == tag
                        Surface(
                            shape = RoundedCornerShape(50),
                            color = if (selected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant,
                            modifier = Modifier.combinedClickable(
                                onClick = { onToggleTag(tag) },
                                onLongClick = { onLongPressTag(tag) },
                            ),
                        ) {
                            Text(
                                tag,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                style = MaterialTheme.typography.labelLarge,
                            )
                        }
                    }
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (drafting) {
                    OutlinedTextField(
                        value = draft,
                        onValueChange = onDraft,
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        placeholder = { Text("例如 待寄") },
                        label = { Text("為${item.name}加上標籤") },
                    )
                    TextButton(onClick = onSubmitTag, enabled = !busy) { Text("加上") }
                    TextButton(onClick = onCancelTag, enabled = !busy) { Text("取消") }
                } else {
                    TextButton(onClick = onStartTag, enabled = !busy) { Text("加標籤") }
                    Box {
                        TextButton(onClick = { menu = true }, enabled = !busy) {
                            Text("移到 ${canonicalGroup(item.group) ?: UNGROUPED_LABEL}")
                        }
                        DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                            groupNames.forEach { name ->
                                DropdownMenuItem(
                                    text = { Text(name) },
                                    onClick = {
                                        menu = false
                                        onMove(if (name == UNGROUPED_LABEL) null else name)
                                    },
                                )
                            }
                            DropdownMenuItem(
                                text = { Text("新分組…") },
                                onClick = {
                                    menu = false
                                    onNewGroup()
                                },
                            )
                        }
                    }
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
