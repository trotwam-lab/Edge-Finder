export const SPORTS = {
  NBA: 'basketball_nba',
  NFL: 'americanfootball_nfl',
  NHL: 'icehockey_nhl',
  MLB: 'baseball_mlb',
  WNBA: 'basketball_wnba',
  NCAAB: 'basketball_ncaab',
  NCAAF: 'americanfootball_ncaaf',
  WNCAAB: 'basketball_wncaab',
  MMA: 'mma_mixed_martial_arts',
  Boxing: 'boxing_boxing',
  'World Cup': 'soccer_fifa_world_cup',
  EPL: 'soccer_epl',
  'La Liga': 'soccer_spain_la_liga',
  'Serie A': 'soccer_italy_serie_a',
  Bundesliga: 'soccer_germany_bundesliga',
  'Ligue 1': 'soccer_france_ligue_one',
  UCL: 'soccer_uefa_champs_league',
  MLS: 'soccer_usa_mls',
  'Liga MX': 'soccer_mexico_ligamx',
  'ATP Italian': 'tennis_atp_italian_open',
  'WTA Italian': 'tennis_wta_italian_open',
  Golf: 'golf_masters_tournament_winner',
  AFL: 'aussierules_afl',
  NRL: 'rugbyleague_nrl',
};

export const BOOKMAKERS = {
  'fanduel': 'FanDuel',
  'draftkings': 'DraftKings',
  'betmgm': 'BetMGM',
  'caesars': 'Caesars',
  'betonlineag': 'BetOnline',
  'bovada': 'Bovada',
  'betrivers': 'BetRivers',
  'fanatics': 'Fanatics',
  'lowvig': 'LowVig',
  'mybookieag': 'MyBookie',
  'williamhill_us': 'William Hill',
  'betus': 'BetUS',
  'espnbet': 'ESPN BET',
  'hardrockbet': 'Hard Rock Bet'
};

export const AFFILIATE_LINKS = {
  'fanduel': 'https://www.fanduel.com/sportsbook',
  'draftkings': 'https://sportsbook.draftkings.com',
  'betmgm': 'https://sports.betmgm.com',
  'caesars': 'https://www.caesars.com/sportsbook',
  'betonlineag': 'https://www.betonline.ag',
  'bovada': 'https://www.bovada.lv',
  'betrivers': 'https://www.betrivers.com',
  'fanatics': 'https://sportsbook.fanatics.com',
  'lowvig': 'https://www.lowvig.ag',
  'mybookieag': 'https://www.mybookie.ag',
  'williamhill_us': 'https://www.caesars.com/sportsbook',
  'betus': 'https://www.betus.com.pa',
  'espnbet': 'https://espnbet.com',
  'hardrockbet': 'https://app.hardrock.bet',
  'default': 'https://www.fanduel.com/sportsbook'
};

// FREE_BOOKS ★ Free users only see these 3 sportsbooks
// Pro users see all supported sportsbook keys returned by The Odds API.
export const FREE_BOOKS = ['fanduel', 'draftkings', 'betmgm'];

// NAV_TABS ★ Single source of truth for app navigation.
// Rendered by Header (desktop) and MobileNav (bottom bar) so the two can
// never drift apart. Icons are resolved by name inside each component to
// keep this file dependency-free.
export const NAV_TABS = [
  { key: 'HOME',      label: 'Home',     icon: 'Home',       proOnly: false },
  { key: 'GAMES',     label: 'Games',    icon: 'Target',     proOnly: false },
  { key: 'PROPS',     label: 'Props',    icon: 'Users',      proOnly: false },
  { key: 'PRO_TOOLS', label: 'Tools',    icon: 'Wrench',     proOnly: false },
  { key: 'REPORT',    label: 'Report',   icon: 'FileText',   proOnly: true  },
  { key: 'TRACKER',   label: 'Tracker',  icon: 'TrendingUp', proOnly: false },
  { key: 'SETTINGS',  label: 'Settings', icon: 'Settings',   proOnly: false },
];

// PRO_FEATURES ★ What you get with EdgeFinder Pro ($12.99/mo)
export const PRO_FEATURES = {
  price: '$12.99/mo',
  headline: 'Tell me where to look today.',
  subheadline: 'Pro opens with a Daily Report that does the scanning for you, then backs it up with an arbitrage scanner, full edge board, and every sportsbook we track.',
  features: [
    { icon: '📝', text: 'Daily Pro Report — top edges, steam moves, best books, and games to avoid in one morning screen' },
    { icon: '⚖️', text: 'Arbitrage & Low-Hold Scanner — guaranteed-profit and near-free bets across books, with stake splits computed for you' },
    { icon: '🎯', text: 'Full edge board with exact book, line, EV, and fair probability — the same edges graded publicly in Yesterday’s Receipts' },
    { icon: '🔥', text: 'Steam Move Tracker — see which lines moved most since open' },
    { icon: '🛒', text: 'Line Shopping Score + Best Books leaderboard across every game' },
    { icon: '📊', text: 'All sportsbooks unlocked — not just the 3-book free preview' },
    { icon: '🏀', text: 'Unlimited player prop board with best-price comparison' },
    { icon: '🧮', text: 'EV calculator and Kelly Criterion sizing so stakes match the edge' },
    { icon: '📈', text: 'Bet tracker with W/L, ROI, units, streaks, and CLV grading' },
  ],
};

export const SPORT_ESPN_MAP = {
  'basketball_nba': 'basketball/nba',
  'basketball_wnba': 'basketball/wnba',
  'americanfootball_nfl': 'football/nfl',
  'icehockey_nhl': 'hockey/nhl',
  'baseball_mlb': 'baseball/mlb'
};
