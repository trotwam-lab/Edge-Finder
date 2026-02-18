import Foundation

// MARK: - Odds Movement

enum OddsMovement: String, Codable {
    case up    = "up"
    case down  = "down"
    case flat  = "flat"
}

// MARK: - Odds Line

struct OddsLine: Codable, Equatable {
    var sportsbook: String
    var homeOdds: Int
    var awayOdds: Int
    var drawOdds: Int?
    var spread: Double
    var homeSpreadOdds: Int
    var awaySpreadOdds: Int
    var total: Double
    var overOdds: Int
    var underOdds: Int
    var lastUpdated: Date

    var formattedHomeOdds: String { homeOdds > 0 ? "+\(homeOdds)" : "\(homeOdds)" }
    var formattedAwayOdds: String { awayOdds > 0 ? "+\(awayOdds)" : "\(awayOdds)" }
    var formattedSpread: String { spread > 0 ? "+\(spread)" : "\(spread)" }
}

// MARK: - Edge Data

struct EdgeData: Codable, Equatable {
    var selection: String
    var trueOdds: Int
    var marketOdds: Int
    var edgePercent: Double
    var impliedProbability: Double
    var trueProbability: Double
    var expectedValue: Double

    var isPositiveEV: Bool { expectedValue > 0 }

    var formattedEdge: String {
        String(format: "%.1f%%", edgePercent)
    }

    var formattedEV: String {
        expectedValue > 0
            ? String(format: "+$%.2f", expectedValue)
            : String(format: "-$%.2f", abs(expectedValue))
    }
}

// MARK: - Game

struct Game: Identifiable, Codable, Equatable {
    var id: String
    var sport: Sport
    var homeTeam: String
    var awayTeam: String
    var homeAbbr: String
    var awayAbbr: String
    var homeRecord: String
    var awayRecord: String
    var gameTime: Date
    var venue: String
    var liveScore: LiveScore?
    var oddsLines: [OddsLine]
    var edges: [EdgeData]
    var isFeatured: Bool

    var isLive: Bool {
        guard liveScore != nil else { return false }
        return !(liveScore?.isFinal ?? false)
    }

    var bestLine: OddsLine? { oddsLines.first }

    var topEdge: EdgeData? {
        edges.filter { $0.isPositiveEV }
              .max { $0.edgePercent < $1.edgePercent }
    }

    var displayTime: String {
        if let score = liveScore {
            if score.isFinal { return "Final" }
            if score.isHalftime { return "Halftime" }
            return "\(score.period) • \(score.clock)"
        }
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        return formatter.string(from: gameTime)
    }
}

// MARK: - Trending Pick

struct TrendingPick: Identifiable, Codable {
    var id: UUID
    var game: String
    var selection: String
    var sport: Sport
    var odds: Int
    var edgePercent: Double
    var publicBettingPercent: Double
    var moneyPercent: Double
    var sharpAction: Bool
    var recordFor: String
    var recordAgainst: String

    var formattedOdds: String { odds > 0 ? "+\(odds)" : "\(odds)" }
}
