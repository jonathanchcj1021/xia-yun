import PhotosUI
import SwiftUI
import UIKit
import UniformTypeIdentifiers

struct LibraryView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.palette) private var palette

    @State private var showAdd = false
    @State private var showImporter = false
    @State private var showNote = false
    @State private var showSettings = false
    @State private var photo: PhotosPickerItem?

    var body: some View {
        NavigationSplitView {
            list
                .navigationTitle("匣雲")
                .navigationBarTitleDisplayMode(.large)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button {
                            showSettings = true
                        } label: {
                            Image(systemName: "gearshape")
                        }
                        .accessibilityLabel("設定")
                    }
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            showAdd = true
                        } label: {
                            Image(systemName: "plus")
                        }
                        .accessibilityLabel("加入")
                    }
                }
        } detail: {
            if let selected = model.selectedItemID {
                ItemDetailView(itemID: selected)
            } else {
                ContentUnavailableView(
                    "選一個項目",
                    systemImage: "archivebox",
                    description: Text("或上傳檔案、圖片，寫一則筆記。")
                )
            }
        }
        .sheet(isPresented: $showAdd) { addSheet }
        .sheet(isPresented: $showNote) {
            NoteEditorView()
                .environmentObject(model)
                .modifier(PaletteModifier())
        }
        .sheet(isPresented: $showSettings) {
            SettingsView()
                .environmentObject(model)
                .modifier(PaletteModifier())
        }
        .fileImporter(isPresented: $showImporter, allowedContentTypes: [.item], allowsMultipleSelection: false) { result in
            switch result {
            case .success(let urls):
                guard let url = urls.first else { return }
                Task { await model.importFile(at: url) }
            case .failure:
                model.notice = "無法讀取選擇的檔案。"
            }
        }
        .onChange(of: photo) { _, item in
            guard let item else { return }
            Task { await uploadPhoto(item) }
        }
        .overlay {
            if model.isWorking {
                ProgressView(model.workingTitle)
                    .padding(18)
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
        }
    }

    private var list: some View {
        List(selection: $model.selectedItemID) {
            if let notice = model.notice {
                NoticeBanner(text: notice) { model.dismissNotice() }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
            }
            if model.isLoadingLibrary && model.items.isEmpty {
                HStack {
                    Spacer()
                    ProgressView("正在讀取項目")
                    Spacer()
                }
                .listRowBackground(Color.clear)
            } else if let libraryError = model.libraryError, model.items.isEmpty {
                VStack(alignment: .leading, spacing: 12) {
                    Text(libraryError)
                        .foregroundStyle(palette.danger)
                    Button("再試一次") { Task { await model.refreshItems() } }
                        .buttonStyle(CinnabarButtonStyle())
                }
                .padding(.vertical, 12)
                .listRowBackground(Color.clear)
            } else if model.items.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("匣裡還是空的")
                        .font(.headline)
                    Text("上傳檔案、圖片，或寫一則筆記。它們只會留在這個帳號。")
                        .font(.subheadline)
                        .foregroundStyle(palette.muted)
                }
                .padding(.vertical, 12)
                .listRowBackground(Color.clear)
            } else {
                ForEach(model.items) { item in
                    NavigationLink(value: item.id) {
                        ItemRow(item: item)
                    }
                    .listRowBackground(palette.card)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(PaperBackground())
        .refreshable { await model.refreshItems() }
    }

    private var addSheet: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                Text("單檔上限 32 MB。點陣圖會存成圖片，其餘存成檔案。")
                    .font(.subheadline)
                    .foregroundStyle(palette.muted)
                Button {
                    showAdd = false
                    showImporter = true
                } label: {
                    Label("上傳檔案", systemImage: "doc")
                }
                .buttonStyle(CinnabarButtonStyle(prominent: false))
                PhotosPicker(selection: $photo, matching: .images) {
                    Label("從照片加入", systemImage: "photo")
                        .font(.body.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .foregroundStyle(palette.ink)
                        .background(palette.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .stroke(palette.line, lineWidth: 1)
                        }
                }
                Button {
                    showAdd = false
                    showNote = true
                } label: {
                    Label("寫一則筆記", systemImage: "square.and.pencil")
                }
                .buttonStyle(CinnabarButtonStyle(prominent: false))
                Spacer()
            }
            .padding(20)
            .background(PaperBackground())
            .navigationTitle("加入")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("關閉") { showAdd = false }
                }
            }
        }
        .presentationDetents([.medium])
    }

    private func uploadPhoto(_ item: PhotosPickerItem) async {
        defer { photo = nil }
        showAdd = false
        do {
            guard let data = try await item.loadTransferable(type: Data.self) else {
                model.notice = "無法讀取這張照片。"
                return
            }
            let mime = item.supportedContentTypes.first?.preferredMIMEType ?? "image/jpeg"
            if RasterMime.isRaster(mime) {
                await model.upload(
                    data: data,
                    filename: photoName(for: mime),
                    mimeType: mime,
                    type: .image
                )
                return
            }
            if let image = UIImage(data: data), let jpeg = image.jpegData(compressionQuality: 0.9) {
                await model.upload(data: jpeg, filename: "照片.jpg", mimeType: "image/jpeg", type: .image)
                return
            }
            await model.upload(data: data, filename: "照片", mimeType: mime, type: .file)
        } catch {
            model.notice = "無法讀取這張照片。"
        }
    }

    private func photoName(for mime: String) -> String {
        switch RasterMime.normalized(mime) {
        case "image/jpeg": return "照片.jpg"
        case "image/png": return "照片.png"
        case "image/gif": return "照片.gif"
        case "image/webp": return "照片.webp"
        case "image/avif": return "照片.avif"
        case "image/bmp": return "照片.bmp"
        default: return "照片"
        }
    }
}
