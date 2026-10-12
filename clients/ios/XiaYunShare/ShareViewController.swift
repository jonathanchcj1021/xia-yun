import SwiftUI
import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        let model = ShareModel(context: extensionContext)
        let host = UIHostingController(rootView: ShareRoot(model: model).modifier(PaletteModifier()))
        addChild(host)
        host.view.translatesAutoresizingMaskIntoConstraints = false
        host.view.backgroundColor = .clear
        view.addSubview(host.view)
        NSLayoutConstraint.activate([
            host.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            host.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            host.view.topAnchor.constraint(equalTo: view.topAnchor),
            host.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        host.didMove(toParent: self)
    }
}

private struct LoadedImage {
    var data: Data
    var filename: String
    var mimeType: String
}

private enum ShareIncoming {
    case loading
    case text(String)
    case image(LoadedImage)
    case tooLarge
    case unreadable
    case unsupported
}

@MainActor
private final class ShareModel: ObservableObject {
    @Published var lang: ShareLang
    @Published var incoming: ShareIncoming = .loading
    @Published var signedIn = false
    @Published var groups: [String] = []
    @Published var selectedGroup: String?
    @Published var customName = ""
    @Published var groupsFailed = false
    @Published var error: String?
    @Published var saving = false
    @Published var saved = false

    private let context: NSExtensionContext?
    private var credential = Credential.none

    init(context: NSExtensionContext?) {
        self.context = context
        lang = ShareLang.resolved()
    }

    var copy: ShareCopy { ShareCopy.forLang(lang) }

    func start() async {
        switch loadSession() {
        case .ready(let credential):
            self.credential = credential
            signedIn = true
        case .cancelled:
            context?.cancelRequest(withError: CocoaError(.userCancelled))
            return
        case .missing:
            signedIn = false
        }
        incoming = await loadIncoming()
        guard signedIn else { return }
        await loadGroups()
    }

    func chooseLang(_ next: ShareLang) {
        lang = next
        SharedDefaults.storeLanguageCode(next.rawValue)
    }

    func openApp() {
        guard let url = URL(string: "xiayun://library") else { return }
        context?.open(url, completionHandler: nil)
    }

    func cancel() {
        context?.cancelRequest(withError: CocoaError(.userCancelled))
    }

    func close() {
        context?.completeRequest(returningItems: nil, completionHandler: nil)
    }

    func save() async {
        let copy = self.copy
        let typed = customName.trimmingCharacters(in: .whitespacesAndNewlines)
        if typed.utf16.count > ShareDraft.maxGroupCharacters {
            error = copy.groupTooLong
            return
        }
        let group = ShareDraft.canonicalGroup(typed.isEmpty ? selectedGroup : typed)
        error = nil
        saving = true
        defer { saving = false }
        let client = APIClient(baseURL: SharedDefaults.resolvedBaseURL(), credential: credential)
        do {
            switch incoming {
            case .text(let raw):
                guard let draft = ShareDraft.note(
                    text: raw,
                    linkTitle: copy.linkTitle,
                    fallbackTitle: copy.fallbackTitle
                ) else {
                    error = copy.unsupported
                    return
                }
                _ = try await client.createNote(title: draft.title, body: draft.body, group: group)
            case .image(let image):
                if image.data.count > Limits.maxUploadBytes {
                    error = copy.tooLarge
                    return
                }
                let type: UploadType = RasterMime.isRaster(image.mimeType) ? .image : .file
                _ = try await client.upload(
                    data: image.data,
                    filename: image.filename,
                    mimeType: image.mimeType,
                    type: type,
                    group: group
                )
            case .tooLarge:
                error = copy.tooLarge
                return
            case .unreadable:
                error = copy.cannotRead
                return
            case .loading, .unsupported:
                error = copy.unsupported
                return
            }
            saved = true
        } catch let api as APIError where api.isUnauthenticated {
            signedIn = false
            error = copy.sessionExpired
        } catch {
            error = (error as? APIError)?.message ?? copy.cannotRead
        }
    }

    private enum SessionLoad {
        case ready(Credential)
        case cancelled
        case missing
    }

