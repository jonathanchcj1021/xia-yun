import XCTest
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif
@testable import XiaYunCore

/// Hits a running 匣雲 server when XIAYUN_BASE_URL is set. Skips otherwise.
final class LiveAPITests: XCTestCase {
    func testNativeBearerSessionAndPasskeyRoute() async throws {
        guard let raw = ProcessInfo.processInfo.environment["XIAYUN_BASE_URL"],
              let base = BaseURL.normalize(raw) else {
            throw XCTSkip("XIAYUN_BASE_URL is not set")
        }
        let email = "ios-\(UUID().uuidString.lowercased())@example.com"
        let password = "password1"
        let client = APIClient(baseURL: base)

        let registered = try await client.register(email: email, password: password)
        XCTAssertFalse(registered.credential.isEmpty)
        client.credential = registered.credential
        let me = try await client.currentUser()
        XCTAssertEqual(me.email, email)

        let loggedIn = try await client.login(email: email, password: password)
        XCTAssertNotNil(loggedIn.credential.bearerToken)
        let bearerOnly = APIClient(
            baseURL: base,
            credential: Credential(bearerToken: loggedIn.credential.bearerToken, sessionCookie: nil)
        )
        let meAgain = try await bearerOnly.currentUser()
        XCTAssertEqual(meAgain.id, me.id)

        let note = try await bearerOnly.createNote(title: "iOS 筆記", body: "只有這個帳號看得到")
        XCTAssertEqual(note.type, .text)
        let listed = try await bearerOnly.listItems()
        XCTAssertTrue(listed.contains { $0.id == note.id })
        let detailed = try await bearerOnly.item(id: note.id)
        XCTAssertEqual(detailed.body, "只有這個帳號看得到")
        let downloaded = try await bearerOnly.content(id: note.id, attachment: true)
        XCTAssertEqual(String(data: downloaded, encoding: .utf8), "只有這個帳號看得到")

        let fileBytes = Data("xiayun-file".utf8)
        let file = try await bearerOnly.upload(
            data: fileBytes,
            filename: "備忘.txt",
            mimeType: "text/plain",
            type: .file
        )
        XCTAssertEqual(file.type, .file)
        let fetched = try await bearerOnly.content(id: file.id, attachment: true)
        XCTAssertEqual(fetched, fileBytes)

        try await bearerOnly.deleteItem(id: note.id)
        try await bearerOnly.deleteItem(id: file.id)
        let afterDelete = try await bearerOnly.listItems()
        XCTAssertFalse(afterDelete.contains { $0.id == note.id || $0.id == file.id })

        do {
            _ = try await bearerOnly.passkeyOptions(email: email)
            XCTFail("a new account has no passkey")
        } catch let error as APIError {
            XCTAssertNotEqual(error, .passkeyUnavailable)
            XCTAssertFalse(error.message.isEmpty)
        }

        let fake = PasskeyAssertionPayload.make(
            credentialID: Data("not-a-credential".utf8),
            clientDataJSON: Data("{}".utf8),
            authenticatorData: Data([0]),
            signature: Data([0]),
            userHandle: nil
        )
        do {
            _ = try await bearerOnly.verifyPasskey(email: email, assertion: fake, rpId: base.host ?? "localhost")
            XCTFail("fake assertion must fail")
        } catch let error as APIError {
            XCTAssertNotEqual(error, .passkeyUnavailable)
            XCTAssertFalse(error.message.isEmpty)
        }

        await bearerOnly.logout()
        do {
            _ = try await bearerOnly.currentUser()
            XCTFail("logged out token should be rejected")
        } catch let error as APIError {
            XCTAssertTrue(error.isUnauthenticated)
        }
    }
}
