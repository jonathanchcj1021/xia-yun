import Foundation

enum ShareDraft {
    static let ungroupedSentinel = "未分組"
    static let maxGroupCharacters = 40

    static func canonicalGroup(_ raw: String?) -> String? {
        guard let raw else { return nil }
        let collapsed = raw.split(whereSeparator: \.isWhitespace).joined(separator: " ")
        if collapsed.isEmpty || collapsed == ungroupedSentinel { return nil }
        return collapsed
    }

    static func note(text: String, linkTitle: String, fallbackTitle: String) -> (title: String, body: String)? {
        let body = text
            .replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if body.isEmpty { return nil }
        let title: String
        if let url = firstHTTPURL(body), body == url {
            title = linkTitle
        } else {
            let line = body
                .split(separator: "\n", omittingEmptySubsequences: false)
                .map { $0.trimmingCharacters(in: .whitespaces) }
                .first { !$0.isEmpty } ?? ""
            let clipped = String(line.prefix(Limits.maxNoteTitle)).trimmingCharacters(in: .whitespaces)
            title = clipped.isEmpty ? fallbackTitle : clipped
        }
        let safe = String(title.prefix(Limits.maxNoteTitle)).trimmingCharacters(in: .whitespaces)
        return (safe.isEmpty ? fallbackTitle : safe, body)
    }

    static func groupNames(from items: [CloudItem]) -> [String] {
        var seen = Set<String>()
        var names: [String] = []
        for item in items {
            guard let name = canonicalGroup(item.group), seen.insert(name).inserted else { continue }
            names.append(name)
        }
        return names.sorted { $0.localizedStandardCompare($1) == .orderedAscending }
    }

    static func firstHTTPURL(_ text: String) -> String? {
        guard let regex = try? NSRegularExpression(pattern: #"https?://[^\s<>"']+"#, options: .caseInsensitive) else {
            return nil
        }
        let range = NSRange(text.startIndex..., in: text)
        guard let match = regex.firstMatch(in: text, options: [], range: range),
              let swiftRange = Range(match.range, in: text) else { return nil }
        var value = String(text[swiftRange])
        let trailing = CharacterSet(charactersIn: ")].,;!?'\"」』")
        while let last = value.unicodeScalars.last, trailing.contains(last) {
            value.removeLast()
        }
        if value.count <= "https://".count { return nil }
        return value
    }
}
