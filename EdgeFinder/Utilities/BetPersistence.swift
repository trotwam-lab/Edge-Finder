import Foundation

// MARK: - Bet Persistence (local storage)

final class BetPersistence {
    static let shared = BetPersistence()
    private init() {}

    private let key = "edgefinder.bets"
    private let appGroupKey = "group.com.edgefinder.app"

    private var defaults: UserDefaults {
        UserDefaults(suiteName: appGroupKey) ?? .standard
    }

    func save(_ bets: [Bet]) {
        if let encoded = try? JSONEncoder().encode(bets) {
            defaults.set(encoded, forKey: key)
        }
        syncWidgetData(bets: bets)
    }

    func load() -> [Bet] {
        guard let data = defaults.data(forKey: key),
              let bets = try? JSONDecoder().decode([Bet].self, from: data) else {
            return []
        }
        return bets
    }

    // MARK: - Widget Data Sync

    private func syncWidgetData(bets: [Bet]) {
        let settled = bets.filter { [BetStatus.won, .lost, .push].contains($0.status) }
        let wins    = bets.filter { $0.status == .won }.count
        let losses  = bets.filter { $0.status == .lost }.count
        let profit  = bets.compactMap { $0.profit }.reduce(0, +)
        let staked  = bets.map { $0.stake }.reduce(0, +)
        let roi     = staked > 0 ? (profit / staked) * 100 : 0
        let live    = bets.filter { $0.isLive }

        defaults.set(profit,  forKey: "totalProfit")
        defaults.set(String(format: "%+.1f%%", roi), forKey: "roi")
        defaults.set(wins,    forKey: "wins")
        defaults.set(losses,  forKey: "losses")
        defaults.set(live.count, forKey: "liveCount")

        let simpleLive = live.prefix(3).map { bet -> [String: String] in
            [
                "title": bet.title,
                "score": bet.liveScore?.displayScore ?? "-",
                "period": bet.liveScore?.period ?? "",
                "odds": bet.formattedOdds
            ]
        }
        if let data = try? JSONSerialization.data(withJSONObject: simpleLive) {
            defaults.set(data, forKey: "liveBets")
        }

        // Trigger widget refresh
        WidgetKitService.reloadTimelines()
    }
}

// MARK: - User Persistence

final class UserPersistence {
    static let shared = UserPersistence()
    private init() {}

    private let key = "edgefinder.user"

    func save(_ user: User) {
        if let encoded = try? JSONEncoder().encode(user) {
            UserDefaults.standard.set(encoded, forKey: key)
        }
    }

    func load() -> User? {
        guard let data = UserDefaults.standard.data(forKey: key),
              let user = try? JSONDecoder().decode(User.self, from: data) else {
            return nil
        }
        return user
    }

    func clear() {
        UserDefaults.standard.removeObject(forKey: key)
        UserDefaults.standard.removeObject(forKey: "authToken")
    }
}
