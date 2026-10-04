package app.xiayun.android.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import app.xiayun.android.AppContainer
import app.xiayun.android.passkey.PasskeySigner
import app.xiayun.android.session.BiometricVault
import app.xiayun.core.BaseUrls
import kotlinx.coroutines.launch

@Composable
fun XiaYunApp(
    container: AppContainer,
    vault: BiometricVault,
    passkey: PasskeySigner,
) {
    val appModel: AppViewModel = viewModel(factory = AppViewModel.factory(container))
    val state by appModel.state.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    var passkeyBusy by remember { mutableStateOf(false) }
    var serverFromLibrary by remember { mutableStateOf(false) }

    BackHandler(enabled = state.fromLock && state.phase == Phase.SignedOut) {
        appModel.returnToLock()
    }

    when (state.phase) {
        Phase.Checking -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        Phase.Locked -> LockScreen(
            error = state.error,
            onUnlock = {
                val envelope = container.sessionStore.readEnvelope()
                if (envelope == null) {
                    appModel.forgetVault("找不到已儲存的工作階段，請重新登入")
                } else {
                    vault.decrypt(
                        envelope = envelope,
                        onSuccess = { session -> appModel.onUnlocked(session) },
                        onError = { message ->
                            if (message.contains("請改用密碼")) appModel.forgetVault(message) else appModel.showError(message)
                        },
                        onCancel = { appModel.usePassword() },
                    )
                }
            },
            onPassword = { appModel.usePassword() },
        )
        Phase.SignedOut -> AuthScreen(
            baseUrl = state.baseUrl.ifBlank { BaseUrls.DEFAULT },
            busy = state.busy,
            passkeyBusy = passkeyBusy,
            error = state.error,
            fromLock = state.fromLock,
            onLogin = appModel::login,
            onRegister = appModel::register,
            onPasskey = { email ->
                passkeyBusy = true
                appModel.clearError()
                scope.launch {
                    val result = passkey.login(email)
                    passkeyBusy = false
                    appModel.onPasskeyResult(result, email)
                }
            },
            onSaveServer = appModel::updateBaseUrl,
            onBackToLock = appModel::returnToLock,
        )
        Phase.SignedIn -> {
            val token = container.session.value?.token ?: "signed-in"
            val libraryModel: LibraryViewModel = viewModel(
                key = token,
                factory = LibraryViewModel.factory(container),
            )
            val library by libraryModel.state.collectAsStateWithLifecycle()
            LibraryScreen(
                email = state.email,
                state = library,
                biometricEnabled = state.biometricEnabled,
                biometricAvailable = vault.canAuthenticate(),
                onRefresh = libraryModel::refresh,
                onUpload = libraryModel::upload,
                onCreateNote = libraryModel::createNote,
                onAddTag = libraryModel::addTag,
                onRemoveTag = libraryModel::removeTag,
                onMove = libraryModel::moveItem,
                onOpen = libraryModel::open,
                onCloseDetail = libraryModel::closeDetail,
                onAskDelete = libraryModel::askDelete,
                onCancelDelete = libraryModel::cancelDelete,
                onConfirmDelete = libraryModel::confirmDelete,
                onAskDeleteGroup = libraryModel::askDeleteGroup,
                onCancelGroupDelete = libraryModel::cancelGroupDelete,
                onConfirmGroupDelete = libraryModel::confirmGroupDelete,
                onClearBanner = libraryModel::clearBanner,
                onBanner = libraryModel::showBanner,
                fetchContent = libraryModel::fetchContent,
                previewLink = libraryModel::previewLink,
                onSignOut = appModel::signOut,
                onToggleBiometric = { enable ->
                    if (!enable) {
                        appModel.disableBiometric()
                    } else {
                        val session = container.session.value ?: return@LibraryScreen
                        vault.encrypt(
                            session = session,
                            onSuccess = appModel::onBiometricSaved,
                            onError = appModel::showError,
                            onCancel = {},
                        )
                    }
                },
                onOpenServer = { serverFromLibrary = true },
            )
            if (serverFromLibrary) {
                ServerDialog(
                    initial = state.baseUrl,
                    onDismiss = { serverFromLibrary = false },
                    onSave = { raw ->
                        val problem = appModel.updateBaseUrl(raw)
                        if (problem == null) serverFromLibrary = false
                        problem
                    },
                )
            }
        }
    }

    if (state.offerBiometric && state.phase == Phase.SignedIn) {
        if (vault.canAuthenticate()) {
            AlertDialog(
                onDismissRequest = appModel::dismissOffer,
                title = { Text("用生物辨識解鎖？") },
                text = { Text("下次開啟匣雲時，可以用指紋或臉部辨識還原這次登入，不必再輸入密碼。") },
                confirmButton = {
                    TextButton(onClick = {
                        val session = container.session.value
                        appModel.dismissOffer()
                        if (session != null) {
                            vault.encrypt(
                                session = session,
                                onSuccess = appModel::onBiometricSaved,
                                onError = appModel::showError,
                                onCancel = {},
                            )
                        }
                    }) { Text("啟用") }
                },
                dismissButton = {
                    TextButton(onClick = appModel::dismissOffer) { Text("暫時不要") }
                },
            )
        } else {
            LaunchedEffect(Unit) { appModel.dismissOffer() }
        }
    }
}

@Composable
private fun ServerDialog(
    initial: String,
    onDismiss: () -> Unit,
    onSave: (String) -> String?,
) {
    var draft by remember { mutableStateOf(initial) }
    var error by remember { mutableStateOf<String?>(null) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("伺服器位址") },
        text = {
            androidx.compose.foundation.layout.Column {
                androidx.compose.material3.OutlinedTextField(
                    value = draft,
                    onValueChange = {
                        draft = it
                        error = null
                    },
                    singleLine = true,
                    label = { Text("位址") },
                )
                if (error != null) {
                    Text(error!!, color = androidx.compose.material3.MaterialTheme.colorScheme.error)
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val problem = onSave(draft)
                error = problem
            }) { Text("儲存") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("取消") } },
    )
}
