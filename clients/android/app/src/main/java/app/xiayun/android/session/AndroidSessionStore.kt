package app.xiayun.android.session

import android.content.Context
import android.content.SharedPreferences
import android.util.Base64
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import app.xiayun.core.AuthSession
import app.xiayun.core.BiometricEnvelope
import app.xiayun.core.SessionStore

class AndroidSessionStore(context: Context) : SessionStore {
    private val appContext = context.applicationContext
    private val plain = openPlainPrefs()
    private val vault = appContext.getSharedPreferences("xiayun_vault", Context.MODE_PRIVATE)

    override fun readPlain(): AuthSession? {
        val token = plain.getString(KEY_TOKEN, null) ?: return null
        if (token.isBlank()) return null
        return AuthSession(
            token = token,
            email = plain.getString(KEY_EMAIL, "").orEmpty(),
            userId = plain.getString(KEY_USER, "").orEmpty(),
        )
    }

    override fun writePlain(session: AuthSession?) {
        plain.edit().apply {
            if (session == null || !session.hasToken()) {
                remove(KEY_TOKEN)
                remove(KEY_EMAIL)
                remove(KEY_USER)
            } else {
                putString(KEY_TOKEN, session.token)
                putString(KEY_EMAIL, session.email)
                putString(KEY_USER, session.userId)
            }
        }.apply()
    }

    override fun isBiometricEnabled(): Boolean = vault.getBoolean(KEY_ENABLED, false)

    override fun setBiometricEnabled(enabled: Boolean) {
        vault.edit().putBoolean(KEY_ENABLED, enabled).apply()
    }

    override fun readEnvelope(): BiometricEnvelope? {
        val iv = vault.getString(KEY_IV, null) ?: return null
        val ciphertext = vault.getString(KEY_CIPHERTEXT, null) ?: return null
        return try {
            BiometricEnvelope(
                iv = Base64.decode(iv, Base64.NO_WRAP),
                ciphertext = Base64.decode(ciphertext, Base64.NO_WRAP),
            )
        } catch (_: Exception) {
            null
        }
    }

    override fun writeEnvelope(envelope: BiometricEnvelope?) {
        vault.edit().apply {
            if (envelope == null) {
                remove(KEY_IV)
                remove(KEY_CIPHERTEXT)
            } else {
                putString(KEY_IV, Base64.encodeToString(envelope.iv, Base64.NO_WRAP))
                putString(KEY_CIPHERTEXT, Base64.encodeToString(envelope.ciphertext, Base64.NO_WRAP))
            }
        }.apply()
    }

    private fun openPlainPrefs(): SharedPreferences {
        return try {
            val alias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
            EncryptedSharedPreferences.create(
                "xiayun_session",
                alias,
                appContext,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
        } catch (_: Exception) {
            appContext.getSharedPreferences("xiayun_session_fallback", Context.MODE_PRIVATE)
        }
    }

    private companion object {
        const val KEY_TOKEN = "token"
        const val KEY_EMAIL = "email"
        const val KEY_USER = "user_id"
        const val KEY_ENABLED = "enabled"
        const val KEY_IV = "iv"
        const val KEY_CIPHERTEXT = "ciphertext"
    }
}
