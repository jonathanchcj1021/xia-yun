import XCTest
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif
@testable import XiaYunCore

final class SupportTests: XCTestCase {
    func testCredentialPrefersBearerOverCookie() {
        var request = URLRequest(url: BaseURL.fallback)
        Credential(bearerToken: "tok", sessionCookie: "cookie").apply(to: &request)
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer tok")
        XCTAssertNil(request.value(forHTTPHeaderField: "Cookie"))

        var cookieOnly = URLRequest(url: BaseURL.fallback)
        Credential(bearerToken: "  ", sessionCookie: "cookie").apply(to: &cookieOnly)
        XCTAssertEqual(cookieOnly.value(forHTTPHeaderField: "Cookie"), "session=cookie")
        XCTAssertNil(cookieOnly.value(forHTTPHeaderField: "Authorization"))
    }

    func testSessionCookieIgnoresExpiresComma() {
        let header = "session=abc_def-123; Path=/; Expires=Wed, 01 Oct 2026 00:00:00 GMT; Max-Age=2592000; HttpOnly; SameSite=Lax"
        XCTAssertEqual(SessionCookie.parse(header), "abc_def-123")
    }

    func testBaseURLNormalization() {
        XCTAssertEqual(BaseURL.normalize("http://127.0.0.1:43123/")?.absoluteString, "http://127.0.0.1:43123")
        XCTAssertEqual(BaseURL.normalize(" 127.0.0.1:43123 ")?.absoluteString, "http://127.0.0.1:43123")
        XCTAssertEqual(BaseURL.normalize("https://cloud.example")?.scheme, "https")
        XCTAssertNil(BaseURL.normalize("ftp://example.com"))
        XCTAssertNil(BaseURL.normalize(""))
        XCTAssertEqual(
            BaseURL.joining(BaseURL.fallback, path: "/api/items")?.absoluteString,
            "http://127.0.0.1:43123/api/items"
        )
    }

    func testBiometricOffer() {
        XCTAssertTrue(BiometricPolicy.shouldOfferUnlock(kind: .faceID, alreadyEnabled: false, userDeclined: false))
        XCTAssertFalse(BiometricPolicy.shouldOfferUnlock(kind: .faceID, alreadyEnabled: true, userDeclined: false))
        XCTAssertFalse(BiometricPolicy.shouldOfferUnlock(kind: .touchID, alreadyEnabled: false, userDeclined: true))
        XCTAssertFalse(BiometricPolicy.shouldOfferUnlock(kind: .none, alreadyEnabled: false, userDeclined: false))
        XCTAssertEqual(BiometricKind.faceID.displayName, "Face ID")
    }

    func testAccountAndNoteRules() {
        XCTAssertEqual(AccountRules.normalizeEmail(" A@Example.com "), "a@example.com")
        XCTAssertEqual(AccountRules.emailError("nope"), "請輸入有效的電子郵件")
        XCTAssertNil(AccountRules.emailError("a@example.com"))
        XCTAssertEqual(AccountRules.passwordError("short"), "密碼至少需要 8 個字元")
        XCTAssertNil(AccountRules.passwordError("password1"))
        XCTAssertThrowsError(try NoteRules.validated(title: "  ", body: ""))
        let note = try? NoteRules.validated(title: " 標題 ", body: "")
        XCTAssertEqual(note?.title, "標題")
        XCTAssertEqual(note?.body, "")
    }

    func testByteFormatAndRaster() {
        XCTAssertEqual(ByteFormat.string(for: 500), "500 B")
        XCTAssertEqual(ByteFormat.string(for: 1536), "1.5 KB")
        XCTAssertEqual(ByteFormat.string(for: Limits.maxUploadBytes), "32 MB")
        XCTAssertTrue(RasterMime.isRaster("image/jpg"))
        XCTAssertEqual(RasterMime.normalized("image/x-png; charset=binary"), "image/png")
        XCTAssertFalse(RasterMime.isRaster("image/svg+xml"))
        XCTAssertEqual(ItemType.text.displayName, "筆記")
    }

    func testBase64URLRoundTripAndWrappedPasskeyOptions() throws {
        let data = Data([0, 255, 16, 32, 64])
        let encoded = Base64URL.encode(data)
        XCTAssertFalse(encoded.contains("="))
        XCTAssertFalse(encoded.contains("+"))
        XCTAssertEqual(Base64URL.decode(encoded), data)

        let wrapped = """
        {"publicKey":{"challenge":"Y2hhbGxlbmdl","rp":{"id":"example.com","name":"匣雲"},"allowCredentials":[]}}
        """.data(using: .utf8)!
        let options = try PasskeyAssertionOptions.decode(from: wrapped, fallbackRPID: nil)
        XCTAssertEqual(options.rpId, "example.com")
        XCTAssertEqual(options.challenge, "Y2hhbGxlbmdl")
        XCTAssertEqual(String(data: Base64URL.decode(options.challenge)!, encoding: .utf8), "challenge")
    }

    func testPasskeyPayloadOmitsEmptyUserHandle() throws {
        let payload = PasskeyAssertionPayload.make(
            credentialID: Data("id".utf8),
            clientDataJSON: Data("client".utf8),
            authenticatorData: Data("auth".utf8),
            signature: Data("sig".utf8),
            userHandle: Data()
        )
        let object = try JSONSerialization.jsonObject(with: JSONEncoder().encode(payload)) as! [String: Any]
        let response = object["response"] as! [String: Any]
        XCTAssertNil(response["userHandle"])
        XCTAssertEqual(object["type"] as? String, "public-key")
        XCTAssertEqual(object["clientExtensionResults"] as? [String: String], [:])
    }

    func testTextExportName() {
        let note = CloudItem(
            id: "1",
            ownerId: "2",
            type: .text,
            name: "備忘",
            size: 1,
            mimeType: "text/plain; charset=utf-8",
            createdAt: Date(),
            excerpt: nil,
            body: "hi"
        )
        XCTAssertEqual(note.exportName, "備忘.txt")
    }
}
