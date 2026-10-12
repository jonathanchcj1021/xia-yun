import Foundation

struct User: Codable, Equatable, Identifiable {
    var id: String
    var email: String
    var createdAt: Date
}

enum ItemType: String, Codable, Equatable {
    case file
    case image
    case text

    var displayName: String {
        switch self {
        case .file: return "檔案"
        case .image: return "圖片"
        case .text: return "筆記"
        }
    }
}

struct CloudItem: Codable, Equatable, Identifiable {
    var id: String
    var ownerId: String
    var type: ItemType
    var name: String
    var size: Int
    var mimeType: String?
    var createdAt: Date
    var excerpt: String?
    var body: String?
    var group: String? = nil

    var exportName: String {
        if type == .text, !name.lowercased().hasSuffix(".txt") {
            return name + ".txt"
        }
        return name
    }
}

enum UploadType: String, Equatable {
    case file
    case image
}

enum RasterMime {
    static let types: Set<String> = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/avif",
        "image/bmp",
    ]

    static func normalized(_ mime: String) -> String {
        let base = mime.split(separator: ";").first
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() } ?? ""
        if base == "image/jpg" || base == "image/pjpeg" { return "image/jpeg" }
        if base == "image/x-png" { return "image/png" }
        return base.isEmpty ? "application/octet-stream" : base
    }

    static func isRaster(_ mime: String) -> Bool {
        types.contains(normalized(mime))
    }
}
