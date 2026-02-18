import SwiftUI

struct ContentView: View {
    @EnvironmentObject var userViewModel: UserViewModel
    @EnvironmentObject var betTrackerViewModel: BetTrackerViewModel
    @Environment(\.theme) var theme
    @State private var selectedTab: Tab = .dashboard

    enum Tab: Int, CaseIterable {
        case dashboard = 0
        case odds      = 1
        case tracker   = 2
        case profile   = 3

        var title: String {
            switch self {
            case .dashboard: return "Dashboard"
            case .odds:      return "Odds"
            case .tracker:   return "Tracker"
            case .profile:   return "Profile"
            }
        }

        var icon: String {
            switch self {
            case .dashboard: return "chart.bar.fill"
            case .odds:      return "percent"
            case .tracker:   return "list.bullet.clipboard.fill"
            case .profile:   return "person.crop.circle.fill"
            }
        }
    }

    var body: some View {
        ZStack {
            theme.background.ignoresSafeArea()

            if userViewModel.isLoading {
                SplashView()
            } else if !userViewModel.isLoggedIn {
                OnboardingView()
            } else {
                mainTabView
            }
        }
        .animation(.easeInOut(duration: 0.3), value: userViewModel.isLoggedIn)
    }

    private var mainTabView: some View {
        TabView(selection: $selectedTab) {
            DashboardView()
                .tabItem {
                    Label(Tab.dashboard.title, systemImage: Tab.dashboard.icon)
                }
                .tag(Tab.dashboard)

            OddsView()
                .tabItem {
                    Label(Tab.odds.title, systemImage: Tab.odds.icon)
                }
                .tag(Tab.odds)

            BetTrackerView()
                .tabItem {
                    Label(Tab.tracker.title, systemImage: Tab.tracker.icon)
                }
                .badge(betTrackerViewModel.liveCount)
                .tag(Tab.tracker)

            ProfileView()
                .tabItem {
                    Label(Tab.profile.title, systemImage: Tab.profile.icon)
                }
                .tag(Tab.profile)
        }
        .tint(theme.primary)
        .background(theme.background)
    }
}

// MARK: - Splash View

struct SplashView: View {
    @Environment(\.theme) var theme

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "chart.line.uptrend.xyaxis.circle.fill")
                .resizable()
                .frame(width: 80, height: 80)
                .foregroundStyle(theme.primary)

            Text("EdgeFinder")
                .font(.system(size: 32, weight: .bold, design: .rounded))
                .foregroundStyle(theme.onSurface)

            Text("Find your edge.")
                .font(.subheadline)
                .foregroundStyle(theme.onSurface.opacity(0.6))

            ProgressView()
                .tint(theme.primary)
                .padding(.top, 8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(theme.background)
    }
}
