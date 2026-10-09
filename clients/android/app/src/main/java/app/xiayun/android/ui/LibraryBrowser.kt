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
import androidx.compose.material3.Checkbox
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
import app.xiayun.core.ApiResult
import app.xiayun.core.LibrarySort
import app.xiayun.core.LinkPreview
import app.xiayun.core.LibraryTypeFilter
import app.xiayun.core.UNGROUPED_LABEL
import app.xiayun.core.canonicalGroup
import app.xiayun.core.libraryGroupNames
import app.xiayun.core.organizeLibrary
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class, ExperimentalFoundationApi::class)
@Composable
fun LibraryBrowser(
    items: List<CloudItem>,
    notice: String?,
    banner: String?,
    updatingId: String?,
    onOpen: (CloudItem) -> Unit,
    onDelete: (CloudItem) -> Unit,
    onDeleteMany: (List<String>) -> Unit,
    onDeleteGroup: (String, Int) -> Unit,
    onAddTag: (CloudItem, String) -> Unit,
    onRemoveTag: (CloudItem, String) -> Unit,
    onMove: (CloudItem, String?) -> Unit,
    onClearBanner: () -> Unit,
    previewLink: suspend (String) -> ApiResult<LinkPreview>,
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
    var selected by remember { mutableStateOf(setOf<String>()) }
    var confirmSelection by remember { mutableStateOf(false) }
    val copy = LocalAppCopy.current

    LaunchedEffect(notice) { filterMessage = null }

    val organized = organizeLibrary(items, query, typeFilter, sort, tagFilter)
    val groupNames = libraryGroupNames(items)
    val shownNotice = filterMessage ?: notice

    fun clearFilters() {
        query = ""
        typeFilter = LibraryTypeFilter.All
        tagFilter = null
        filterMessage = copy.filtersCleared
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
                    placeholder = { Text(copy.search) },
                )
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(
                        copy.filterType,
                        modifier = Modifier.align(Alignment.CenterVertically),
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    TypeChoice(LibraryTypeFilter.All, copy.allTypes, typeFilter) { typeFilter = it }
                    TypeChoice(LibraryTypeFilter.File, copy.typeFile, typeFilter) { typeFilter = it }
                    TypeChoice(LibraryTypeFilter.Image, copy.typeImage, typeFilter) { typeFilter = it }
                    TypeChoice(LibraryTypeFilter.Text, copy.typeNote, typeFilter) { typeFilter = it }
                }
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(
                        copy.filterSort,
                        modifier = Modifier.align(Alignment.CenterVertically),
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    SortChoice(LibrarySort.Newest, copy.newest, sort) { sort = it }
                    SortChoice(LibrarySort.Oldest, copy.oldest, sort) { sort = it }
                    SortChoice(LibrarySort.Name, copy.byName, sort) { sort = it }
                    Text(
                        fill(copy.showingCount, mapOf("count" to organized.visible.size.toString())),
                        modifier = Modifier.align(Alignment.CenterVertically),
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
        val selectedTag = tagFilter
        if (selectedTag != null) {
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
                        Text(fill(copy.watchingTag, mapOf("tag" to selectedTag)), modifier = Modifier.weight(1f))
                        TextButton(onClick = {
                            tagFilter = null
                            filterMessage = copy.tagCleared
                        }) { Text(copy.clear) }
                    }
                }
            }
        }
        if (!shownNotice.isNullOrBlank()) {
            item {
                Text(
                    knownMessage(shownNotice, copy),
                    modifier = Modifier.widthIn(max = 720.dp).fillMaxWidth(),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        if (selected.isNotEmpty()) {
            item {
                Row(
                    Modifier.widthIn(max = 720.dp).fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(fill(copy.deleteSelectedTitle, mapOf("count" to selected.size.toString())).removeSuffix("？").removeSuffix("?"))
                    TextButton(onClick = { confirmSelection = true }) { Text(copy.deleteSelected) }
                }
            }
        }
        if (!banner.isNullOrBlank()) {
            item {
                Banner(knownMessage(banner, copy), onClearBanner, Modifier.widthIn(max = 720.dp))
            }
        }
        when {
            items.isEmpty() -> item {
                EmptyCopy(
                    title = copy.emptyTitle,
                    body = copy.emptyBody,
                )
            }
            organized.filtering && organized.visible.isEmpty() -> item {
                Column(Modifier.widthIn(max = 420.dp).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                    EmptyCopy(
                        title = copy.noMatchTitle,
                        body = copy.noMatchBody,
                    )
                    TextButton(onClick = { clearFilters() }) { Text(copy.clearFilters) }
                }
            }
            else -> {
                organized.shelves.forEach { shelf ->
                    if (organized.filtering && shelf.items.isEmpty()) return@forEach
                    val open = shelf.name !in collapsed
                    val total = items.count { (canonicalGroup(it.group) ?: UNGROUPED_LABEL) == shelf.name }
                    item(key = "group-${shelf.name}") {
                        GroupHeader(
                            name = shelf.name,
                            count = shelf.items.size,
                            open = open,
                            muted = shelf.name == UNGROUPED_LABEL,
                            onToggle = {
                                collapsed = if (open) collapsed + shelf.name else collapsed - shelf.name
                            },
                            onDelete = if (total > 0) {
                                { onDeleteGroup(shelf.name, total) }
                            } else {
                                null
                            },
                        )
                    }
                    if (!open) return@forEach
                    if (shelf.items.isEmpty()) {
                        item(key = "empty-${shelf.name}") {
                            Text(
                                copy.emptyGroup,
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
                                selected = item.id in selected,
                                onToggleSelected = {
                                    if (item.type != "text") {
                                        selected = if (item.id in selected) selected - item.id else selected + item.id
                                    }
                                },
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
                                previewLink = previewLink,
                            )
                        }
                    }
                }
            }
        }
    }

    if (confirmSelection) {
        AlertDialog(
            onDismissRequest = { confirmSelection = false },
            title = { Text(fill(copy.deleteSelectedTitle, mapOf("count" to selected.size.toString()))) },
            text = { Text(fill(copy.deleteSelectedBody, mapOf("count" to selected.size.toString()))) },
            confirmButton = {
                TextButton(onClick = {
                    val ids = selected.toList()
                    selected = emptySet()
                    confirmSelection = false
                    onDeleteMany(ids)
                }) { Text(copy.deleteSelected) }
            },
            dismissButton = {
                TextButton(onClick = { confirmSelection = false }) { Text(copy.cancel) }
            },
        )
    }

    val creating = newGroupFor
    if (creating != null) {
        AlertDialog(
            onDismissRequest = { newGroupFor = null },
            title = { Text(copy.moveNewTitle) },
            text = {
                OutlinedTextField(
                    value = newGroupName,
                    onValueChange = { newGroupName = it },
                    singleLine = true,
                    label = { Text(copy.groupName) },
                    placeholder = { Text(copy.groupExample) },
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
                ) { Text(copy.moveAction) }
            },
            dismissButton = {
                TextButton(onClick = { newGroupFor = null }) { Text(copy.cancel) }
            },
        )
    }

    val removing = removeTarget
    if (removing != null) {
        AlertDialog(
            onDismissRequest = { removeTarget = null },
            title = { Text(copy.removeTagTitle) },
            text = { Text(fill(copy.removeTagBody, mapOf("name" to removing.first.name, "tag" to removing.second))) },
            confirmButton = {
                TextButton(onClick = {
                    onRemoveTag(removing.first, removing.second)
                    if (tagFilter == removing.second) tagFilter = null
                    removeTarget = null
                }) { Text(copy.removeTag) }
            },
            dismissButton = {
                TextButton(onClick = { removeTarget = null }) { Text(copy.cancel) }
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
    onDelete: (() -> Unit)?,
) {
    val copy = LocalAppCopy.current
    val shown = displayGroup(name, copy)
    Row(
        Modifier
            .widthIn(max = 720.dp)
            .fillMaxWidth()
            .padding(top = 8.dp, bottom = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            Modifier
                .weight(1f)
                .semantics {
                    contentDescription = fill(
                        if (open) copy.collapseGroup else copy.expandGroup,
                        mapOf("name" to shown, "count" to count.toString()),
                    )
                }
                .clickable(onClick = onToggle)
                .padding(vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                shown,
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
        if (onDelete != null) {
            IconButton(onClick = onDelete) {
                Icon(Icons.Filled.Delete, contentDescription = fill(copy.deleteNamed, mapOf("name" to shown)))
            }
        }
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
    selected: Boolean,
    onToggleSelected: () -> Unit,
    onToggleTag: (String) -> Unit,
    onStartTag: () -> Unit,
    onDraft: (String) -> Unit,
    onCancelTag: () -> Unit,
    onSubmitTag: () -> Unit,
    onLongPressTag: (String) -> Unit,
    onMove: (String?) -> Unit,
    onNewGroup: () -> Unit,
    previewLink: suspend (String) -> ApiResult<LinkPreview>,
) {
    var menu by remember { mutableStateOf(false) }
    Card(modifier = Modifier.widthIn(max = 720.dp).fillMaxWidth()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (item.type != "text") {
                    Checkbox(
                        checked = selected,
                        onCheckedChange = { onToggleSelected() },
                    )
                }
                Row(Modifier.weight(1f).clickable(onClick = onOpen), verticalAlignment = Alignment.CenterVertically) {
                    Icon(iconFor(item.type), contentDescription = displayType(item.type, LocalAppCopy.current), tint = MaterialTheme.colorScheme.primary)
                    Column(Modifier.padding(start = 12.dp).weight(1f)) {
                        Text(item.name, maxLines = 2, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.titleMedium)
                        Text(
                            itemStamp(item.type, item.createdAt, item.size, LocalAppCopy.current),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                IconButton(onClick = onDelete) {
                    Icon(Icons.Filled.Delete, contentDescription = LocalAppCopy.current.delete)
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
            if (item.type == "text") {
                NoteLinkPreview(text = item.excerpt.orEmpty(), load = previewLink)
            }
            if (item.tags.isEmpty()) {
                Text(LocalAppCopy.current.noTags, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
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
                        placeholder = { Text(LocalAppCopy.current.tagExample) },
                        label = { Text(fill(LocalAppCopy.current.tagFor, mapOf("name" to item.name))) },
                    )
                    TextButton(onClick = onSubmitTag, enabled = !busy) { Text(LocalAppCopy.current.add) }
                    TextButton(onClick = onCancelTag, enabled = !busy) { Text(LocalAppCopy.current.cancel) }
                } else {
                    TextButton(onClick = onStartTag, enabled = !busy) { Text(LocalAppCopy.current.addTagShort) }
                    Box {
                        TextButton(onClick = { menu = true }, enabled = !busy) {
                            Text(fill(LocalAppCopy.current.moveTo, mapOf("name" to displayGroup(canonicalGroup(item.group) ?: UNGROUPED_LABEL, LocalAppCopy.current))))
                        }
                        DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                            groupNames.forEach { name ->
                                DropdownMenuItem(
                                    text = { Text(displayGroup(name, LocalAppCopy.current)) },
                                    onClick = {
                                        menu = false
                                        onMove(if (name == UNGROUPED_LABEL) null else name)
                                    },
                                )
                            }
                            DropdownMenuItem(
                                text = { Text(LocalAppCopy.current.newGroupMenu) },
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
