package app.xiayun.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SessionGateTest {
    @Test
    fun routeAndBiometricHandoff() {
        val store = MemorySessionStore()
        val gate = SessionGate(store)
        assertEquals(StartupRoute.SignedOut, gate.route())

        val session = AuthSession(token = "tok", email = "a@b.co", userId = "u")
        gate.saveInteractiveLogin(session)
        assertEquals(StartupRoute.Restore, gate.route())
        assertEquals(session, store.readPlain())

        val envelope = BiometricEnvelope(iv = byteArrayOf(1), ciphertext = byteArrayOf(2, 3))
        gate.saveBiometric(envelope)
        assertEquals(StartupRoute.BiometricUnlock, gate.route())
        assertNull(store.readPlain())
        assertTrue(store.isBiometricEnabled())

        gate.disableBiometric(session)
        assertEquals(StartupRoute.Restore, gate.route())
        assertFalse(store.isBiometricEnabled())
        assertNull(store.readEnvelope())

        gate.clear()
        assertEquals(StartupRoute.SignedOut, gate.route())
    }

    @Test
    fun enabledWithoutEnvelopeDoesNotLockForever() {
        val store = MemorySessionStore()
        store.setBiometricEnabled(true)
        assertEquals(StartupRoute.SignedOut, SessionGate(store).route())
    }

    @Test
    fun offerAndSessionCheck() {
        assertTrue(shouldOfferBiometric(hardwareReady = true, biometricEnabled = false))
        assertFalse(shouldOfferBiometric(hardwareReady = true, biometricEnabled = true))
        assertFalse(shouldOfferBiometric(hardwareReady = false, biometricEnabled = false))
        assertEquals(RestoreOutcome.Ready, interpretSessionCheck(200))
        assertEquals(RestoreOutcome.Expired, interpretSessionCheck(401))
        assertEquals(RestoreOutcome.Offline, interpretSessionCheck(null))
        assertEquals(RestoreOutcome.Offline, interpretSessionCheck(500))
    }

    @Test
    fun sessionCodecRoundTrip() {
        val session = AuthSession(token = "tok+/=", email = "人@example.com", userId = "id")
        assertEquals(session, SessionCodec.decode(SessionCodec.encode(session)))
    }
}

private class MemorySessionStore : SessionStore {
    private var plain: AuthSession? = null
    private var envelope: BiometricEnvelope? = null
    private var biometric = false

    override fun readPlain(): AuthSession? = plain
    override fun writePlain(session: AuthSession?) {
        plain = session
    }
    override fun isBiometricEnabled(): Boolean = biometric
    override fun setBiometricEnabled(enabled: Boolean) {
        biometric = enabled
    }
    override fun readEnvelope(): BiometricEnvelope? = envelope
    override fun writeEnvelope(envelope: BiometricEnvelope?) {
        this.envelope = envelope
    }
}
