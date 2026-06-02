export const SPORTS = {
  NBA: 'basketball_nba',
  NFL: 'americanfootball_nfl',
  NHL: 'icehockey_nhl',
  MLB: 'baseball_mlb',
  NCAAB: 'basketball_ncaab',
  NCAAF: 'americanfootball_ncaaf',
  WNCAAB: 'basketball_wncaab',
  MMA: 'mma_mixed_martial_arts',
  Boxing: 'boxing_boxing',
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

// PRO_FEATURES ★ What you get with Edge Finder Pro ($12.99/mo)
export const PRO_FEATURES = {
  price: '$12.99/mo',
  headline: 'Know where to look before you bet.',
  subheadline: 'Pro turns the live odds board into a daily betting workflow: edges, props, timing, sizing, and tracking.',
  features: [
    { icon: '🎯', text: 'Full edge board with exact book, line, EV, and fair probability' },
    { icon: '📊', text: 'All sportsbooks unlocked — not just the 3-book free preview' },
    { icon: '🏀', text: 'Unlimited player prop board with best-price comparison' },
    { icon: '⚡', text: 'Line movement and market disagreement alerts' },
    { icon: '🧮', text: 'EV calculator plus implied probability/fair line tools' },
    { icon: '💰', text: 'Kelly Criterion bet sizing so stakes match the edge' },
    { icon: '📈', text: 'Bet tracker with W/L, ROI, units, streaks, and CLV' },
    { icon: '📝', text: 'Daily Top Edges workflow foundation — built for the $12.99 plan' },
  ],
};

export const SPORT_ESPN_MAP = {
  'basketball_nba': 'basketball/nba',
  'americanfootball_nfl': 'football/nfl',
  'icehockey_nhl': 'hockey/nhl',
  'baseball_mlb': 'baseball/mlb'
};
