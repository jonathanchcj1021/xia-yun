package app.xiayun.core

import java.text.Collator
import java.time.Instant
import java.util.Locale

const val UNGROUPED_LABEL = "未分組"
const val MAX_TAG_CHARS = 12
const val MAX_GROUP_CHARS = 40

enum class LibrarySort { Newest, Oldest, Name }

enum class LibraryTypeFilter { All, File, Image, Text }

data class LibraryShelf(
    val name: String,
    val items: List<CloudItem>,
)

data class OrganizedLibrary(
    val filtering: Boolean,
    val visible: List<CloudItem>,
    val shelves: List<LibraryShelf>,
)

fun firstHttpUrl(text: String?): String? {
    if (text.isNullOrBlank()) return null
    val match = Regex("""https?://[^\s<>"']+""", RegexOption.IGNORE_CASE).find(text) ?: return null
    return match.value.trimEnd { it in ")].,;!?'\"」』" }.takeIf { it.length > "https://".length }
}

fun canonicalGroup(group: String?): String? {
    val cleaned = group?.trim()?.replace(Regex("\\s+"), " ")?.takeIf { it.isNotEmpty() }
    if (cleaned == null || cleaned == UNGROUPED_LABEL) return null
    return cleaned
}

fun normalizeTag(raw: String): String = raw.trim().replace(Regex("\\s+"), " ")

fun libraryGroupNames(items: List<CloudItem>): List<String> {
    val collator = taiwanCollator()
    val named = items.map { canonicalGroup(it.group) }
        .filterNotNull()
        .distinct()
        .sortedWith(collator)
    return named + UNGROUPED_LABEL
}

fun organizeLibrary(
    items: List<CloudItem>,
    query: String,
    type: LibraryTypeFilter,
    sort: LibrarySort,
    tag: String?,
): OrganizedLibrary {
    val needle = query.trim().lowercase(Locale.ROOT)
    val activeTag = tag?.trim()?.takeIf { it.isNotEmpty() }
    val filtering = needle.isNotEmpty() || type != LibraryTypeFilter.All || activeTag != null
    val filtered = items.filter { item ->
        if (!matchesType(item, type)) return@filter false
        if (activeTag != null && activeTag !in item.tags) return@filter false
        if (needle.isEmpty()) return@filter true
        searchableText(item).contains(needle)
    }
    val collator = taiwanCollator()
    val sorted = filtered.sortedWith { left, right ->
        when (sort) {
            LibrarySort.Name -> collator.compare(left.name, right.name)
            LibrarySort.Oldest -> createdMillis(left).compareTo(createdMillis(right))
            LibrarySort.Newest -> createdMillis(right).compareTo(createdMillis(left))
        }
    }
    val shelves = libraryGroupNames(items).map { name ->
        val group = canonicalGroup(name)
        LibraryShelf(name, sorted.filter { canonicalGroup(it.group) == group })
    }
    return OrganizedLibrary(filtering, sorted, shelves)
}

private fun searchableText(item: CloudItem): String = buildString {
    append(item.name)
    append('\n')
    append(item.body.orEmpty())
    append('\n')
    append(item.excerpt.orEmpty())
}.lowercase(Locale.ROOT)

private fun matchesType(item: CloudItem, type: LibraryTypeFilter): Boolean = when (type) {
    LibraryTypeFilter.All -> true
    LibraryTypeFilter.Image -> item.type == "image"
    LibraryTypeFilter.Text -> item.type == "text"
    LibraryTypeFilter.File -> item.type != "image" && item.type != "text"
}

private fun createdMillis(item: CloudItem): Long = try {
    Instant.parse(item.createdAt).toEpochMilli()
} catch (_: Exception) {
    0L
}

private fun taiwanCollator(): Collator = Collator.getInstance(Locale.TAIWAN)

fun shareNote(raw: String, linkTitle: String, fallbackTitle: String): ShareNote? {
    val body = raw.replace("\r\n", "\n").replace('\r', '\n').trim()
    if (body.isEmpty()) return null
    val url = firstHttpUrl(body)
    val title = if (url != null && body == url) {
        linkTitle
    } else {
        val line = body.lineSequence().map { it.trim() }.firstOrNull { it.isNotEmpty() }.orEmpty()
        val clipped = line.take(Limits.MAX_NOTE_TITLE).trim()
        if (clipped.isEmpty()) fallbackTitle else clipped
    }
    val safeTitle = title.trim().take(Limits.MAX_NOTE_TITLE).ifBlank { fallbackTitle }
    return ShareNote(safeTitle, body)
}
