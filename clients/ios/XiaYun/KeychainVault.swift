import Foundation
import LocalAuthentication
import Security

struct SessionSecret: Codable, Equatable {
    var bearerToken: String?
    var sessionCookie: String?
    var userId: String
    var email: String

    var credential: Credential {
        Credential(bearerToken: bearerToken, sessionCookie: sessionCookie)
    }
}

enum KeychainError: Error, Equatable {
    case cancelled
    case failed
    case unavailable
    case unexpected(OSStatus)
}

final class KeychainVault {
    private let service = "app.xiayun.ios.session"
    private let account = "current"

    func save(_ secret: SessionSecret, requireBiometry: Bool) throws {
        let data = try JSONEncoder().encode(secret)
        delete()
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data,
        ]
        if requireBiometry {
            var error: Unmanaged<CFError>?
            guard let access = SecAccessControlCreateWithFlags(
                nil,
                kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
                .biometryCurrentSet,
                &error
            ) else {
                throw KeychainError.unavailable
            }
            query[kSecAttrAccessControl as String] = access
        } else {
            query[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        }
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw KeychainError.unexpected(status)
        }
    }

    func load(context: LAContext?) throws -> SessionSecret {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        if let context {
            query[kSecUseAuthenticationContext as String] = context
        }
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecUserCanceled { throw KeychainError.cancelled }
        if status == errSecAuthFailed || status == errSecItemNotFound { throw KeychainError.failed }
        guard status == errSecSuccess, let data = item as? Data else {
            throw KeychainError.unexpected(status)
        }
        do {
            return try JSONDecoder().decode(SessionSecret.self, from: data)
        } catch {
            throw KeychainError.failed
        }
    }

    func delete() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
