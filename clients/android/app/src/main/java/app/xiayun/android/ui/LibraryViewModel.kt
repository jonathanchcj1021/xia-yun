package app.xiayun.android.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import app.xiayun.android.AppContainer
import app.xiayun.core.ApiResult
import app.xiayun.core.CloudItem
import app.xiayun.core.Upload
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

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
    val deleting: Boolean = false,
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

    fun createNote(title: String, body: String) {
        val session = container.session.value ?: return
        viewModelScope.launch {
            _state.update { it.copy(savingNote = true, banner = null) }
            when (val result = container.api().createNote(session, title, body)) {
                is ApiResult.Ok -> _state.update { it.copy(savingNote = false) }
                is ApiResult.Err -> {
                    if (result.error.status == 401) container.notifyUnauthorized()
                    _state.update { it.copy(savingNote = false, banner = result.error.message) }
                    return@launch
                }
            }
            refresh()
        }
    }

    fun open(item: CloudItem) {
        _state.update { it.copy(detail = item, detailLoading = true, banner = null) }
        val session = container.session.value ?: return
        viewModelScope.launch {
            when (val result = container.api().getItem(session, item.id)) {
                is ApiResult.Ok -> _state.update { state ->
                    if (state.detail?.id == item.id) state.copy(detail = result.value, detailLoading = false) else state
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
        _state.update { it.copy(pendingDelete = item) }
    }

    fun cancelDelete() {
        _state.update { it.copy(pendingDelete = null) }
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

    companion object {
        fun factory(container: AppContainer): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T = LibraryViewModel(container) as T
            }
    }
}
