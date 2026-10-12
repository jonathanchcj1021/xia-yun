package app.xiayun.android.ui

import android.content.ContentResolver
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import app.xiayun.android.AppContainer
import app.xiayun.core.ApiError
import app.xiayun.core.ApiResult
import app.xiayun.core.AuthSession
import app.xiayun.core.ChunkedUpload
import app.xiayun.core.CloudItem
import app.xiayun.core.LinkPreview
import app.xiayun.core.MAX_GROUP_CHARS
import app.xiayun.core.MAX_TAG_CHARS
import app.xiayun.core.canonicalGroup
import app.xiayun.core.normalizeTag
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class PendingGroupDelete(
    val name: String,
    val count: Int,
)

data class LibraryUiState(
    val items: List<CloudItem>? = null,
    val loading: Boolean = true,
    val error: String? = null,
    val banner: String? = null,
    val uploading: Boolean = false,
    val uploadDetail: String? = null,
    val uploadFraction: Float? = null,
    val savingNote: Boolean = false,
    val detail: CloudItem? = null,
    val detailLoading: Boolean = false,
    val pendingDelete: CloudItem? = null,
    val pendingGroup: PendingGroupDelete? = null,
    val deleting: Boolean = false,
    val updatingId: String? = null,
    val notice: String? = null,
)

