import WidgetKit
import SwiftUI

@main
struct EdgeFinderWidgetBundle: WidgetBundle {
    var body: some Widget {
        // Lock Screen Live Activity (iOS 16.1+)
        BetLiveActivityWidget()

        // Standard home/lock screen widgets
        BetSummaryWidget()
    }
}

// MARK: - Bet Summary Widget (home + lock screen)

struct BetSummaryEntry: TimelineEntry {
    let date: Date
    let totalProfit: Double
    let roi: String
    let wins: Int
    let losses: Int
    let liveCount: Int
    let liveBets: [SimpleLiveBet]
}

struct SimpleLiveBet: Codable {
    var title: String
    var score: String
    var period: String
    var odds: String
}

struct BetSummaryProvider: TimelineProvider {
    func placeholder(in context: Context) -> BetSummaryEntry {
        BetSummaryEntry(date: Date(), totalProfit: 142.50, roi: "+8.2%", wins: 24, losses: 16, liveCount: 2, liveBets: [
            SimpleLiveBet(title: "Chiefs -3.5", score: "21-17", period: "Q4", odds: "-110")
        ])
    }

    func getSnapshot(in context: Context, completion: @escaping (BetSummaryEntry) -> Void) {
        completion(placeholder(in: context))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<BetSummaryEntry>) -> Void) {
        let entry = loadEntry()
        // Refresh every 30 seconds when live bets active, else every 30 minutes
        let interval: TimeInterval = entry.liveCount > 0 ? 30 : 1800
        let timeline = Timeline(entries: [entry], policy: .after(.now.addingTimeInterval(interval)))
        completion(timeline)
    }

    private func loadEntry() -> BetSummaryEntry {
        // Read from shared App Group UserDefaults
        let defaults = UserDefaults(suiteName: "group.com.edgefinder.app")
        let profit     = defaults?.double(forKey: "totalProfit") ?? 0
        let roi        = defaults?.string(forKey: "roi") ?? "0%"
        let wins       = defaults?.integer(forKey: "wins") ?? 0
        let losses     = defaults?.integer(forKey: "losses") ?? 0
        let liveCount  = defaults?.integer(forKey: "liveCount") ?? 0

        var liveBets: [SimpleLiveBet] = []
        if let data = defaults?.data(forKey: "liveBets"),
           let decoded = try? JSONDecoder().decode([SimpleLiveBet].self, from: data) {
            liveBets = decoded
        }

        return BetSummaryEntry(date: Date(), totalProfit: profit, roi: roi,
                               wins: wins, losses: losses,
                               liveCount: liveCount, liveBets: liveBets)
    }
}

struct BetSummaryWidget: Widget {
    let kind = "BetSummaryWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: BetSummaryProvider()) { entry in
            BetSummaryWidgetView(entry: entry)
        }
        .configurationDisplayName("EdgeFinder Tracker")
        .description("Track your bets and live scores at a glance.")
        .supportedFamilies([
            .systemSmall,
            .systemMedium,
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryInline
        ])
    }
}

// MARK: - Widget View

