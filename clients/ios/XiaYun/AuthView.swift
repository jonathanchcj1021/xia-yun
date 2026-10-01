import SwiftUI

struct AuthView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.palette) private var palette

    @State private var mode = Mode.login
    @State private var email = ""
    @State private var password = ""
    @State private var showPassword = false
    @State private var showServer = false

    private enum Mode: String, CaseIterable, Identifiable {
        case login = "登入"
        case register = "註冊"
        var id: String { rawValue }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack(spacing: 10) {
                    Mark()
                        .frame(width: 36, height: 36)
                    Text("匣雲")
                        .font(.title2.weight(.semibold))
                }
                VStack(alignment: .leading, spacing: 8) {
                    Text("檔案、圖片與筆記，放在你的帳號裡。")
                        .font(.title.weight(.semibold))
                        .fixedSize(horizontal: false, vertical: true)
                    Text("內容只屬於這個帳號。單一檔案上限 32 MB。")
                        .font(.subheadline)
                        .foregroundStyle(palette.muted)
                }
                Picker("模式", selection: $mode) {
                    ForEach(Mode.allCases) { item in
                        Text(item.rawValue).tag(item)
                    }
                }
                .pickerStyle(.segmented)
                .labelsHidden()

                VStack(alignment: .leading, spacing: 12) {
                    labeled("電子郵件") {
                        TextField("you@example.com", text: $email)
                            .textContentType(.username)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    }
                    labeled("密碼") {
                        Group {
                            if showPassword {
                                TextField("至少 8 個字元", text: $password)
                            } else {
                                SecureField("至少 8 個字元", text: $password)
                            }
                        }
                        .textContentType(mode == .register ? .newPassword : .password)
                    }
                    Toggle("顯示密碼", isOn: $showPassword)
                        .font(.footnote)
                        .foregroundStyle(palette.muted)
                }
                .padding(16)
                .background(palette.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(palette.line, lineWidth: 1)
                }

                if let formError = model.formError {
                    Text(formError)
                        .font(.footnote)
                        .foregroundStyle(palette.danger)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Button(action: submit) {
                    if model.isWorking {
                        ProgressView()
                            .tint(Color(red: 0.99, green: 0.97, blue: 0.94))
                    } else {
                        Text(mode == .login ? "登入" : "建立帳號")
                    }
                }
                .buttonStyle(CinnabarButtonStyle())
                .disabled(model.isWorking)
                .accessibilityIdentifier("auth.submit")

                if mode == .login {
                    Button(action: passkey) {
                        Text("用通行密鑰登入")
                    }
                    .buttonStyle(CinnabarButtonStyle(prominent: false))
                    .disabled(model.isWorking)
                    .accessibilityIdentifier("auth.passkey")
                }

                Button {
                    showServer = true
                } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("伺服器")
                            .font(.footnote.weight(.semibold))
                        Text(model.baseURLText)
                            .font(.footnote)
                            .foregroundStyle(palette.muted)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.plain)
            }
            .padding(24)
        }
        .scrollDismissesKeyboard(.interactively)
        .sheet(isPresented: $showServer) {
            ServerSheet()
                .environmentObject(model)
                .modifier(PaletteModifier())
        }
    }

    private func labeled<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(palette.muted)
            content()
                .textFieldStyle(.plain)
        }
    }

    private func submit() {
        let email = email
        let password = password
        Task {
            if mode == .login {
                await model.login(email: email, password: password)
            } else {
                await model.register(email: email, password: password)
            }
        }
    }

    private func passkey() {
        let email = email
        Task { await model.loginWithPasskey(email: email) }
    }
}

private struct ServerSheet: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.palette) private var palette
    @Environment(\.dismiss) private var dismiss
    @State private var draft = ""
    @State private var error: String?

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text("匣雲會把檔案送到這個位址。本機預設是 http://127.0.0.1:43123。模擬器上的 127.0.0.1 是模擬器自己，真機請改成電腦的位址。")
                    .font(.subheadline)
                    .foregroundStyle(palette.muted)
                TextField("http://127.0.0.1:43123", text: $draft)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)
                    .padding(12)
                    .background(palette.card, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(palette.line, lineWidth: 1)
                    }
                if let error {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(palette.danger)
                }
                Spacer()
            }
            .padding(20)
            .background(PaperBackground())
            .navigationTitle("伺服器位址")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("儲存") { save() }
                }
            }
        }
        .onAppear { draft = model.baseURLText }
    }

    private func save() {
        Task {
            if let message = await model.updateBaseURL(draft) {
                error = message
            } else {
                dismiss()
            }
        }
    }
}
