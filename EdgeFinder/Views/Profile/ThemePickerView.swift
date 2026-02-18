import SwiftUI

struct ThemePickerView: View {
    @EnvironmentObject var userVM: UserViewModel
    @Environment(\.theme) var currentTheme
    @Environment(\.dismiss) var dismiss

    private let columns = [GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        NavigationStack {
            ZStack {
                currentTheme.background.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        // Free themes
                        themeGroup(title: "Standard Themes", themes: AppTheme.all.filter { !$0.isPro })

                        // Pro themes
                        proThemeGroup
                    }
                    .padding()
                }
            }
            .navigationTitle("Layout Theme")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(currentTheme.primary)
                }
            }
        }
    }

    // MARK: - Free Themes Group

    private func themeGroup(title: String, themes: [AppTheme]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.headline)
                .foregroundStyle(currentTheme.onSurface)

            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(themes) { theme in
                    ThemeCard(
                        theme: theme,
                        isSelected: userVM.currentUser?.selectedThemeID == theme.id,
                        isLocked: false
                    ) {
                        userVM.setTheme(theme)
                    }
                }
            }
        }
    }

    // MARK: - Pro Themes Group

    private var proThemeGroup: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Pro Themes")
                    .font(.headline)
                    .foregroundStyle(currentTheme.onSurface)
                Image(systemName: "crown.fill")
                    .foregroundStyle(currentTheme.accent)
                    .font(.caption)
            }

            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(AppTheme.all.filter { $0.isPro }) { theme in
                    ThemeCard(
                        theme: theme,
                        isSelected: userVM.currentUser?.selectedThemeID == theme.id,
                        isLocked: !(userVM.currentUser?.isPro ?? false)
                    ) {
                        userVM.setTheme(theme)
                    }
                }
            }

            if !(userVM.currentUser?.isPro ?? false) {
                proUpgradeBanner
            }
        }
    }

    private var proUpgradeBanner: some View {
        HStack {
            Image(systemName: "crown.fill")
                .foregroundStyle(currentTheme.accent)
            VStack(alignment: .leading, spacing: 2) {
                Text("Unlock All Pro Themes")
                    .font(.subheadline.bold())
                    .foregroundStyle(currentTheme.onSurface)
                Text("Upgrade to Pro to customize your EdgeFinder experience")
                    .font(.caption)
                    .foregroundStyle(currentTheme.onSurface.opacity(0.6))
            }
            Spacer()
            Image(systemName: "chevron.right")
                .foregroundStyle(currentTheme.onSurface.opacity(0.3))
        }
        .padding()
        .background(currentTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(currentTheme.accent.opacity(0.3), lineWidth: 1)
        )
    }
}

// MARK: - Theme Card

struct ThemeCard: View {
    let theme: AppTheme
    let isSelected: Bool
    let isLocked: Bool
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            ZStack(alignment: .topTrailing) {
                VStack(spacing: 0) {
                    // Color preview strips
                    HStack(spacing: 0) {
                        theme.primary
                        theme.accent
                        theme.secondary
                    }
                    .frame(height: 40)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .path(in: CGRect(x: 0, y: 0, width: 200, height: 40)))

                    // Background preview
                    ZStack {
                        theme.background
                        VStack(spacing: 4) {
                            theme.surface
                                .frame(height: 8)
                                .clipShape(RoundedRectangle(cornerRadius: 4))
                                .padding(.horizontal, 12)
                            theme.surface
                                .frame(height: 8)
                                .clipShape(RoundedRectangle(cornerRadius: 4))
                                .padding(.horizontal, 20)
                        }
                    }
                    .frame(height: 44)
                }
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(isSelected ? theme.primary : Color.white.opacity(0.1), lineWidth: isSelected ? 2 : 1)
                )

                // Lock icon
                if isLocked {
                    Image(systemName: "lock.fill")
                        .font(.caption2)
                        .foregroundStyle(.white)
                        .padding(4)
                        .background(Color.black.opacity(0.5))
                        .clipShape(Circle())
                        .padding(6)
                }

                // Checkmark
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.caption)
                        .foregroundStyle(theme.primary)
                        .padding(6)
                }
            }

            Text(theme.name)
                .font(.caption.bold())
                .foregroundStyle(isSelected ? theme.primary : Color.white.opacity(0.7))
                .padding(.top, 4)
        }
        .buttonStyle(.plain)
        .opacity(isLocked ? 0.6 : 1)
    }
}
