import SwiftUI

struct Palette: Equatable {
    var paper: Color
    var card: Color
    var ink: Color
    var cinnabar: Color
    var muted: Color
    var line: Color
    var danger: Color

    static let light = Palette(
        paper: Color(red: 0.965, green: 0.945, blue: 0.910),
        card: Color(red: 0.995, green: 0.988, blue: 0.972),
        ink: Color(red: 0.28, green: 0.18, blue: 0.14),
        cinnabar: Color(red: 0.55, green: 0.27, blue: 0.18),
        muted: Color(red: 0.45, green: 0.36, blue: 0.30),
        line: Color(red: 0.86, green: 0.80, blue: 0.72),
        danger: Color(red: 0.62, green: 0.22, blue: 0.16)
    )

    static let dark = Palette(
        paper: Color(red: 0.14, green: 0.11, blue: 0.10),
        card: Color(red: 0.22, green: 0.17, blue: 0.15),
        ink: Color(red: 0.96, green: 0.93, blue: 0.89),
        cinnabar: Color(red: 0.86, green: 0.58, blue: 0.46),
        muted: Color(red: 0.73, green: 0.65, blue: 0.58),
        line: Color(red: 0.36, green: 0.29, blue: 0.25),
        danger: Color(red: 0.93, green: 0.55, blue: 0.48)
    )
}

private struct PaletteKey: EnvironmentKey {
    static let defaultValue = Palette.light
}

extension EnvironmentValues {
    var palette: Palette {
        get { self[PaletteKey.self] }
        set { self[PaletteKey.self] = newValue }
    }
}

struct PaletteModifier: ViewModifier {
    @Environment(\.colorScheme) private var scheme

    func body(content: Content) -> some View {
        let palette = scheme == .dark ? Palette.dark : Palette.light
        content
            .environment(\.palette, palette)
            .tint(palette.cinnabar)
            .foregroundStyle(palette.ink)
    }
}

struct CinnabarButtonStyle: ButtonStyle {
    @Environment(\.palette) private var palette
    var prominent = true

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.semibold))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .foregroundStyle(prominent ? Color(red: 0.99, green: 0.97, blue: 0.94) : palette.ink)
            .background {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(prominent ? palette.cinnabar.opacity(configuration.isPressed ? 0.82 : 1) : palette.card)
            }
            .overlay {
                if !prominent {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(palette.line, lineWidth: 1)
                }
            }
    }
}

struct PaperBackground: View {
    @Environment(\.palette) private var palette
    var body: some View { palette.paper.ignoresSafeArea() }
}
