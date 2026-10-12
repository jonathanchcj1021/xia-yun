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
    static let accessGroupSuffix = "group.app.xiayun.ios"

    static func resolvedAccessGroup() -> String {
        let raw = Bundle.main.object(forInfoDictionaryKey: "AppIdentifierPrefix") as? String ?? ""
        let prefix = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if prefix.isEmpty || prefix.contains("$") { return accessGroupSuffix }
        if prefix.hasSuffix(".") { return prefix + accessGroupSuffix }
        return prefix + "." + accessGroupSuffix
    }

    func save(_ secret: SessionSecret, requireBiometry: Bool) throws {
        let data = try JSONEncoder().encode(secret)
        let shared = Self.resolvedAccessGroup()
        if add(data, accessGroup: shared, requireBiometry: requireBiometry) {
            delete(accessGroup: nil)
            return
        }
        if add(data, accessGroup: nil, requireBiometry: requireBiometry) {
            return
        }
        throw KeychainError.failed
    }

    func load(context: LAContext?) throws -> SessionSecret {
        if let secret = try read(
            accessGroup: Self.resolvedAccessGroup(),
            context: context,
            allowPrompt: context != nil,
            missingIsNil: true
        ) {
            return secret
        }
        if let secret = try read(accessGroup: nil, context: context, allowPrompt: context != nil, missingIsNil: false) {
            return secret
        }
        throw KeychainError.failed
    }

    /// The share extension can only see the shared access group. Biometry still prompts.
    func loadForShare() throws -> SessionSecret {
        let group = Self.resolvedAccessGroup()
        if let secret = try read(accessGroup: group, context: nil, allowPrompt: false, missingIsNil: true) {
            return secret
        }
        let context = LAContext()
        context.localizedReason = "用已登入的匣雲接收分享"
        if let secret = try read(accessGroup: group, context: context, allowPrompt: true, missingIsNil: true) {
            return secret
        }
        throw KeychainError.failed
    }

    func delete() {
        delete(accessGroup: Self.resolvedAccessGroup())
        delete(accessGroup: nil)
    }

    private func add(_ data: Data, accessGroup: String?, requireBiometry: Bool) -> Bool {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data,
        ]
        if let accessGroup {
            query[kSecAttrAccessGroup as String] = accessGroup
        }
        if requireBiometry {
            var error: Unmanaged<CFError>?
            guard let access = SecAccessControlCreateWithFlags(
                nil,
                kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
                .biometryCurrentSet,
                &error
            ) else { return false }
            query[kSecAttrAccessControl as String] = access
        } else {
            query[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        }
        var status = SecItemAdd(query as CFDictionary, nil)
        if status == errSecDuplicateItem {
            delete(accessGroup: accessGroup)
            status = SecItemAdd(query as CFDictionary, nil)
        }
        return status == errSecSuccess
    }

    private func read(
        accessGroup: String?,
        context: LAContext?,
        allowPrompt: Bool,
        missingIsNil: Bool
    ) throws -> SessionSecret? {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        if let accessGroup {
            query[kSecAttrAccessGroup as String] = accessGroup
        }
        if !allowPrompt {
            query[kSecUseAuthenticationUI as String] = kSecUseAuthenticationUIFail
        }
        if let context {
            query[kSecUseAuthenticationContext as String] = context
        }
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        if missingIsNil && (status == errSecMissingEntitlement || status == errSecParam) { return nil }
        if !allowPrompt && status == errSecInteractionNotAllowed { return nil }
        if status == errSecUserCanceled { throw KeychainError.cancelled }
        if status == errSecAuthFailed || status == errSecInteractionNotAllowed {
            throw KeychainError.failed
        }
        guard status == errSecSuccess, let data = item as? Data else {
            throw KeychainError.unexpected(status)
        }
        do {
            return try JSONDecoder().decode(SessionSecret.self, from: data)
        } catch {
            throw KeychainError.failed
        }
    }

    private func delete(accessGroup: String?) {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        if let accessGroup {
            query[kSecAttrAccessGroup as String] = accessGroup
        }
        SecItemDelete(query as CFDictionary)
    }
}
