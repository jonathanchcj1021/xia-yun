import Foundation

enum APIError: Error, Equatable {
    case invalidBaseURL
    case fileTooLarge
    case missingCredential
    case passkeyUnavailable
    case cancelled
    case validation(String)
    case server(status: Int, code: String?, message: String)
    case transport(String)
    case decoding(String)

    var message: String {
        switch self {
        case .invalidBaseURL:
            return "伺服器位址需要是 http 或 https。"
        case .fileTooLarge:
            return "檔案超過 1 GB 上限。"
        case .missingCredential:
            return "登入沒有帶回權杖或 session cookie。"
        case .passkeyUnavailable:
            return "這台伺服器尚未提供通行密鑰登入。"
        case .cancelled:
            return "已取消。"
        case .server(_, let code, let message):
            if let code, !code.isEmpty {
                return "\(code): \(message)"
            }
            return message
        case .validation(let message),
             .transport(let message),
             .decoding(let message):
            return message
        }
    }

    var isUnauthenticated: Bool {
        if case .server(let status, let code, _) = self {
            return status == 401 || code == "UNAUTHENTICATED"
        }
        return false
    }
}

enum UploadBudget {
    static func reject(byteCount: Int) -> APIError? {
        byteCount > Limits.maxUploadBytes ? .fileTooLarge : nil
    }
}

enum Limits {
    static let maxUploadBytes = 1024 * 1024 * 1024
    static let singleUploadBytes = 32 * 1024 * 1024
    static let uploadPartBytes = 8 * 1024 * 1024
    static let maxNoteTitle = 200
    static let maxNoteBody = 100_000
    static let minPassword = 8
    static let maxPassword = 128
    static let maxEmail = 254
}