    private func loadSession() -> SessionLoad {
        do {
            let secret = try KeychainVault().loadForShare()
            if secret.credential.isEmpty { return .missing }
            return .ready(secret.credential)
        } catch KeychainError.cancelled {
            return .cancelled
        } catch {
            return .missing
        }
    }

    private func loadGroups() async {
        let client = APIClient(baseURL: SharedDefaults.resolvedBaseURL(), credential: credential)
        do {
            let items = try await client.listItems()
            groups = ShareDraft.groupNames(from: items)
            groupsFailed = false
        } catch let api as APIError where api.isUnauthenticated {
            signedIn = false
            error = copy.sessionExpired
        } catch {
            groupsFailed = true
        }
    }

    private func loadIncoming() async -> ShareIncoming {
        guard let items = context?.inputItems as? [NSExtensionItem] else { return .unsupported }
        var text: String?
        var page: URL?
        var image: LoadedImage?
        var sawImage = false
        for item in items {
            for provider in item.attachments ?? [] {
                if image == nil && provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
                    sawImage = true
                    switch await loadImage(provider) {
                    case .image(let loaded):
                        image = loaded
                    case .tooLarge:
                        return .tooLarge
                    case .missing:
                        continue
                    }
                } else if page == nil && provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    page = await loadURL(provider)
                } else if text == nil && provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    text = await loadText(provider, type: UTType.plainText.identifier)
                } else if text == nil && provider.hasItemConformingToTypeIdentifier(UTType.text.identifier) {
                    text = await loadText(provider, type: UTType.text.identifier)
                }
            }
        }
        if let image { return .image(image) }
        if sawImage && text == nil && page == nil { return .unreadable }
        if let text, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return .text(text) }
        if let page { return .text(page.absoluteString) }
        return .unsupported
    }
}

private enum ImageLoad {
    case image(LoadedImage)
    case tooLarge
    case missing
}

private func loadImage(_ provider: NSItemProvider) async -> ImageLoad {
    await withCheckedContinuation { continuation in
        var resumed = false
        func finish(_ value: ImageLoad) {
            if resumed { return }
            resumed = true
            continuation.resume(returning: value)
        }
        provider.loadFileRepresentation(for: .image) { url, _ in
            guard let url else {
                finish(.missing)
                return
            }
            guard let data = try? Data(contentsOf: url) else {
                finish(.missing)
                return
            }
            if data.count > Limits.maxUploadBytes {
                finish(.tooLarge)
                return
            }
            let filename = url.lastPathComponent.isEmpty ? "image.jpg" : url.lastPathComponent
            let mime = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "image/jpeg"
            finish(.image(LoadedImage(data: data, filename: filename, mimeType: mime)))
        }
    }
}

private func loadText(_ provider: NSItemProvider, type: String) async -> String? {
    await withCheckedContinuation { continuation in
        var resumed = false
        provider.loadItem(forTypeIdentifier: type, options: nil) { item, _ in
            if resumed { return }
            resumed = true
            if let text = item as? String {
                continuation.resume(returning: text)
            } else if let text = item as? NSString {
                continuation.resume(returning: text as String)
            } else {
                continuation.resume(returning: nil)
            }
        }
    }
}

private func loadURL(_ provider: NSItemProvider) async -> URL? {
    await withCheckedContinuation { continuation in
        var resumed = false
        provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { item, _ in
            if resumed { return }
            resumed = true
            if let url = item as? URL {
                continuation.resume(returning: url)
            } else if let url = item as? NSURL {
                continuation.resume(returning: url as URL)
            } else {
                continuation.resume(returning: nil)
            }
        }
    }
}

private struct ShareRoot: View {
    @ObservedObject var model: ShareModel

