import SwiftUI

// MARK: - App Theme

struct AppTheme: Identifiable, Codable, Equatable {
    var id: String
    var name: String
    var isPro: Bool

    // Stored as hex strings for Codable conformance
    var primaryHex: String
    var secondaryHex: String
    var accentHex: String
    var backgroundHex: String
    var surfaceHex: String
    var onSurfaceHex: String

    // MARK: - Color Accessors

    var primary: Color    { Color(hex: primaryHex) }
    var secondary: Color  { Color(hex: secondaryHex) }
    var accent: Color     { Color(hex: accentHex) }
    var background: Color { Color(hex: backgroundHex) }
    var surface: Color    { Color(hex: surfaceHex) }
    var onSurface: Color  { Color(hex: onSurfaceHex) }

    // MARK: - Predefined Themes

    static let defaultThemeID = "dark-green"

    static let all: [AppTheme] = [
        // Free themes
        AppTheme(
            id: "dark-green",
            name: "Sharp Green",
            isPro: false,
            primaryHex: "#00C853",
            secondaryHex: "#1B5E20",
            accentHex: "#69F0AE",
            backgroundHex: "#0A0A0A",
            surfaceHex: "#151515",
            onSurfaceHex: "#F5F5F5"
        ),
        AppTheme(
            id: "dark-default",
            name: "Midnight",
            isPro: false,
            primaryHex: "#5C6BC0",
            secondaryHex: "#1A237E",
            accentHex: "#7986CB",
            backgroundHex: "#0D0D0D",
            surfaceHex: "#1A1A1A",
            onSurfaceHex: "#EEEEEE"
        ),
        // Pro themes
        AppTheme(
            id: "pro-gold",
            name: "Vegas Gold",
            isPro: true,
            primaryHex: "#FFD700",
            secondaryHex: "#B8860B",
            accentHex: "#FFF176",
            backgroundHex: "#0A0800",
            surfaceHex: "#1A1500",
            onSurfaceHex: "#FFF9C4"
        ),
        AppTheme(
            id: "pro-red",
            name: "Crimson Edge",
            isPro: true,
            primaryHex: "#EF5350",
            secondaryHex: "#B71C1C",
            accentHex: "#FF8A80",
            backgroundHex: "#0D0000",
            surfaceHex: "#1A0000",
            onSurfaceHex: "#FFCDD2"
        ),
        AppTheme(
            id: "pro-cyan",
            name: "Ice Sharp",
            isPro: true,
            primaryHex: "#00BCD4",
            secondaryHex: "#006064",
            accentHex: "#80DEEA",
            backgroundHex: "#000A0D",
            surfaceHex: "#00131A",
            onSurfaceHex: "#E0F7FA"
        ),
        AppTheme(
            id: "pro-purple",
            name: "Royal Flush",
            isPro: true,
            primaryHex: "#AB47BC",
            secondaryHex: "#4A148C",
            accentHex: "#CE93D8",
            backgroundHex: "#08000D",
            surfaceHex: "#130018",
            onSurfaceHex: "#F3E5F5"
        ),
        AppTheme(
            id: "pro-orange",
            name: "Blaze",
            isPro: true,
            primaryHex: "#FF6D00",
            secondaryHex: "#E65100",
            accentHex: "#FFAB40",
            backgroundHex: "#0D0400",
            surfaceHex: "#1A0800",
            onSurfaceHex: "#FFF3E0"
        ),
        AppTheme(
            id: "pro-white",
            name: "Clean Slate",
            isPro: true,
            primaryHex: "#212121",
            secondaryHex: "#616161",
            accentHex: "#9E9E9E",
            backgroundHex: "#FAFAFA",
            surfaceHex: "#FFFFFF",
            onSurfaceHex: "#212121"
        )
    ]

    static func theme(for id: String) -> AppTheme {
        all.first { $0.id == id } ?? all[0]
    }
}

// MARK: - Color Hex Init

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - Theme Environment Key

struct ThemeKey: EnvironmentKey {
    static let defaultValue: AppTheme = AppTheme.all[0]
}

extension EnvironmentValues {
    var theme: AppTheme {
        get { self[ThemeKey.self] }
        set { self[ThemeKey.self] = newValue }
    }
}
