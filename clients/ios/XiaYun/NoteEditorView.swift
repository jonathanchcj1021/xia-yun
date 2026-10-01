import SwiftUI

struct NoteEditorView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.palette) private var palette
    @Environment(\.dismiss) private var dismiss

    @State private var title = ""
    @State private var bodyText = ""
    @State private var error: String?
    @State private var saving = false

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 14) {
                TextField("標題", text: $title)
                    .font(.title3.weight(.semibold))
                    .padding(12)
                    .background(palette.card, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                Text("標題 1–200 字。內文可以留空，最多 10 萬字。")
                    .font(.caption)
                    .foregroundStyle(palette.muted)
                TextEditor(text: $bodyText)
                    .scrollContentBackground(.hidden)
                    .padding(8)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(palette.card, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                if let error {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(palette.danger)
                }
            }
            .padding(20)
            .background(PaperBackground())
            .navigationTitle("新筆記")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { dismiss() }
                        .disabled(saving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(saving ? "儲存中…" : "儲存") { Task { await save() } }
                        .disabled(saving || title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }

    private func save() async {
        saving = true
        defer { saving = false }
        do {
            try await model.createNote(title: title, body: bodyText)
            dismiss()
        } catch {
            self.error = (error as? APIError)?.message ?? "無法儲存筆記。"
        }
    }
}
