import AuthenticationServices
import LocalAuthentication
import UIKit

enum BiometricError: Error {
    case unavailable
    case cancelled
    case failed
}

enum SystemBiometrics {
    static func kind() -> BiometricKind {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            return .none
        }
        switch context.biometryType {
        case .faceID: return .faceID
        case .touchID: return .touchID
        case .opticID: return .opticID
        case .none: return .none
        @unknown default: return .none
        }
    }

    static func evaluate(reason: String) async throws {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            throw BiometricError.unavailable
        }
        do {
            try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: reason
            )
        } catch let error as LAError {
            switch error.code {
            case .userCancel, .appCancel, .systemCancel:
                throw BiometricError.cancelled
            default:
                throw BiometricError.failed
            }
        }
    }
}

enum PasskeyFlowError: Error, Equatable {
    case cancelled
    case failed(String)
}

@MainActor
final class SystemPasskeyCeremony: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    weak var anchor: ASPresentationAnchor?
    private var continuation: CheckedContinuation<PasskeyAssertionPayload, Error>?
    private var controller: ASAuthorizationController?

    func perform(_ options: PasskeyAssertionOptions) async throws -> PasskeyAssertionPayload {
        if continuation != nil {
            resume(with: .failure(PasskeyFlowError.failed("上一次通行密鑰還沒結束。")))
        }
        guard let challenge = Base64URL.decode(options.challenge) else {
            throw PasskeyFlowError.failed("通行密鑰 challenge 無法解讀。")
        }
        guard anchor != nil || keyWindow() != nil else {
            throw PasskeyFlowError.failed("現在無法顯示通行密鑰確認。")
        }
        let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(relyingPartyIdentifier: options.rpId)
        let request = provider.createCredentialAssertionRequest(challenge: challenge)
        if !options.allowCredentials.isEmpty {
            request.allowedCredentials = options.allowCredentials.compactMap { credential in
                guard let id = Base64URL.decode(credential.id) else { return nil }
                return ASAuthorizationPlatformPublicKeyCredentialDescriptor(credentialID: id)
            }
        }
        switch options.userVerification {
        case "required":
            request.userVerificationPreference = .required
        case "discouraged":
            request.userVerificationPreference = .discouraged
        default:
            request.userVerificationPreference = .preferred
        }
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        self.controller = controller
        return try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            controller.performRequests()
        }
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        guard let credential = authorization.credential as? ASAuthorizationPlatformPublicKeyCredentialAssertion else {
            resume(with: .failure(PasskeyFlowError.failed("這次通行密鑰回應無法使用。")))
            return
        }
        let payload = PasskeyAssertionPayload.make(
            credentialID: credential.credentialID,
            clientDataJSON: credential.rawClientDataJSON,
            authenticatorData: credential.rawAuthenticatorData,
            signature: credential.signature,
            userHandle: credential.userID
        )
        resume(with: .success(payload))
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        if let authError = error as? ASAuthorizationError, authError.code == .canceled {
            resume(with: .failure(PasskeyFlowError.cancelled))
            return
        }
        resume(with: .failure(PasskeyFlowError.failed(
            "通行密鑰登入沒有完成。請確認伺服器網域已加到 App 的 Associated Domains，而且這個帳號已經註冊通行密鑰。"
        )))
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        anchor ?? keyWindow() ?? ASPresentationAnchor()
    }

    private func keyWindow() -> UIWindow? {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first { $0.isKeyWindow }
    }

    private func resume(with result: Result<PasskeyAssertionPayload, Error>) {
        let continuation = continuation
        self.continuation = nil
        controller = nil
        switch result {
        case .success(let value):
            continuation?.resume(returning: value)
        case .failure(let error):
            continuation?.resume(throwing: error)
        }
    }
}
