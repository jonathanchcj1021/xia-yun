package app.xiayun.android.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import app.xiayun.android.AppContainer
import app.xiayun.core.ApiResult
import app.xiayun.core.CloudItem
import app.xiayun.core.LinkPreview
import app.xiayun.core.MAX_GROUP_CHARS
import app.xiayun.core.MAX_TAG_CHARS
import app.xiayun.core.UNGROUPED_LABEL
import app.xiayun.core.Upload
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

    fun upload(files: List<Upload>) {
        if (files.isEmpty() || _state.value.uploading) return
        val session = container.session.value ?: return
        viewModelScope.launch {
            _state.update { it.copy(uploading = true, banner = null) }
            var failure: String? = null
            for (file in files) {
                when (val result = container.api().upload(session, file)) {
                    is ApiResult.Ok -> Unit
                    is ApiResult.Err -> {
                        if (result.error.status == 401) {
                            container.notifyUnauthorized()
                            _state.update { it.copy(uploading = false) }
                            return@launch
                        }
                        failure = result.error.message
                        break
                    }
                }
            }
            _state.update { it.copy(uploading = false, banner = failure) }
            refresh()
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
            val label = target ?: UNGROUPED_LABEL
            _state.update {
                it.copy(
                    savingNote = false,
                    banner = failure,
                    notice = if (failure == null) "已把筆記「${title.trim()}」放進「$label」" else null,
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
            _state.update { it.copy(notice = "標籤請留在十二個字以內", banner = null) }
            return
        }
        if (value in item.tags) {
            _state.update { it.copy(notice = "「${item.name}」已經有標籤「$value」", banner = null) }
            return
        }
        patch(item, group = item.group, tags = item.tags + value, setGroup = false, setTags = true, notice = "已為「${item.name}」加上「$value」")
    }

    fun removeTag(item: CloudItem, tag: String) {
        if (tag !in item.tags) return
        patch(item, group = item.group, tags = item.tags - tag, setGroup = false, setTags = true, notice = "已從「${item.name}」移除「$tag」")
    }

    fun moveItem(item: CloudItem, group: String?) {
        val target = when (val choice = groupChoice(group)) {
            GroupChoice.Invalid -> return
            is GroupChoice.Chosen -> choice.name
        }
        if (canonicalGroup(item.group) == target) return
        val label = target ?: UNGROUPED_LABEL
        patch(item, group = target, tags = item.tags, setGroup = true, setTags = false, notice = "已把「${item.name}」移到「$label」")
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
                        notice = "已刪除「${pending.name}」入面 ${result.value} 個項目",
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
            _state.update { it.copy(notice = "分組名稱請留在四十個字以內", banner = null) }
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
            ?: return ApiResult.Err(app.xiayun.core.ApiError(401, "UNAUTHENTICATED", "尚未登入"))
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
