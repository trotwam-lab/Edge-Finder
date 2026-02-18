import UserNotifications

/// Apple's Notification Service Extension — runs in the background when a
/// push notification with `mutable-content: 1` arrives. Used to:
///  1. Enrich live score pushes with current score data from the payload
///  2. Modify badge counts
///  3. Download media attachments (future: team logos)
class NotificationService: UNNotificationServiceExtension {

    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?

    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        self.contentHandler = contentHandler
        bestAttemptContent = request.content.mutableCopy() as? UNMutableNotificationContent

        guard let content = bestAttemptContent else {
            contentHandler(request.content)
            return
        }

        let userInfo = content.userInfo

        // Enrich score update notifications
        if let type = userInfo["type"] as? String, type == "scoreUpdate" {
            enrichScoreNotification(content: content, userInfo: userInfo)
        }

        // Enrich edge alert with EV value
        if let type = userInfo["type"] as? String, type == "edgeAlert" {
            if let edge = userInfo["edgePercent"] as? Double,
               let ev = userInfo["expectedValue"] as? Double {
                content.body += String(format: " | EV: +$%.2f", ev)
                content.subtitle = String(format: "Edge: %.1f%%", edge)
            }
        }

        // Future: attach team logo images
        // attachTeamLogo(content: content, userInfo: userInfo) { ... }

        contentHandler(content)
    }

    override func serviceExtensionTimeWillExpire() {
        if let contentHandler = contentHandler, let content = bestAttemptContent {
            contentHandler(content)
        }
    }

    // MARK: - Score Enrichment

    private func enrichScoreNotification(
        content: UNMutableNotificationContent,
        userInfo: [AnyHashable: Any]
    ) {
        guard
            let home = userInfo["homeScore"] as? Int,
            let away = userInfo["awayScore"] as? Int,
            let period = userInfo["period"] as? String,
            let clock = userInfo["clock"] as? String,
            let betTitle = userInfo["betTitle"] as? String
        else { return }

        content.title = "📊 \(away) – \(home)"
        content.subtitle = "\(period) \(clock)"
        content.body = betTitle
        content.sound = UNNotificationSound(named: UNNotificationSoundName("score_update.caf"))
    }
}
