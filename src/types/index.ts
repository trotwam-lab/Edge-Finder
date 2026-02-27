// ============================================================
// Core Domain Types for Edge-Finder
// ============================================================

// --- Sports & Games ---

export type Sport =
  | "americanfootball_nfl"
  | "americanfootball_ncaaf"
  | "basketball_nba"
  | "basketball_ncaab"
  | "baseball_mlb"
  | "icehockey_nhl"
  | "soccer_epl"
  | "soccer_usa_mls"
  | "mma_mixed_martial_arts"
  | "tennis_atp"
  | string;

export interface SportConfig {
  key: Sport;
  label: string;
  icon: string;
  group: string;
  active: boolean;
}

export interface Game {
  id: string;
  sport: Sport;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  completed: boolean;
  scores?: { home: number; away: number };
  bookmakers: Bookmaker[];
}

export interface Bookmaker {
  key: string;
  title: string;
  lastUpdate: string;
  markets: Market[];
}

export interface Market {
  key: MarketType;
  lastUpdate: string;
  outcomes: Outcome[];
}

export type MarketType =
  | "h2h"
  | "spreads"
  | "totals"
  | "outrights"
  | "player_props"
  | string;

export interface Outcome {
  name: string;
  price: number;
  point?: number;
  description?: string;
}

// --- Line Movement ---

export interface LineSnapshot {
  timestamp: string;
  bookmaker: string;
  market: MarketType;
  outcomes: Outcome[];
}

export interface LineMovement {
  gameId: string;
  sport: Sport;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  snapshots: LineSnapshot[];
  openingLine?: LineSnapshot;
  currentLine?: LineSnapshot;
  totalMovement?: number;
  direction: "home" | "away" | "stable";
  steamMove: boolean;
  reverseLineMove: boolean;
}

export interface LineMovementFilter {
  sport?: Sport;
  market?: MarketType;
  bookmaker?: string;
  minMovement?: number;
  steamOnly?: boolean;
  reverseOnly?: boolean;
  dateRange?: { start: string; end: string };
}

// --- Edge Detection ---

export type EdgeType =
  | "arbitrage"
  | "positive_ev"
  | "steam_move"
  | "reverse_line"
  | "closing_line_value"
  | "injury_impact"
  | "public_fade"
  | "sharp_money";

export type EdgeStrength = "extreme" | "strong" | "moderate" | "mild";

export interface Edge {
  id: string;
  type: EdgeType;
  strength: EdgeStrength;
  gameId: string;
  sport: Sport;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  market: MarketType;
  description: string;
  profitPercentage: number;
  confidence: number; // 0-100
  bookmakers: string[];
  outcomes: EdgeOutcome[];
  detectedAt: string;
  expiresAt?: string;
  relatedInjuries?: Injury[];
  metadata: Record<string, unknown>;
}

export interface EdgeOutcome {
  bookmaker: string;
  selection: string;
  odds: number;
  stake?: number;
  expectedProfit?: number;
}

export interface ArbitrageOpportunity extends Edge {
  type: "arbitrage";
  totalImpliedProbability: number;
  guaranteedProfit: number;
  optimalStakes: { bookmaker: string; selection: string; stake: number }[];
}

// --- Injuries ---

export type InjuryStatus =
  | "out"
  | "doubtful"
  | "questionable"
  | "probable"
  | "day-to-day";

export interface Injury {
  id: string;
  playerName: string;
  team: string;
  sport: Sport;
  position: string;
  status: InjuryStatus;
  injuryType: string;
  description: string;
  reportDate: string;
  expectedReturn?: string;
  impactRating: number; // 1-10, how much this affects the line
  source: string;
  lastUpdated: string;
}

export interface InjuryImpactAnalysis {
  gameId: string;
  injuries: Injury[];
  totalImpact: number;
  lineShiftExpected: number;
  affectedMarkets: MarketType[];
  recommendation: string;
}

// --- User & Payment ---

export type SubscriptionTier = "free" | "pro" | "elite";

export interface User {
  id: string;
  email: string;
  tier: SubscriptionTier;
  stripeCustomerId?: string;
  preferences: UserPreferences;
  createdAt: string;
}

export interface UserPreferences {
  theme: "light" | "dark" | "system";
  favoriteSports: Sport[];
  favoriteBookmakers: string[];
  notifications: {
    edges: boolean;
    injuries: boolean;
    lineMovement: boolean;
  };
  edgeThreshold: number;
}

export interface SubscriptionPlan {
  tier: SubscriptionTier;
  name: string;
  price: number;
  features: string[];
  edgeTypes: EdgeType[];
  refreshInterval: number; // seconds
  historicalDataDays: number;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  created: number;
  processed: boolean;
  error?: string;
}

// --- API Responses ---

export interface OddsApiResponse {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: {
    key: string;
    title: string;
    last_update: string;
    markets: {
      key: string;
      last_update: string;
      outcomes: {
        name: string;
        price: number;
        point?: number;
        description?: string;
      }[];
    }[];
  }[];
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}
