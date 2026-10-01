import SwiftUI

struct RootView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.palette) private var palette

    var body: some View {
        ZStack {
            PaperBackground()
            switch model.phase {
            case .launching:
                ProgressView("正在打開匣雲")
                    .tint(palette.cinnabar)
            case .signedOut:
                AuthView()
            case .locked:
                LockView()
            case .library:
                LibraryView()
            }
        }
        .background(WindowReader { window in
            model.setPasskeyAnchor(window)
        })
        .sheet(item: $model.biometricOffer) { kind in
            FaceIDOfferView(kind: kind)
                .environmentObject(model)
                .modifier(PaletteModifier())
        }
        .task {
            guard !model.skipBootstrap else { return }
            await model.bootstrap()
        }
    }
}
