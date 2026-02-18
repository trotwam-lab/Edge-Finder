import ActivityKit
import WidgetKit
import SwiftUI

// MARK: - Live Activity Widget

struct BetLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: BetLiveActivityAttributes.self) { context in
            // Lock Screen / Banner view
            BetLockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded view (when long-pressed)
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(context.attributes.awayTeam)
                            .font(.caption2.bold())
                            .foregroundStyle(.white)
                        Text("\(context.state.awayScore)")
                            .font(.system(size: 22, weight: .black, design: .rounded))
                            .foregroundStyle(.white)
                            .monospacedDigit()
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(context.attributes.homeTeam)
                            .font(.caption2.bold())
                            .foregroundStyle(.white)
                        Text("\(context.state.homeScore)")
                            .font(.system(size: 22, weight: .black, design: .rounded))
                            .foregroundStyle(.white)
                            .monospacedDigit()
                    }
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(spacing: 2) {
                        if context.state.isFinal {
                            Text("FINAL")
                                .font(.caption2.bold())
                                .foregroundStyle(.white.opacity(0.7))
                        } else if context.state.isHalftime {
                            Text("HALF")
                                .font(.caption2.bold())
                                .foregroundStyle(.orange)
                        } else {
                            Text(context.state.period)
                                .font(.caption2.bold())
                                .foregroundStyle(.red)
                            Text(context.state.clock)
                                .font(.system(size: 10, design: .monospaced))
                                .foregroundStyle(.white.opacity(0.7))
                        }
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    betStatusBar(context: context)
                        .padding(.horizontal, 12)
                        .padding(.bottom, 4)
                }
            } compactLeading: {
                // Compact leading: away score
                HStack(spacing: 3) {
                    Circle().fill(.red).frame(width: 5, height: 5)
                    Text("\(context.state.awayScore)")
                        .font(.caption.bold().monospacedDigit())
                        .foregroundStyle(.white)
                }
            } compactTrailing: {
                // Compact trailing: home score
                Text("\(context.state.homeScore)")
                    .font(.caption.bold().monospacedDigit())
                    .foregroundStyle(.white)
            } minimal: {
                // Minimal: live indicator
                Circle()
                    .fill(context.state.isFinal ? Color.gray : Color.red)
                    .frame(width: 8, height: 8)
            }
            .keylineTint(context.state.betStatus == "won" ? .green :
                         context.state.betStatus == "lost" ? .red : .primary)
        }
    }

    @ViewBuilder
    private func betStatusBar(context: ActivityViewContext<BetLiveActivityAttributes>) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 1) {
                Text(context.attributes.betSelection)
                    .font(.caption2.bold())
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Text("\(context.attributes.odds) • \(context.attributes.sportsbook)")
                    .font(.system(size: 9))
                    .foregroundStyle(.white.opacity(0.6))
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 1) {
                if let profit = context.state.currentProfit {
                    Text(profit >= 0
                         ? "+$\(String(format: "%.2f", profit))"
                         : "-$\(String(format: "%.2f", abs(profit)))")
                        .font(.caption2.bold())
                        .foregroundStyle(profit >= 0 ? .green : .red)
                } else {
                    Text("Win $\(String(format: "%.2f", context.state.potentialPayout))")
                        .font(.caption2.bold())
                        .foregroundStyle(.green.opacity(0.8))
                }
                Text("Stake $\(String(format: "%.2f", context.attributes.stake))")
                    .font(.system(size: 9))
                    .foregroundStyle(.white.opacity(0.6))
            }
        }
    }
}

// MARK: - Lock Screen View

struct BetLockScreenView: View {
    let context: ActivityViewContext<BetLiveActivityAttributes>

    var betStatusColor: Color {
        switch context.state.betStatus {
        case "won":  return .green
        case "lost": return .red
        case "push": return .orange
        default:     return .primary
        }
    }

    var body: some View {
        VStack(spacing: 10) {
            // Top bar: app name + bet status
            HStack {
                HStack(spacing: 4) {
                    Image(systemName: "chart.line.uptrend.xyaxis.circle.fill")
                        .foregroundStyle(.green)
                        .font(.caption)
                    Text("EdgeFinder")
                        .font(.caption2.bold())
                        .foregroundStyle(.white.opacity(0.7))
                }
                Spacer()
                liveIndicator
            }

            // Score row
            scoreRow

            // Bet info row
            betInfoRow

            // Status bar
            betStatusRow
        }
        .padding(14)
        .background(Color.black.opacity(0.85))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    // MARK: - Live Indicator

    private var liveIndicator: some View {
        Group {
            if context.state.isFinal {
                Text("FINAL")
                    .font(.caption2.bold())
                    .foregroundStyle(.white.opacity(0.6))
            } else {
                HStack(spacing: 4) {
                    Circle()
                        .fill(.red)
                        .frame(width: 6, height: 6)
                    Text("LIVE")
                        .font(.caption2.bold())
                        .foregroundStyle(.red)
                }
            }
        }
    }

    // MARK: - Score Row

    private var scoreRow: some View {
        HStack(alignment: .center, spacing: 0) {
            // Away team
            VStack(spacing: 2) {
                Text(context.attributes.awayTeam)
                    .font(.caption.bold())
                    .foregroundStyle(.white.opacity(0.8))
                Text("\(context.state.awayScore)")
                    .font(.system(size: 32, weight: .black, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
            }
            .frame(maxWidth: .infinity)

            // Clock / period
            VStack(spacing: 2) {
                if context.state.isHalftime {
                    Text("HALF")
                        .font(.caption2.bold())
                        .foregroundStyle(.orange)
                } else {
                    Text(context.state.period)
                        .font(.caption2.bold())
                        .foregroundStyle(.red)
                    Text(context.state.clock)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(.white.opacity(0.6))
                }
            }
            .frame(width: 52)

            // Home team
            VStack(spacing: 2) {
                Text(context.attributes.homeTeam)
                    .font(.caption.bold())
                    .foregroundStyle(.white.opacity(0.8))
                Text("\(context.state.homeScore)")
                    .font(.system(size: 32, weight: .black, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
            }
            .frame(maxWidth: .infinity)
        }
    }

    // MARK: - Bet Info Row

    private var betInfoRow: some View {
        HStack {
            Image(systemName: "list.bullet.clipboard.fill")
                .foregroundStyle(.green.opacity(0.8))
                .font(.caption2)
            Text(context.attributes.betSelection)
                .font(.caption2.bold())
                .foregroundStyle(.white)
                .lineLimit(1)
            Spacer()
            Text(context.attributes.odds)
                .font(.caption2.bold())
                .foregroundStyle(.green)
        }
    }

    // MARK: - Bet Status Row

    private var betStatusRow: some View {
        HStack {
            HStack(spacing: 3) {
                Image(systemName: "dollarsign.circle.fill")
                    .foregroundStyle(.white.opacity(0.5))
                    .font(.caption2)
                Text("Stake: $\(String(format: "%.2f", context.attributes.stake))")
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.5))
            }
            Spacer()
            if let profit = context.state.currentProfit {
                Text(profit >= 0
                     ? "Won +$\(String(format: "%.2f", profit))"
                     : "Lost -$\(String(format: "%.2f", abs(profit)))")
                    .font(.caption2.bold())
                    .foregroundStyle(profit >= 0 ? .green : .red)
            } else {
                Text("To Win: $\(String(format: "%.2f", context.state.potentialPayout))")
                    .font(.caption2.bold())
                    .foregroundStyle(.green.opacity(0.8))
            }
        }
    }
}
