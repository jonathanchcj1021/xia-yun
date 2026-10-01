package app.xiayun.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.ZoneOffset

class SupportTest {
    @Test
    fun defaultBaseUrlDependsOnEmulator() {
        assertEquals("http://10.0.2.2:43123", BaseUrls.defaultFor(true))
        assertEquals("http://127.0.0.1:43123", BaseUrls.defaultFor(false))
    }

    @Test
    fun normalizeBaseUrl() {
        assertEquals("http://10.0.2.2:43123", BaseUrls.normalize("  http://10.0.2.2:43123/ "))
        assertEquals("https://yun.example", BaseUrls.normalize("https://yun.example"))
        assertNull(BaseUrls.normalize("ftp://10.0.2.2:43123"))
        assertNull(BaseUrls.normalize("not a url"))
        assertNull(BaseUrls.normalize("http://"))
        assertNull(BaseUrls.normalize("http://10.0.2.2:43123/extra"))
    }

    @Test
    fun emulatorHints() {
        assertTrue(isEmulator(DeviceHints(fingerprint = "google/sdk_gphone64_x86_64/emu64xa")))
        assertTrue(isEmulator(DeviceHints(hardware = "ranchu", model = "sdk_gphone64_arm64")))
        assertTrue(isEmulator(DeviceHints(manufacturer = "Genymotion")))
        assertFalse(
            isEmulator(
                DeviceHints(
                    fingerprint = "google/husky/husky:14/UQ1A.240205.002/user/release-keys",
                    model = "Pixel 8 Pro",
                    hardware = "husky",
                    product = "husky",
                    manufacturer = "Google",
                    brand = "google",
                    device = "husky",
                ),
            ),
        )
    }

    @Test
    fun hintedTypeMatchesRasterRules() {
        assertEquals("image", hintedItemType("image/jpeg"))
        assertEquals("image", hintedItemType("image/jpg"))
        assertEquals("image", hintedItemType("image/png; charset=binary"))
        assertEquals("file", hintedItemType("image/svg+xml"))
        assertEquals("file", hintedItemType("application/pdf"))
        assertEquals("file", hintedItemType(""))
    }

    @Test
    fun sanitizeAndFormat() {
        assertEquals("筆記.txt", sanitizeFileName("/tmp/筆記.txt"))
        assertEquals("未命名檔案", sanitizeFileName("   "))
        assertEquals("0 B", formatBytes(0))
        assertEquals("512 B", formatBytes(512))
        assertEquals("1.5 KB", formatBytes(1536))
        assertEquals("1.0 MB", formatBytes(1024 * 1024))
        assertEquals(
            "1月2日 03:04",
            formatTimestamp("2026-01-02T03:04:05.000Z", ZoneOffset.UTC),
        )
    }

    @Test
    fun contentUrlAndLabels() {
        assertEquals(
            "http://10.0.2.2:43123/api/items/abc/content",
            contentUrl("http://10.0.2.2:43123/", "abc", false),
        )
        assertEquals(
            "http://10.0.2.2:43123/api/items/abc/content?disposition=attachment",
            contentUrl("http://10.0.2.2:43123", "abc", true),
        )
        assertNull(contentUrl("nope", "abc", false))
        assertEquals("圖片", typeLabel("image"))
        assertEquals("筆記", typeLabel("text"))
        assertEquals("檔案", typeLabel("file"))
    }

    @Test
    fun bearerPrefersJsonTokenThenCookie() {
        assertEquals("from-json", bearerFrom("from-json", "from-cookie"))
        assertEquals("from-cookie", bearerFrom(null, "from-cookie"))
        assertEquals("from-cookie", bearerFrom("  ", "from-cookie"))
        assertNull(bearerFrom(null, null))
    }

    @Test
    fun sessionCookieParser() {
        assertEquals(
            "abc_def-123",
            sessionCookie(listOf("session=abc_def-123; Path=/; HttpOnly; SameSite=Lax")),
        )
        assertEquals(
            "quoted",
            sessionCookie(listOf("other=1", "session=\"quoted\"; Path=/")),
        )
        assertNull(sessionCookie(listOf("session=; Path=/")))
    }

    @Test
    fun passkeyJsonShapes() {
        val direct = """{"challenge":"abc","rpId":"10.0.2.2","allowCredentials":[]}"""
        assertTrue(extractPasskeyRequestJson(direct)!!.contains("\"challenge\":\"abc\""))
        val wrapped = """{"publicKey":{"challenge":"zzz","rpId":"localhost"}}"""
        assertTrue(extractPasskeyRequestJson(wrapped)!!.contains("\"rpId\":\"localhost\""))
        val options = """{"options":{"challenge":"opt"}}"""
        assertTrue(extractPasskeyRequestJson(options)!!.contains("\"challenge\":\"opt\""))
        assertNull(extractPasskeyRequestJson("""{"hello":1}"""))
        assertNull(extractPasskeyRequestJson("not-json"))

        val body = passkeyVerifyBody(
            "a@b.co",
            """{"id":"cred","type":"public-key","response":{"clientDataJSON":"e30"}}""",
        )
        assertTrue(body!!.contains("\"client\":\"native\""))
        assertTrue(body.contains("\"email\":\"a@b.co\""))
        assertTrue(body.contains("\"id\":\"cred\""))
        assertNull(passkeyVerifyBody("a@b.co", """{"id":"cred"}"""))
        assertNull(passkeyVerifyBody("a@b.co", "nope"))
    }
}
