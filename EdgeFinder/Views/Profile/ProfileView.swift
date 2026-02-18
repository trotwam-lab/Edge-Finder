import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var userVM: UserViewModel
    @EnvironmentObject var betVM: BetTrackerViewModel
    @Environment(\.theme) var theme
    @State private var showThemePicker = false
    @State private var showNotificationSettings = false
    @State private var showProUpgrade = false

    var body: some View {
        NavigationStack {
            ZStack {
                theme.background.ignoresSafeArea()

                List {
                    // Profile header
                    profileHeader
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets())

                    // Stats summary
                    statsSummarySection

                    // Appearance (Pro)
                    appearanceSection

                    // Notifications
                    notificationsSection

                    // Account
                    accountSection
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
                .background(theme.background)
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.large)
            .sheet(isPresented: $showThemePicker) {
                ThemePickerView()
                    .environmentObject(userVM)
                    .environment(\.theme, theme)
            }
            .sheet(isPresented: $showNotificationSettings) {
                NotificationSettingsView()
                    .environmentObject(userVM)
                    .environment(\.theme, theme)
            }
            .sheet(isPresented: $showProUpgrade) {
                ProUpgradeView()
                    .environmentObject(userVM)
                    .environment(\.theme, theme)
            }
        }
    }

    // MARK: - Profile Header

    private var profileHeader: some View {
        VStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(LinearGradient(colors: [theme.primary, theme.secondary], startPoint: .topLeading, endPoint: .bottomTrailing))
                    .frame(width: 80, height: 80)
                Text(userVM.currentUser?.displayName.prefix(1).uppercased() ?? "U")
                    .font(.system(size: 34, weight: .bold))
                    .foregroundStyle(.white)
            }

            VStack(spacing: 4) {
                Text(userVM.currentUser?.displayName ?? "Bettor")
                    .font(.title2.bold())
                    .foregroundStyle(theme.onSurface)
                Text(userVM.currentUser?.email ?? "")
                    .font(.subheadline)
                    .foregroundStyle(theme.onSurface.opacity(0.5))
                subscriptionBadge
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
    }

    private var subscriptionBadge: some View {
        HStack(spacing: 4) {
            Image(systemName: userVM.currentUser?.isPro == true ? "crown.fill" : "person.fill")
                .font(.caption)
            Text(userVM.currentUser?.subscriptionTier.displayName ?? "Free")
                .font(.caption.bold())
        }
        .foregroundStyle(userVM.currentUser?.isPro == true ? .black : theme.onSurface.opacity(0.6))
        .padding(.horizontal, 12)
        .padding(.vertical, 5)
        .background(userVM.currentUser?.isPro == true ? theme.accent : theme.surface)
        .clipShape(Capsule())
    }

    // MARK: - Stats Summary

    private var statsSummarySection: some View {
        Section {
            HStack {
                miniStat(label: "Bets", value: "\(betVM.statistics.totalBets)")
                Divider().frame(height: 30)
                miniStat(label: "Won", value: "\(betVM.statistics.wins)", color: theme.primary)
                Divider().frame(height: 30)
                miniStat(label: "ROI", value: betVM.statistics.formattedROI,
                         color: betVM.statistics.roi >= 0 ? theme.primary : .red)
                Divider().frame(height: 30)
                miniStat(label: "Profit",
                         value: String(format: "%@$%.0f",
                                       betVM.statistics.totalProfit >= 0 ? "+" : "",
                                       betVM.statistics.totalProfit),
                         color: betVM.statistics.totalProfit >= 0 ? theme.primary : .red)
            }
            .padding(.vertical, 4)
        }
        .listRowBackground(theme.surface)
    }

    private func miniStat(label: String, value: String, color: Color? = nil) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.subheadline.bold())
                .foregroundStyle(color ?? theme.onSurface)
            Text(label)
                .font(.caption2)
                .foregroundStyle(theme.onSurface.opacity(0.5))
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Appearance

    private var appearanceSection: some View {
        Section("Appearance") {
            Button {
                if userVM.currentUser?.isPro == true {
                    showThemePicker = true
                } else {
                    showProUpgrade = true
                }
            } label: {
                HStack {
                    Image(systemName: "paintpalette.fill")
                        .foregroundStyle(theme.primary)
                        .frame(width: 28)
                    Text("Layout Color Theme")
                        .foregroundStyle(theme.onSurface)
                    Spacer()
                    if userVM.currentUser?.isPro == false {
                        Text("PRO")
                            .font(.caption2.bold())
                            .foregroundStyle(.black)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(theme.accent)
                            .clipShape(Capsule())
                    } else {
                        Circle()
                            .fill(theme.primary)
                            .frame(width: 16, height: 16)
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundStyle(theme.onSurface.opacity(0.3))
                    }
                }
            }
        }
        .listRowBackground(theme.surface)
    }

    // MARK: - Notifications

    private var notificationsSection: some View {
        Section("Notifications") {
            Button {
                showNotificationSettings = true
            } label: {
                HStack {
                    Image(systemName: "bell.badge.fill")
                        .foregroundStyle(theme.primary)
                        .frame(width: 28)
                    Text("Notification Settings")
                        .foregroundStyle(theme.onSurface)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundStyle(theme.onSurface.opacity(0.3))
                }
            }
        }
        .listRowBackground(theme.surface)
    }

    // MARK: - Account

    private var accountSection: some View {
        Section("Account") {
            if userVM.currentUser?.isPro == false {
                Button {
                    showProUpgrade = true
                } label: {
                    HStack {
                        Image(systemName: "crown.fill")
                            .foregroundStyle(theme.accent)
                            .frame(width: 28)
                        Text("Upgrade to Pro")
                            .foregroundStyle(theme.onSurface)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundStyle(theme.onSurface.opacity(0.3))
                    }
                }
            }

            Button(role: .destructive) {
                userVM.signOut()
            } label: {
                HStack {
                    Image(systemName: "rectangle.portrait.and.arrow.right")
                        .foregroundStyle(.red)
                        .frame(width: 28)
                    Text("Sign Out")
                        .foregroundStyle(.red)
                }
            }
        }
        .listRowBackground(theme.surface)
    }
}
