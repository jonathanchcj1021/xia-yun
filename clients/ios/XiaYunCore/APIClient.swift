import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

final class APIClient {
    var baseURL: URL
    private var storedCredential: Credential
    private let credentialLock = NSLock()
    private let session: URLSession

    var credential: Credential {
        get {
            credentialLock.lock()
            defer { credentialLock.unlock() }
            return storedCredential
        }
        set {
            credentialLock.lock()
            storedCredential = newValue
            credentialLock.unlock()
        }
    }

    init(baseURL: URL, credential: Credential = .none, session: URLSession? = nil) {
        self.baseURL = baseURL
        self.storedCredential = credential
        if let session {
            self.session = session
        } else {
            let configuration = URLSessionConfiguration.ephemeral
            configuration.httpCookieAcceptPolicy = .never
            configuration.httpShouldSetCookies = false
            configuration.urlCache = nil
            self.session = URLSession(configuration: configuration)
        }
    }

    func register(email: String, password: String) async throws -> AuthSuccess {
        try validateAccount(email: email, password: password)
        let payload = RegisterPayload(
            email: AccountRules.normalizeEmail(email),
            password: password
        )
        return try await submitAuth(
            path: "/api/auth/register",
            body: try APIJSON.makeEncoder().encode(payload),
            authorized: false
        )
    }

    func login(email: String, password: String) async throws -> AuthSuccess {
        try validateAccount(email: email, password: password)
        let payload = LoginPayload(
            email: AccountRules.normalizeEmail(email),
            password: password,
            client: "native"
        )
        return try await submitAuth(
            path: "/api/auth/login",
            body: try APIJSON.makeEncoder().encode(payload),
            authorized: false
        )
    }

    func currentUser() async throws -> User {
        let request = try makeRequest(path: "/api/auth/me", method: "GET", authorized: true)
        let (response, data) = try await perform(request)
        try ensureSuccess(response, data: data)
        return try decode(UserEnvelope.self, from: data).user
    }

    func listItems() async throws -> [CloudItem] {
        let request = try makeRequest(path: "/api/items", method: "GET", authorized: true)
        let (response, data) = try await perform(request)
        try ensureSuccess(response, data: data)
        return try decode(ItemListEnvelope.self, from: data).items
    }

    func createNote(title: String, body: String, group: String? = nil) async throws -> CloudItem {
        let note = try NoteRules.validated(title: title, body: body)
        let payload = NotePayload(
            type: "text",
            title: note.title,
            body: note.body,
            group: ShareDraft.canonicalGroup(group)
        )
        let request = try makeRequest(
            path: "/api/items",
            method: "POST",
            body: try APIJSON.makeEncoder().encode(payload),
            contentType: "application/json",
            authorized: true
        )
        let (response, data) = try await perform(request)
        try ensureSuccess(response, data: data)
        return try decode(ItemEnvelope.self, from: data).item
    }

    func upload(
        data: Data,
        filename: String,
        mimeType: String,
        type: UploadType?,
        group: String? = nil
    ) async throws -> CloudItem {
        if data.count > Limits.maxUploadBytes {
            throw APIError.fileTooLarge
        }
        let mime = RasterMime.normalized(mimeType)
        let resolvedType: UploadType? = {
            if let type { return type }
            return RasterMime.isRaster(mime) ? .image : .file
        }()
        let form = MultipartBody.fileUpload(
            filename: filename,
            mimeType: mime,
            fileData: data,
            name: filename,
            type: resolvedType,
            group: ShareDraft.canonicalGroup(group)
        )
        var request = try makeRequest(
            path: "/api/items",
            method: "POST",
            body: form.data,
            contentType: form.contentType,
            authorized: true
        )
        request.timeoutInterval = 180
        let (response, responseData) = try await perform(request)
        try ensureSuccess(response, data: responseData)
        return try decode(ItemEnvelope.self, from: responseData).item
    }

    func item(id: String) async throws -> CloudItem {
        let request = try makeRequest(path: itemPath(id), method: "GET", authorized: true)
        let (response, data) = try await perform(request)
        try ensureSuccess(response, data: data)
        return try decode(ItemEnvelope.self, from: data).item
    }

    func content(id: String, attachment: Bool) async throws -> Data {
        var path = itemPath(id, suffix: "/content")
        if attachment { path += "?disposition=attachment" }
        let request = try makeRequest(
            path: path,
            method: "GET",
            accept: "*/*",
            authorized: true
        )
        let (response, data) = try await perform(request)
        try ensureSuccess(response, data: data)
        return data
    }

    func deleteItem(id: String) async throws {
        let request = try makeRequest(path: itemPath(id), method: "DELETE", authorized: true)
        let (response, data) = try await perform(request)
        try ensureSuccess(response, data: data)
    }

    func logout() async {
        do {
            let request = try makeRequest(path: "/api/auth/logout", method: "POST", authorized: true)
            _ = try await perform(request)
        } catch {
            return
        }
    }

    func passkeyOptions(email: String) async throws -> PasskeyAssertionOptions {
        if let error = AccountRules.emailError(email) {
            throw APIError.validation(error)
        }
        let payload = EmailPayload(email: AccountRules.normalizeEmail(email))
        let request = try makeRequest(
            path: "/api/auth/passkey/login/options",
            method: "POST",
            body: try APIJSON.makeEncoder().encode(payload),
            contentType: "application/json",
            authorized: false
        )
        let (response, data) = try await perform(request)
        try ensureSuccess(response, data: data, passkeyRoute: true)
        return try PasskeyAssertionOptions.decode(from: data, fallbackRPID: baseURL.host)
    }

