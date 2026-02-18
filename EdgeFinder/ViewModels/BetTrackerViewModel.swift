import Foundation
import Combine

@MainActor
final class BetTrackerViewModel: ObservableObject {

    // MARK: - Published State

    @Published var bets: [Bet] = []
    @Published var selectedFilter: BetStatus? = nil
    @Published var selectedSport: Sport? = nil
    @Published var searchQuery: String = ""
    @Published var isLoading: Bool = false
    @Published var errorMessage: String? = nil
    @Published var statistics: BetStatistics = .empty

    // MARK: - Services

    private let apiService = APIService.shared
    private let liveActivityService = LiveActivityService.shared
    private let notificationService = NotificationService.shared
    private let persistence = BetPersistence.shared
    private var scoreRefreshTimer: Timer?
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Computed

    var filteredBets: [Bet] {
        var result = bets
        if let filter = selectedFilter {
            result = result.filter { $0.status == filter }
        }
        if let sport = selectedSport {
            result = result.filter { $0.sport == sport }
        }
        if !searchQuery.isEmpty {
            let q = searchQuery.lowercased()
            result = result.filter {
                $0.title.lowercased().contains(q) ||
                $0.sportsbook.lowercased().contains(q)
            }
        }
        return result.sorted { $0.placedAt > $1.placedAt }
    }

    var liveBets: [Bet] {
        bets.filter { $0.isLive }
    }

    var liveCount: Int { liveBets.count }

    var pendingBets: [Bet] {
        bets.filter { $0.status == .pending }
    }

    var settledBets: [Bet] {
        bets.filter { [.won, .lost, .push, .cashout].contains($0.status) }
    }

    // MARK: - Init

    init() {
        loadBets()
        startLiveScoreRefresh()
    }

    deinit {
        scoreRefreshTimer?.invalidate()
    }

    // MARK: - CRUD

    func addBet(_ bet: Bet) {
        bets.insert(bet, at: 0)
        persistence.save(bets)
        recalculateStats()

        if bet.notificationsEnabled {
            notificationService.scheduleGameStartNotification(for: bet)
        }

        if bet.isLive {
            Task { await liveActivityService.start(for: bet) }
        }
    }

    func updateBet(_ bet: Bet) {
        guard let idx = bets.firstIndex(where: { $0.id == bet.id }) else { return }
        let old = bets[idx]
        bets[idx] = bet
        persistence.save(bets)
        recalculateStats()

        // Settle notifications
        if old.status != bet.status {
            handleStatusChange(bet: bet, oldStatus: old.status)
        }

        // Update Live Activity if score changed
        if old.liveScore != bet.liveScore {
            Task { await liveActivityService.update(for: bet) }
        }
    }

    func deleteBet(at offsets: IndexSet) {
        let idsToDelete = offsets.map { filteredBets[$0].id }
        for id in idsToDelete {
            if let bet = bets.first(where: { $0.id == id }) {
                Task { await liveActivityService.end(for: bet) }
            }
        }
        bets.removeAll { idsToDelete.contains($0.id) }
        persistence.save(bets)
        recalculateStats()
    }

    func settleBet(_ bet: Bet, as status: BetStatus) {
        guard var updated = bets.first(where: { $0.id == bet.id }) else { return }
        updated.status = status
        updated.settledAt = Date()
        updateBet(updated)
        Task { await liveActivityService.end(for: updated) }
    }

    // MARK: - Live Scores

    func startLiveScoreRefresh() {
        scoreRefreshTimer?.invalidate()
        scoreRefreshTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            Task { [weak self] in
                await self?.refreshLiveScores()
            }
        }
    }

    func refreshLiveScores() async {
        let live = bets.filter { $0.isLive || $0.status == .pending }
        guard !live.isEmpty else { return }

        for bet in live {
            do {
                let score = try await apiService.fetchLiveScore(gameID: bet.id.uuidString, sport: bet.sport)
                if var updated = bets.first(where: { $0.id == bet.id }) {
                    let wasLive = updated.isLive
                    updated.liveScore = score

                    if score.isFinal && updated.status == .live {
                        updated.status = .pending // Let user settle manually or auto-detect
                    } else if !wasLive && !score.isFinal {
                        updated.status = .live
                    }

                    updateBet(updated)
                }
            } catch {
                // Silently skip failed score fetches for individual bets
            }
        }
    }

    // MARK: - Notifications

    private func handleStatusChange(bet: Bet, oldStatus: BetStatus) {
        switch bet.status {
        case .live:
            Task { await liveActivityService.start(for: bet) }
            notificationService.sendBetLiveNotification(for: bet)
        case .won:
            notificationService.sendBetSettledNotification(for: bet, won: true)
            Task { await liveActivityService.end(for: bet) }
        case .lost:
            notificationService.sendBetSettledNotification(for: bet, won: false)
            Task { await liveActivityService.end(for: bet) }
        case .push:
            notificationService.sendBetPushNotification(for: bet)
            Task { await liveActivityService.end(for: bet) }
        default:
            break
        }
    }

    // MARK: - Persistence

    private func loadBets() {
        bets = persistence.load()
        recalculateStats()
    }

    // MARK: - Statistics

    func recalculateStats() {
        let settled = bets.filter { [.won, .lost, .push, .cashout].contains($0.status) }
        let wins    = bets.filter { $0.status == .won }.count
        let losses  = bets.filter { $0.status == .lost }.count
        let pushes  = bets.filter { $0.status == .push }.count

        let totalStaked = bets.map { $0.stake }.reduce(0, +)
        let totalProfit = bets.compactMap { $0.profit }.reduce(0, +)
        let roi         = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0
        let winRate     = settled.isEmpty ? 0 : Double(wins) / Double(settled.count)
        let avgOdds     = bets.isEmpty ? 0 : Double(bets.map { $0.odds }.reduce(0, +)) / Double(bets.count)

        // Streak calculation
        var streak = 0
        var longestWin = 0
        var curStreak = 0
        var isWinStreak = false
        let sortedSettled = settled.sorted { ($0.settledAt ?? .distantPast) < ($1.settledAt ?? .distantPast) }
        for bet in sortedSettled {
            let won = bet.status == .won
            if won {
                if isWinStreak { curStreak += 1 } else { curStreak = 1; isWinStreak = true }
                longestWin = max(longestWin, curStreak)
            } else {
                if !isWinStreak { curStreak += 1 } else { curStreak = 1; isWinStreak = false }
            }
        }
        streak = curStreak

        statistics = BetStatistics(
            totalBets: bets.count,
            wins: wins,
            losses: losses,
            pushes: pushes,
            pendingCount: bets.filter { $0.status == .pending }.count,
            totalStaked: totalStaked,
            totalProfit: totalProfit,
            roi: roi,
            winRate: winRate,
            avgOdds: avgOdds,
            longestWinStreak: longestWin,
            currentStreak: streak,
            currentStreakIsWin: isWinStreak
        )
    }
}
