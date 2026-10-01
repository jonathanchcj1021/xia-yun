package app.xiayun.core

import kotlinx.serialization.json.Json

enum class StartupRoute {
    SignedOut,
    BiometricUnlock,
    Restore,
}

enum class RestoreOutcome {
    Ready,
    Expired,
    Offline,
}

data class BiometricEnvelope(
    val iv: ByteArray,
    val ciphertext: ByteArray,
)

interface SessionStore {
    fun readPlain(): AuthSession?
    fun writePlain(session: AuthSession?)
    fun isBiometricEnabled(): Boolean
    fun setBiometricEnabled(enabled: Boolean)
    fun readEnvelope(): BiometricEnvelope?
    fun writeEnvelope(envelope: BiometricEnvelope?)
}

class SessionGate(private val store: SessionStore) {
    fun route(): StartupRoute {
        if (store.isBiometricEnabled() && store.readEnvelope() != null) {
            return StartupRoute.BiometricUnlock
        }
        val plain = store.readPlain()
        if (plain != null && plain.hasToken()) return StartupRoute.Restore
        return StartupRoute.SignedOut
    }

    fun saveInteractiveLogin(session: AuthSession) {
        store.setBiometricEnabled(false)
        store.writeEnvelope(null)
        store.writePlain(session)
    }

    fun saveBiometric(envelope: BiometricEnvelope) {
        store.writeEnvelope(envelope)
        store.setBiometricEnabled(true)
        store.writePlain(null)
    }

    fun disableBiometric(current: AuthSession) {
        store.writePlain(current)
        store.writeEnvelope(null)
        store.setBiometricEnabled(false)
    }

    fun clear() {
        store.writePlain(null)
        store.writeEnvelope(null)
        store.setBiometricEnabled(false)
    }
}

fun shouldOfferBiometric(hardwareReady: Boolean, biometricEnabled: Boolean): Boolean =
    hardwareReady && !biometricEnabled

fun interpretSessionCheck(status: Int?): RestoreOutcome = when (status) {
    null -> RestoreOutcome.Offline
    401 -> RestoreOutcome.Expired
    in 200..299 -> RestoreOutcome.Ready
    else -> RestoreOutcome.Offline
}

/**
 * Login and passkey verify return `token` when `client` is `native`.
 * Register only sets the `session` cookie, and that cookie value is the same
 * session secret the API accepts as a bearer token.
 */
fun bearerFrom(jsonToken: String?, sessionCookie: String?): String? =
    jsonToken?.trim()?.takeIf { it.isNotEmpty() }
        ?: sessionCookie?.trim()?.takeIf { it.isNotEmpty() }

object SessionCodec {
    private val json = Json { ignoreUnknownKeys = true }

    fun encode(session: AuthSession): String = json.encodeToString(AuthSession.serializer(), session)

    fun decode(text: String): AuthSession = json.decodeFromString(AuthSession.serializer(), text)
}

fun sessionCookie(setCookieHeaders: List<String>): String? {
    for (header in setCookieHeaders) {
        val first = header.substringBefore(';').trim()
        val eq = first.indexOf('=')
        if (eq <= 0) continue
        val name = first.substring(0, eq).trim()
        if (!name.equals("session", ignoreCase = true)) continue
        var value = first.substring(eq + 1).trim()
        if (value.length >= 2 && value.startsWith("\"") && value.endsWith("\"")) {
            value = value.substring(1, value.length - 1)
        }
        if (value.isNotEmpty()) return value
    }
    return null
}
