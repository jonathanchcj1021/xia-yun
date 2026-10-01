import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.palette) private var palette
    @Environment(\.dismiss) private var dismiss

    @State private var draft = ""
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("帳號") {
                    LabeledContent("電子郵件", value: model.user?.email ?? model.accountEmail)
                }
                Section {
                    TextField("http://127.0.0.1:43123", text: $draft)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                    if let error {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(palette.danger)
                    }
                } header: {
                    Text("伺服器")
                } footer: {
                    Text("更換位址會先登出。真機上的 127.0.0.1 指的是手機自己，請改成電腦或伺服器的位址。")
                }
                Section {
                    if model.biometricKind == .none {
                        Text("這台裝置目前沒有可用的 Face ID 或 Touch ID。")
                            .font(.subheadline)
                            .foregroundStyle(palette.muted)
                    } else {
                        Toggle(isOn: faceIDBinding) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("用\(model.biometricKind.displayName)解鎖")
                                Text("下次打開時，先確認是你本人再取出已儲存的登入。")
                                    .font(.footnote)
                                    .foregroundStyle(palette.muted)
                            }
                        }
                    }
                } header: {
                    Text("這台裝置")
                }
                Section {
                    Button("登出", role: .destructive) {
                        Task {
                            await model.logout()
                            dismiss()
                        }
                    }
                }
            }
            .navigationTitle("設定")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("關閉") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(serverChanged ? "儲存並登出" : "儲存") { saveServer() }
                        .disabled(!serverChanged)
                }
            }
        }
        .onAppear {
            draft = model.baseURLText
            model.biometricKind = SystemBiometrics.kind()
        }
    }

    private var serverChanged: Bool {
        BaseURL.normalize(draft)?.absoluteString != BaseURL.normalize(model.baseURLText)?.absoluteString
    }

    private var faceIDBinding: Binding<Bool> {
        Binding(
            get: { model.faceIDEnabled },
            set: { newValue in
                Task { await model.setFaceIDEnabled(newValue) }
            }
        )
    }

    private func saveServer() {
        Task {
            if let message = await model.updateBaseURL(draft) {
                error = message
            } else {
                dismiss()
            }
        }
    }
}
