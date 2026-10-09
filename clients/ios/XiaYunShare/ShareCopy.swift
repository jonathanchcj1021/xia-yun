import Foundation

enum ShareLang: String, CaseIterable, Identifiable {
    case zhHant = "zh-Hant"
    case zhHans = "zh-Hans"
    case en = "en"

    var id: String { rawValue }

    var chip: String {
        switch self {
        case .zhHant: return "繁體"
        case .zhHans: return "简体"
        case .en: return "EN"
        }
    }

    static func resolved() -> ShareLang {
        if let stored = SharedDefaults.storedLanguageCode(), let lang = ShareLang(rawValue: stored) {
            return lang
        }
        let preferred = Locale.preferredLanguages.first ?? "zh-Hant"
        if preferred.hasPrefix("zh-Hans") || preferred.contains("Hans") || preferred.hasPrefix("zh-CN") {
            return .zhHans
        }
        if preferred.hasPrefix("en") { return .en }
        return .zhHant
    }
}

struct ShareCopy {
    var title: String
    var loginTitle: String
    var loginBody: String
    var openApp: String
    var groupTitle: String
    var textLead: String
    var imageLead: String
    var linkTitle: String
    var fallbackTitle: String
    var saved: String
    var unsupported: String
    var saving: String
    var newGroup: String
    var groupsFailed: String
    var ungrouped: String
    var save: String
    var cancel: String
    var close: String
    var tooLarge: String
    var cannotRead: String
    var groupTooLong: String
    var groupExample: String
    var langLabel: String
    var sessionExpired: String

    static func forLang(_ lang: ShareLang) -> ShareCopy {
        switch lang {
        case .zhHant:
            return ShareCopy(
                title: "分享到匣雲",
                loginTitle: "請先登入匣雲",
                loginBody: "從其他 App 分享前，要先用現有帳號登入匣雲。若剛更新，請先打開匣雲一次。",
                openApp: "打開匣雲",
                groupTitle: "放到哪個分組？",
                textLead: "這則文字會存成筆記",
                imageLead: "這張圖片會存成圖片",
                linkTitle: "連結",
                fallbackTitle: "分享",
                saved: "已存進匣雲",
                unsupported: "匣雲只能接收文字、連結或圖片",
                saving: "正在存進匣雲…",
                newGroup: "或輸入新分組名稱",
                groupsFailed: "讀不到現有分組，仍可存到未分組或新名稱",
                ungrouped: "未分組",
                save: "儲存",
                cancel: "取消",
                close: "關閉",
                tooLarge: "檔案超過 32 MB 上限",
                cannotRead: "無法讀取這個檔案",
                groupTooLong: "分組名稱請留在四十個字以內",
                groupExample: "例如 京都行",
                langLabel: "語言",
                sessionExpired: "工作階段已失效，請重新登入"
            )
        case .zhHans:
            return ShareCopy(
                title: "分享到匣云",
                loginTitle: "请先登录匣云",
                loginBody: "从其他应用分享前，要先用现有账号登录匣云。若刚更新，请先打开匣云一次。",
                openApp: "打开匣云",
                groupTitle: "放到哪个分组？",
                textLead: "这段文字会存成笔记",
                imageLead: "这张图片会存成图片",
                linkTitle: "链接",
                fallbackTitle: "分享",
                saved: "已存进匣云",
                unsupported: "匣云只能接收文字、链接或图片",
                saving: "正在存进匣云…",
                newGroup: "或输入新分组名称",
                groupsFailed: "读不到现有分组，仍可存到未分组或新名称",
                ungrouped: "未分组",
                save: "保存",
                cancel: "取消",
                close: "关闭",
                tooLarge: "文件超过 32 MB 上限",
                cannotRead: "无法读取这个文件",
                groupTooLong: "分组名称请留在四十个字以内",
                groupExample: "例如 京都行",
                langLabel: "语言",
                sessionExpired: "会话已失效，请重新登录"
            )
        case .en:
            return ShareCopy(
                title: "Share to Xia Yun",
                loginTitle: "Log in to Xia Yun first",
                loginBody: "Log in with your existing Xia Yun account before sharing from another app. If you just updated, open Xia Yun once.",
                openApp: "Open Xia Yun",
                groupTitle: "Which group?",
                textLead: "This text is saved as a note",
                imageLead: "This picture is saved as an image",
                linkTitle: "Link",
                fallbackTitle: "Share",
                saved: "Saved to Xia Yun",
                unsupported: "Xia Yun can accept text, a link, or a picture",
                saving: "Saving to Xia Yun…",
                newGroup: "Or type a new group name",
                groupsFailed: "Existing groups could not be loaded. You can still use Ungrouped or a new name.",
                ungrouped: "Ungrouped",
                save: "Save",
                cancel: "Cancel",
                close: "Close",
                tooLarge: "The file is over the 32 MB limit",
                cannotRead: "Could not read this file",
                groupTooLong: "Keep the group name within forty characters",
                groupExample: "For example, Kyoto",
                langLabel: "Language",
                sessionExpired: "This session expired. Log in again."
            )
        }
    }
}
