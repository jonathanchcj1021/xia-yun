import Foundation

enum BiometricKind: String, Equatable, Identifiable {
    case faceID
    case touchID
    case opticID
    case none

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .faceID: return "Face ID"
        case .touchID: return "Touch ID"
        case .opticID: return "Optic ID"
        case .none: return "生物辨識"
        }
    }

    var systemImage: String {
        switch self {
        case .faceID: return "faceid"
        case .touchID: return "touchid"
        case .opticID: return "opticid"
        case .none: return "person.badge.key"
        }
    }
}

enum BiometricPolicy {
    static func shouldOfferUnlock(kind: BiometricKind, alreadyEnabled: Bool, userDeclined: Bool) -> Bool {
        kind != .none && !alreadyEnabled && !userDeclined
    }
}

enum AccountRules {
    static func normalizeEmail(_ raw: String) -> String {
        raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    static func emailError(_ raw: String) -> String? {
        let email = normalizeEmail(raw)
        if email.isEmpty { return "請輸入電子郵件" }
        if email.utf16.count > Limits.maxEmail || !isValidEmail(email) {
            return "請輸入有效的電子郵件"
        }
        return nil
    }

    static func passwordError(_ password: String) -> String? {
        if password.utf16.count < Limits.minPassword { return "密碼至少需要 8 個字元" }
        if password.utf16.count > Limits.maxPassword { return "密碼最長 128 個字元" }
        return nil
    }

    private static func isValidEmail(_ email: String) -> Bool {
        let pattern = #"^[^\s@]+@[^\s@]+\.[^\s@]+$"#
        return email.range(of: pattern, options: .regularExpression) != nil
    }
}

enum NoteRules {
    static func validated(title: String, body: String) throws -> (title: String, body: String) {
        let title = title.trimmingCharacters(in: .whitespacesAndNewlines)
        if title.isEmpty { throw APIError.validation("請填寫筆記標題") }
        if title.utf16.count > Limits.maxNoteTitle {
            throw APIError.validation("筆記標題最長 200 個字元")
        }
        if body.utf16.count > Limits.maxNoteBody {
            throw APIError.validation("筆記內文最長 10 萬個字元")
        }
        return (title, body)
    }
}

enum ByteFormat {
    static func string(for bytes: Int) -> String {
        let value = Double(max(0, bytes))
        if value < 1024 { return "\(Int(value)) B" }
        if value < 1024 * 1024 { return trim(value / 1024) + " KB" }
        if value < 1024 * 1024 * 1024 { return trim(value / (1024 * 1024)) + " MB" }
        return trim(value / (1024 * 1024 * 1024)) + " GB"
    }

    private static func trim(_ value: Double) -> String {
        let tenths = (value * 10).rounded() / 10
        if abs(tenths - tenths.rounded()) < 0.001 {
            return String(Int(tenths.rounded()))
        }
        let negative = tenths < 0
        let absolute = abs(tenths)
        let whole = Int(absolute)
        let fraction = Int((absolute * 10).rounded()) % 10
        return "\(negative ? "-" : "")\(whole).\(fraction)"
    }
}
