package app.xiayun.android.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import app.xiayun.core.Limits

@Composable
fun AuthScreen(
    baseUrl: String,
    busy: Boolean,
    passkeyBusy: Boolean,
    error: String?,
    fromLock: Boolean,
    onLogin: (email: String, password: String) -> Unit,
    onRegister: (email: String, password: String) -> Unit,
    onPasskey: (email: String) -> Unit,
    onSaveServer: (String) -> String?,
    onBackToLock: () -> Unit,
) {
    var register by rememberSaveable { mutableStateOf(false) }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var confirm by rememberSaveable { mutableStateOf("") }
    var formError by rememberSaveable { mutableStateOf<String?>(null) }
    var serverOpen by rememberSaveable { mutableStateOf(false) }
    var serverDraft by rememberSaveable { mutableStateOf(baseUrl) }
    var serverError by rememberSaveable { mutableStateOf<String?>(null) }
    val shown = formError ?: error
    val copy = LocalAppCopy.current
    val context = LocalContext.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .safeScreenPadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Column(Modifier.widthIn(max = 480.dp)) {
            LanguageSwitcher()
            Spacer(Modifier.height(12.dp))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.clickable { openProductPage(context) },
            ) {
                Mark()
                Text(LocalAppCopy.current.brand, style = MaterialTheme.typography.titleLarge)
            }
            Spacer(Modifier.height(28.dp))
            Text(
                if (register) LocalAppCopy.current.registerTitle else LocalAppCopy.current.loginTitle,
                style = MaterialTheme.typography.headlineMedium,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                if (register) LocalAppCopy.current.registerLead else LocalAppCopy.current.loginLead,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(20.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = !register,
                    onClick = {
                        register = false
                        formError = null
                    },
                    label = { Text(LocalAppCopy.current.login) },
                )
                FilterChip(
                    selected = register,
                    onClick = {
                        register = true
                        formError = null
                    },
                    label = { Text(LocalAppCopy.current.createAccount) },
                )
            }
            Spacer(Modifier.height(16.dp))
            OutlinedTextField(
                value = email,
                onValueChange = {
                    email = it
                    formError = null
                },
                modifier = Modifier.fillMaxWidth(),
                label = { Text(LocalAppCopy.current.email) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
            )
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = password,
                onValueChange = {
                    password = it
                    formError = null
                },
                modifier = Modifier.fillMaxWidth(),
                label = { Text(LocalAppCopy.current.password) },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
            )
            if (register) {
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = confirm,
                    onValueChange = {
                        confirm = it
                        formError = null
                    },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text(LocalAppCopy.current.confirmPassword) },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                )
            }
            if (!shown.isNullOrBlank()) {
                Spacer(Modifier.height(12.dp))
                Text(
                    shown,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            Spacer(Modifier.height(16.dp))
            Button(
                onClick = {
                    val problem = validate(register, email, password, confirm, copy)
                    if (problem != null) {
                        formError = problem
                    } else if (register) {
                        onRegister(email.trim(), password)
                    } else {
                        onLogin(email.trim(), password)
                    }
                },
                enabled = !busy && !passkeyBusy,
                modifier = Modifier.fillMaxWidth().height(48.dp),
            ) {
                Text(
                    when {
                        busy && register -> copy.creating
                        busy -> copy.loggingIn
                        register -> LocalAppCopy.current.createAccount
                        else -> LocalAppCopy.current.login
                    },
                )
            }
            if (!register) {
                Spacer(Modifier.height(8.dp))
                OutlinedButton(
                    onClick = {
                        if (email.isBlank()) formError = copy.emailFirst else onPasskey(email.trim())
                    },
                    enabled = !busy && !passkeyBusy,
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                ) {
                    Text(if (passkeyBusy) copy.passkeyWaiting else copy.passkeyLogin)
                }
            }
            Spacer(Modifier.height(8.dp))
            TextButton(onClick = {
                serverDraft = baseUrl
                serverError = null
                serverOpen = true
            }) {
                Text(copy.server)
            }
            Text(
                baseUrl,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (fromLock) {
                TextButton(onClick = onBackToLock) { Text(copy.backToBiometric) }
            }
        }
    }

    if (serverOpen) {
        AlertDialog(
            onDismissRequest = { serverOpen = false },
            title = { Text(copy.server) },
            text = {
                Column {
                    Text(
                        copy.serverHelp,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    Spacer(Modifier.height(12.dp))
                    OutlinedTextField(
                        value = serverDraft,
                        onValueChange = {
                            serverDraft = it
                            serverError = null
                        },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        label = { Text(copy.address) },
                    )
                    if (serverError != null) {
                        Spacer(Modifier.height(8.dp))
                        Text(serverError!!, color = MaterialTheme.colorScheme.error)
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    val problem = onSaveServer(serverDraft)
                    if (problem == null) serverOpen = false else serverError = problem
                }) { Text(copy.save) }
            },
            dismissButton = {
                TextButton(onClick = { serverOpen = false }) { Text(copy.cancel) }
            },
        )
    }
}

private fun validate(
    register: Boolean,
    email: String,
    password: String,
    confirm: String,
    copy: AppCopy,
): String? {
    if (email.isBlank()) return copy.emailFirst
    if (register && password.length < Limits.MIN_PASSWORD) return copy.passwordShort
    if (register && password != confirm) return copy.passwordMismatch
    if (!register && password.isEmpty()) return copy.passwordRequired
    return null
}
