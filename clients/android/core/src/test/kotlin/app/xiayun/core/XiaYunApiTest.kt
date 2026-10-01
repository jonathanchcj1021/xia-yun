package app.xiayun.core

import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class XiaYunApiTest {
    private val server = MockWebServer()

    @Before
    fun setUp() {
        server.start()
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    private fun api() = XiaYunApi(server.url("/").toString())

    private fun userJson(token: String? = "from-json") = buildString {
        append("""{"user":{"id":"u1","email":"a@b.co","createdAt":"2026-01-02T03:04:05.000Z"}""")
        if (token != null) append(""","token":"$token"""")
        append("}")
    }

    @Test
    fun loginSendsNativeClientAndPrefersBearer() = runBlocking {
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .addHeader("Set-Cookie", "session=from-cookie; Path=/; HttpOnly")
                .setBody(userJson("from-json")),
        )
        server.enqueue(MockResponse().setBody("""{"user":{"id":"u1","email":"a@b.co","createdAt":"2026-01-02T03:04:05.000Z"}}"""))

        val session = (api().login("  A@b.co  ", "secret-pass") as ApiResult.Ok).value
        assertEquals("from-json", session.token)
        assertEquals("a@b.co", session.email)

        api().me(session)

        val login = server.takeRequest()
        assertEquals("/api/auth/login", login.path)
        val loginBody = apiJson.parseToJsonElement(login.body.readUtf8()).jsonObject
        assertEquals("A@b.co", loginBody.optString("email"))
        assertEquals("secret-pass", loginBody.optString("password"))
        assertEquals("native", loginBody.optString("client"))

        val me = server.takeRequest()
        assertEquals("/api/auth/me", me.path)
        assertEquals("Bearer from-json", me.getHeader("Authorization"))
        assertNull(me.getHeader("Cookie"))
    }

    @Test
    fun registerUsesSessionCookieAsBearer() = runBlocking {
        server.enqueue(
            MockResponse()
                .setResponseCode(201)
                .addHeader("Set-Cookie", "theme=light")
                .addHeader("Set-Cookie", "session=cookie-token; Path=/; HttpOnly")
                .setBody("""{"user":{"id":"u1","email":"a@b.co","createdAt":"2026-01-02T03:04:05.000Z"}}"""),
        )
        server.enqueue(MockResponse().setResponseCode(204))

        val session = (api().register("a@b.co", "password123") as ApiResult.Ok).value
        assertEquals("cookie-token", session.token)
        api().logout(session)

        val register = server.takeRequest()
        val body = apiJson.parseToJsonElement(register.body.readUtf8()).jsonObject
        assertEquals("a@b.co", body.optString("email"))
        assertNull(body.optString("client"))
        val logout = server.takeRequest()
        assertEquals("POST", logout.method)
        assertEquals("/api/auth/logout", logout.path)
        assertEquals("Bearer cookie-token", logout.getHeader("Authorization"))
    }

    @Test
    fun loginWithoutCredentialIsAnError() = runBlocking {
        server.enqueue(MockResponse().setResponseCode(200).setBody("""{"user":{"id":"u1","email":"a@b.co","createdAt":"t"}}"""))
        val result = api().login("a@b.co", "password123") as ApiResult.Err
        assertEquals(ClientMessages.NO_SESSION, result.error.message)
    }

    @Test
    fun serverErrorMessageIsShown() = runBlocking {
        server.enqueue(
            MockResponse()
                .setResponseCode(401)
                .setBody("""{"error":"電子郵件或密碼不正確","code":"INVALID_CREDENTIALS"}"""),
        )
        val result = api().login("a@b.co", "nope") as ApiResult.Err
        assertEquals(401, result.error.status)
        assertEquals("INVALID_CREDENTIALS", result.error.code)
        assertEquals("電子郵件或密碼不正確", result.error.message)
    }

    @Test
    fun passkeyOptionsAndVerify() = runBlocking {
        val options = """{"challenge":"abc","timeout":60000,"rpId":"10.0.2.2","allowCredentials":[{"id":"cred","type":"public-key"}],"userVerification":"preferred"}"""
        server.enqueue(MockResponse().setBody(options))
        server.enqueue(
            MockResponse()
                .setBody(userJson("pass-token"))
                .addHeader("Set-Cookie", "session=ignored; Path=/"),
        )

        val requestJson = (api().passkeyOptions("a@b.co") as ApiResult.Ok).value
        assertTrue(requestJson.contains("\"challenge\":\"abc\""))
        assertTrue(requestJson.contains("\"rpId\":\"10.0.2.2\""))

        val assertion = """{"id":"cred","type":"public-key","response":{"clientDataJSON":"e30","authenticatorData":"YQ","signature":"Yw"}}"""
        val session = (api().passkeyVerify("a@b.co", assertion) as ApiResult.Ok).value
        assertEquals("pass-token", session.token)

        val optionsCall = server.takeRequest()
        assertEquals("/api/auth/passkey/login/options", optionsCall.path)
        assertEquals("a@b.co", apiJson.parseToJsonElement(optionsCall.body.readUtf8()).jsonObject.optString("email"))

        val verify = server.takeRequest()
        assertEquals("/api/auth/passkey/login/verify", verify.path)
        val posted = apiJson.parseToJsonElement(verify.body.readUtf8()).jsonObject
        assertEquals("native", posted.optString("client"))
        assertEquals("a@b.co", posted.optString("email"))
        val response = posted["response"]!!.jsonObject
        assertEquals("cred", response.optString("id"))
        assertTrue(response["response"] is kotlinx.serialization.json.JsonObject)
    }

    @Test
    fun passkey404And400DoNotThrow() = runBlocking {
        server.enqueue(MockResponse().setResponseCode(404).setBody("<html>missing</html>"))
        server.enqueue(
            MockResponse()
                .setResponseCode(400)
                .setBody("""{"error":"無法使用通行密鑰登入","code":"WEBAUTHN"}"""),
        )
        val missing = api().passkeyOptions("a@b.co") as ApiResult.Err
        assertEquals(ClientMessages.PASSKEY_MISSING, missing.error.message)
        val rejected = api().passkeyVerify("a@b.co", """{"id":"c","response":{}}""") as ApiResult.Err
        assertEquals("無法使用通行密鑰登入", rejected.error.message)
    }

    @Test
    fun passkeyFormatProblemsStayLocal() = runBlocking {
        server.enqueue(MockResponse().setBody("""{"hello":"no challenge"}"""))
        val format = api().passkeyOptions("a@b.co") as ApiResult.Err
        assertEquals(ClientMessages.PASSKEY_FORMAT, format.error.message)

        val bad = api().passkeyVerify("a@b.co", "not-json") as ApiResult.Err
        assertEquals(ClientMessages.PASSKEY_RESPONSE, bad.error.message)
        assertEquals(1, server.requestCount)
    }

    @Test
    fun itemsNotesUploadAndDelete() = runBlocking {
        val session = AuthSession(token = "tok", email = "a@b.co", userId = "u1")
        server.enqueue(
            MockResponse().setBody(
                """{"items":[{"id":"1","ownerId":"u1","type":"text","name":"備忘","size":6,"mimeType":"text/plain; charset=utf-8","createdAt":"2026-01-02T03:04:05.000Z","excerpt":"你好","body":null}]}""",
            ),
        )
        server.enqueue(
            MockResponse()
                .setResponseCode(201)
                .setBody("""{"item":{"id":"2","type":"text","name":"標題","size":3,"createdAt":"2026-01-02T03:04:05.000Z","body":"內文"}}"""),
        )
        server.enqueue(
            MockResponse()
                .setResponseCode(201)
                .setBody("""{"item":{"id":"3","type":"image","name":"圖.png","size":4,"mimeType":"image/png","createdAt":"2026-01-02T03:04:05.000Z"}}"""),
        )
        server.enqueue(MockResponse().setBody("PNG!"))
        server.enqueue(MockResponse().setBody("""{"ok":true}"""))

        val items = (api().listItems(session) as ApiResult.Ok).value
        assertEquals("備忘", items.single().name)
        assertEquals("text", items.single().type)
        assertNull(items.single().group)
        assertEquals(emptyList<String>(), items.single().tags)

        val note = (api().createNote(session, " 標題 ", "內文") as ApiResult.Ok).value
        assertEquals("內文", note.body)

        val uploaded = (
            api().upload(
                session,
                Upload("圖.png", "圖.png", "image/png", byteArrayOf(1, 2, 3, 4)),
            ) as ApiResult.Ok
            ).value
        assertEquals("image", uploaded.type)

        val bytes = (api().content(session, "3", attachment = true) as ApiResult.Ok).value
        assertEquals("PNG!", bytes.toString(Charsets.UTF_8))
        assertTrue(api().deleteItem(session, "3") is ApiResult.Ok)

        assertEquals("/api/items", server.takeRequest().path)
        val noteCall = server.takeRequest()
        val noteBody = apiJson.parseToJsonElement(noteCall.body.readUtf8()).jsonObject
        assertEquals("text", noteBody.optString("type"))
        assertEquals("標題", noteBody.optString("title"))
        assertEquals("內文", noteBody.optString("body"))
        assertEquals("Bearer tok", noteCall.getHeader("Authorization"))

        val upload = server.takeRequest()
        assertEquals("POST", upload.method)
        assertTrue(upload.getHeader("Content-Type")!!.startsWith("multipart/form-data"))
        val length = upload.getHeader("Content-Length")
        assertTrue(length != null && length.toLong() > 0)
        val raw = upload.body.readUtf8()
        assertTrue(raw.contains("name=\"file\""))
        assertTrue(raw.contains("name=\"name\""))
        assertTrue(raw.contains("name=\"type\""))
        assertTrue(raw.contains("image"))
        assertEquals("Bearer tok", upload.getHeader("Authorization"))

        val content = server.takeRequest()
        assertEquals("/api/items/3/content?disposition=attachment", content.path)
        val delete = server.takeRequest()
        assertEquals("DELETE", delete.method)
        assertEquals("/api/items/3", delete.path)
    }

    @Test
    fun patchReplacesTagsAndClearsGroup() = runBlocking {
        val session = AuthSession(token = "tok")
        server.enqueue(
            MockResponse().setBody(
                """{"items":[{"id":"1","type":"file","name":"稅.pdf","size":3,"createdAt":"2026-05-11T03:20:00Z","group":" 家裡的紙 ","tags":["稅務",""]}]}""",
            ),
        )
        server.enqueue(
            MockResponse().setBody(
                """{"item":{"id":"1","type":"file","name":"稅.pdf","size":3,"createdAt":"2026-05-11T03:20:00Z","group":"家裡的紙","tags":["稅務","重要"]}}""",
            ),
        )
        server.enqueue(MockResponse().setBody("""{"ok":true}"""))
        server.enqueue(MockResponse().setResponseCode(405).setBody("""{"error":"Method Not Allowed"}"""))

        val listed = (api().listItems(session) as ApiResult.Ok).value.single()
        assertEquals("家裡的紙", listed.group)
        assertEquals(listOf("稅務"), listed.tags)

        val tagged = api().patchItem(session, "1", tags = listOf("稅務", "重要"), setTags = true) as ApiResult.Ok
        assertEquals(listOf("稅務", "重要"), tagged.value!!.item.tags)
        assertTrue(tagged.value!!.echoedTags)
        assertTrue(tagged.value!!.echoedGroup)

        val cleared = api().patchItem(session, "1", group = "", setGroup = true) as ApiResult.Ok
        assertNull(cleared.value)

        val missing = api().patchItem(session, "1", group = "京都行", setGroup = true) as ApiResult.Err
        assertEquals("伺服器尚未提供分組與標籤更新", missing.error.message)

        server.takeRequest()
        val tagsCall = server.takeRequest()
        assertEquals("PATCH", tagsCall.method)
        assertEquals("/api/items/1", tagsCall.path)
        assertEquals("Bearer tok", tagsCall.getHeader("Authorization"))
        val tagsBody = apiJson.parseToJsonElement(tagsCall.body.readUtf8()).jsonObject
        assertNull(tagsBody["group"])
        assertEquals(listOf("稅務", "重要"), tagsBody["tags"]!!.jsonArray.map { it.jsonPrimitive.content })

        val groupCall = server.takeRequest()
        val groupBody = apiJson.parseToJsonElement(groupCall.body.readUtf8()).jsonObject
        assertTrue(groupBody["group"] is kotlinx.serialization.json.JsonNull)
        assertNull(groupBody["tags"])
    }

    @Test
    fun deleteGroupSendsNameOrNull() = runBlocking {
        val session = AuthSession(token = "tok")
        server.enqueue(MockResponse().setBody("""{"deleted":3}"""))
        server.enqueue(MockResponse().setBody("""{"deleted":2}"""))
        server.enqueue(MockResponse().setResponseCode(405).setBody("""{"error":"Method Not Allowed"}"""))
        server.enqueue(MockResponse().setResponseCode(401).setBody("""{"error":"尚未登入","code":"UNAUTHENTICATED"}"""))

        val named = api().deleteGroup(session, " 工作 ") as ApiResult.Ok
        assertEquals(3, named.value)
        val ungrouped = api().deleteGroup(session, "") as ApiResult.Ok
        assertEquals(2, ungrouped.value)
        val missing = api().deleteGroup(session, "未分組") as ApiResult.Err
        assertEquals("伺服器尚未提供整組刪除", missing.error.message)
        val loggedOut = api().deleteGroup(session, null) as ApiResult.Err
        assertEquals(401, loggedOut.error.status)
        assertEquals("尚未登入", loggedOut.error.message)

        val namedCall = server.takeRequest()
        assertEquals("DELETE", namedCall.method)
        assertEquals("/api/items", namedCall.path)
        assertEquals("Bearer tok", namedCall.getHeader("Authorization"))
        val namedBody = apiJson.parseToJsonElement(namedCall.body.readUtf8()).jsonObject
        assertEquals("工作", namedBody.optString("group"))

        val clearCall = server.takeRequest()
        val clearBody = apiJson.parseToJsonElement(clearCall.body.readUtf8()).jsonObject
        assertTrue(clearBody["group"] is kotlinx.serialization.json.JsonNull)
        assertNull(clearBody["tags"])
    }

    @Test
    fun oversizedUploadAndBlankNoteNeverHitTheNetwork() = runBlocking {
        val session = AuthSession(token = "tok")
        val big = ByteArray(1) // replaced below
        val tooBig = Upload("a.bin", null, "application/octet-stream", ByteArray(0)).copy(
            bytes = ByteArray((Limits.MAX_UPLOAD_BYTES + 1).toInt()),
        )
        val upload = api().upload(session, tooBig) as ApiResult.Err
        assertEquals(ClientMessages.TOO_LARGE, upload.error.message)
        val note = api().createNote(session, "  ", "x") as ApiResult.Err
        assertEquals(ClientMessages.NOTE_TITLE, note.error.message)
        assertEquals(0, server.requestCount)
        assertTrue(big.isNotEmpty() || big.isEmpty())
    }

    @Test
    fun badUrlAndUnreachableHost() = runBlocking {
        val bad = XiaYunApi("ftp://nope").login("a@b.co", "password123") as ApiResult.Err
        assertEquals(ClientMessages.BAD_URL, bad.error.message)
        val down = XiaYunApi("http://127.0.0.1:1").me(AuthSession(token = "tok")) as ApiResult.Err
        assertEquals(ClientMessages.NETWORK, down.error.message)
        assertFalse(down.error.message.isBlank())
    }
}
