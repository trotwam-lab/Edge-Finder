import SwiftUI

struct OddsView: View {
    @EnvironmentObject var userVM: UserViewModel
    @Environment(\.theme) var theme
    @StateObject private var vm = OddsViewModel()
    @State private var showEdgeOnly = false
    @State private var selectedGame: Game? = nil

    var body: some View {
        NavigationStack {
            ZStack {
                theme.background.ignoresSafeArea()

                VStack(spacing: 0) {
                    // Sport picker
                    sportPicker

                    // Filters
                    filterBar

                    if vm.isLoading {
                        ProgressView().tint(theme.primary).frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else if vm.filteredGames.isEmpty {
                        emptyGames
                    } else {
                        gamesList
                    }
                }
            }
            .navigationTitle("Odds & Edges")
            .navigationBarTitleDisplayMode(.large)
            .searchable(text: $vm.searchQuery, prompt: "Search teams...")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        vm.refresh()
                    } label: {
                        Image(systemName: "arrow.clockwise")
                            .foregroundStyle(theme.primary)
                    }
                }
            }
            .sheet(item: $selectedGame) { game in
                GameDetailView(game: game)
                    .environment(\.theme, theme)
                    .environmentObject(userVM)
            }
        }
    }

    // MARK: - Sport Picker

    private var sportPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Sport.allCases, id: \.self) { sport in
                    Button {
                        vm.selectSport(sport)
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: sport.iconName)
                                .font(.caption)
                            Text(sport.rawValue)
                                .font(.caption.bold())
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(vm.selectedSport == sport ? theme.primary : theme.surface)
                        .foregroundStyle(vm.selectedSport == sport ? .black : theme.onSurface.opacity(0.7))
                        .clipShape(Capsule())
                    }
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
        .background(theme.surface)
    }

    // MARK: - Filter Bar

    private var filterBar: some View {
        HStack {
            Toggle(isOn: $vm.showEdgeOnly) {
                HStack(spacing: 4) {
                    Image(systemName: "bolt.fill")
                        .foregroundStyle(theme.accent)
                        .font(.caption)
                    Text("Edges Only")
                        .font(.caption.bold())
                        .foregroundStyle(theme.onSurface)
                }
            }
            .tint(theme.primary)
            .padding(.horizontal)
            .padding(.vertical, 8)
            Spacer()
            Text("\(vm.filteredGames.count) games")
                .font(.caption)
                .foregroundStyle(theme.onSurface.opacity(0.4))
                .padding(.horizontal)
        }
        .background(theme.background)
    }

    // MARK: - Games List

    private var gamesList: some View {
        List {
            ForEach(vm.filteredGames) { game in
                GameOddsRow(game: game)
                    .listRowBackground(theme.surface)
                    .listRowSeparatorTint(theme.onSurface.opacity(0.08))
                    .contentShape(Rectangle())
                    .onTapGesture { selectedGame = game }
            }
        }
        .listStyle(.plain)
        .background(theme.background)
        .refreshable { vm.refresh() }
    }

    private var emptyGames: some View {
        VStack(spacing: 16) {
            Image(systemName: "sportscourt")
                .font(.system(size: 52))
                .foregroundStyle(theme.primary.opacity(0.3))
            Text("No games found")
                .font(.headline)
                .foregroundStyle(theme.onSurface)
            Text(vm.showEdgeOnly ? "No positive EV edges found for this sport" : "Check back later for upcoming games")
                .font(.subheadline)
                .foregroundStyle(theme.onSurface.opacity(0.5))
                .multilineTextAlignment(.center)
        }
        .padding(40)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Game Odds Row

struct GameOddsRow: View {
    let game: Game
    @Environment(\.theme) var theme

    var body: some View {
        VStack(spacing: 10) {
            // Header
            HStack {
                Text(game.sport.rawValue)
                    .font(.caption2.bold())
                    .foregroundStyle(theme.primary)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(theme.primary.opacity(0.1))
                    .clipShape(Capsule())

                Spacer()

                if game.isLive {
                    HStack(spacing: 4) {
                        Circle().fill(.red).frame(width: 6, height: 6)
                        Text("LIVE").font(.caption2.bold()).foregroundStyle(.red)
                    }
                } else {
                    Text(game.displayTime)
                        .font(.caption)
                        .foregroundStyle(theme.onSurface.opacity(0.5))
                }

                if let edge = game.topEdge {
                    Text(edge.formattedEdge + " EV")
                        .font(.caption2.bold())
                        .foregroundStyle(theme.accent)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(theme.accent.opacity(0.12))
                        .clipShape(Capsule())
                }
            }

            // Teams & score / odds
            HStack(spacing: 0) {
                // Away
                VStack(spacing: 4) {
                    Text(game.awayAbbr)
                        .font(.title3.bold())
                        .foregroundStyle(theme.onSurface)
                    if game.isLive, let score = game.liveScore {
                        Text("\(score.awayScore)")
                            .font(.system(size: 28, weight: .black))
                            .foregroundStyle(theme.onSurface)
                    }
                    if let line = game.bestLine {
                        Text(line.formattedAwayOdds)
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(theme.onSurface.opacity(0.6))
                    }
                }
                .frame(maxWidth: .infinity)

                // Middle divider / game info
                VStack(spacing: 4) {
                    if game.isLive, let score = game.liveScore {
                        Text(score.period)
                            .font(.caption2)
                            .foregroundStyle(.red)
                        Text(score.clock)
                            .font(.caption2.monospacedDigit())
                            .foregroundStyle(.red)
                    } else {
                        Text("@")
                            .font(.caption)
                            .foregroundStyle(theme.onSurface.opacity(0.3))
                    }
                    if let line = game.bestLine {
                        Text("O/U \(line.total, specifier: "%.1f")")
                            .font(.caption2)
                            .foregroundStyle(theme.onSurface.opacity(0.4))
                    }
                }
                .frame(width: 60)

                // Home
                VStack(spacing: 4) {
                    Text(game.homeAbbr)
                        .font(.title3.bold())
                        .foregroundStyle(theme.onSurface)
                    if game.isLive, let score = game.liveScore {
                        Text("\(score.homeScore)")
                            .font(.system(size: 28, weight: .black))
                            .foregroundStyle(theme.onSurface)
                    }
                    if let line = game.bestLine {
                        Text(line.formattedHomeOdds)
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(theme.onSurface.opacity(0.6))
                    }
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.vertical, 8)
    }
}

// MARK: - Game Detail View

struct GameDetailView: View {
    let game: Game
    @EnvironmentObject var userVM: UserViewModel
    @Environment(\.theme) var theme
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                theme.background.ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 16) {
                        // Score / matchup
                        matchupCard
                        // Odds comparison
                        oddsComparisonCard
                        // Edges
                        if !game.edges.isEmpty { edgesCard }
                    }
                    .padding()
                }
            }
            .navigationTitle("\(game.awayAbbr) @ \(game.homeAbbr)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }.foregroundStyle(theme.primary)
                }
            }
        }
    }

    private var matchupCard: some View {
        VStack(spacing: 12) {
            HStack {
                VStack {
                    Text(game.awayTeam).font(.headline).foregroundStyle(theme.onSurface)
                    Text(game.awayRecord).font(.caption).foregroundStyle(theme.onSurface.opacity(0.5))
                    if let s = game.liveScore {
                        Text("\(s.awayScore)")
                            .font(.system(size: 36, weight: .black))
                            .foregroundStyle(theme.onSurface)
                    }
                }
                .frame(maxWidth: .infinity)
                VStack {
                    Text(game.displayTime).font(.caption).foregroundStyle(game.isLive ? .red : theme.onSurface.opacity(0.5))
                    Text("@").font(.caption).foregroundStyle(theme.onSurface.opacity(0.3))
                }
                VStack {
                    Text(game.homeTeam).font(.headline).foregroundStyle(theme.onSurface)
                    Text(game.homeRecord).font(.caption).foregroundStyle(theme.onSurface.opacity(0.5))
                    if let s = game.liveScore {
                        Text("\(s.homeScore)")
                            .font(.system(size: 36, weight: .black))
                            .foregroundStyle(theme.onSurface)
                    }
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding()
        .background(theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private var oddsComparisonCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Odds Comparison")
                .font(.headline)
                .foregroundStyle(theme.onSurface)
            ForEach(game.oddsLines, id: \.sportsbook) { line in
                HStack {
                    Text(line.sportsbook)
                        .font(.subheadline)
                        .foregroundStyle(theme.onSurface)
                        .frame(width: 100, alignment: .leading)
                    Spacer()
                    Text(line.formattedAwayOdds)
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(theme.onSurface.opacity(0.7))
                    Spacer()
                    Text(line.formattedSpread)
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(theme.onSurface.opacity(0.7))
                    Spacer()
                    Text("O \(line.total, specifier: "%.1f")")
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(theme.onSurface.opacity(0.7))
                }
                Divider().background(theme.onSurface.opacity(0.08))
            }
        }
        .padding()
        .background(theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private var edgesCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Positive EV Edges")
                .font(.headline)
                .foregroundStyle(theme.onSurface)
            ForEach(game.edges.filter { $0.isPositiveEV }, id: \.selection) { edge in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(edge.selection).font(.subheadline.bold()).foregroundStyle(theme.onSurface)
                        Text("True prob: \(Int(edge.trueProbability * 100))%")
                            .font(.caption)
                            .foregroundStyle(theme.onSurface.opacity(0.5))
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(edge.formattedEdge)
                            .font(.subheadline.bold())
                            .foregroundStyle(theme.primary)
                        Text(edge.formattedEV)
                            .font(.caption)
                            .foregroundStyle(edge.expectedValue > 0 ? theme.primary : .red)
                    }
                }
                Divider().background(theme.onSurface.opacity(0.08))
            }
        }
        .padding()
        .background(theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}