    var body: some View {
        let copy = model.copy
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text(copy.title).font(.title2.weight(.semibold))
                langRow(copy)
                content(copy)
            }
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(PaperBackground())
        .task { await model.start() }
    }

    @ViewBuilder
    private func content(_ copy: ShareCopy) -> some View {
        switch model.incoming {
        case .loading:
            ProgressView(copy.saving)
        case .unsupported:
            Text(copy.unsupported)
            Button(copy.close, action: model.cancel).buttonStyle(CinnabarButtonStyle(prominent: false))
        case .tooLarge:
            Text(copy.tooLarge)
            Button(copy.close, action: model.cancel).buttonStyle(CinnabarButtonStyle(prominent: false))
        case .unreadable:
            Text(copy.cannotRead)
            Button(copy.close, action: model.cancel).buttonStyle(CinnabarButtonStyle(prominent: false))
        case .text(let raw):
            if !model.signedIn {
                login(copy)
            } else if model.saved {
                saved(copy)
            } else {
                editor(copy, lead: copy.textLead, preview: previewTitle(raw, copy: copy), body: raw)
            }
        case .image:
            if !model.signedIn {
                login(copy)
            } else if model.saved {
                saved(copy)
            } else {
                editor(copy, lead: copy.imageLead, preview: nil, body: nil)
            }
        }
    }

    @ViewBuilder
    private func login(_ copy: ShareCopy) -> some View {
        Text(copy.loginTitle).font(.headline)
        Text(copy.loginBody)
        if let error = model.error {
            Text(error).foregroundStyle(Color(red: 0.62, green: 0.22, blue: 0.16))
        }
        Button(copy.openApp, action: model.openApp).buttonStyle(CinnabarButtonStyle())
        Button(copy.cancel, action: model.cancel).buttonStyle(CinnabarButtonStyle(prominent: false))
    }

    private func previewTitle(_ raw: String, copy: ShareCopy) -> String {
        ShareDraft.note(text: raw, linkTitle: copy.linkTitle, fallbackTitle: copy.fallbackTitle)?.title
            ?? copy.fallbackTitle
    }

    @ViewBuilder
    private func saved(_ copy: ShareCopy) -> some View {
        Text(copy.saved).font(.headline)
        Button(copy.close, action: model.close).buttonStyle(CinnabarButtonStyle())
    }

    @ViewBuilder
    private func editor(_ copy: ShareCopy, lead: String, preview: String?, body: String?) -> some View {
        Text(lead).foregroundStyle(.secondary)
        if let preview {
            Text(preview).font(.headline)
        }
        if let body {
            Text(body).lineLimit(6)
        }
        Text(copy.groupTitle).font(.headline)
        if model.groupsFailed {
            Text(copy.groupsFailed).foregroundStyle(.secondary)
        }
        if let error = model.error {
            Text(error).foregroundStyle(Color(red: 0.62, green: 0.22, blue: 0.16))
        }
        chip(copy.ungrouped, selected: model.customName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && model.selectedGroup == nil) {
            model.selectedGroup = nil
            model.customName = ""
        }
        ForEach(model.groups, id: \.self) { name in
            chip(name, selected: model.customName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && model.selectedGroup == name) {
                model.selectedGroup = name
                model.customName = ""
            }
        }
        TextField(copy.groupExample, text: $model.customName)
            .textFieldStyle(.roundedBorder)
            .accessibilityLabel(copy.newGroup)
        Button(model.saving ? copy.saving : copy.save) {
            Task { await model.save() }
        }
        .buttonStyle(CinnabarButtonStyle())
        .disabled(model.saving)
        Button(copy.cancel, action: model.cancel)
            .buttonStyle(CinnabarButtonStyle(prominent: false))
            .disabled(model.saving)
    }

    private func chip(_ title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background {
                    Capsule().fill(selected ? Color(red: 0.55, green: 0.27, blue: 0.18) : Color.white.opacity(0.7))
                }
                .foregroundStyle(selected ? Color.white : Color.primary)
        }
        .buttonStyle(.plain)
    }

    private func langRow(_ copy: ShareCopy) -> some View {
        HStack(spacing: 8) {
            ForEach(ShareLang.allCases) { lang in
                Button(lang.chip) { model.chooseLang(lang) }
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background {
                        Capsule().fill(lang == model.lang ? Color(red: 0.55, green: 0.27, blue: 0.18) : Color.white.opacity(0.7))
                    }
                    .foregroundStyle(lang == model.lang ? Color.white : Color.primary)
                    .buttonStyle(.plain)
                    .accessibilityLabel(copy.langLabel)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(copy.langLabel)
    }
}
