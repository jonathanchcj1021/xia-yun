import AuthenticationServices
import Foundation
import LocalAuthentication
import UniformTypeIdentifiers

@MainActor
final class AppModel: ObservableObject {
    enum Phase: Equatable {
        case launching
        case signedOut
        case locked
        case library
    }

    @Published var phase: Phase = .launching
    @Published var baseURLText: String = BaseURL.defaultString
    @Published var accountEmail = ""
    @Published var user: User?
    @Published var items: [CloudItem] = []
    @Published var selectedItemID: String?
    @Published var isWorking = false
    @Published var workingTitle = ""
    @Published var isLoadingLibrary = false
    @Published var formError: String?
    @Published var libraryError: String?
    @Published var notice: String?
    @Published var biometricOffer: BiometricKind?
    @Published var faceIDEnabled = false
    @Published var biometricKind: BiometricKind = .none

    var skipBootstrap = false

    private let defaults: UserDefaults
    private let vault: KeychainVault
    private let passkey: SystemPasskeyCeremony
    private var client: APIClient
    private var currentSecret: SessionSecret?

    init(
        defaults: UserDefaults = .standard,
        vault: KeychainVault = KeychainVault(),
        passkey: SystemPasskeyCeremony = SystemPasskeyCeremony()
    ) {
        self.defaults = defaults
        self.vault = vault
        self.passkey = passkey
        self.client = APIClient(baseURL: BaseURL.fallback)
    }

    func setPasskeyAnchor(_ window: ASPresentationAnchor) {
        passkey.anchor = window
    }

    func bootstrap() async {
        biometricKind = SystemBiometrics.kind()
        let stored = defaults.string(forKey: Pref.baseURL) ?? BaseURL.defaultString
        let url = BaseURL.normalize(stored) ?? BaseURL.fallback
        applyBaseURL(url)
        faceIDEnabled = defaults.bool(forKey: Pref.faceID)
        accountEmail = defaults.string(forKey: Pref.email) ?? ""
        guard defaults.bool(forKey: Pref.hasSession) else {
            phase = .signedOut
            return
        }
        if faceIDEnabled {
            phase = .locked
            return
        }
        do {
            let secret = try vault.load(context: nil)
            try? vault.save(secret, requireBiometry: false)
            try adopt(secret)
            user = try await client.currentUser()
            accountEmail = user?.email ?? secret.email
            phase = .library
            await refreshItems()
        } catch let error as APIError where error.isUnauthenticated {
            clearLocalSession()
            phase = .signedOut
            formError = "登入已失效，請重新登入。"
        } catch {
            clearLocalSession()
            phase = .signedOut
        }
    }

    func login(email: String, password: String) async {
        await authenticate(working: "正在登入…") {
            try await client.login(email: email, password: password)
        }
    }

    func register(email: String, password: String) async {
        await authenticate(working: "正在建立帳號…") {
            try await client.register(email: email, password: password)
        }
    }

    func loginWithPasskey(email: String) async {
        formError = nil
        if let error = AccountRules.emailError(email) {
            formError = error == "請輸入電子郵件" ? "請先輸入要用通行密鑰的電子郵件。" : error
            return
        }
        isWorking = true
        workingTitle = "正在等待通行密鑰…"
        defer { isWorking = false }
        do {
            let options = try await client.passkeyOptions(email: email)
            let assertion = try await passkey.perform(options)
            let success = try await client.verifyPasskey(
                email: email,
                assertion: assertion,
                rpId: options.rpId
            )
            await finishSignIn(success)
        } catch PasskeyFlowError.cancelled {
            formError = nil
        } catch let error as PasskeyFlowError {
            formError = message(for: error)
        } catch let error as APIError where error == .cancelled {
            formError = nil
        } catch {
            formError = message(for: error)
        }
    }

    func acceptBiometricOffer() async {
        guard let kind = biometricOffer, let secret = currentSecret else {
            biometricOffer = nil
            return
        }
        do {
            try await SystemBiometrics.evaluate(reason: "啟用\(kind.displayName)解鎖匣雲")
            try vault.save(secret, requireBiometry: true)
            defaults.set(true, forKey: Pref.faceID)
            defaults.set(false, forKey: Pref.declined)
            faceIDEnabled = true
            biometricOffer = nil
        } catch BiometricError.cancelled {
            notice = "已取消啟用\(kind.displayName)。"
        } catch {
            biometricOffer = nil
            notice = "無法啟用\(kind.displayName)。這次登入已儲存，下次會直接進入。"
        }
    }

    func declineBiometricOffer() {
        defaults.set(true, forKey: Pref.declined)
        biometricOffer = nil
    }

