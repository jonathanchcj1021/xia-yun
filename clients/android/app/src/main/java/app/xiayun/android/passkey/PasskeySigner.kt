package app.xiayun.android.passkey

import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetPublicKeyCredentialOption
import androidx.credentials.PublicKeyCredential
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.fragment.app.FragmentActivity
import app.xiayun.core.ApiError
import app.xiayun.core.ApiResult
import app.xiayun.core.AuthSession
import app.xiayun.core.ClientMessages
import app.xiayun.core.XiaYunApi

class PasskeySigner(
    private val activity: FragmentActivity,
    private val api: () -> XiaYunApi,
) {
    suspend fun login(email: String): ApiResult<AuthSession> {
        val trimmed = email.trim()
        if (trimmed.isEmpty()) {
            return ApiResult.Err(ApiError(0, "VALIDATION", ClientMessages.NEED_EMAIL))
        }
        val requestJson = when (val options = api().passkeyOptions(trimmed)) {
            is ApiResult.Err -> return options
            is ApiResult.Ok -> options.value
        }
        return try {
            val manager = CredentialManager.create(activity)
            val request = GetCredentialRequest.Builder()
                .addCredentialOption(GetPublicKeyCredentialOption(requestJson))
                .build()
            val result = manager.getCredential(activity, request)
            val credential = result.credential
            if (credential !is PublicKeyCredential) {
                ApiResult.Err(ApiError(0, "PASSKEY", "這台裝置沒有回傳通行密鑰"))
            } else {
                api().passkeyVerify(trimmed, credential.authenticationResponseJson)
            }
        } catch (_: GetCredentialCancellationException) {
            ApiResult.Err(ApiError(0, "CANCELLED", "已取消通行密鑰登入"))
        } catch (error: GetCredentialException) {
            val detail = error.errorMessage?.toString()?.takeIf { it.isNotBlank() }
            val message = if (detail == null) {
                "這台裝置目前無法使用通行密鑰"
            } else {
                "這台裝置目前無法使用通行密鑰：$detail"
            }
            ApiResult.Err(ApiError(0, "PASSKEY", message))
        } catch (_: Exception) {
            ApiResult.Err(ApiError(0, "PASSKEY", "通行密鑰登入沒有完成"))
        }
    }
}
