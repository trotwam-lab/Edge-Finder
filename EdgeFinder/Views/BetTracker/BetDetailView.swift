import SwiftUI

struct BetDetailView: View {
    let bet: Bet
    @EnvironmentObject var vm: BetTrackerViewModel
    @EnvironmentObject var liveActivityService: LiveActivityService
    @Environment(\.theme) var theme
    @Environment(\.dismiss) var dismiss
    @State private var showSettleSheet = false

    var body: some View {
        ZStack {
            theme.background.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 16) {
                    // Header card
                    headerCard

                    // Live score card (if live)
                    if let score = bet.liveScore {
                        liveScoreCard(score)
                    }

                    // Financial details
                    financialCard

                    // Parlay legs
                    if bet.isParlay && !bet.legs.isEmpty {
                        parlayLegsCard
                    }

                    // Info section
                    infoCard

                    // Actions
                    if [.pending, .live].contains(bet.status) {
                        actionButtons
                    }
                }
                .padding()
            }
        }
        .navigationTitle(bet.title)
        .navigationBarTitleDisplayMode(.inline)
        .actionSheet(isPresented: $showSettleSheet) {
            ActionSheet(
                title: Text("Settle Bet"),
                buttons: [
                    .default(Text("Won \u{1F3C6}")) { vm.settleBet(bet, as: .won); dismiss() },
                    .default(Text("Lost \u{274C}"))  { vm.settleBet(bet, as: .lost); dismiss() },
                    .default(Text("Push \u{1F91D}")) { vm.settleBet(bet, as: .push); dismiss() },
                    .default(Text("Cash Out \u{1F4B0}")) { vm.settleBet(bet, as: .cashout); dismiss() },
                    .cancel()
                ]
            )
        }
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                liveActivityToggle
            }
        }
    }

    // MARK: - Header Card

    private var headerCard: some View {
        VStack(spacing: 12) {
            HStack {
                Image(systemName: bet.sport.iconName)
                    .font(.title2)
                    .foregroundStyle(theme.primary)
                VStack(alignment: .leading, spacing: 2) {
                    Text(bet.sport.rawValue)
                        .font(.caption)
                        .foregroundStyle(theme.onSurface.opacity(0.5))
                    Text(bet.type.rawValue)
                        .font(.subheadline.bold())
                        .foregroundStyle(theme.onSurface)
                }
                Spacer()
                statusBadge
            }
            Divider().background(theme.onSurface.opacity(0.1))
            HStack {
                VStack(alignment: .leading) {
                    Text("Odds")
                        .font(.caption2)
                        .foregroundStyle(theme.onSurface.opacity(0.5))
                    Text(bet.formattedOdds)
                        .font(.title2.bold())
                        .foregroundStyle(theme.accent)
                }
                Spacer()
                VStack(alignment: .trailing) {
                    Text("Sportsbook")
                        .font(.caption2)
                        .foregroundStyle(theme.onSurface.opacity(0.5))
                    Text(bet.sportsbook)
                        .font(.subheadline.bold())
                        .foregroundStyle(theme.onSurface)
                }
            }
        }
        .padding()
        .background(theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    // MARK: - Live Score Card

    private func liveScoreCard(_ score: LiveScore) -> some View {
        VStack(spacing: 8) {
            HStack {
                Circle().fill(.red).frame(width: 8, height: 8)
                Text(score.isFinal ? "FINAL" : "LIVE")
                    .font(.caption.bold())
                    .foregroundStyle(.red)
                Spacer()
                Text("\(score.period) • \(score.clock)")
                    .font(.caption)
                    .foregroundStyle(theme.onSurface.opacity(0.6))
            }

            HStack {
                Spacer()
                Text(score.displayScore)
                    .font(.system(size: 36, weight: .black, design: .rounded))
                    .foregroundStyle(theme.onSurface)
                    .monospacedDigit()
                Spacer()
            }

            if score.isHalftime {
                Text("HALFTIME")
                    .font(.caption.bold())
                    .foregroundStyle(theme.accent)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(theme.accent.opacity(0.15))
                    .clipShape(Capsule())
            }
        }
        .padding()
        .background(theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(.red.opacity(0.4), lineWidth: 1)
        )
    }

    // MARK: - Financial Card

    private var financialCard: some View {
        VStack(spacing: 12) {
            Text("Financials")
                .font(.headline)
                .foregroundStyle(theme.onSurface)
                .frame(maxWidth: .infinity, alignment: .leading)
            Divider().background(theme.onSurface.opacity(0.1))

            detailRow(label: "Stake", value: String(format: "$%.2f", bet.stake))
            detailRow(label: "To Win", value: String(format: "$%.2f", bet.potentialPayout), valueColor: theme.primary)
            detailRow(label: "Total Return", value: String(format: "$%.2f", bet.totalReturn))

            if let profit = bet.profit {
                Divider().background(theme.onSurface.opacity(0.1))
                detailRow(
                    label: "Profit/Loss",
                    value: profit >= 0
                        ? String(format: "+$%.2f", profit)
                        : String(format: "-$%.2f", abs(profit)),
                    valueColor: profit >= 0 ? theme.primary : .red,
                    bold: true
                )
                if let roi = bet.roi {
                    detailRow(
                        label: "ROI",
                        value: String(format: "%.1f%%", roi),
                        valueColor: roi >= 0 ? theme.primary : .red
                    )
                }
            }
        }
        .padding()
        .background(theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private func detailRow(label: String, value: String, valueColor: Color? = nil, bold: Bool = false) -> some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(theme.onSurface.opacity(0.6))
            Spacer()
            Text(value)
                .font(bold ? .subheadline.bold() : .subheadline)
                .foregroundStyle(valueColor ?? theme.onSurface)
        }
    }

    // MARK: - Parlay Legs

    private var parlayLegsCard: some View {
        VStack(spacing: 10) {
            Text("Parlay Legs (\(bet.legs.count))")
                .font(.headline)
                .foregroundStyle(theme.onSurface)
                .frame(maxWidth: .infinity, alignment: .leading)
            ForEach(bet.legs) { leg in
                HStack {
                    Image(systemName: leg.sport.iconName)
                        .foregroundStyle(legStatusColor(leg.status))
                        .frame(width: 24)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(leg.game)
                            .font(.caption.bold())
                            .foregroundStyle(theme.onSurface)
                        Text(leg.selection)
                            .font(.caption2)
                            .foregroundStyle(theme.onSurface.opacity(0.6))
                    }
                    Spacer()
                    if let score = leg.liveScore {
                        Text(score.displayScore)
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(theme.accent)
                    }
                    Text(leg.formattedOdds)
                        .font(.caption.bold())
                        .foregroundStyle(legStatusColor(leg.status))
                }
                .padding(.vertical, 4)
                if leg.id != bet.legs.last?.id {
                    Divider().background(theme.onSurface.opacity(0.08))
                }
            }
        }
        .padding()
        .background(theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private func legStatusColor(_ status: BetStatus) -> Color {
        switch status {
        case .won: return .green
        case .lost: return .red
        case .push: return .orange
        case .live: return .red
        default: return theme.primary
        }
    }

    // MARK: - Info Card

    private var infoCard: some View {
        VStack(spacing: 10) {
            Text("Details")
                .font(.headline)
                .foregroundStyle(theme.onSurface)
                .frame(maxWidth: .infinity, alignment: .leading)
            Divider().background(theme.onSurface.opacity(0.1))
            detailRow(label: "Placed", value: bet.placedAt.formatted(date: .abbreviated, time: .shortened))
            detailRow(label: "Game Time", value: bet.gameStartTime.formatted(date: .abbreviated, time: .shortened))
            if let settled = bet.settledAt {
                detailRow(label: "Settled", value: settled.formatted(date: .abbreviated, time: .shortened))
            }
            if !bet.notes.isEmpty {
                Divider().background(theme.onSurface.opacity(0.1))
                VStack(alignment: .leading, spacing: 4) {
                    Text("Notes")
                        .font(.caption)
                        .foregroundStyle(theme.onSurface.opacity(0.5))
                    Text(bet.notes)
                        .font(.subheadline)
                        .foregroundStyle(theme.onSurface)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding()
        .background(theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    // MARK: - Action Buttons

    private var actionButtons: some View {
        VStack(spacing: 10) {
            Button {
                showSettleSheet = true
            } label: {
                Label("Settle Bet", systemImage: "checkmark.circle.fill")
                    .font(.headline)
                    .foregroundStyle(.black)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(theme.primary)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
            }
        }
    }

    // MARK: - Live Activity Toggle

    private var liveActivityToggle: some View {
        Button {
            Task {
                if bet.liveActivityID != nil {
                    await liveActivityService.end(for: bet)
                } else {
                    await liveActivityService.start(for: bet)
                }
            }
        } label: {
            Image(systemName: bet.liveActivityID != nil ? "lock.open.fill" : "lock.fill")
                .foregroundStyle(theme.primary)
        }
    }

    // MARK: - Status Badge

    private var statusBadge: some View {
        let color: Color = {
            switch bet.status {
            case .won: return .green
            case .lost: return .red
            case .push: return .orange
            case .live: return .red
            case .cashout: return .yellow
            case .pending: return theme.primary
            }
        }()
        return Text(bet.status.displayName)
            .font(.caption.bold())
            .foregroundStyle(color)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(color.opacity(0.15))
            .clipShape(Capsule())
    }
}