    func unlockWithBiometrics() async {
        notice = nil
        isWorking = true
        workingTitle = "正在解鎖…"
        defer { isWorking = false }
        let context = LAContext()
        let kind = SystemBiometrics.kind()
        biometricKind = kind
        context.localizedReason = "解鎖匣雲裡已儲存的登入"
        do {
            let secret = try vault.load(context: context)
            try? vault.save(secret, requireBiometry: true)
            try adopt(secret)
            user = try await client.currentUser()
            accountEmail = user?.email ?? secret.email
            phase = .library
            await refreshItems()
        } catch KeychainError.cancelled {
            notice = "已取消解鎖。"
        } catch KeychainError.failed {
            notice = "\(kind.displayName)沒有通過，或生物辨識已變更。請改用密碼登入。"
        } catch let error as APIError where error.isUnauthenticated {
            clearLocalSession()
            phase = .signedOut
            formError = "登入已失效，請重新登入。"
        } catch {
            notice = message(for: error)
        }
    }

    func usePasswordInstead() {
        clearLocalSession()
        phase = .signedOut
        notice = nil
    }

    func logout() async {
        isWorking = true
        workingTitle = "正在登出…"
        defer { isWorking = false }
        await client.logout()
        clearLocalSession()
        phase = .signedOut
        formError = nil
        notice = nil
    }

    func refreshItems() async {
        if items.isEmpty { isLoadingLibrary = true }
        defer { isLoadingLibrary = false }
        do {
            items = try await client.listItems()
            libraryError = nil
        } catch let error as APIError where error == .cancelled {
            return
        } catch let error as APIError where error.isUnauthenticated {
            clearLocalSession()
            phase = .signedOut
            formError = "登入已失效，請重新登入。"
        } catch {
            if items.isEmpty {
                libraryError = message(for: error)
            } else {
                notice = message(for: error)
            }
        }
    }

    func createNote(title: String, body: String) async throws {
        do {
            let item = try await client.createNote(title: title, body: body)
            items.removeAll { $0.id == item.id }
            items.insert(item, at: 0)
            libraryError = nil
        } catch let error as APIError where error.isUnauthenticated {
            clearLocalSession()
            phase = .signedOut
            formError = "登入已失效，請重新登入。"
            throw error
        }
    }

    func upload(data: Data, filename: String, mimeType: String, type: UploadType?) async {
        if data.count > Limits.maxUploadBytes {
            notice = APIError.fileTooLarge.message
            return
        }
        isWorking = true
        workingTitle = "正在上傳…"
        defer { isWorking = false }
        do {
            let item = try await client.upload(
                data: data,
                filename: filename,
                mimeType: mimeType,
                type: type
            )
            items.removeAll { $0.id == item.id }
            items.insert(item, at: 0)
            libraryError = nil
            selectedItemID = item.id
        } catch let error as APIError where error.isUnauthenticated {
            clearLocalSession()
            phase = .signedOut
            formError = "登入已失效，請重新登入。"
        } catch {
            notice = message(for: error)
        }
    }

    func importFile(at url: URL) async {
        let accessed = url.startAccessingSecurityScopedResource()
        defer { if accessed { url.stopAccessingSecurityScopedResource() } }
        do {
            let values = try url.resourceValues(forKeys: [.fileSizeKey, .contentTypeKey])
            if let size = values.fileSize, size > Limits.maxUploadBytes {
                notice = APIError.fileTooLarge.message
                return
            }
            let data = try Data(contentsOf: url)
            let mime = values.contentType?.preferredMIMEType
                ?? UTType(filenameExtension: url.pathExtension)?.preferredMIMEType
                ?? "application/octet-stream"
            let type: UploadType = RasterMime.isRaster(mime) ? .image : .file
            await upload(data: data, filename: url.lastPathComponent, mimeType: mime, type: type)
        } catch {
            notice = "無法讀取選擇的檔案。"
        }
    }

    func item(id: String) async throws -> CloudItem {
        do {
            return try await client.item(id: id)
        } catch let error as APIError where error.isUnauthenticated {
            clearLocalSession()
            phase = .signedOut
            formError = "登入已失效，請重新登入。"
            throw error
        }
    }

    func content(id: String, attachment: Bool) async throws -> Data {
        do {
            return try await client.content(id: id, attachment: attachment)
        } catch let error as APIError where error.isUnauthenticated {
            clearLocalSession()
            phase = .signedOut
            formError = "登入已失效，請重新登入。"
            throw error
        }
    }

    func delete(id: String) async throws {
        do {
            try await client.deleteItem(id: id)
            items.removeAll { $0.id == id }
            if selectedItemID == id { selectedItemID = nil }
        } catch let error as APIError where error.isUnauthenticated {
            clearLocalSession()
            phase = .signedOut
            formError = "登入已失效，請重新登入。"
            throw error
        }
    }

