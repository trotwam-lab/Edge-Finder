import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var betVM: BetTrackerViewModel
    @EnvironmentObject var userVM: UserViewModel
    @Environment(\.theme) var theme
    @StateObject private var oddsVM = OddsViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                theme.background.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 20) {
                        // Greeting
                        greetingHeader

                        // Live Bets Strip
                        if !betVM.liveBets.isEmpty {
                            liveBetsSection
                        }

                        // Quick stats
                        quickStatsGrid

                        // Trending picks
                        if !oddsVM.trendingPicks.isEmpty {
                            trendingPicksSection
                        }

                        // Featured games
                        featuredGamesSection
                    }
                    .padding(.bottom, 20)
                }
                .refreshable {
                    oddsVM.refresh()
                    await betVM.refreshLiveScores()
                }
            }
            .navigationTitle("EdgeFinder")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    if userVM.currentUser?.isPro == false {
                        Button {
                            // navigate to pro upgrade
                        } label: {
                            Text("PRO")
                                .font(.caption.bold())
                                .foregroundStyle(.black)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(theme.accent)
                                .clipShape(Capsule())
                        }
                    }
                }
            }
        }
    }

    // MARK: - Greeting

    private var greetingHeader: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(greeting)
                    .font(.subheadline)
                    .foregroundStyle(theme.onSurface.opacity(0.6))
                Text(userVM.currentUser?.displayName ?? "Bettor")
                    .font(.title2.bold())
                    .foregroundStyle(theme.onSurface)
            }
            Spacer()
            ZStack {
                Circle()
                    .fill(theme.primary.opacity(0.15))
                    .frame(width: 44, height: 44)
                Text(userVM.currentUser?.displayName.prefix(1).uppercased() ?? "U")
                    .font(.title3.bold())
                    .foregroundStyle(theme.primary)
            }
        }
        .padding(.horizontal)
        .padding(.top, 8)
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 5..<12: return "Good morning,"
        case 12..<17: return "Good afternoon,"
        case 17..<21: return "Good evening,"
        default: return "Good night,"
        }
    }

    // MARK: - Live Bets Strip

    private var liveBetsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionHeader(title: "Live Bets", icon: "dot.radiowaves.left.and.right", color: .red)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(betVM.liveBets) { bet in
                        LiveBetCard(bet: bet)
                    }
                }
                .padding(.horizontal)
            }
        }
    }

    // MARK: - Quick Stats

    private var quickStatsGrid: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionHeader(title: "Your Edge", icon: "chart.line.uptrend.xyaxis")
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                statCard(
                    icon: "dollarsign.circle.fill",
                    title: "Total Profit",
                    value: String(format: "%@$%.2f",
                                  betVM.statistics.totalProfit >= 0 ? "+" : "",
                                  betVM.statistics.totalProfit),
                    color: betVM.statistics.totalProfit >= 0 ? theme.primary : .red
                )
                statCard(
                    icon: "percent",
                    title: "ROI",
                    value: betVM.statistics.formattedROI,
                    color: betVM.statistics.roi >= 0 ? theme.primary : .red
                )
                statCard(
                    icon: "trophy.fill",
                    title: "Win Rate",
                    value: betVM.statistics.formattedWinRate,
                    color: theme.accent
                )
                statCard(
                    icon: "flame.fill",
                    title: "Streak",
                    value: "\(betVM.statistics.currentStreak)\(betVM.statistics.currentStreakIsWin ? "W" : "L")",
                    color: betVM.statistics.currentStreakIsWin ? theme.primary : .red
                )
            }
            .padding(.horizontal)
        }
    }

    private func statCard(icon: String, title: String, value: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .foregroundStyle(color)
                Spacer()
            }
            Text(value)
                .font(.title2.bold())
                .foregroundStyle(color)
            Text(title)
                .font(.caption)
                .foregroundStyle(theme.onSurface.opacity(0.5))
        }
        .padding()
        .background(theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    // MARK: - Trending Picks

    private var trendingPicksSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionHeader(title: "Top Edges", icon: "bolt.fill", color: theme.accent)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(oddsVM.trendingPicks.prefix(5)) { pick in
                        TrendingPickCard(pick: pick)
                    }
                }
                .padding(.horizontal)
            }
        }
    }

    // MARK: - Featured Games

    private var featuredGamesSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionHeader(title: "Games Today", icon: "sportscourt.fill")

            if oddsVM.isLoading {
                ProgressView().tint(theme.primary).frame(maxWidth: .infinity)
            } else {
                VStack(spacing: 10) {
                    ForEach(oddsVM.filteredGames.filter(\.isFeatured).prefix(4)) { game in
                        FeaturedGameCard(game: game)
                    }
                }
                .padding(.horizontal)
            }
        }
    }

    // MARK: - Helpers

    private func sectionHeader(title: String, icon: String, color: Color? = nil) -> some View {
        HStack {
            Image(systemName: icon)
                .foregroundStyle(color ?? theme.primary)
            Text(title)
                .font(.headline)
                .foregroundStyle(theme.onSurface)
            Spacer()
        }
        .padding(.horizontal)
    }
}

