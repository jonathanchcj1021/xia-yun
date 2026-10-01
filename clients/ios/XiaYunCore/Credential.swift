import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

struct Credential: Equatable {
    var bearerToken: String?
    var sessionCookie: String?

    static let none = Credential(bearerToken: nil, sessionCookie: nil)

    var isEmpty: Bool {
        (bearerToken?.isEmpty ?? true) && (sessionCookie?.isEmpty ?? true)
    }

    /// Bearer wins. The server ignores the cookie once Authorization is present.
    func apply(to request: inout URLRequest) {
        if let token = bearerToken?.trimmingCharacters(in: .whitespacesAndNewlines), !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            return
        }
        if let cookie = sessionCookie?.trimmingCharacters(in: .whitespacesAndNewlines), !cookie.isEmpty {
            request.setValue("session=\(cookie)", forHTTPHeaderField: "Cookie")
        }
    }
}

struct AuthSuccess: Equatable {
    var user: User
    var credential: Credential
}
