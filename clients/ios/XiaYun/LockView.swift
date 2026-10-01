import SwiftUI

struct LockView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.palette) private var palette

    var body: some View {
        VStack(spacing: 22) {
            Spacer()
            Mark()
                .frame(width: 72, height: 72)
            VStack(spacing: 6) {
                Text("匣雲已鎖上")
                    .font(.title2.weight(.semibold))
                if !model.accountEmail.isEmpty {
                    Text(model.accountEmail)
                        .font(.subheadline)
                        .foregroundStyle(palette.muted)
                }
                Text("用\(model.biometricKind == .none ? "生物辨識" : model.biometricKind.displayName)取出已儲存的登入。")
                    .font(.subheadline)
                    .foregroundStyle(palette.muted)
                    .multilineTextAlignment(.center)
            }
            if let notice = model.notice {
                Text(notice)
                    .font(.footnote)
                    .foregroundStyle(palette.danger)
                    .multilineTextAlignment(.center)
            }
            Button {
                Task { await model.unlockWithBiometrics() }
            } label: {
                Label("用 \(unlockName) 解鎖", systemImage: model.biometricKind.systemImage)
            }
            .buttonStyle(CinnabarButtonStyle())
            .disabled(model.isWorking)
            Button("改用密碼登入") {
                model.usePasswordInstead()
            }
            .buttonStyle(CinnabarButtonStyle(prominent: false))
            .disabled(model.isWorking)
            Spacer()
        }
        .padding(24)
        .onAppear { model.biometricKind = SystemBiometrics.kind() }
    }

    private var unlockName: String {
        model.biometricKind == .none ? "生物辨識" : model.biometricKind.displayName
    }
}

struct FaceIDOfferView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.palette) private var palette
    var kind: BiometricKind

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Image(systemName: kind.systemImage)
                .font(.largeTitle)
                .foregroundStyle(palette.cinnabar)
            Text("要用\(kind.displayName)解鎖嗎？")
                .font(.title2.weight(.semibold))
            Text("下次打開匣雲時，可以用\(kind.displayName)取出已儲存的登入，不必再輸入密碼。生物辨識只留在這台裝置上，不會上傳。")
                .font(.body)
                .foregroundStyle(palette.muted)
                .fixedSize(horizontal: false, vertical: true)
            Button("啟用\(kind.displayName)") {
                Task { await model.acceptBiometricOffer() }
            }
            .buttonStyle(CinnabarButtonStyle())
            Button("先不要") {
                model.declineBiometricOffer()
            }
            .buttonStyle(CinnabarButtonStyle(prominent: false))
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(PaperBackground())
        .presentationDetents([.medium])
    }
}
