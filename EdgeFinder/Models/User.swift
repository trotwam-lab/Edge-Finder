import Foundation

// MARK: - Subscription Tier

enum SubscriptionTier: String, Codable {
    case free = "free"
    case pro  = "pro"

    var displayName: String {
        switch self {
        case .free: return "Free"
        case .pro:  return "Pro"
        }
    }

    var isPro: Bool { self == .pro }
}

// MARK: - Notification Preferences

struct NotificationPreferences: Codable, Equatable {
    var betTracker: Bool
    var liveScoreUpdates: Bool
    var gameStart: Bool
    var edgeAlerts: Bool
    var lineMovement: Bool
    var oddsBoosts: Bool

    static var defaultPreferences: NotificationPreferences {
        NotificationPreferences(
            betTracker: true,
            liveScoreUpdates: true,
            gameStart: true,
            edgeAlerts: true,
            lineMovement: false,
            oddsBoosts: true
        )
    }
}

// MARK: - User

struct User: Identifiable, Codable, Equatable {
    var id: UUID
    var username: String
    var email: String
    var displayName: String
    var avatarURL: URL?
    var subscriptionTier: SubscriptionTier
    var subscriptionExpiresAt: Date?
    var notificationPreferences: NotificationPreferences
    var selectedThemeID: String
    var apnsToken: String?
    var joinedAt: Date

    init(
        id: UUID = UUID(),
        username: String,
        email: String,
        displayName: String,
        avatarURL: URL? = nil,
        subscriptionTier: SubscriptionTier = .free,
        subscriptionExpiresAt: Date? = nil,
        notificationPreferences: NotificationPreferences = .defaultPreferences,
        selectedThemeID: String = AppTheme.defaultThemeID,
        apnsToken: String? = nil,
        joinedAt: Date = Date()
    ) {
        self.id = id
        self.username = username
        self.email = email
        self.displayName = displayName
        self.avatarURL = avatarURL
        self.subscriptionTier = subscriptionTier
        self.subscriptionExpiresAt = subscriptionExpiresAt
        self.notificationPreferences = notificationPreferences
        self.selectedThemeID = selectedThemeID
        self.apnsToken = apnsToken
        self.joinedAt = joinedAt
    }

    var isPro: Bool { subscriptionTier.isPro }

    static var preview: User {
        User(
            username: "bettor_pro",
            email: "user@example.com",
            displayName: "Sharp Bettor",
            subscriptionTier: .pro
        )
    }
}