    func verifyPasskey(
        email: String,
        assertion: PasskeyAssertionPayload,
        rpId: String
    ) async throws -> AuthSuccess {
        let payload = PasskeyVerifyPayload(
            email: AccountRules.normalizeEmail(email),
            response: assertion,
            client: "native"
        )
        var request = try makeRequest(
            path: "/api/auth/passkey/login/verify",
            method: "POST",
            body: try APIJSON.makeEncoder().encode(payload),
            contentType: "application/json",
            authorized: false
        )
        // The API trusts Origin for WebAuthn expectedOrigin. Platform passkeys put
        // https://<rpId> in clientDataJSON, which is not the HTTP API origin.
        if !rpId.isEmpty {
            request.setValue("https://\(rpId)", forHTTPHeaderField: "Origin")
        }
        let (response, data) = try await perform(request)
        try ensureSuccess(response, data: data, passkeyRoute: true)
        return try authSuccess(from: data, response: response)
    }

    private func validateAccount(email: String, password: String) throws {
        if let error = AccountRules.emailError(email) { throw APIError.validation(error) }
        if let error = AccountRules.passwordError(password) { throw APIError.validation(error) }
    }

    private func submitAuth(path: String, body: Data, authorized: Bool) async throws -> AuthSuccess {
        let request = try makeRequest(
            path: path,
            method: "POST",
            body: body,
            contentType: "application/json",
            authorized: authorized
        )
        let (response, data) = try await perform(request)
        try ensureSuccess(response, data: data)
        return try authSuccess(from: data, response: response)
    }

    private func authSuccess(from data: Data, response: HTTPURLResponse) throws -> AuthSuccess {
        let envelope = try decode(AuthEnvelope.self, from: data)
        let token = envelope.token?.trimmingCharacters(in: .whitespacesAndNewlines)
        let cookie = SessionCookie.value(from: response)
        let credential: Credential
        if let token, !token.isEmpty {
            credential = Credential(bearerToken: token, sessionCookie: nil)
        } else if let cookie, !cookie.isEmpty {
            credential = Credential(bearerToken: nil, sessionCookie: cookie)
        } else {
            throw APIError.missingCredential
        }
        return AuthSuccess(user: envelope.user, credential: credential)
    }

    private func itemPath(_ id: String, suffix: String = "") -> String {
        let encoded = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
        return "/api/items/\(encoded)\(suffix)"
    }

    private func makeRequest(
        path: String,
        method: String,
        body: Data? = nil,
        contentType: String? = nil,
        accept: String = "application/json",
        authorized: Bool
    ) throws -> URLRequest {
        guard let url = BaseURL.joining(baseURL, path: path) else {
            throw APIError.invalidBaseURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.timeoutInterval = 60
        request.setValue(accept, forHTTPHeaderField: "Accept")
        if let contentType {
            request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        }
        if let body {
            request.httpBody = body
            request.setValue(String(body.count), forHTTPHeaderField: "Content-Length")
        }
        if authorized {
            credential.apply(to: &request)
        }
        return request
    }

    private func perform(_ request: URLRequest) async throws -> (HTTPURLResponse, Data) {
        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                throw APIError.transport("伺服器回應不正確。")
            }
            return (http, data)
        } catch let error as APIError {
            throw error
        } catch is CancellationError {
            throw APIError.cancelled
        } catch let error as URLError {
            if error.code == .cancelled { throw APIError.cancelled }
            throw APIError.transport("無法連上匣雲。請確認伺服器位址，以及這台裝置連得到它。")
        } catch {
            throw APIError.transport("無法連上匣雲。請確認伺服器位址。")
        }
    }

    private func ensureSuccess(
        _ response: HTTPURLResponse,
        data: Data,
        passkeyRoute: Bool = false
    ) throws {
        if (200...299).contains(response.statusCode) { return }
        if passkeyRoute && response.statusCode == 404 {
            throw APIError.passkeyUnavailable
        }
        let envelope = try? APIJSON.makeDecoder().decode(ErrorEnvelope.self, from: data)
        let message = envelope?.error ?? Self.fallbackMessage(status: response.statusCode)
        throw APIError.server(status: response.statusCode, code: envelope?.code, message: message)
    }

    private static func fallbackMessage(status: Int) -> String {
        switch status {
        case 401: return "尚未登入，或登入已失效。"
        case 413: return "檔案超過 32 MB 上限。"
        case 415: return "這個上傳格式不被接受。"
        default: return "伺服器回應錯誤（\(status)）。"
        }
    }

    private func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        do {
            return try APIJSON.makeDecoder().decode(T.self, from: data)
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.decoding("伺服器回應格式不正確。")
        }
    }
}

private struct RegisterPayload: Encodable {
    var email: String
    var password: String
}

private struct LoginPayload: Encodable {
    var email: String
    var password: String
    var client: String
}

private struct EmailPayload: Encodable {
    var email: String
}

private struct NotePayload: Encodable {
    var type: String
    var title: String
    var body: String
    var group: String?

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(type, forKey: .type)
        try container.encode(title, forKey: .title)
        try container.encode(body, forKey: .body)
        try container.encodeIfPresent(group, forKey: .group)
    }

    private enum CodingKeys: String, CodingKey {
        case type
        case title
        case body
        case group
    }
}

private struct PasskeyVerifyPayload: Encodable {
    var email: String
    var response: PasskeyAssertionPayload
    var client: String
}

private struct AuthEnvelope: Decodable {
    var user: User
    var token: String?
}

private struct UserEnvelope: Decodable {
    var user: User
}

private struct ItemEnvelope: Decodable {
    var item: CloudItem
}

private struct ItemListEnvelope: Decodable {
    var items: [CloudItem]
}

private struct ErrorEnvelope: Decodable {
    var error: String?
    var code: String?
}
