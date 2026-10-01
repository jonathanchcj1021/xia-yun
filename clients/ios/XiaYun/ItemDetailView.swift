import SwiftUI
import UIKit

struct ItemDetailView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.palette) private var palette
    @Environment(\.dismiss) private var dismiss

    let itemID: String

    @State private var item: CloudItem?
    @State private var preview: UIImage?
    @State private var error: String?
    @State private var loading = true
    @State private var confirmDelete = false
    @State private var shareURL: SharePayload?
    @State private var working = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if loading && item == nil {
                    HStack {
                        Spacer()
                        ProgressView("正在讀取")
                        Spacer()
                    }
                    .padding(.top, 40)
                } else if let error, item == nil {
                    Text(error)
                        .foregroundStyle(palette.danger)
                    Button("再試一次") { Task { await load() } }
                        .buttonStyle(CinnabarButtonStyle())
                } else if let item {
                    content(for: item)
                }
            }
            .padding(20)
        }
        .background(PaperBackground())
        .navigationTitle(item?.name ?? "項目")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if item != nil {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("下載") { Task { await download() } }
                        .disabled(working)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("刪除", role: .destructive) { confirmDelete = true }
                        .disabled(working)
                }
            }
        }
        .confirmationDialog(
            "刪除「\(item?.name ?? "這個項目")」？",
            isPresented: $confirmDelete,
            titleVisibility: .visible
        ) {
            Button("刪除", role: .destructive) { Task { await remove() } }
            Button("取消", role: .cancel) {}
        } message: {
            Text("這個項目會從你的匣雲刪除，無法復原。")
        }
        .sheet(item: $shareURL) { payload in
            ShareSheet(url: payload.url)
        }
        .task(id: itemID) { await load() }
    }

    @ViewBuilder
    private func content(for item: CloudItem) -> some View {
        Text("\(item.type.displayName) · \(ByteFormat.string(for: item.size)) · \(ItemDate.label(item.createdAt))")
            .font(.subheadline)
            .foregroundStyle(palette.muted)
        if let mime = item.mimeType, item.type != .text {
            Text(mime)
                .font(.caption)
                .foregroundStyle(palette.muted)
        }
        if let error {
            Text(error)
                .font(.footnote)
                .foregroundStyle(palette.danger)
        }
        switch item.type {
        case .image:
            if let preview {
                Image(uiImage: preview)
                    .resizable()
                    .scaledToFit()
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .accessibilityLabel(item.name)
            } else if !loading {
                Text("無法預覽這張圖片，仍可下載原檔。")
                    .font(.subheadline)
                    .foregroundStyle(palette.muted)
            }
        case .text:
            Text(item.body ?? "")
                .font(.body)
                .foregroundStyle(palette.ink)
                .frame(maxWidth: .infinity, alignment: .leading)
                .textSelection(.enabled)
                .padding(16)
                .background(palette.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        case .file:
            Label("這個檔案沒有內嵌預覽。", systemImage: "doc")
                .font(.subheadline)
                .foregroundStyle(palette.muted)
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(palette.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        if working {
            ProgressView()
        }
    }

    private func load() async {
        loading = true
        error = nil
        preview = nil
        defer { loading = false }
        if item == nil {
            item = model.items.first { $0.id == itemID }
        }
        do {
            let fresh = try await model.item(id: itemID)
            item = fresh
            if fresh.type == .image {
                let data = try await model.content(id: itemID, attachment: false)
                if let image = UIImage(data: data) {
                    preview = image
                } else {
                    error = "無法預覽這張圖片，仍可下載原檔。"
                }
            }
        } catch {
            if item == nil {
                self.error = (error as? APIError)?.message ?? "無法讀取這個項目。"
            } else {
                self.error = (error as? APIError)?.message ?? "無法更新這個項目。"
            }
        }
    }

    private func download() async {
        guard let item else { return }
        working = true
        defer { working = false }
        do {
            let data = try await model.content(id: item.id, attachment: true)
            let url = try ExportFile.write(data: data, suggestedName: item.exportName)
            shareURL = SharePayload(url: url)
        } catch {
            self.error = (error as? APIError)?.message ?? "無法下載。"
        }
    }

    private func remove() async {
        working = true
        defer { working = false }
        do {
            try await model.delete(id: itemID)
            dismiss()
        } catch {
            self.error = (error as? APIError)?.message ?? "無法刪除。"
        }
    }
}

struct SharePayload: Identifiable {
    let id = UUID()
    let url: URL
}
