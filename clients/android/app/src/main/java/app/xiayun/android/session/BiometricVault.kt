package app.xiayun.android.session

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import app.xiayun.android.ui.copyFor
import app.xiayun.android.ui.readAppLang
import app.xiayun.core.AuthSession
import app.xiayun.core.BiometricEnvelope
import app.xiayun.core.SessionCodec
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class BiometricVault(private val activity: FragmentActivity) {
    private fun t() = copyFor(readAppLang(activity))
    fun canAuthenticate(): Boolean {
        val manager = BiometricManager.from(activity)
        return manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) ==
            BiometricManager.BIOMETRIC_SUCCESS
    }

    fun encrypt(
        session: AuthSession,
        onSuccess: (BiometricEnvelope) -> Unit,
        onError: (String) -> Unit,
        onCancel: () -> Unit,
    ) {
        val cipher = try {
            cipher(Cipher.ENCRYPT_MODE, null)
        } catch (_: KeyPermanentlyInvalidatedException) {
            deleteKey()
            try {
                cipher(Cipher.ENCRYPT_MODE, null)
            } catch (_: Exception) {
                onError(t().bioKey)
                return
            }
        } catch (_: Exception) {
            onError(t().bioUnavailable)
            return
        }
        authenticate(
            title = t().bioEnableTitle,
            subtitle = t().bioEnableSubtitle,
            negative = t().cancel,
            cipher = cipher,
            onSuccess = {
                try {
                    val encrypted = cipher.doFinal(SessionCodec.encode(session).toByteArray(Charsets.UTF_8))
                    onSuccess(BiometricEnvelope(iv = cipher.iv, ciphertext = encrypted))
                } catch (_: Exception) {
                    onError(t().bioSaveFailed)
                }
            },
            onCancel = onCancel,
            onError = onError,
        )
    }

    fun decrypt(
        envelope: BiometricEnvelope,
        onSuccess: (AuthSession) -> Unit,
        onError: (String) -> Unit,
        onCancel: () -> Unit,
    ) {
        val cipher = try {
            cipher(Cipher.DECRYPT_MODE, envelope.iv)
        } catch (_: KeyPermanentlyInvalidatedException) {
            deleteKey()
            onError(t().bioChanged)
            return
        } catch (_: Exception) {
            onError(t().bioReadFailed)
            return
        }
        authenticate(
            title = t().bioUnlockTitle,
            subtitle = t().bioUnlockSubtitle,
            negative = t().bioUsePassword,
            cipher = cipher,
            onSuccess = {
                try {
                    val plain = cipher.doFinal(envelope.ciphertext)
                    onSuccess(SessionCodec.decode(plain.toString(Charsets.UTF_8)))
                } catch (_: Exception) {
                    onError(t().bioDecryptFailed)
                }
            },
            onCancel = onCancel,
            onError = onError,
        )
    }

    private fun authenticate(
        title: String,
        subtitle: String,
        negative: String,
        cipher: Cipher,
        onSuccess: () -> Unit,
        onCancel: () -> Unit,
        onError: (String) -> Unit,
    ) {
        val executor = ContextCompat.getMainExecutor(activity)
        val prompt = BiometricPrompt(
            activity,
            executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    onSuccess()
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    if (
                        errorCode == BiometricPrompt.ERROR_USER_CANCELED ||
                        errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON ||
                        errorCode == BiometricPrompt.ERROR_CANCELED
                    ) {
                        onCancel()
                    } else {
                        val text = errString.toString().ifBlank { t().bioIncomplete }
                        onError(text)
                    }
                }
            },
        )
        val info = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setNegativeButtonText(negative)
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
            .build()
        prompt.authenticate(info, BiometricPrompt.CryptoObject(cipher))
    }

    private fun cipher(mode: Int, iv: ByteArray?): Cipher {
        val secret = secretKey()
        val cipher = Cipher.getInstance(TRANSFORMATION)
        if (mode == Cipher.ENCRYPT_MODE) {
            cipher.init(Cipher.ENCRYPT_MODE, secret)
        } else {
            cipher.init(Cipher.DECRYPT_MODE, secret, GCMParameterSpec(128, iv))
        }
        return cipher
    }

    private fun secretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        val existing = keyStore.getKey(KEY_ALIAS, null) as? SecretKey
        if (existing != null) return existing
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        val builder = KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setUserAuthenticationRequired(true)
            .setInvalidatedByBiometricEnrollment(true)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            builder.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG)
        } else {
            @Suppress("DEPRECATION")
            builder.setUserAuthenticationValidityDurationSeconds(-1)
        }
        generator.init(builder.build())
        return generator.generateKey()
    }

    private fun deleteKey() {
        try {
            val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
            keyStore.deleteEntry(KEY_ALIAS)
        } catch (_: Exception) {
            // The next password login replaces the vault.
        }
    }

    private companion object {
        const val KEY_ALIAS = "xiayun_biometric_session"
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
    }
}
