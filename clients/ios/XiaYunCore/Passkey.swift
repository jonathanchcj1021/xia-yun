import Foundation

struct PasskeyAllowedCredential: Equatable {
    var id: String
    var type: String
}

struct PasskeyAssertionOptions: Equatable {
    var challenge: String
    var rpId: String
    var timeout: Int?
    var userVerification: String?
    var allowCredentials: [PasskeyAllowedCredential]

    static func decode(from data: Data, fallbackRPID: String?) throws -> PasskeyAssertionOptions {
        let json = try JSONSerialization.jsonObject(with: data)
        guard var object = json as? [String: Any] else {
            throw APIError.decoding("通行密鑰選項格式不正確。")
        }
        if let wrapped = object["publicKey"] as? [String: Any] {
            object = wrapped
        } else if let wrapped = object["options"] as? [String: Any] {
            object = wrapped
        }
        guard let challenge = object["challenge"] as? String, !challenge.isEmpty else {
            throw APIError.decoding("通行密鑰選項缺少 challenge。")
        }
        let rpId = (object["rpId"] as? String)
            ?? ((object["rp"] as? [String: Any])?["id"] as? String)
            ?? fallbackRPID
        guard let rpId, !rpId.isEmpty else {
            throw APIError.decoding("通行密鑰選項缺少 rpId。")
        }
        var credentials: [PasskeyAllowedCredential] = []
        if let raw = object["allowCredentials"] as? [[String: Any]] {
            credentials = raw.compactMap { item in
                guard let id = item["id"] as? String, !id.isEmpty else { return nil }
                let type = (item["type"] as? String) ?? "public-key"
                return PasskeyAllowedCredential(id: id, type: type)
            }
        }
        let timeout = object["timeout"] as? Int
        let userVerification = object["userVerification"] as? String
        return PasskeyAssertionOptions(
            challenge: challenge,
            rpId: rpId,
            timeout: timeout,
            userVerification: userVerification,
            allowCredentials: credentials
        )
    }
}

struct PasskeyAssertionPayload: Equatable, Encodable {
    var id: String
    var rawId: String
    var type: String
    var response: ResponseBody
    var clientExtensionResults: [String: String]

    struct ResponseBody: Equatable, Encodable {
        var clientDataJSON: String
        var authenticatorData: String
        var signature: String
        var userHandle: String?

        func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(clientDataJSON, forKey: .clientDataJSON)
            try container.encode(authenticatorData, forKey: .authenticatorData)
            try container.encode(signature, forKey: .signature)
            try container.encodeIfPresent(userHandle, forKey: .userHandle)
        }

        private enum CodingKeys: String, CodingKey {
            case clientDataJSON
            case authenticatorData
            case signature
            case userHandle
        }
    }

    static func make(
        credentialID: Data,
        clientDataJSON: Data,
        authenticatorData: Data,
        signature: Data,
        userHandle: Data?
    ) -> PasskeyAssertionPayload {
        let id = Base64URL.encode(credentialID)
        let handle = userHandle.flatMap { $0.isEmpty ? nil : Base64URL.encode($0) }
        return PasskeyAssertionPayload(
            id: id,
            rawId: id,
            type: "public-key",
            response: ResponseBody(
                clientDataJSON: Base64URL.encode(clientDataJSON),
                authenticatorData: Base64URL.encode(authenticatorData),
                signature: Base64URL.encode(signature),
                userHandle: handle
            ),
            clientExtensionResults: [:]
        )
    }
}
