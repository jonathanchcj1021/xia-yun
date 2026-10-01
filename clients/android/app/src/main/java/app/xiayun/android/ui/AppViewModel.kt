package app.xiayun.android.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import app.xiayun.android.AppContainer
import app.xiayun.core.ApiResult
import app.xiayun.core.AuthSession
import app.xiayun.core.BaseUrls
import app.xiayun.core.BiometricEnvelope
import app.xiayun.core.StartupRoute
import app.xiayun.core.interpretSessionCheck
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class Phase {
    Checking,
    Locked,
    SignedOut,
    SignedIn,
}

data class AppUiState(
    val phase: Phase = Phase.Checking,
    val error: String? = null,
    val busy: Boolean = false,
    val offerBiometric: Boolean = false,
    val fromLock: Boolean = false,
    val baseUrl: String = "",
    val email: String = "",
    val biometricEnabled: Boolean = false,
)

class AppViewModel(private val container: AppContainer) : ViewModel() {
    private val _state = MutableStateFlow(
        AppUiState(
            baseUrl = container.baseUrl(),
            biometricEnabled = container.sessionStore.isBiometricEnabled(),
        ),
    )
    val state: StateFlow<AppUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            container.unauthorized.collect {
                expire()
            }
        }
        viewModelScope.launch { restore() }
    }

    fun login(email: String, password: String) = authenticate(email) {
        container.api().login(email, password)
    }

    fun register(email: String, password: String) = authenticate(email) {
        container.api().register(email, password)
    }

    fun onPasskeyResult(result: ApiResult<AuthSession>, email: String) {
        when (result) {
            is ApiResult.Ok -> finishLogin(result.value, email)
            is ApiResult.Err -> _state.update { it.copy(busy = false, error = result.error.message) }
        }
    }

    fun setBusy(busy: Boolean) {
        _state.update { it.copy(busy = busy, error = if (busy) null else it.error) }
    }

    fun clearError() {
        _state.update { it.copy(error = null) }
    }

    fun showError(message: String) {
        _state.update { it.copy(error = message, busy = false) }
    }

    fun usePassword() {
        _state.update { it.copy(phase = Phase.SignedOut, fromLock = true, error = null, busy = false) }
    }

    fun returnToLock() {
        _state.update { it.copy(phase = Phase.Locked, fromLock = false, error = null) }
    }

    fun dismissOffer() {
        _state.update { it.copy(offerBiometric = false) }
    }

    fun onBiometricSaved(envelope: BiometricEnvelope) {
        container.gate.saveBiometric(envelope)
        _state.update { it.copy(offerBiometric = false, biometricEnabled = true, error = null) }
    }

    fun disableBiometric() {
        val session = container.session.value ?: return
        container.gate.disableBiometric(session)
        _state.update { it.copy(biometricEnabled = false) }
    }

    fun forgetVault(message: String) {
        container.gate.clear()
        container.session.value = null
        _state.update {
            it.copy(
                phase = Phase.SignedOut,
                fromLock = false,
                biometricEnabled = false,
                offerBiometric = false,
                error = message,
                busy = false,
            )
        }
    }

    fun onUnlocked(session: AuthSession) {
        viewModelScope.launch {
            container.session.value = session
            when (val me = container.api().me(session)) {
                is ApiResult.Ok -> {
                    val enriched = session.copy(email = me.value.email, userId = me.value.id)
                    container.session.value = enriched
                    _state.update {
                        it.copy(phase = Phase.SignedIn, email = enriched.email, error = null, busy = false)
                    }
                }
                is ApiResult.Err -> when (interpretSessionCheck(me.error.status)) {
                    app.xiayun.core.RestoreOutcome.Expired -> expire()
                    else -> _state.update {
                        it.copy(
                            phase = Phase.SignedIn,
                            email = session.email,
                            error = null,
                            busy = false,
                        )
                    }
                }
            }
        }
    }

    fun updateBaseUrl(raw: String): String? {
        val normalized = BaseUrls.normalize(raw) ?: return "伺服器位址不正確"
        container.setBaseUrl(normalized)
        _state.update { it.copy(baseUrl = normalized) }
        return null
    }

    fun signOut() {
        val session = container.session.value
        viewModelScope.launch {
            if (session != null) {
                runCatching { container.api().logout(session) }
            }
            container.gate.clear()
            container.session.value = null
            _state.update {
                it.copy(
                    phase = Phase.SignedOut,
                    fromLock = false,
                    offerBiometric = false,
                    biometricEnabled = false,
                    error = null,
                    busy = false,
                    email = "",
                )
            }
        }
    }

    private fun authenticate(email: String, call: suspend () -> ApiResult<AuthSession>) {
        if (_state.value.busy) return
        viewModelScope.launch {
            _state.update { it.copy(busy = true, error = null) }
            when (val result = call()) {
                is ApiResult.Ok -> finishLogin(result.value, email)
                is ApiResult.Err -> _state.update { it.copy(busy = false, error = result.error.message) }
            }
        }
    }

    private fun finishLogin(session: AuthSession, fallbackEmail: String) {
        val enriched = if (session.email.isBlank()) session.copy(email = fallbackEmail.trim()) else session
        container.gate.saveInteractiveLogin(enriched)
        container.session.value = enriched
        _state.update {
            it.copy(
                phase = Phase.SignedIn,
                busy = false,
                error = null,
                offerBiometric = true,
                fromLock = false,
                email = enriched.email,
                biometricEnabled = false,
            )
        }
    }

    private suspend fun restore() {
        when (container.gate.route()) {
            StartupRoute.BiometricUnlock -> _state.update {
                it.copy(phase = Phase.Locked, biometricEnabled = true)
            }
            StartupRoute.Restore -> {
                val session = container.sessionStore.readPlain()
                if (session == null) {
                    _state.update { it.copy(phase = Phase.SignedOut) }
                    return
                }
                container.session.value = session
                when (val me = container.api().me(session)) {
                    is ApiResult.Ok -> _state.update {
                        it.copy(phase = Phase.SignedIn, email = me.value.email, biometricEnabled = false)
                    }
                    is ApiResult.Err -> when (interpretSessionCheck(me.error.status)) {
                        app.xiayun.core.RestoreOutcome.Expired -> expire()
                        else -> _state.update {
                            it.copy(phase = Phase.SignedIn, email = session.email)
                        }
                    }
                }
            }
            StartupRoute.SignedOut -> _state.update { it.copy(phase = Phase.SignedOut) }
        }
    }

    private fun expire() {
        container.gate.clear()
        container.session.value = null
        _state.update {
            it.copy(
                phase = Phase.SignedOut,
                fromLock = false,
                biometricEnabled = false,
                offerBiometric = false,
                busy = false,
                error = "工作階段已失效，請重新登入",
            )
        }
    }

    companion object {
        fun factory(container: AppContainer): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T = AppViewModel(container) as T
            }
    }
}
