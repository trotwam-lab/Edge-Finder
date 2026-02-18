# EdgeFinder iOS

Native iOS app for [EdgeFinder](https://edgefinder-betting.vercel.app/) — a sports betting edge-finding platform.

## Features

| Feature | Details |
|---------|---------|
| **Lock Screen Live Activities** | Real-time bet scores displayed on the iOS lock screen and Dynamic Island via ActivityKit |
| **Push Notifications** | APNs-backed alerts for game start, live score updates, bet settlement, and +EV edge alerts |
| **Bet Tracker** | Add, track, and settle bets with live score integration and automatic Live Activity updates |
| **Odds & Edges** | Browse games across 10 sports, compare sportsbook lines, and see positive EV edges |
| **Pro Theme Picker** | Free users get 2 themes; Pro members unlock 6 additional layout color themes |
| **Dashboard** | Profit/ROI stats, live bet cards, trending sharp picks, and featured games |
| **Notification Service Extension** | Enriches push payloads for rich score notifications |

## Requirements

- **Xcode 15+**
- **iOS 16.2+** (Live Activities + lock screen widgets)
- **Swift 5.9+**
- Apple Developer Program membership (for APNs, Live Activities, App Groups)

## Project Structure

```
Edge-Finder/
├── EdgeFinder/                         # Main app target
│   ├── App/
│   │   ├── EdgeFinderApp.swift         # SwiftUI @main entry point
│   │   └── AppDelegate.swift           # APNs registration + notification delegate
│   ├── Models/
│   │   ├── Bet.swift                   # Bet, BetLeg, LiveScore, BetStatistics
│   │   ├── Game.swift                  # Game, OddsLine, EdgeData, TrendingPick
│   │   ├── User.swift                  # User, SubscriptionTier, NotificationPreferences
│   │   └── Theme.swift                 # AppTheme + Color(hex:) + EnvironmentKey
│   ├── Views/
│   │   ├── ContentView.swift           # Tab container + splash
│   │   ├── BetTracker/
│   │   │   ├── BetTrackerView.swift    # Bet list, stats bar, filters
│   │   │   ├── BetDetailView.swift     # Bet detail + live score + settlement
│   │   │   └── AddBetView.swift        # Add bet form + parlay legs
│   │   ├── Dashboard/
│   │   │   └── DashboardView.swift     # Home screen with live bets, stats, picks
│   │   ├── Odds/
│   │   │   └── OddsView.swift          # Game odds browser + edge view
│   │   ├── Profile/
│   │   │   ├── ProfileView.swift       # User profile + subscription + settings
│   │   │   └── ThemePickerView.swift   # Pro layout color picker
│   │   ├── Settings/
│   │   │   └── NotificationSettingsView.swift
│   │   └── Onboarding/
│   │       └── OnboardingView.swift    # Sign in/up + Pro upgrade sheet
│   ├── ViewModels/
│   │   ├── BetTrackerViewModel.swift   # Bet CRUD, live refresh, stats
│   │   ├── OddsViewModel.swift         # Games, picks, sport filtering
│   │   └── UserViewModel.swift         # Auth, theme, notification prefs
│   ├── Services/
│   │   ├── LiveActivityService.swift   # ActivityKit Live Activity management
│   │   ├── NotificationService.swift   # UNUserNotificationCenter wrapper
│   │   └── APIService.swift            # REST client (auth, games, bets, push tokens)
│   ├── Utilities/
│   │   ├── BetPersistence.swift        # Codable bet/user storage + widget sync
│   │   └── WidgetKitService.swift      # WidgetCenter reload wrapper
│   └── Resources/
│       ├── Info.plist
│       └── EdgeFinder.entitlements
├── EdgeFinderWidget/                   # WidgetKit extension
│   ├── BetLiveActivityWidget.swift     # Live Activity lock screen + Dynamic Island
│   ├── EdgeFinderWidgetBundle.swift    # Widget bundle + BetSummaryWidget
│   ├── Info.plist
│   └── EdgeFinderWidget.entitlements
└── EdgeFinderNotificationService/      # Notification Service Extension
    ├── NotificationService.swift       # Rich push enrichment
    └── Info.plist
```

## Xcode Setup

1. **Open Xcode** and create a new project — or use `File > Add Files` to bring in these source files.
2. **Bundle IDs** — set these in each target's Build Settings:
   - Main app: `com.edgefinder.app`
   - Widget: `com.edgefinder.app.widget`
   - Notification Service: `com.edgefinder.app.notificationservice`
3. **Capabilities** — enable in each target's Signing & Capabilities tab:
   - Main app: Push Notifications, App Groups (`group.com.edgefinder.app`), Associated Domains, In-App Purchases
   - Widget: App Groups (`group.com.edgefinder.app`)
4. **API URL** — update `baseURL` in `APIService.swift` to your EdgeFinder backend.
5. **Minimum deployment target**: iOS 16.2

## Architecture

- **SwiftUI** throughout, with `@EnvironmentObject` for dependency injection.
- **MVVM** — ViewModels are `@MainActor ObservableObject` classes.
- **ActivityKit** (`BetLiveActivityAttributes`) drives the lock screen Live Activity.
- **WidgetKit** provides home screen + lock screen accessory widgets.
- **App Groups** allow the widget and main app to share bet data via `UserDefaults(suiteName:)`.
- Themes are propagated via a custom `EnvironmentKey`, so every view reads the active `AppTheme` automatically.

## Push Notification Payload Examples

### Live Score Update
```json
{
  "aps": { "mutable-content": 1, "alert": { "title": "Score Update" } },
  "type": "scoreUpdate",
  "betID": "...",
  "betTitle": "Chiefs -3.5",
  "homeScore": 24,
  "awayScore": 21,
  "period": "Q4",
  "clock": "2:31"
}
```

### Edge Alert
```json
{
  "aps": { "alert": { "title": "Edge Found" }, "sound": "default" },
  "type": "edgeAlert",
  "selection": "Chiefs -3.5",
  "odds": "-110",
  "edgePercent": 4.2,
  "expectedValue": 3.82,
  "sport": "NFL"
}
```

### Live Activity Update (server push)
```json
{
  "aps": {
    "timestamp": 1708200000,
    "event": "update",
    "content-state": {
      "homeScore": 24,
      "awayScore": 21,
      "period": "Q4",
      "clock": "1:45",
      "betStatus": "live",
      "isHalftime": false,
      "isFinal": false,
      "potentialPayout": 90.91,
      "currentProfit": null
    }
  }
}
```
