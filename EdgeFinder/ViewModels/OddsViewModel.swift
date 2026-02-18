import Foundation
import Combine

@MainActor
final class OddsViewModel: ObservableObject {
    @Published var games: [Game] = []
    @Published var trendingPicks: [TrendingPick] = []
    @Published var selectedSport: Sport = .nfl
    @Published var isLoading: Bool = false
    @Published var errorMessage: String? = nil
    @Published var showEdgeOnly: Bool = false
    @Published var searchQuery: String = ""

    private let apiService = APIService.shared
    private var cancellables = Set<AnyCancellable>()
    private var refreshTask: Task<Void, Never>?

    var filteredGames: [Game] {
        var result = games
        if showEdgeOnly {
            result = result.filter { $0.topEdge != nil }
        }
        if !searchQuery.isEmpty {
            let q = searchQuery.lowercased()
            result = result.filter {
                $0.homeTeam.lowercased().contains(q) ||
                $0.awayTeam.lowercased().contains(q)
            }
        }
        return result.sorted { a, b in
            // Live games first, then by start time
            if a.isLive != b.isLive { return a.isLive }
            return a.gameTime < b.gameTime
        }
    }

    init() {
        Task { await loadGames() }
    }

    func loadGames() async {
        isLoading = true
        defer { isLoading = false }
        do {
            async let games = apiService.fetchGames(sport: selectedSport)
            async let picks = apiService.fetchTrendingPicks(sport: selectedSport)
            (self.games, self.trendingPicks) = try await (games, picks)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func refresh() {
        refreshTask?.cancel()
        refreshTask = Task { await loadGames() }
    }

    func selectSport(_ sport: Sport) {
        selectedSport = sport
        Task { await loadGames() }
    }
}
