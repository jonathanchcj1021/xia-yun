import SwiftUI
import UIKit

struct Mark: View {
    @Environment(\.palette) private var palette

    var body: some View {
        GeometryReader { geo in
            let width = geo.size.width
            let height = geo.size.height
            Canvas { context, _ in
                let rect = CGRect(x: width * 0.12, y: height * 0.22, width: width * 0.76, height: height * 0.56)
                let box = Path(roundedRect: rect, cornerRadius: width * 0.08)
                let lineWidth = max(1.5, width * 0.055)
                context.stroke(box, with: .color(palette.cinnabar), lineWidth: lineWidth)
                var lid = Path()
                let lidY = rect.minY + rect.height * 0.34
                lid.move(to: CGPoint(x: rect.minX, y: lidY))
                lid.addLine(to: CGPoint(x: rect.maxX, y: lidY))
                context.stroke(lid, with: .color(palette.cinnabar), lineWidth: lineWidth)
                var clasp = Path()
                let claspX = rect.minX + rect.width * 0.28
                clasp.move(to: CGPoint(x: claspX, y: rect.minY))
                clasp.addLine(to: CGPoint(x: claspX, y: lidY))
                context.stroke(clasp, with: .color(palette.cinnabar), lineWidth: lineWidth)
            }
        }
        .accessibilityHidden(true)
    }
}

struct ItemRow: View {
    @Environment(\.palette) private var palette
    var item: CloudItem

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: symbol)
                .font(.body.weight(.semibold))
                .foregroundStyle(palette.cinnabar)
                .frame(width: 40, height: 40)
                .background(palette.cinnabar.opacity(0.12), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            VStack(alignment: .leading, spacing: 4) {
                Text(item.name)
                    .font(.body.weight(.medium))
                    .foregroundStyle(palette.ink)
                    .lineLimit(1)
                Text(meta)
                    .font(.caption)
                    .foregroundStyle(palette.muted)
                if let excerpt = item.excerpt, !excerpt.isEmpty {
                    Text(excerpt)
                        .font(.caption)
                        .foregroundStyle(palette.muted)
                        .lineLimit(2)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }

    private var symbol: String {
        switch item.type {
        case .file: return "doc"
        case .image: return "photo"
        case .text: return "note.text"
        }
    }

    private var meta: String {
        "\(item.type.displayName) · \(ByteFormat.string(for: item.size)) · \(ItemDate.label(item.createdAt))"
    }
}

enum ItemDate {
    static func label(_ date: Date, now: Date = Date()) -> String {
        let age = now.timeIntervalSince(date)
        if age >= 0 && age < 7 * 24 * 60 * 60 {
            return date.formatted(
                Date.RelativeFormatStyle(
                    presentation: .named,
                    unitsStyle: .wide,
                    locale: Locale(identifier: "zh-Hant")
                )
            )
        }
        return date.formatted(
            Date.FormatStyle()
                .locale(Locale(identifier: "zh-Hant"))
                .year().month().day()
        )
    }
}

struct NoticeBanner: View {
    @Environment(\.palette) private var palette
    var text: String
    var onDismiss: () -> Void

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(text)
                .font(.footnote)
                .foregroundStyle(palette.ink)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button("關閉", action: onDismiss)
                .font(.footnote.weight(.semibold))
        }
        .padding(12)
        .background(palette.card, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(palette.line, lineWidth: 1)
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }
}

struct ShareSheet: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        if let popover = controller.popoverPresentationController {
            let window = UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap(\.windows)
                .first { $0.isKeyWindow }
            popover.sourceView = window
            popover.sourceRect = CGRect(
                x: window?.bounds.midX ?? 0,
                y: window?.bounds.midY ?? 0,
                width: 1,
                height: 1
            )
            popover.permittedArrowDirections = []
        }
        return controller
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

struct WindowReader: UIViewRepresentable {
    var onWindow: (UIWindow) -> Void

    func makeUIView(context: Context) -> UIView {
        let view = UIView(frame: .zero)
        view.isUserInteractionEnabled = false
        DispatchQueue.main.async { [weak view] in
            if let window = view?.window { onWindow(window) }
        }
        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        DispatchQueue.main.async { [weak uiView] in
            if let window = uiView?.window { onWindow(window) }
        }
    }
}

enum ExportFile {
    static func write(data: Data, suggestedName: String) throws -> URL {
        let folder = FileManager.default.temporaryDirectory
            .appendingPathComponent("xiayun-exports", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let url = folder.appendingPathComponent(sanitize(suggestedName))
        try data.write(to: url, options: .atomic)
        return url
    }

    static func sanitize(_ name: String) -> String {
        let base = name.split(whereSeparator: { $0 == "/" || $0 == "\\" }).last.map(String.init) ?? "download"
        let cleaned = base.replacingOccurrences(of: "\u{0}", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let limited = String(cleaned.prefix(200))
        return limited.isEmpty ? "download" : limited
    }
}