class LibraryViewModel(private val container: AppContainer) : ViewModel() {
    private fun t() = copyFor(parseAppLang(container.langCode()))
    private val _state = MutableStateFlow(LibraryUiState())
    val state: StateFlow<LibraryUiState> = _state.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        val session = container.session.value ?: return
        viewModelScope.launch {
            _state.update { it.copy(loading = it.items == null, error = null) }
            when (val result = container.api().listItems(session)) {
                is ApiResult.Ok -> _state.update { it.copy(items = result.value, loading = false, error = null) }
                is ApiResult.Err -> {
                    if (result.error.status == 401) {
                        container.notifyUnauthorized()
                    } else {
                        _state.update { it.copy(loading = false, error = result.error.message, items = it.items ?: emptyList()) }
                    }
                }
            }
        }
    }

    fun upload(files: List<StagedFile>, resolver: ContentResolver) {
        if (files.isEmpty() || _state.value.uploading) return
        val session = container.session.value ?: return
        viewModelScope.launch {
            _state.update { it.copy(uploading = true, banner = null, uploadDetail = null, uploadFraction = null) }
            var failure: String? = null
            for (file in files) {
                val result = when (file) {
                    is StagedFile.Small -> {
                        _state.update { it.copy(uploadDetail = null, uploadFraction = null) }
                        container.api().upload(session, file.upload)
                    }
                    is StagedFile.Large -> uploadLarge(session, file, resolver)
                }
                when (result) {
                    is ApiResult.Ok -> Unit
                    is ApiResult.Err -> {
                        if (result.error.status == 401) {
                            container.notifyUnauthorized()
                            _state.update { it.copy(uploading = false, uploadDetail = null, uploadFraction = null) }
                            return@launch
                        }
                        failure = formatShareError(result.error, t())
                        break
                    }
                }
            }
            _state.update { it.copy(uploading = false, banner = failure, uploadDetail = null, uploadFraction = null) }
            refresh()
        }
    }

    private suspend fun uploadLarge(
        session: AuthSession,
        file: StagedFile.Large,
        resolver: ContentResolver,
    ): ApiResult<CloudItem> {
        val reader = try {
            SequentialReader.open(resolver, file.uri)
        } catch (_: Exception) {
            return ApiResult.Err(ApiError(0, "VALIDATION", t().cannotRead))
        }
        return reader.use {
            container.api().uploadChunked(
                session,
                ChunkedUpload(file.filename, file.filename, file.mimeType, file.size, file.group),
                it::read,
            ) { sent, total ->
                val percent = if (total <= 0L) 0 else ((sent * 100) / total).toInt()
                _state.update { state ->
                    state.copy(
                        uploadDetail = fill(
                            t().uploadChunk,
                            mapOf("name" to file.filename, "percent" to percent.toString()),
                        ),
                        uploadFraction = if (total <= 0L) 0f else sent.toFloat() / total.toFloat(),
                    )
                }
            }
        }
    }

    suspend fun previewLink(url: String): ApiResult<LinkPreview> = container.api().linkPreview(url)

    fun createNote(title: String, body: String, group: String?) {
        val session = container.session.value ?: return
        val target = when (val choice = groupChoice(group)) {
            GroupChoice.Invalid -> return
            is GroupChoice.Chosen -> choice.name
        }
        viewModelScope.launch {
            _state.update { it.copy(savingNote = true, banner = null, notice = null) }
            val created = when (val result = container.api().createNote(session, title, body)) {
                is ApiResult.Ok -> result.value
                is ApiResult.Err -> {
                    if (result.error.status == 401) container.notifyUnauthorized()
                    _state.update { it.copy(savingNote = false, banner = result.error.message) }
                    return@launch
                }
            }
            var failure: String? = null
            if (target != null) {
                when (val patched = container.api().patchItem(session, created.id, group = target, setGroup = true)) {
                    is ApiResult.Ok -> Unit
                    is ApiResult.Err -> {
                        if (patched.error.status == 401) {
                            container.notifyUnauthorized()
                            _state.update { it.copy(savingNote = false) }
                            return@launch
                        }
                        failure = patched.error.message
                    }
                }
            }
            val label = target ?: t().ungrouped
            _state.update {
                it.copy(
                    savingNote = false,
                    banner = failure,
                    notice = if (failure == null) {
                        fill(t().notePlaced, mapOf("title" to title.trim(), "group" to label))
                    } else {
                        null
                    },
                )
            }
            refresh()
        }
    }

    fun updateNote(id: String, title: String, body: String, group: String?) {
        val session = container.session.value ?: return
        val target = when (val choice = groupChoice(group)) {
            GroupChoice.Invalid -> return
            is GroupChoice.Chosen -> choice.name
        }
        viewModelScope.launch {
            _state.update { it.copy(savingNote = true, banner = null, notice = null) }
            val updated = when (val result = container.api().updateNote(session, id, title, body)) {
                is ApiResult.Ok -> result.value
                is ApiResult.Err -> {
                    if (result.error.status == 401) container.notifyUnauthorized()
                    _state.update { it.copy(savingNote = false, banner = result.error.message) }
                    return@launch
                }
            }
            var failure: String? = null
            if (target != updated.group) {
                when (val patched = container.api().patchItem(session, id, group = target, setGroup = true)) {
                    is ApiResult.Ok -> Unit
                    is ApiResult.Err -> {
                        if (patched.error.status == 401) {
                            container.notifyUnauthorized()
                            _state.update { it.copy(savingNote = false) }
                            return@launch
                        }
                        failure = patched.error.message
                    }
                }
            }
            _state.update { it.copy(savingNote = false, banner = failure, detail = null) }
            refresh()
        }
    }

    fun addTag(item: CloudItem, raw: String) {
        val value = normalizeTag(raw)
        if (value.isEmpty()) return
        if (value.length > MAX_TAG_CHARS) {
            _state.update { it.copy(notice = t().tagTooLong, banner = null) }
            return
        }
        if (value in item.tags) {
            _state.update {
                it.copy(notice = fill(t().tagExists, mapOf("name" to item.name, "tag" to value)), banner = null)
            }
            return
        }
        patch(
            item,
            group = item.group,
            tags = item.tags + value,
            setGroup = false,
            setTags = true,
            notice = fill(t().tagAdded, mapOf("name" to item.name, "tag" to value)),
        )
    }

    fun removeTag(item: CloudItem, tag: String) {
        if (tag !in item.tags) return
        patch(
            item,
            group = item.group,
            tags = item.tags - tag,
            setGroup = false,
            setTags = true,
            notice = fill(t().tagRemoved, mapOf("name" to item.name, "tag" to tag)),
        )
    }

    fun moveItem(item: CloudItem, group: String?) {
        val target = when (val choice = groupChoice(group)) {
            GroupChoice.Invalid -> return
            is GroupChoice.Chosen -> choice.name
        }
        if (canonicalGroup(item.group) == target) return
        val label = target ?: t().ungrouped
        patch(
            item,
            group = target,
            tags = item.tags,
            setGroup = true,
            setTags = false,
            notice = fill(t().moved, mapOf("name" to item.name, "group" to label)),
        )
    }

    fun open(item: CloudItem) {
        _state.update { it.copy(detail = item, detailLoading = true, banner = null) }
        val session = container.session.value ?: return
        viewModelScope.launch {
            when (val result = container.api().getItem(session, item.id)) {
                is ApiResult.Ok -> _state.update { state ->
                    val merged = result.value.copy(
                        body = result.value.body ?: item.body,
                        excerpt = result.value.excerpt ?: item.excerpt,
                    )
                    state.copy(
                        detail = if (state.detail?.id == item.id) merged else state.detail,
                        detailLoading = false,
                        items = state.items?.map { row -> if (row.id == merged.id) row.copy(body = merged.body, excerpt = merged.excerpt, group = merged.group, tags = merged.tags) else row },
                    )
                }
                is ApiResult.Err -> {
                    if (result.error.status == 401) container.notifyUnauthorized()
                    _state.update { state ->
                        if (state.detail?.id == item.id) {
                            state.copy(detailLoading = false, banner = result.error.message)
                        } else {
                            state
                        }
                    }
                }
            }
        }
    }

    fun closeDetail() {
        _state.update { it.copy(detail = null, detailLoading = false) }
    }

    fun askDelete(item: CloudItem) {
        _state.update { it.copy(pendingDelete = item, pendingGroup = null) }
    }

    fun cancelDelete() {
        _state.update { it.copy(pendingDelete = null) }
    }

    fun askDeleteGroup(name: String, count: Int) {
        if (count <= 0 || name.isBlank()) return
        _state.update { it.copy(pendingGroup = PendingGroupDelete(name, count), pendingDelete = null) }
    }

    fun cancelGroupDelete() {
        if (_state.value.deleting) return
        _state.update { it.copy(pendingGroup = null) }
    }

    fun confirmGroupDelete() {
        val pending = _state.value.pendingGroup ?: return
        val session = container.session.value ?: return
        val group = canonicalGroup(pending.name)
        viewModelScope.launch {
            _state.update { it.copy(deleting = true, banner = null) }
            when (val result = container.api().deleteGroup(session, group)) {
                is ApiResult.Ok -> _state.update { state ->
                    state.copy(
                        deleting = false,
                        pendingGroup = null,
                        notice = fill(
                            t().groupDeleted,
                            mapOf("name" to displayGroup(pending.name, t()), "count" to result.value.toString()),
                        ),
                        detail = if (state.detail != null && canonicalGroup(state.detail.group) == group) null else state.detail,
                        pendingDelete = state.pendingDelete?.takeUnless { canonicalGroup(it.group) == group },
                        items = state.items?.filterNot { row -> canonicalGroup(row.group) == group },
                    )
                }
                is ApiResult.Err -> {
                    if (result.error.status == 401) container.notifyUnauthorized()
                    _state.update { it.copy(deleting = false, pendingGroup = null, banner = result.error.message) }
                }
            }
        }
    }

    fun deleteMany(ids: List<String>) {
        if (ids.isEmpty() || _state.value.deleting) return
        val session = container.session.value ?: return
        val gone = ids.toSet()
        viewModelScope.launch {
            _state.update { it.copy(deleting = true, banner = null) }
            when (val result = container.api().deleteItems(session, ids)) {
                is ApiResult.Ok -> _state.update {
                    it.copy(
                        deleting = false,
                        detail = if (it.detail?.id in gone) null else it.detail,
                        pendingDelete = it.pendingDelete?.takeUnless { row -> row.id in gone },
                        items = it.items?.filterNot { row -> row.id in gone },
                        notice = fill(t().deleteSelectedDone, mapOf("count" to result.value.toString())),
                    )
                }
                is ApiResult.Err -> {
                    if (result.error.status == 401) container.notifyUnauthorized()
                    _state.update { it.copy(deleting = false, banner = result.error.message) }
                }
            }
        }
    }

    fun confirmDelete() {
        val item = _state.value.pendingDelete ?: return
        val session = container.session.value ?: return
        viewModelScope.launch {
            _state.update { it.copy(deleting = true) }
            when (val result = container.api().deleteItem(session, item.id)) {
                is ApiResult.Ok -> _state.update {
                    it.copy(
                        deleting = false,
                        pendingDelete = null,
                        detail = if (it.detail?.id == item.id) null else it.detail,
                        items = it.items?.filterNot { row -> row.id == item.id },
                    )
                }
                is ApiResult.Err -> {
                    if (result.error.status == 401) container.notifyUnauthorized()
                    _state.update { it.copy(deleting = false, pendingDelete = null, banner = result.error.message) }
                }
            }
        }
    }

    fun clearBanner() {
        _state.update { it.copy(banner = null) }
    }

    fun clearNotice() {
        _state.update { it.copy(notice = null) }
    }

    private fun groupChoice(group: String?): GroupChoice {
        val raw = group?.trim()?.replace(Regex("\\s+"), " ").orEmpty()
        if (raw.length > MAX_GROUP_CHARS) {
            _state.update { it.copy(notice = t().groupTooLong, banner = null) }
            return GroupChoice.Invalid
        }
        return GroupChoice.Chosen(canonicalGroup(raw))
    }

    private fun patch(
        item: CloudItem,
        group: String?,
        tags: List<String>,
        setGroup: Boolean,
        setTags: Boolean,
        notice: String,
    ) {
        val session = container.session.value ?: return
        viewModelScope.launch {
            _state.update { it.copy(updatingId = item.id, notice = null, banner = null) }
            when (val result = container.api().patchItem(session, item.id, group = group, tags = tags, setGroup = setGroup, setTags = setTags)) {
                is ApiResult.Ok -> {
                    val returned = result.value
                    val base = returned?.item ?: item
                    val next = base.copy(
                        group = when {
                            returned != null && returned.echoedGroup -> returned.item.group
                            setGroup -> canonicalGroup(group)
                            else -> item.group
                        },
                        tags = when {
                            returned != null && returned.echoedTags -> returned.item.tags
                            setTags -> tags
                            else -> item.tags
                        },
                        body = base.body ?: item.body,
                        excerpt = base.excerpt ?: item.excerpt,
                    )
                    _state.update { state ->
                        state.copy(
                            updatingId = null,
                            notice = notice,
                            items = state.items?.map { row -> if (row.id == next.id) next else row },
                            detail = if (state.detail?.id == next.id) next else state.detail,
                        )
                    }
                }
                is ApiResult.Err -> {
                    if (result.error.status == 401) container.notifyUnauthorized()
                    _state.update { it.copy(updatingId = null, banner = result.error.message) }
                }
            }
        }
    }

    fun showBanner(message: String) {
        _state.update { it.copy(banner = message) }
    }

    suspend fun fetchContent(id: String, attachment: Boolean): ApiResult<ByteArray> {
        val session = container.session.value
            ?: return ApiResult.Err(app.xiayun.core.ApiError(401, "UNAUTHENTICATED", t().notSignedIn))
        val result = container.api().content(session, id, attachment)
        if (result is ApiResult.Err && result.error.status == 401) container.notifyUnauthorized()
        return result
    }

    private sealed class GroupChoice {
        data class Chosen(val name: String?) : GroupChoice()
        data object Invalid : GroupChoice()
    }

    companion object {
        fun factory(container: AppContainer): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T = LibraryViewModel(container) as T
            }
    }
}