// MARK: - Live Bet Card

struct LiveBetCard: View {
    let bet: Bet
    @Environment(\.theme) var theme

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Circle().fill(.red).frame(width: 7, height: 7)
                Text("LIVE").font(.caption2.bold()).foregroundStyle(.red)
                Spacer()
                Image(systemName: bet.sport.iconName)
                    .foregroundStyle(theme.primary)
                    .font(.caption)
            }
            Text(bet.title)
                .font(.caption.bold())
                .foregroundStyle(theme.onSurface)
                .lineLimit(1)

            if let score = bet.liveScore {
                Text(score.displayScore)
                    .font(.system(size: 20, weight: .black, design: .rounded))
                    .foregroundStyle(theme.onSurface)
                    .monospacedDigit()
                Text("\(score.period) • \(score.clock)")
                    .font(.caption2)
                    .foregroundStyle(theme.onSurface.opacity(0.5))
            }

            HStack {
                Text(bet.formattedOdds)
                    .font(.caption.bold())
                    .foregroundStyle(theme.accent)
                Spacer()
                Text("$\(bet.stake, specifier: "%.0f")")
                    .font(.caption2)
                    .foregroundStyle(theme.onSurface.opacity(0.5))
            }
        }
        .padding(12)
        .frame(width: 160)
        .background(theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(.red.opacity(0.3), lineWidth: 1)
        )
    }
}

// MARK: - Trending Pick Card

struct TrendingPickCard: View {
    let pick: TrendingPick
    @Environment(\.theme) var theme

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: pick.sport.iconName)
                    .foregroundStyle(theme.primary)
                    .font(.caption)
                Spacer()
                if pick.sharpAction {
                    Text("SHARP")
                        .font(.caption2.bold())
                        .foregroundStyle(theme.accent)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(theme.accent.opacity(0.15))
                        .clipShape(Capsule())
                }
            }
            Text(pick.game)
                .font(.caption2)
                .foregroundStyle(theme.onSurface.opacity(0.5))
                .lineLimit(1)
            Text(pick.selection)
                .font(.caption.bold())
                .foregroundStyle(theme.onSurface)
                .lineLimit(1)
            HStack {
                Text(pick.formattedOdds)
                    .font(.caption.bold())
                    .foregroundStyle(theme.onSurface)
                Spacer()
                Text(pick.edgePercent >= 0
                     ? "+\(String(format: "%.1f", pick.edgePercent))%"
                     : "\(String(format: "%.1f", pick.edgePercent))%")
                    .font(.caption.bold())
                    .foregroundStyle(pick.edgePercent > 0 ? theme.primary : .red)
            }
            // Public money bar
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 3)
                        .fill(theme.onSurface.opacity(0.1))
                        .frame(height: 4)
                    RoundedRectangle(cornerRadius: 3)
                        .fill(theme.primary)
                        .frame(width: geo.size.width * (pick.publicBettingPercent / 100), height: 4)
                }
            }
            .frame(height: 4)
            Text("Public: \(Int(pick.publicBettingPercent))% | Money: \(Int(pick.moneyPercent))%")
                .font(.caption2)
                .foregroundStyle(theme.onSurface.opacity(0.4))
        }
        .padding(12)
        .frame(width: 170)
        .background(theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}

// MARK: - Featured Game Card

struct FeaturedGameCard: View {
    let game: Game
    @Environment(\.theme) var theme

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: game.sport.iconName)
                .foregroundStyle(theme.primary)
                .font(.title3)
                .frame(width: 36)

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("\(game.awayAbbr) @ \(game.homeAbbr)")
                        .font(.subheadline.bold())
                        .foregroundStyle(theme.onSurface)
                    Spacer()
                    Text(game.displayTime)
                        .font(.caption)
                        .foregroundStyle(game.isLive ? .red : theme.onSurface.opacity(0.5))
                }
                if let edge = game.topEdge {
                    HStack {
                        Image(systemName: "bolt.fill")
                            .font(.caption2)
                            .foregroundStyle(theme.accent)
                        Text("Edge: \(edge.formattedEdge) on \(edge.selection)")
                            .font(.caption)
                            .foregroundStyle(theme.accent)
                    }
                }
                if let line = game.bestLine {
                    HStack(spacing: 8) {
                        Text("\(line.formattedAwayOdds)")
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(theme.onSurface.opacity(0.6))
                        Text("•")
                            .foregroundStyle(theme.onSurface.opacity(0.3))
                        Text("O/U \(line.total)")
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(theme.onSurface.opacity(0.6))
                        Text("•")
                            .foregroundStyle(theme.onSurface.opacity(0.3))
                        Text("\(line.formattedHomeOdds)")
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(theme.onSurface.opacity(0.6))
                    }
                }
            }
        }
        .padding(12)
        .background(theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
