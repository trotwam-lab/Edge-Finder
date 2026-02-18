import SwiftUI

struct NotificationSettingsView: View {
    @EnvironmentObject var userVM: UserViewModel
    @Environment(\.theme) var theme
    @Environment(\.dismiss) var dismiss

    @State private var prefs: NotificationPreferences = .defaultPreferences

    var body: some View {
        NavigationStack {
            ZStack {
                theme.background.ignoresSafeArea()

                List {
                    Section {
                        HStack {
                            Image(systemName: "bell.badge.fill")
                                .foregroundStyle(theme.primary)
                                .font(.title2)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Push Notifications")
                                    .font(.headline)
                                    .foregroundStyle(theme.onSurface)
                                Text("Stay updated on your bets and sharp edges")
                                    .font(.caption)
                                    .foregroundStyle(theme.onSurface.opacity(0.5))
                            }
                        }
                        .padding(.vertical, 4)
                    }
                    .listRowBackground(theme.surface)

                    // Bet Tracker
                    Section("Bet Tracker") {
                        toggleRow(
                            icon: "list.bullet.clipboard.fill",
                            title: "Bet Tracker Alerts",
                            subtitle: "Game start, settlement, and status changes",
                            isOn: $prefs.betTracker
                        )
                        toggleRow(
                            icon: "dot.radiowaves.left.and.right",
                            title: "Live Score Updates",
                            subtitle: "Score updates for your active bets",
                            isOn: $prefs.liveScoreUpdates
                        )
                        toggleRow(
                            icon: "clock.fill",
                            title: "Game Start Reminders",
                            subtitle: "15 minutes before your bet's game",
                            isOn: $prefs.gameStart
                        )
                    }
                    .listRowBackground(theme.surface)

                    // Edge Alerts
                    Section("Edge Alerts") {
                        toggleRow(
                            icon: "bolt.fill",
                            title: "Positive EV Edges",
                            subtitle: "Alerts when new sharp edges are detected",
                            isOn: $prefs.edgeAlerts
                        )
                        toggleRow(
                            icon: "chart.line.uptrend.xyaxis",
                            title: "Line Movement",
                            subtitle: "Significant line moves across sportsbooks",
                            isOn: $prefs.lineMovement
                        )
                        toggleRow(
                            icon: "tag.fill",
                            title: "Odds Boosts",
                            subtitle: "Promotions from your connected sportsbooks",
                            isOn: $prefs.oddsBoosts
                        )
                    }
                    .listRowBackground(theme.surface)

                    Section {
                        Button {
                            // Open iOS notification settings
                            if let url = URL(string: UIApplication.openNotificationSettingsURLString) {
                                UIApplication.shared.open(url)
                            }
                        } label: {
                            HStack {
                                Image(systemName: "gear")
                                    .foregroundStyle(theme.primary)
                                    .frame(width: 28)
                                Text("iOS Notification Settings")
                                    .foregroundStyle(theme.onSurface)
                                Spacer()
                                Image(systemName: "arrow.up.right")
                                    .font(.caption)
                                    .foregroundStyle(theme.onSurface.opacity(0.3))
                            }
                        }
                    }
                    .listRowBackground(theme.surface)
                }
                .scrollContentBackground(.hidden)
                .background(theme.background)
            }
            .navigationTitle("Notifications")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(theme.onSurface.opacity(0.6))
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        userVM.updateNotificationPreferences(prefs)
                        dismiss()
                    }
                    .foregroundStyle(theme.primary)
                    .fontWeight(.semibold)
                }
            }
            .onAppear {
                prefs = userVM.currentUser?.notificationPreferences ?? .defaultPreferences
            }
        }
    }

    private func toggleRow(icon: String, title: String, subtitle: String, isOn: Binding<Bool>) -> some View {
        HStack {
            Image(systemName: icon)
                .foregroundStyle(isOn.wrappedValue ? theme.primary : theme.onSurface.opacity(0.3))
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline)
                    .foregroundStyle(theme.onSurface)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(theme.onSurface.opacity(0.5))
            }
            Spacer()
            Toggle("", isOn: isOn)
                .tint(theme.primary)
                .labelsHidden()
        }
    }
}
