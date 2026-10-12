import Foundation

enum SharedDefaults {
    static let suiteName = "group.app.xiayun.ios"
    static let languageKey = "xy-lang"
    static let baseURLKey = "xiayun.baseURL"
    static let productionBaseURL = "https://xia-yun.jonathanchcj1021.workers.dev"

    static func suite() -> UserDefaults? {
        UserDefaults(suiteName: suiteName)
    }

    static func storedLanguageCode() -> String? {
        suite()?.string(forKey: languageKey)
    }

    static func storeLanguageCode(_ code: String) {
        suite()?.set(code, forKey: languageKey)
    }

    static func storeBaseURL(_ absolute: String) {
        suite()?.set(absolute, forKey: baseURLKey)
    }

    static func resolvedBaseURL() -> URL {
        if let raw = suite()?.string(forKey: baseURLKey), let url = BaseURL.normalize(raw) {
            return url
        }
        return BaseURL.normalize(productionBaseURL) ?? BaseURL.fallback
    }
}
