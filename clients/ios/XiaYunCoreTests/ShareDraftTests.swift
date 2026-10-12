import XCTest
@testable import XiaYunCore

final class ShareDraftTests: XCTestCase {
    func testNoteTitleUsesLinkOnlyForBareURL() {
        let link = ShareDraft.note(text: "https://example.com/a", linkTitle: "連結", fallbackTitle: "分享")
        XCTAssertEqual(link?.title, "連結")
        XCTAssertEqual(link?.body, "https://example.com/a")

        let mixed = ShareDraft.note(text: "看這個\nhttps://example.com/a", linkTitle: "連結", fallbackTitle: "分享")
        XCTAssertEqual(mixed?.title, "看這個")
        XCTAssertEqual(mixed?.body, "看這個\nhttps://example.com/a")
        XCTAssertNil(ShareDraft.note(text: "   ", linkTitle: "連結", fallbackTitle: "分享"))
    }

    func testCanonicalGroupDropsUngroupedSentinel() {
        XCTAssertNil(ShareDraft.canonicalGroup(" 未分組 "))
        XCTAssertNil(ShareDraft.canonicalGroup("   "))
        XCTAssertEqual(ShareDraft.canonicalGroup(" 旅行 "), "旅行")
    }

    func testMultipartWritesNamedGroupOnly() {
        let plain = MultipartBody.fileUpload(
            filename: "a.png",
            mimeType: "image/png",
            fileData: Data([1, 2, 3]),
            name: "a.png",
            type: .image,
            group: nil
        )
        XCTAssertFalse(String(decoding: plain.data, as: UTF8.self).contains("name=\"group\""))

        let named = MultipartBody.fileUpload(
            filename: "a.png",
            mimeType: "image/png",
            fileData: Data([1, 2, 3]),
            name: "a.png",
            type: .image,
            group: "旅行"
        )
        let text = String(decoding: named.data, as: UTF8.self)
        XCTAssertTrue(text.contains("name=\"group\""))
        XCTAssertTrue(text.contains("旅行"))
        XCTAssertTrue(text.contains("name=\"file\""))
    }
}
