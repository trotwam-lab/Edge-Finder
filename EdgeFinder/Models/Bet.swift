import Foundation

// MARK: - Bet Status

enum BetStatus: String, Codable, CaseIterable {
    case pending   = "pending"
    case won       = "won"
    case lost      = "lost"
    case push      = "push"
    case cashout   = "cashout"
    case live      = "live"

    var displayName: String {
        switch self {
        case .pending:  return "Pending"
        case .won:      return "Won"
        case .lost:     return "Lost"
        case .push:     return "Push"
        case .cashout:  return "Cash Out"
        case .live:     return "Live"
        }
    }
}

// MARK: - Sport

enum Sport: String, Codable, CaseIterable {
    case nfl   = "NFL"
    case nba   = "NBA"
    case mlb   = "MLB"
    case nhl   = "NHL"
    case ncaaf = "NCAAF"
    case ncaab = "NCAAB"
    case soccer = "Soccer"
    case mma   = "MMA"
    case boxing = "Boxing"
    case tennis = "Tennis"

    var iconName: String {
        switch self {
        case .nfl, .ncaaf:  return "football"
        case .nba, .ncaab:  return "basketball"
        case .mlb:           return "baseball"
        case .nhl:           return "hockey.puck"
        case .soccer:        return "soccerball"
        case .mma, .boxing:  return "figure.boxing"
        case .tennis:        return "tennis.racket"
        }
    }
}

// MARK: - Bet Type

enum BetType: String, Codable, CaseIterable {
    case moneyline    = "Moneyline"
    case spread       = "Spread"
    case total        = "Total (O/U)"
    case parlay       = "Parlay"
    case prop         = "Prop"
    case futures      = "Futures"
    case teaser       = "Teaser"
    case roundRobin   = "Round Robin"
}

// MARK: - Live Score

struct LiveScore: Codable, Equatable {
    var homeScore: Int
    var awayScore: Int
    var period: String
    var clock: String
    var isHalftime: Bool
    var isFinal: Bool

    var displayScore: String {
        "\(awayScore) - \(homeScore)"
    }
}

// MARK: - Bet Leg (for parlays)

struct BetLeg: Identifiable, Codable, Equatable {
    var id: UUID
    var game: String
    var selection: String
    var odds: Int
    var sport: Sport
    var status: BetStatus
    var liveScore: LiveScore?

    init(
        id: UUID = UUID(),
        game: String,
        selection: String,
        odds: Int,
        sport: Sport,
        status: BetStatus = .pending,
        liveScore: LiveScore? = nil
    ) {
        self.id = id
        self.game = game
        self.selection = selection
        self.odds = odds
        self.sport = sport
        self.status = status
        self.liveScore = liveScore
    }

    var formattedOdds: String {
        odds > 0 ? "+\(odds)" : "\(odds)"
    }
}

// MARK: - Bet

struct Bet: Identifiable, Codable, Equatable {
    var id: UUID
    var title: String
    var type: BetType
    var sport: Sport
    var sportsbook: String
    var stake: Double
    var odds: Int
    var status: BetStatus
    var legs: [BetLeg]
    var liveScore: LiveScore?
    var gameStartTime: Date
    var placedAt: Date
    var settledAt: Date?
    var notes: String
    var liveActivityID: String?
    var notificationsEnabled: Bool

    init(
        id: UUID = UUID(),
        title: String,
        type: BetType,
        sport: Sport,
        sportsbook: String,
        stake: Double,
        odds: Int,
        status: BetStatus = .pending,
        legs: [BetLeg] = [],
        liveScore: LiveScore? = nil,
        gameStartTime: Date = Date(),
        placedAt: Date = Date(),
        settledAt: Date? = nil,
        notes: String = "",
        liveActivityID: String? = nil,
        notificationsEnabled: Bool = true
    ) {
        self.id = id
        self.title = title
        self.type = type
        self.sport = sport
        self.sportsbook = sportsbook
        self.stake = stake
        self.odds = odds
        self.status = status
        self.legs = legs
        self.liveScore = liveScore
        self.gameStartTime = gameStartTime
        self.placedAt = placedAt
        self.settledAt = settledAt
        self.notes = notes
        self.liveActivityID = liveActivityID
        self.notificationsEnabled = notificationsEnabled
    }

    // MARK: - Calculated Properties

    var formattedOdds: String {
        odds > 0 ? "+\(odds)" : "\(odds)"
    }

    var potentialPayout: Double {
        if odds > 0 {
            return stake * (Double(odds) / 100.0)
        } else {
            return stake * (100.0 / Double(abs(odds)))
        }
    }

    var totalReturn: Double {
        potentialPayout + stake
    }

    var profit: Double? {
        switch status {
        case .won:      return potentialPayout
        case .lost:     return -stake
        case .push:     return 0
        case .cashout:  return settledAt != nil ? potentialPayout * 0.7 : nil
        default:        return nil
    }
    }

    var roi: Double? {
        guard let p = profit else { return nil }
        return (p / stake) * 100
    }

    var isLive: Bool {
        status == .live || (status == .pending && Date() >= gameStartTime)
    }

    var isParlay: Bool {
        type == .parlay || type == .teaser || type == .roundRobin
    }
}

// MARK: - Bet Statistics

struct BetStatistics: Codable {
    var totalBets: Int
    var wins: Int
    var losses: Int
    var pushes: Int
    var pendingCount: Int
    var totalStaked: Double
    var totalProfit: Double
    var roi: Double
    var winRate: Double
    var avgOdds: Double
    var longestWinStreak: Int
    var currentStreak: Int
    var currentStreakIsWin: Bool

    var formattedROI: String {
        String(format: "%.1f%%", roi)
    }

    var formattedWinRate: String {
        String(format: "%.1f%%", winRate * 100)
    }

    static var empty: BetStatistics {
        BetStatistics(
            totalBets: 0, wins: 0, losses: 0, pushes: 0,
            pendingCount: 0, totalStaked: 0, totalProfit: 0,
            roi: 0, winRate: 0, avgOdds: 0,
            longestWinStreak: 0, currentStreak: 0, currentStreakIsWin: false
        )
    }
}