    func updateBaseURL(_ raw: String) async -> String? {
        guard let url = BaseURL.normalize(raw) else { return APIError.invalidBaseURL.message }
        if url.absoluteString == client.baseURL.absoluteString {
            baseURLText = url.absoluteString
            return nil
        }
        if phase == .library || phase == .locked {
            await client.logout()
            clearLocalSession()
            phase = .signedOut
        }
        applyBaseURL(url)
        return nil
    }

    func setFaceIDEnabled(_ enabled: Bool) async {
        biometricKind = SystemBiometrics.kind()
        guard phase == .library, let secret = currentSecret else { return }
        if enabled {
            guard biometricKind != .none else {
                notice = "這台裝置沒有可用的 Face ID 或 Touch ID。"
                return
            }
            do {
                try await SystemBiometrics.evaluate(reason: "啟用\(biometricKind.displayName)解鎖匣雲")
                try vault.save(secret, requireBiometry: true)
                defaults.set(true, forKey: Pref.faceID)
                defaults.set(false, forKey: Pref.declined)
                faceIDEnabled = true
            } catch BiometricError.cancelled {
                notice = "已取消啟用\(biometricKind.displayName)。"
            } catch {
                notice = "無法啟用\(biometricKind.displayName)。"
            }
        } else {
            do {
                try vault.save(secret, requireBiometry: false)
                defaults.set(false, forKey: Pref.faceID)
                faceIDEnabled = false
            } catch {
                notice = "無法關閉生物辨識解鎖。"
            }
        }
    }

    func dismissNotice() { notice = nil }

    private func authenticate(working: String, action: () async throws -> AuthSuccess) async {
        formError = nil
        isWorking = true
        workingTitle = working
        defer { isWorking = false }
        do {
            let success = try await action()
            await finishSignIn(success)
        } catch {
            formError = message(for: error)
        }
    }

    private func finishSignIn(_ success: AuthSuccess) async {
        let secret = SessionSecret(
            bearerToken: success.credential.bearerToken,
            sessionCookie: success.credential.sessionCookie,
            userId: success.user.id,
            email: success.user.email
        )
        var protect = defaults.bool(forKey: Pref.faceID)
        do {
            try vault.save(secret, requireBiometry: protect)
        } catch {
            if protect {
                do {
                    try vault.save(secret, requireBiometry: false)
                    protect = false
                    defaults.set(false, forKey: Pref.faceID)
                } catch {
                    formError = "無法在這台裝置儲存登入。"
                    return
                }
            } else {
                formError = "無法在這台裝置儲存登入。"
                return
            }
        }
        currentSecret = secret
        client.credential = success.credential
        user = success.user
        accountEmail = success.user.email
        defaults.set(true, forKey: Pref.hasSession)
        defaults.set(success.user.email, forKey: Pref.email)
        faceIDEnabled = protect
        isLoadingLibrary = true
        phase = .library
        await refreshItems()
        biometricKind = SystemBiometrics.kind()
        if BiometricPolicy.shouldOfferUnlock(
            kind: biometricKind,
            alreadyEnabled: faceIDEnabled,
            userDeclined: defaults.bool(forKey: Pref.declined)
        ) {
            biometricOffer = biometricKind
        }
    }

    private func adopt(_ secret: SessionSecret) throws {
        guard !secret.credential.isEmpty else { throw KeychainError.failed }
        currentSecret = secret
        client.credential = secret.credential
        accountEmail = secret.email
    }

    private func applyBaseURL(_ url: URL) {
        baseURLText = url.absoluteString
        defaults.set(url.absoluteString, forKey: Pref.baseURL)
        SharedDefaults.storeBaseURL(url.absoluteString)
        let existing = client.credential
        client = APIClient(baseURL: url, credential: existing)
    }

    private func clearLocalSession() {
        vault.delete()
        currentSecret = nil
        client.credential = .none
        user = nil
        items = []
        selectedItemID = nil
        faceIDEnabled = false
        biometricOffer = nil
        accountEmail = ""
        defaults.set(false, forKey: Pref.hasSession)
        defaults.set(false, forKey: Pref.faceID)
        defaults.set(false, forKey: Pref.declined)
        defaults.removeObject(forKey: Pref.email)
    }

    private func message(for error: Error) -> String {
        if let api = error as? APIError { return api.message }
        if let passkey = error as? PasskeyFlowError {
            switch passkey {
            case .cancelled: return "已取消。"
            case .failed(let text): return text
            }
        }
        return "發生未預期的錯誤。"
    }
}

private enum Pref {
    static let baseURL = "xiayun.baseURL"
    static let faceID = "xiayun.faceIDUnlock"
    static let email = "xiayun.accountEmail"
    static let hasSession = "xiayun.hasSession"
    static let declined = "xiayun.declinedBiometricOffer"
}
