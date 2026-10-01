import XCTest
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif
@testable import XiaYunCore

final class APIClientTests: XCTestCase {
    override func setUp() {
        super.setUp()
_ = URLProtocol.registerClass(StubURLProtocol.self)
    }

    override func tearDown() {
        StubURLProtocol.requestHandler = nil
        URLProtocol.unregisterClass(StubURLProtocol.self)
        super.tearDown()
    }

    func testLoginSendsNativeClientAndPrefersBearerToken() async throws {
        let base = BaseURL.fallback
        StubURLProtocol.requestHandler = { request in
            XCTAssertEqual(request.url?.path, "/api/auth/login")
            XCTAssertNil(request.value(forHTTPHeaderField: "Authorization"))
            XCTAssertNil(request.value(forHTTPHeaderField: "Cookie"))
            let body = try JSONSerialization.jsonObject(with: RequestBody.data(from: request) ?? Data()) as! [String: Any]
            XCTAssertEqual(body["client"] as? String, "native")
            XCTAssertEqual(body["email"] as? String, "a@example.com")
            XCTAssertEqual(body["password"] as? String, "password1")
            return jsonResponse(
                url: request.url!,
                status: 200,
                json: #"{"user":\#(sampleUserJSON),"token":"native-token"}"#,
                headers: [
                    "Content-Type": "application/json",
                    "Set-Cookie": "session=cookie-token; Path=/; Expires=Wed, 01 Oct 2026 00:00:00 GMT; HttpOnly; SameSite=Lax",
                ]
            )
        }
        let client = APIClient(baseURL: base, session: stubSession())
        let result = try await client.login(email: " A@Example.com ", password: "password1")
        XCTAssertEqual(result.user.email, "a@example.com")
        XCTAssertEqual(result.credential.bearerToken, "native-token")
        XCTAssertNil(result.credential.sessionCookie)

        var followUp: URLRequest?
        StubURLProtocol.requestHandler = { request in
            followUp = request
            return jsonResponse(url: request.url!, status: 200, json: #"{"user":\#(sampleUserJSON)}"#)
        }
        client.credential = result.credential
        _ = try await client.currentUser()
        XCTAssertEqual(followUp?.value(forHTTPHeaderField: "Authorization"), "Bearer native-token")
        XCTAssertNil(followUp?.value(forHTTPHeaderField: "Cookie"))
    }

    func testRegisterFallsBackToSessionCookieWhenTokenIsAbsent() async throws {
        StubURLProtocol.requestHandler = { request in
            let body = try JSONSerialization.jsonObject(with: RequestBody.data(from: request) ?? Data()) as! [String: Any]
            XCTAssertNil(body["client"])
            XCTAssertEqual(request.url?.path, "/api/auth/register")
            return jsonResponse(
                url: request.url!,
                status: 201,
                json: #"{"user":\#(sampleUserJSON)}"#,
                headers: [
                    "Content-Type": "application/json",
                    "Set-Cookie": "session=sess-from-cookie; Path=/; HttpOnly; SameSite=Lax",
                ]
            )
        }
        let client = APIClient(baseURL: BaseURL.fallback, session: stubSession())
        let result = try await client.register(email: "a@example.com", password: "password1")
        XCTAssertNil(result.credential.bearerToken)
        XCTAssertEqual(result.credential.sessionCookie, "sess-from-cookie")

        var followUp: URLRequest?
        StubURLProtocol.requestHandler = { request in
            followUp = request
            return jsonResponse(url: request.url!, status: 200, json: #"{"user":\#(sampleUserJSON)}"#)
        }
        client.credential = result.credential
        _ = try await client.currentUser()
        XCTAssertEqual(followUp?.value(forHTTPHeaderField: "Cookie"), "session=sess-from-cookie")
        XCTAssertNil(followUp?.value(forHTTPHeaderField: "Authorization"))
    }

    func testMissingCredentialThrows() async throws {
        StubURLProtocol.requestHandler = { request in
            jsonResponse(url: request.url!, status: 200, json: #"{"user":\#(sampleUserJSON)}"#)
        }
        let client = APIClient(baseURL: BaseURL.fallback, session: stubSession())
        do {
            _ = try await client.login(email: "a@example.com", password: "password1")
            XCTFail("expected missing credential")
        } catch let error as APIError {
            XCTAssertEqual(error, .missingCredential)
        }
    }

    func testServerErrorMessageIsPreserved() async throws {
        StubURLProtocol.requestHandler = { request in
            jsonResponse(
                url: request.url!,
                status: 401,
                json: #"{"error":"電子郵件或密碼不正確","code":"INVALID_CREDENTIALS"}"#
            )
        }
        let client = APIClient(baseURL: BaseURL.fallback, session: stubSession())
        do {
            _ = try await client.login(email: "a@example.com", password: "password1")
            XCTFail("expected error")
        } catch let error as APIError {
            XCTAssertEqual(error.message, "電子郵件或密碼不正確")
            guard case .server(let status, let code, _) = error else {
                return XCTFail("expected server error")
            }
            XCTAssertEqual(status, 401)
            XCTAssertEqual(code, "INVALID_CREDENTIALS")
        }
    }

    func testPasskey404IsAClearError() async throws {
        StubURLProtocol.requestHandler = { request in
            jsonResponse(url: request.url!, status: 404, json: "<html>missing</html>", headers: ["Content-Type": "text/html"])
        }
        let client = APIClient(baseURL: BaseURL.fallback, session: stubSession())
        do {
            _ = try await client.passkeyOptions(email: "a@example.com")
            XCTFail("expected passkey error")
        } catch let error as APIError {
            XCTAssertEqual(error, .passkeyUnavailable)
            XCTAssertEqual(error.message, "這台伺服器尚未提供通行密鑰登入。")
        }
    }

    func testPasskeyOptionsAndVerifyShape() async throws {
        StubURLProtocol.requestHandler = { request in
            XCTAssertEqual(request.url?.path, "/api/auth/passkey/login/options")
            return jsonResponse(
                url: request.url!,
                status: 200,
                json: """
                {"challenge":"Y2hhbGxlbmdl","rpId":"example.com","timeout":60000,"userVerification":"preferred","allowCredentials":[{"type":"public-key","id":"Y3JlZA"}]}
                """
            )
        }
        let client = APIClient(baseURL: BaseURL.fallback, session: stubSession())
        let options = try await client.passkeyOptions(email: "a@example.com")
        XCTAssertEqual(options.rpId, "example.com")
        XCTAssertEqual(options.allowCredentials.first?.id, "Y3JlZA")

        let assertion = PasskeyAssertionPayload.make(
            credentialID: Data("cred".utf8),
            clientDataJSON: Data("{}".utf8),
            authenticatorData: Data([1, 2, 3]),
            signature: Data([4, 5]),
            userHandle: nil
        )
        StubURLProtocol.requestHandler = { request in
            XCTAssertEqual(request.url?.path, "/api/auth/passkey/login/verify")
            XCTAssertEqual(request.value(forHTTPHeaderField: "Origin"), "https://example.com")
            let body = try JSONSerialization.jsonObject(with: RequestBody.data(from: request) ?? Data()) as! [String: Any]
            XCTAssertEqual(body["client"] as? String, "native")
            XCTAssertEqual(body["email"] as? String, "a@example.com")
            let response = body["response"] as! [String: Any]
            XCTAssertEqual(response["id"] as? String, assertion.id)
            XCTAssertEqual(response["type"] as? String, "public-key")
            XCTAssertNotNil(response["response"] as? [String: Any])
            return jsonResponse(
                url: request.url!,
                status: 200,
                json: #"{"user":\#(sampleUserJSON),"token":"passkey-token"}"#
            )
        }
        let success = try await client.verifyPasskey(email: "a@example.com", assertion: assertion, rpId: options.rpId)
        XCTAssertEqual(success.credential.bearerToken, "passkey-token")
    }

    func testPasskeyServerRejectionIsNotTreatedAsMissingRoute() async throws {
        StubURLProtocol.requestHandler = { request in
            jsonResponse(
                url: request.url!,
                status: 400,
                json: #"{"error":"無法使用通行密鑰登入","code":"WEBAUTHN"}"#
            )
        }
        let client = APIClient(baseURL: BaseURL.fallback, session: stubSession())
        do {
            _ = try await client.passkeyOptions(email: "a@example.com")
            XCTFail("expected webauthn error")
        } catch let error as APIError {
            XCTAssertEqual(error.message, "無法使用通行密鑰登入")
            XCTAssertNotEqual(error, .passkeyUnavailable)
        }
    }

    func testCreateNoteAndListDecodeFractionalDates() async throws {
        StubURLProtocol.requestHandler = { request in
            let body = try JSONSerialization.jsonObject(with: RequestBody.data(from: request) ?? Data()) as! [String: Any]
            XCTAssertEqual(body["type"] as? String, "text")
            XCTAssertEqual(body["title"] as? String, "標題")
            XCTAssertEqual(body["body"] as? String, "")
            XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer tok")
            return jsonResponse(
                url: request.url!,
                status: 201,
                json: """
                {"item":{"id":"22222222-2222-4222-8222-222222222222","ownerId":"11111111-1111-4111-8111-111111111111","type":"text","name":"標題","size":0,"mimeType":"text/plain; charset=utf-8","createdAt":"2026-10-01T01:02:03.456Z","excerpt":null,"body":""}}
                """
            )
        }
        let client = APIClient(
            baseURL: BaseURL.fallback,
            credential: Credential(bearerToken: "tok", sessionCookie: "ignored"),
            session: stubSession()
        )
        let item = try await client.createNote(title: " 標題 ", body: "")
        XCTAssertEqual(item.type, .text)
        XCTAssertEqual(item.body, "")
        XCTAssertNotNil(APIJSON.parseISO8601("2026-10-01T01:02:03.456Z"))
        XCTAssertEqual(item.name, "標題")
    }

    func testUploadRejectsOversizedFileWithoutRequest() async throws {
        StubURLProtocol.requestHandler = { _ in
            XCTFail("should not upload")
            return jsonResponse(url: BaseURL.fallback, status: 500, json: "{}")
        }
        let client = APIClient(baseURL: BaseURL.fallback, session: stubSession())
        do {
            _ = try await client.upload(
                data: Data(count: Limits.maxUploadBytes + 1),
                filename: "big.bin",
                mimeType: "application/octet-stream",
                type: .file
            )
            XCTFail("expected file too large")
        } catch let error as APIError {
            XCTAssertEqual(error, .fileTooLarge)
        }
    }

    func testUploadMultipartIncludesNameTypeAndBytes() async throws {
        let payload = Data("hello-匣".utf8)
        StubURLProtocol.requestHandler = { request in
            XCTAssertTrue(request.value(forHTTPHeaderField: "Content-Type")?.hasPrefix("multipart/form-data; boundary=") == true)
            XCTAssertEqual(request.value(forHTTPHeaderField: "Content-Length"), String(RequestBody.data(from: request)?.count ?? -1))
            let body = RequestBody.data(from: request) ?? Data()
            let text = String(decoding: body, as: UTF8.self)
            XCTAssertTrue(text.contains("name=\"name\""))
            XCTAssertTrue(text.contains("照片.png"))
            XCTAssertTrue(text.contains("name=\"type\""))
            XCTAssertTrue(text.contains("image"))
            XCTAssertTrue(body.range(of: payload) != nil)
            return jsonResponse(
                url: request.url!,
                status: 201,
                json: """
                {"item":{"id":"33333333-3333-4333-8333-333333333333","ownerId":"11111111-1111-4111-8111-111111111111","type":"image","name":"照片.png","size":\(payload.count),"mimeType":"image/png","createdAt":"2026-10-01T00:00:00Z","excerpt":null,"body":null}}
                """
            )
        }
        let client = APIClient(
            baseURL: BaseURL.fallback,
            credential: Credential(bearerToken: "tok", sessionCookie: nil),
            session: stubSession()
        )
        let item = try await client.upload(data: payload, filename: "照片.png", mimeType: "image/png", type: .image)
        XCTAssertEqual(item.type, .image)
        XCTAssertEqual(item.exportName, "照片.png")
    }

    func testContentAndDeletePaths() async throws {
        var paths: [String] = []
        StubURLProtocol.requestHandler = { request in
            paths.append(request.url?.absoluteString ?? "")
            if request.httpMethod == "DELETE" {
                return jsonResponse(url: request.url!, status: 200, json: #"{"ok":true}"#)
            }
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: [
                "Content-Type": "image/png",
            ])!, Data([0x89, 0x50]))
        }
        let client = APIClient(
            baseURL: BaseURL.fallback,
            credential: Credential(bearerToken: "tok", sessionCookie: nil),
            session: stubSession()
        )
        let id = "33333333-3333-4333-8333-333333333333"
        let bytes = try await client.content(id: id, attachment: true)
        XCTAssertEqual(bytes, Data([0x89, 0x50]))
        try await client.deleteItem(id: id)
        XCTAssertTrue(paths.contains { $0.contains("/api/items/\(id)/content?disposition=attachment") })
        XCTAssertTrue(paths.contains { $0.hasSuffix("/api/items/\(id)") })
    }

    func testUnauthenticatedFlag() {
        let error = APIError.server(status: 401, code: "UNAUTHENTICATED", message: "尚未登入")
        XCTAssertTrue(error.isUnauthenticated)
        XCTAssertEqual(error.message, "尚未登入")
    }
}
