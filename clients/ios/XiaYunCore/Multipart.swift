import Foundation

struct MultipartBody: Equatable {
    var contentType: String
    var data: Data

    static func fileUpload(
        filename: String,
        mimeType: String,
        fileData: Data,
        name: String?,
        type: UploadType?,
        group: String? = nil
    ) -> MultipartBody {
        let boundary = "xiayun-\(UUID().uuidString.replacingOccurrences(of: "-", with: ""))"
        var body = Data()
        if let name, !name.isEmpty {
            body.append(textField(name: "name", value: name, boundary: boundary))
        }
        if let type {
            body.append(textField(name: "type", value: type.rawValue, boundary: boundary))
        }
        if let group, !group.isEmpty {
            body.append(textField(name: "group", value: group, boundary: boundary))
        }
        body.append(utf8("--\(boundary)\r\n"))
        body.append(utf8(
            "Content-Disposition: form-data; name=\"file\"; filename=\"\(asciiFilename(filename))\"\r\n"
        ))
        body.append(utf8("Content-Type: \(mimeType)\r\n\r\n"))
        body.append(fileData)
        body.append(utf8("\r\n--\(boundary)--\r\n"))
        return MultipartBody(
            contentType: "multipart/form-data; boundary=\(boundary)",
            data: body
        )
    }

    private static func textField(name: String, value: String, boundary: String) -> Data {
        var data = Data()
        data.append(utf8("--\(boundary)\r\n"))
        data.append(utf8("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n"))
        data.append(utf8(value))
        data.append(utf8("\r\n"))
        return data
    }

    /// The API's multipart parser rejects `filename*`. Unicode display names go in the `name` field.
    static func asciiFilename(_ filename: String) -> String {
        let asciiScalars = filename.unicodeScalars.map { scalar -> Character in
            let value = scalar.value
            if value >= 0x20 && value < 0x7F && scalar != "\\" && scalar != "\"" {
                return Character(scalar)
            }
            return "_"
        }
        let ascii = String(asciiScalars).trimmingCharacters(in: .whitespacesAndNewlines)
        return ascii.isEmpty ? "file" : ascii
    }

    private static func utf8(_ string: String) -> Data {
        Data(string.utf8)
    }
}
