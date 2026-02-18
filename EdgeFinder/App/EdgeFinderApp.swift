import SwiftUI
import UserNotifications

@main
struct EdgeFinderApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var userViewModel = UserViewModel()
    @StateObject private var betTrackerViewModel = BetTrackerViewModel()
    @StateObject private var notificationService = NotificationService.shared
    @StateObject private var liveActivityService = LiveActivityService.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(userViewModel)
                .environmentObject(betTrackerViewModel)
                .environmentObject(notificationService)
                .environmentObject(liveActivityService)
                .environment(\.theme, AppTheme.theme(for: userViewModel.currentUser?.selectedThemeID ?? AppTheme.defaultThemeID))
                .preferredColorScheme(.dark)
                .onAppear {
                    notificationService.requestPermission()
                }
        }
    }
}
