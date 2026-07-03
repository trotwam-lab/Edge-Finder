// SPORTS ★ Every game-market sport The Odds API carries that we surface.
// Seasonal keys (each tennis major is its own key; cup competitions come and
// go) are fine to keep listed year-round: /api/sports tells the client which
// keys are in season, and out-of-season chips sort to the back of the strip.
export const SPORTS = {
  // US majors
  NBA: 'basketball_nba',
  NFL: 'americanfootball_nfl',
  NHL: 'icehockey_nhl',
  MLB: 'baseball_mlb',
  WNBA: 'basketball_wnba',
  NCAAB: 'basketball_ncaab',
  NCAAF: 'americanfootball_ncaaf',
  WNCAAB: 'basketball_wncaab',
  CFL: 'americanfootball_cfl',
  // Combat
  MMA: 'mma_mixed_martial_arts',
  Boxing: 'boxing_boxing',
  // Soccer — tournaments
  'World Cup': 'soccer_fifa_world_cup',
  UCL: 'soccer_uefa_champs_league',
  'Europa League': 'soccer_uefa_europa_league',
  'Conference League': 'soccer_uefa_europa_conference_league',
  'Nations League': 'soccer_uefa_nations_league',
  Libertadores: 'soccer_conmebol_copa_libertadores',
  'Copa América': 'soccer_conmebol_copa_america',
  'FA Cup': 'soccer_fa_cup',
  'EFL Cup': 'soccer_england_efl_cup',
  // Soccer — top-flight leagues
  EPL: 'soccer_epl',
  'La Liga': 'soccer_spain_la_liga',
  'Serie A': 'soccer_italy_serie_a',
  Bundesliga: 'soccer_germany_bundesliga',
  'Ligue 1': 'soccer_france_ligue_one',
  MLS: 'soccer_usa_mls',
  'Liga MX': 'soccer_mexico_ligamx',
  Eredivisie: 'soccer_netherlands_eredivisie',
  'Primeira Liga': 'soccer_portugal_primeira_liga',
  'Scottish Prem': 'soccer_spl',
  'Süper Lig': 'soccer_turkey_super_league',
  'Belgian Pro': 'soccer_belgium_first_div',
  'Austrian Liga': 'soccer_austria_bundesliga',
  'Swiss Super Lg': 'soccer_switzerland_superleague',
  'Greek Super Lg': 'soccer_greece_super_league',
  'Brasileirão': 'soccer_brazil_campeonato',
  'Argentina Primera': 'soccer_argentina_primera_division',
  'J League': 'soccer_japan_j_league',
  'K League': 'soccer_korea_kleague1',
  'Chinese SL': 'soccer_china_superleague',
  'A-League': 'soccer_australia_aleague',
  Allsvenskan: 'soccer_sweden_allsvenskan',
  Eliteserien: 'soccer_norway_eliteserien',
  'Danish Superliga': 'soccer_denmark_superliga',
  Veikkausliiga: 'soccer_finland_veikkausliiga',
  'League of Ireland': 'soccer_league_of_ireland',
  Ekstraklasa: 'soccer_poland_ekstraklasa',
  // Soccer — second divisions
  Championship: 'soccer_efl_champ',
  'League One': 'soccer_england_league1',
  'League Two': 'soccer_england_league2',
  'Bundesliga 2': 'soccer_germany_bundesliga2',
  'Serie B': 'soccer_italy_serie_b',
  'Ligue 2': 'soccer_france_ligue_two',
  'La Liga 2': 'soccer_spain_segunda_division',
  // Tennis — one Odds API key per tournament
  'ATP Wimbledon': 'tennis_atp_wimbledon',
  'WTA Wimbledon': 'tennis_wta_wimbledon',
  'ATP US Open': 'tennis_atp_us_open',
  'WTA US Open': 'tennis_wta_us_open',
  'ATP French Open': 'tennis_atp_french_open',
  'WTA French Open': 'tennis_wta_french_open',
  'ATP Aus Open': 'tennis_atp_aus_open_singles',
  'WTA Aus Open': 'tennis_wta_aus_open_singles',
  'ATP Italian': 'tennis_atp_italian_open',
  'WTA Italian': 'tennis_wta_italian_open',
  // International baseball / basketball / hockey
  KBO: 'baseball_kbo',
  NPB: 'baseball_npb',
  EuroLeague: 'basketball_euroleague',
  NBL: 'basketball_nbl',
  AHL: 'icehockey_ahl',
  SHL: 'icehockey_sweden_hockey_league',
  Liiga: 'icehockey_liiga',
  // Cricket
  IPL: 'cricket_ipl',
  'Big Bash': 'cricket_big_bash',
  'The Hundred': 'cricket_the_hundred',
  'T20 Blast': 'cricket_t20_blast',
  'Intl T20': 'cricket_international_t20',
  'Test Cricket': 'cricket_test_match',
  'ODI Cricket': 'cricket_odi',
  // Other
  PLL: 'lacrosse_pll',
  'Six Nations': 'rugbyunion_six_nations',
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
