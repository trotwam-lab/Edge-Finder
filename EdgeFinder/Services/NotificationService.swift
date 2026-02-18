import Foundation
import UserNotifications
import UIKit

// MARK: - Notification Categories

enum NotificationCategory: String {
    case betTracker   = "BET_TRACKER"
    case liveScore    = "LIVE_SCORE"
    case edgeAlert    = "EDGE_ALERT"
    case lineMovement = "LINE_MOVEMENT"
}

// MARK: - Notification Action IDs

enum NotificationAction: String {
    case viewBet        = "VIEW_BET"
    case settleBetWon   = "SETTLE_WON"
    case settleBetLost  = "SETTLE_LOST"
    case viewEdge       = "VIEW_EDGE"
}

// MARK: - Notification Service

@MainActor
final class NotificationService: ObservableObject {

    static let shared = NotificationService()
    private init() {
        registerCategories()
    }

    @Published var isAuthorized: Bool = false
    @Published var deepLinkBetID: UUID? = nil

    private let center = UNUserNotificationCenter.current()

    // MARK: - Permission

    func requestPermission() {
        center.requestAuthorization(options: [.alert, .sound, .badge]) { [weak self] granted, error in
            DispatchQueue.main.async {
                self?.isAuthorized = granted
                if granted {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
        }
    }

    // MARK: - APNs Token

    func handleAPNsToken(_ token: String) {
        Task {
            try? await APIService.shared.registerAPNsToken(token)
        }
        if var user = UserPersistence.shared.load() {
            user.apnsToken = token
            UserPersistence.shared.save(user)
        }
    }

    // MARK: - Category & Action Registration

    private func registerCategories() {
        let viewBetAction = UNNotificationAction(
            identifier: NotificationAction.viewBet.rawValue,
            title: "View Bet",
            options: [.foreground]
        )
        let settleWonAction = UNNotificationAction(
            identifier: NotificationAction.settleBetWon.rawValue,
            title: "Won ✅",
            options: []
        )
        let settleLostAction = UNNotificationAction(
            identifier: NotificationAction.settleBetLost.rawValue,
            title: "Lost ❌",
            options: [.destructive]
        )
        let viewEdgeAction = UNNotificationAction(
            identifier: NotificationAction.viewEdge.rawValue,
            title: "See Edge",
            options: [.foreground]
        )

        let betTrackerCategory = UNNotificationCategory(
            identifier: NotificationCategory.betTracker.rawValue,
            actions: [viewBetAction, settleWonAction, settleLostAction],
            intentIdentifiers: [],
            options: .customDismissAction
        )
        let liveScoreCategory = UNNotificationCategory(
            identifier: NotificationCategory.liveScore.rawValue,
            actions: [viewBetAction],
            intentIdentifiers: [],
            options: .customDismissAction
        )
        let edgeAlertCategory = UNNotificationCategory(
            identifier: NotificationCategory.edgeAlert.rawValue,
            actions: [viewEdgeAction],
            intentIdentifiers: [],
            options: .customDismissAction
        )

        center.setNotificationCategories([betTrackerCategory, liveScoreCategory, edgeAlertCategory])
    }

    // MARK: - Scheduled: Game Start Reminder

    func scheduleGameStartNotification(for bet: Bet) {
        guard bet.notificationsEnabled else { return }
        guard let prefs = UserPersistence.shared.load()?.notificationPreferences, prefs.gameStart else { return }

        let content = UNMutableNotificationContent()
        content.title = "🏈 Game Starting Soon"
        content.body = "\(bet.title) • \(bet.formattedOdds) kicks off in 15 minutes on \(bet.sportsbook)"
        content.sound = .default
        content.categoryIdentifier = NotificationCategory.betTracker.rawValue
        content.userInfo = ["betID": bet.id.uuidString, "type": "gameStart"]
        content.interruptionLevel = .timeSensitive

        let fireDate = bet.gameStartTime.addingTimeInterval(-15 * 60)
        guard fireDate > Date() else { return }

        let comps = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: fireDate)
        let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
        let request = UNNotificationRequest(
            identifier: "gameStart-\(bet.id.uuidString)",
            content: content,
            trigger: trigger
        )
        center.add(request) { error in
            if let error { print("[Notifications] gameStart schedule error: \(error)") }
        }
    }

    // MARK: - Immediate: Bet Now Live

    func sendBetLiveNotification(for bet: Bet) {
        guard bet.notificationsEnabled else { return }

        let content = UNMutableNotificationContent()
        content.title = "🔴 Bet is LIVE"
        content.body = "\(bet.title) has started! Track live on your lock screen."
        content.sound = .default
        content.categoryIdentifier = NotificationCategory.liveScore.rawValue
        content.userInfo = ["betID": bet.id.uuidString, "type": "live"]
        content.interruptionLevel = .timeSensitive

        schedule(content, id: "live-\(bet.id.uuidString)")
    }

    // MARK: - Immediate: Score Update

    func sendScoreUpdateNotification(for bet: Bet) {
        guard bet.notificationsEnabled else { return }
        guard let score = bet.liveScore else { return }
        guard let prefs = UserPersistence.shared.load()?.notificationPreferences, prefs.liveScoreUpdates else { return }

        let content = UNMutableNotificationContent()
        content.title = "📊 Score Update"
        content.body = "\(score.awayScore) – \(score.homeScore) | \(score.period) \(score.clock) • \(bet.title)"
        content.sound = UNNotificationSound(named: UNNotificationSoundName("score_update.caf"))
        content.categoryIdentifier = NotificationCategory.liveScore.rawValue
        content.userInfo = ["betID": bet.id.uuidString, "type": "scoreUpdate"]
        content.interruptionLevel = .passive

        schedule(content, id: "score-\(bet.id.uuidString)-\(Int(Date().timeIntervalSince1970))")
    }

    // MARK: - Immediate: Bet Settled

    func sendBetSettledNotification(for bet: Bet, won: Bool) {
        guard bet.notificationsEnabled else { return }

        let content = UNMutableNotificationContent()
        if won {
            let profit = bet.potentialPayout
            content.title = "🏆 Bet Won!"
            content.body = "\(bet.title) won! +$\(String(format: "%.2f", profit)) on \(bet.sportsbook)"
            content.sound = UNNotificationSound(named: UNNotificationSoundName("win.caf"))
            content.badge = 1
        } else {
            content.title = "❌ Bet Lost"
            content.body = "\(bet.title) didn't hit. -$\(String(format: "%.2f", bet.stake))"
            content.sound = .default
        }
        content.categoryIdentifier = NotificationCategory.betTracker.rawValue
        content.userInfo = ["betID": bet.id.uuidString, "type": won ? "won" : "lost"]
        content.interruptionLevel = .active

        schedule(content, id: "settled-\(bet.id.uuidString)")
    }

    // MARK: - Immediate: Push (tie)

    func sendBetPushNotification(for bet: Bet) {
        guard bet.notificationsEnabled else { return }

        let content = UNMutableNotificationContent()
        content.title = "🤝 Bet Push"
        content.body = "\(bet.title) ended in a push. Your $\(String(format: "%.2f", bet.stake)) stake is returned."
        content.sound = .default
        content.categoryIdentifier = NotificationCategory.betTracker.rawValue
        content.userInfo = ["betID": bet.id.uuidString, "type": "push"]

        schedule(content, id: "push-\(bet.id.uuidString)")
    }

    // MARK: - Edge Alert

    func sendEdgeAlert(selection: String, edge: String, odds: String, sport: String) {
        let content = UNMutableNotificationContent()
        content.title = "⚡️ Edge Found: \(sport)"
        content.body = "\(selection) at \(odds) — \(edge) positive EV edge detected"
        content.sound = .default
        content.categoryIdentifier = NotificationCategory.edgeAlert.rawValue
        content.userInfo = ["type": "edgeAlert", "selection": selection]
        content.interruptionLevel = .timeSensitive

        schedule(content, id: "edge-\(UUID().uuidString)")
    }

    // MARK: - Cancel

    func cancelNotification(for betID: UUID) {
        let ids = ["gameStart-\(betID)", "live-\(betID)", "settled-\(betID)", "push-\(betID)"]
        center.removePendingNotificationRequests(withIdentifiers: ids)
        center.removeDeliveredNotifications(withIdentifiers: ids)
    }

    func cancelAllNotifications() {
        center.removeAllPendingNotificationRequests()
        center.removeAllDeliveredNotifications()
    }

    // MARK: - Handle Response

    func handleNotificationResponse(userInfo: [AnyHashable: Any], actionID: String) {
        guard let betIDString = userInfo["betID"] as? String,
              let betID = UUID(uuidString: betIDString) else { return }

        switch NotificationAction(rawValue: actionID) {
        case .viewBet:
            deepLinkBetID = betID
        case .settleBetWon:
            // BetTrackerViewModel will observe this
            NotificationCenter.default.post(
                name: .settleBetFromNotification,
                object: nil,
                userInfo: ["betID": betID, "status": BetStatus.won]
            )
        case .settleBetLost:
            NotificationCenter.default.post(
                name: .settleBetFromNotification,
                object: nil,
                userInfo: ["betID": betID, "status": BetStatus.lost]
            )
        default:
            deepLinkBetID = betID
        }
    }

    // MARK: - Private Helper

    private func schedule(_ content: UNMutableNotificationContent, id: String) {
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 0.1, repeats: false)
        let request = UNNotificationRequest(identifier: id, content: content, trigger: trigger)
        center.add(request) { error in
            if let error { print("[Notifications] schedule error: \(error)") }
        }
    }
}

// MARK: - Notification Name Extension

extension Notification.Name {
    static let settleBetFromNotification = Notification.Name("settleBetFromNotification")
}