struct BetSummaryWidgetView: View {
    let entry: BetSummaryEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:
            smallView
        case .systemMedium:
            mediumView
        case .accessoryCircular:
            circularView
        case .accessoryRectangular:
            rectangularView
        case .accessoryInline:
            inlineView
        default:
            smallView
        }
    }

    // MARK: - Small Widget

    private var smallView: some View {
        ZStack {
            Color.black
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Image(systemName: "chart.line.uptrend.xyaxis.circle.fill")
                        .foregroundStyle(.green)
                        .font(.caption)
                    Text("EdgeFinder")
                        .font(.caption2.bold())
                        .foregroundStyle(.green)
                    Spacer()
                    if entry.liveCount > 0 {
                        HStack(spacing: 2) {
                            Circle().fill(.red).frame(width: 5, height: 5)
                            Text("\(entry.liveCount)")
                                .font(.caption2.bold())
                                .foregroundStyle(.red)
                        }
                    }
                }

                Spacer()

                Text(entry.totalProfit >= 0
                     ? "+$\(String(format: "%.2f", entry.totalProfit))"
                     : "-$\(String(format: "%.2f", abs(entry.totalProfit)))")
                    .font(.system(size: 20, weight: .black, design: .rounded))
                    .foregroundStyle(entry.totalProfit >= 0 ? .green : .red)

                Text("ROI: \(entry.roi)")
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.6))

                Text("\(entry.wins)W - \(entry.losses)L")
                    .font(.caption2.bold())
                    .foregroundStyle(.white.opacity(0.8))
            }
            .padding(12)
        }
    }

    // MARK: - Medium Widget

    private var mediumView: some View {
        ZStack {
            Color.black
            HStack(spacing: 16) {
                // Stats column
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Image(systemName: "chart.line.uptrend.xyaxis.circle.fill")
                            .foregroundStyle(.green)
                            .font(.caption)
                        Text("EdgeFinder")
                            .font(.caption2.bold())
                            .foregroundStyle(.green)
                    }
                    Spacer()
                    Text(entry.totalProfit >= 0
                         ? "+$\(String(format: "%.2f", entry.totalProfit))"
                         : "-$\(String(format: "%.2f", abs(entry.totalProfit)))")
                        .font(.system(size: 22, weight: .black, design: .rounded))
                        .foregroundStyle(entry.totalProfit >= 0 ? .green : .red)
                    Text("ROI \(entry.roi)")
                        .font(.caption2)
                        .foregroundStyle(.white.opacity(0.6))
                    Text("\(entry.wins)W - \(entry.losses)L")
                        .font(.caption2.bold())
                        .foregroundStyle(.white.opacity(0.8))
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                // Live bets column
                VStack(alignment: .leading, spacing: 6) {
                    if entry.liveCount > 0 {
                        HStack(spacing: 4) {
                            Circle().fill(.red).frame(width: 6, height: 6)
                            Text("\(entry.liveCount) Live")
                                .font(.caption2.bold())
                                .foregroundStyle(.red)
                        }
                        ForEach(entry.liveBets.prefix(2), id: \.title) { bet in
                            VStack(alignment: .leading, spacing: 1) {
                                Text(bet.title)
                                    .font(.caption2.bold())
                                    .foregroundStyle(.white)
                                    .lineLimit(1)
                                Text("\(bet.score) • \(bet.period)")
                                    .font(.system(size: 9).monospacedDigit())
                                    .foregroundStyle(.white.opacity(0.5))
                            }
                        }
                    } else {
                        Text("No live bets")
                            .font(.caption2)
                            .foregroundStyle(.white.opacity(0.4))
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(14)
        }
    }

    // MARK: - Lock Screen Widgets

    private var circularView: some View {
        ZStack {
            AccessoryWidgetBackground()
            VStack(spacing: 1) {
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .font(.caption2.bold())
                Text(entry.roi)
                    .font(.system(size: 9, weight: .bold))
            }
        }
    }

    private var rectangularView: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Image(systemName: "chart.line.uptrend.xyaxis.circle.fill")
                    .font(.caption2)
                Text("EdgeFinder Tracker")
                    .font(.caption2.bold())
                if entry.liveCount > 0 {
                    Spacer()
                    HStack(spacing: 2) {
                        Circle().fill(.red).frame(width: 4, height: 4)
                        Text("\(entry.liveCount) live")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(.red)
                    }
                }
            }
            Text(entry.totalProfit >= 0
                 ? "+$\(String(format: "%.2f", entry.totalProfit)) • ROI \(entry.roi)"
                 : "-$\(String(format: "%.2f", abs(entry.totalProfit))) • ROI \(entry.roi)")
                .font(.system(size: 10, weight: .bold))
            Text("\(entry.wins)W - \(entry.losses)L")
                .font(.system(size: 9))
                .foregroundStyle(.secondary)
        }
    }

    private var inlineView: some View {
        Label {
            Text(entry.liveCount > 0
                 ? "\(entry.liveCount) live • \(entry.roi)"
                 : "\(entry.wins)W-\(entry.losses)L • \(entry.roi)")
        } icon: {
            Image(systemName: "chart.line.uptrend.xyaxis")
        }
    }
}
