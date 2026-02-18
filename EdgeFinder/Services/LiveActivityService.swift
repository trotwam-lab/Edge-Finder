import Foundation
import ActivityKit

// MARK: - Live Activity Attributes

/// ActivityKit attributes for a tracked bet's live score on the lock screen.
struct BetLiveActivityAttributes: ActivityAttributes {
    /// Static data (doesn't change after activity starts)
    struct ContentState: Codable, Hashable {
        var homeScore: Int
        var awayScore: Int
        var period: String
        var clock: String
        var betStatus: String      // "pending" | "live" | "won" | "lost" | "push"
        var isHalftime: Bool
        var isFinal: Bool
        var potentialPayout: Double
        var currentProfit: Double?
    }

    var betID: String
    var betTitle: String
    var homeTeam: String
    var awayTeam: String
    var betSelection: String
    var odds: String
    var stake: Double
    var sport: String
    var sportsbook: String
}

// MARK: - Live Activity Service

@MainActor
final class LiveActivityService: ObservableObject {

    static let shared = LiveActivityService()
    private init() {}

    // Track running activities by bet ID
    private var activities: [String: Activity<BetLiveActivityAttributes>] = [:]

    // MARK: - Start Activity

    func start(for bet: Bet) async {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            print("[LiveActivity] Activities not enabled on this device.")
            return
        }

        // Don't start a duplicate
        if activities[bet.id.uuidString] != nil { return }

        let state = contentState(from: bet)
        let attributes = BetLiveActivityAttributes(
            betID: bet.id.uuidString,
            betTitle: bet.title,
            homeTeam: homeTeam(from: bet),
            awayTeam: awayTeam(from: bet),
            betSelection: bet.title,
            odds: bet.formattedOdds,
            stake: bet.stake,
            sport: bet.sport.rawValue,
            sportsbook: bet.sportsbook
        )

        do {
            let activity = try Activity<BetLiveActivityAttributes>.request(
                attributes: attributes,
                contentState: state,
                pushType: .token  // enables server push updates
            )
            activities[bet.id.uuidString] = activity
            print("[LiveActivity] Started: \(activity.id) for \(bet.title)")

            // Forward push token to server so we can update remotely
            await listenForPushToken(activity: activity, betID: bet.id.uuidString)
        } catch {
            print("[LiveActivity] Start failed: \(error.localizedDescription)")
        }
    }

    // MARK: - Update Activity

    func update(for bet: Bet) async {
        guard let activity = activities[bet.id.uuidString] else { return }
        let state = contentState(from: bet)
        await activity.update(using: state)
    }

    // MARK: - End Activity

    func end(for bet: Bet) async {
        guard let activity = activities[bet.id.uuidString] else { return }
        let finalState = contentState(from: bet)
        await activity.end(using: finalState, dismissalPolicy: .after(.now + 30))
        activities.removeValue(forKey: bet.id.uuidString)
    }

    // MARK: - Resume Existing Activities (app re-launch)

    func resumeExistingActivities(bets: [Bet]) {
        for activity in Activity<BetLiveActivityAttributes>.activities {
            if let bet = bets.first(where: { $0.id.uuidString == activity.attributes.betID }) {
                activities[bet.id.uuidString] = activity
            }
        }
    }

    // MARK: - Helpers

    private func contentState(from bet: Bet) -> BetLiveActivityAttributes.ContentState {
        BetLiveActivityAttributes.ContentState(
            homeScore: bet.liveScore?.homeScore ?? 0,
            awayScore: bet.liveScore?.awayScore ?? 0,
            period: bet.liveScore?.period ?? "-",
            clock: bet.liveScore?.clock ?? "",
            betStatus: bet.status.rawValue,
            isHalftime: bet.liveScore?.isHalftime ?? false,
            isFinal: bet.liveScore?.isFinal ?? false,
            potentialPayout: bet.potentialPayout,
            currentProfit: bet.profit
        )
    }

    private func homeTeam(from bet: Bet) -> String {
        // Extract home team from title if possible; fallback to "Home"
        let parts = bet.title.components(separatedBy: " vs ")
        return parts.count > 1 ? parts[1] : "Home"
    }

    private func awayTeam(from bet: Bet) -> String {
        let parts = bet.title.components(separatedBy: " vs ")
        return parts.first ?? "Away"
    }

    private func listenForPushToken(activity: Activity<BetLiveActivityAttributes>, betID: String) async {
        // Monitor for push token and send it to the server for remote updates
        Task {
            for await pushToken in activity.pushTokenUpdates {
                let tokenString = pushToken.map { String(format: "%02x", $0) }.joined()
                print("[LiveActivity] Push token for bet \(betID): \(tokenString)")
                try? await APIService.shared.registerLiveActivityToken(betID: betID, token: tokenString)
            }
        }
    }
}
