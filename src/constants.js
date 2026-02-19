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
  'ATP Qatar': 'tennis_atp_qatar_open',
  'WTA Dubai': 'tennis_wta_dubai',
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
  'betrivers': 'BetRivers'
};

export const AFFILIATE_LINKS = {
  'fanduel': 'https://www.fanduel.com/sportsbook',
  'draftkings': 'https://sportsbook.draftkings.com',
  'betmgm': 'https://sports.betmgm.com',
  'caesars': 'https://www.caesars.com/sportsbook',
  'betonlineag': 'https://www.betonline.ag',
  'bovada': 'https://www.bovada.lv',
  'betrivers': 'https://www.betrivers.com',
  'default': 'https://www.fanduel.com/sportsbook'
};

// FREE_BOOKS ★ Free users only see these 3 sportsbooks
// Pro users see ALL books (FanDuel, DraftKings, BetMGM, Caesars, BetOnline, Bovada, BetRivers)
export const FREE_BOOKS = ['fanduel', 'draftkings', 'betmgm'];

// PRO_FEATURES ★ What you get with Edge Finder Pro ($12.99/mo)
export const PRO_FEATURES = {
  price: '$12.99/mo',
  features: [
    { icon: '🏆', text: 'All 7 sportsbooks (not just 3)' },
    { icon: '🏆', text: 'Unlimited player props' },
    { icon: '🏆', text: 'EV indicators on every line' },
    { icon: '🏆¯', text: 'Implied probability overlays' },
    { icon: '⚡', text: 'Real-time edge alerts across all books' },
    { icon: '🏆¯', text: 'Pick tracker with W/L, ROI & streaks' },
    { icon: '🏆', text: 'Line movement alerts (coming soon)' },
    { icon: '🏆°', text: 'Kelly Criterion bet sizing (coming soon)' },
  ],
};

export const SPORT_ESPN_MAP = {
  'basketball_nba': 'basketball/nba',
  'americanfootball_nfl': 'football/nfl',
  'icehockey_nhl': 'hockey/nhl',
  'baseball_mlb': 'baseball/mlb'
};
