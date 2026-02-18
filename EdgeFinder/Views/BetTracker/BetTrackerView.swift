import SwiftUI

struct BetTrackerView: View {
    @EnvironmentObject var vm: BetTrackerViewModel
    @EnvironmentObject var userVM: UserViewModel
    @Environment(\.theme) var theme
    @State private var showAddBet = false
    @State private var betToSettle: Bet? = nil
    @State private var selectedSegment: Segment = .all

    enum Segment: String, CaseIterable {
        case all = "All"
        case live = "Live"
        case pending = "Pending"
        case settled = "Settled"
    }

    var body: some View {
        NavigationStack {
            ZStack {
                theme.background.ignoresSafeArea()

                VStack(spacing: 0) {
                    // Stats bar
                    statsBar

                    // Segment control
                    Picker("Filter", selection: $selectedSegment) {
                        ForEach(Segment.allCases, id: \.self) { seg in
                            Text(seg.rawValue).tag(seg)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal)
                    .padding(.vertical, 8)

                    if vm.isLoading {
                        ProgressView()
                            .tint(theme.primary)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else if displayedBets.isEmpty {
                        emptyState
                    } else {
                        betList
                    }
                }
            }
            .navigationTitle("Bet Tracker")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        showAddBet = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .foregroundStyle(theme.primary)
                            .font(.title3)
                    }
                }
            }
            .sheet(isPresented: $showAddBet) {
                AddBetView()
                    .environmentObject(vm)
                    .environment(\.theme, theme)
            }
            .actionSheet(item: $betToSettle) { bet in
                settlementSheet(for: bet)
            }
        }
    }

    // MARK: - Stats Bar

    private var statsBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                statChip(
                    label: "Profit",
                    value: String(format: "%@$%.2f", vm.statistics.totalProfit >= 0 ? "+" : "", vm.statistics.totalProfit),
                    color: vm.statistics.totalProfit >= 0 ? theme.primary : .red
                )
                statChip(
                    label: "ROI",
                    value: vm.statistics.formattedROI,
                    color: vm.statistics.roi >= 0 ? theme.primary : .red
                )
                statChip(label: "Win%", value: vm.statistics.formattedWinRate, color: theme.accent)
                statChip(label: "Record", value: "\(vm.statistics.wins)-\(vm.statistics.losses)-\(vm.statistics.pushes)", color: theme.onSurface)
                statChip(label: "Bets", value: "\(vm.statistics.totalBets)", color: theme.onSurface)
            }
            .padding(.horizontal)
            .padding(.vertical, 10)
        }
        .background(theme.surface)
    }

    private func statChip(label: String, value: String, color: Color) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .foregroundStyle(color)
            Text(label)
                .font(.caption2)
                .foregroundStyle(theme.onSurface.opacity(0.5))
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(theme.background)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    // MARK: - Bet List

    private var displayedBets: [Bet] {
        switch selectedSegment {
        case .all:     return vm.filteredBets
        case .live:    return vm.liveBets
        case .pending: return vm.pendingBets
        case .settled: return vm.settledBets
        }
    }

    private var betList: some View {
        List {
            ForEach(displayedBets) { bet in
                NavigationLink {
                    BetDetailView(bet: bet)
                        .environmentObject(vm)
                        .environment(\.theme, theme)
                } label: {
                    BetRowView(bet: bet)
                }
                .listRowBackground(theme.surface)
                .listRowSeparatorTint(theme.onSurface.opacity(0.1))
                .swipeActions(edge: .leading) {
                    if bet.status == .live || bet.status == .pending {
                        Button {
                            betToSettle = bet
                        } label: {
                            Label("Settle", systemImage: "checkmark.circle")
                        }
                        .tint(theme.primary)
                    }
                }
                .swipeActions(edge: .trailing) {
                    Button(role: .destructive) {
                        if let idx = vm.filteredBets.firstIndex(where: { $0.id == bet.id }) {
                            vm.deleteBet(at: IndexSet(integer: idx))
                        }
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
            }
        }
        .listStyle(.plain)
        .background(theme.background)
        .refreshable {
            await vm.refreshLiveScores()
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "list.bullet.clipboard")
                .font(.system(size: 52))
                .foregroundStyle(theme.primary.opacity(0.4))
            Text(selectedSegment == .live ? "No live bets" : "No bets tracked yet")
                .font(.headline)
                .foregroundStyle(theme.onSurface)
            Text(selectedSegment == .live
                 ? "Start tracking bets and they'll update live here"
                 : "Tap + to add your first bet")
                .font(.subheadline)
                .foregroundStyle(theme.onSurface.opacity(0.5))
                .multilineTextAlignment(.center)
        }
        .padding(40)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Settlement Action Sheet

    private func settlementSheet(for bet: Bet) -> ActionSheet {
        ActionSheet(
            title: Text("Settle Bet"),
            message: Text(bet.title),
            buttons: [
                .default(Text("Won \u{1F3C6}")) { vm.settleBet(bet, as: .won) },
                .default(Text("Lost \u{274C}"))  { vm.settleBet(bet, as: .lost) },
                .default(Text("Push \u{1F91D}")) { vm.settleBet(bet, as: .push) },
                .default(Text("Cash Out \u{1F4B0}")) { vm.settleBet(bet, as: .cashout) },
                .cancel()
            ]
        )
    }
}

// MARK: - Bet Row

struct BetRowView: View {
    let bet: Bet
    @Environment(\.theme) var theme

    var body: some View {
        HStack(spacing: 12) {
            // Sport icon
            Image(systemName: bet.sport.iconName)
                .font(.title3)
                .foregroundStyle(statusColor)
                .frame(width: 36, height: 36)
                .background(statusColor.opacity(0.12))
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(bet.title)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(theme.onSurface)
                        .lineLimit(1)
                    Spacer()
                    statusBadge
                }

                HStack(spacing: 8) {
                    // Live score if available
                    if let score = bet.liveScore, !score.isFinal {
                        liveScoreView(score)
                    } else {
                        Text(bet.sportsbook)
                            .font(.caption)
                            .foregroundStyle(theme.onSurface.opacity(0.5))
                    }
                    Spacer()
                    Text(bet.formattedOdds)
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(theme.accent)
                }

                HStack {
                    Text("Stake: $\(bet.stake, specifier: "%.2f")")
                        .font(.caption2)
                        .foregroundStyle(theme.onSurface.opacity(0.4))
                    Spacer()
                    if let profit = bet.profit {
                        Text(profit >= 0 ? "+$\(profit, specifier: "%.2f")" : "-$\(abs(profit), specifier: "%.2f")")
                            .font(.caption2.bold())
                            .foregroundStyle(profit >= 0 ? theme.primary : .red)
                    } else {
                        Text("Win: $\(bet.potentialPayout, specifier: "%.2f")")
                            .font(.caption2)
                            .foregroundStyle(theme.onSurface.opacity(0.4))
                    }
                }
            }
        }
        .padding(.vertical, 4)
    }

    private func liveScoreView(_ score: LiveScore) -> some View {
        HStack(spacing: 4) {
            Circle()
                .fill(.red)
                .frame(width: 6, height: 6)
            Text("LIVE")
                .font(.caption2.bold())
                .foregroundStyle(.red)
            Text(score.displayScore)
                .font(.caption.monospacedDigit())
                .foregroundStyle(theme.onSurface)
            Text("• \(score.period) \(score.clock)")
                .font(.caption2)
                .foregroundStyle(theme.onSurface.opacity(0.5))
        }
    }

    private var statusColor: Color {
        switch bet.status {
        case .won:     return .green
        case .lost:    return .red
        case .push:    return .orange
        case .live:    return .red
        case .cashout: return .yellow
        case .pending: return theme.primary
        }
    }

    private var statusBadge: some View {
        Text(bet.status.displayName)
            .font(.caption2.bold())
            .foregroundStyle(statusColor)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(statusColor.opacity(0.15))
            .clipShape(Capsule())
    }
}
