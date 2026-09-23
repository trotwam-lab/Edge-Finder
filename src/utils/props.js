import { americanToImplied, impliedToAmerican, formatOdds as formatAmericanOdds } from './odds-math.js';

export const BOOK_ABBREVIATIONS = {
  FanDuel: 'FD', DraftKings: 'DK', BetMGM: 'MGM', Caesars: 'Csr',
  BetRivers: 'BR', PointsBet: 'PB', Bet365: 'B365', WynnBET: 'Wynn',
  Unibet: 'Uni', Barstool: 'BAR', 'ESPN BET': 'ESPN', Fanatics: 'Fan',
  BetOnline: 'BOL', Bovada: 'BVD', HardRockBet: 'HRB'
};

// Books arrive as Odds API titles ("FanDuel"), raw keys ("fanduel") or
// SportsGameOdds titleized keys ("Fanduel", "Hardrockbet"), so abbreviations
// are also looked up by a case/punctuation-insensitive key.
const BOOK_ABBREVIATIONS_BY_KEY = {
  fanduel: 'FD', draftkings: 'DK', betmgm: 'MGM', caesars: 'Csr', williamhill: 'Csr', williamhillus: 'Csr',
  betrivers: 'BR', pointsbet: 'PB', pointsbetus: 'PB', bet365: 'B365', wynnbet: 'Wynn', unibet: 'Uni',
  barstool: 'BAR', espnbet: 'ESPN', fanatics: 'Fan', betonline: 'BOL', betonlineag: 'BOL', bovada: 'BVD',
  hardrockbet: 'HRB', hardrock: 'HRB', lowvig: 'LV', mybookie: 'MYB', mybookieag: 'MYB', betus: 'BetUS',
  prizepicks: 'PP', underdog: 'UD', pinnacle: 'PIN', ballybet: 'Bally', betparx: 'Parx', fliff: 'Fliff',
};

export const MARKET_DISPLAY_NAMES = {
  player_points: 'PTS',
  player_rebounds: 'REB',
  player_assists: 'AST',
  player_threes: '3PM',
  player_steals: 'STL',
  player_blocks: 'BLK',
  player_turnovers: 'TO',
  player_points_rebounds_assists: 'PRA',
  player_points_rebounds: 'PR',
  player_points_assists: 'PA',
  player_rebounds_assists: 'RA',
  player_double_double: 'DBL-DBL',
  player_triple_double: 'TRP-DBL',
  player_pass_yds: 'PASS YDS',
  player_pass_tds: 'PASS TD',
  player_pass_completions: 'COMP',
  player_pass_attempts: 'ATT',
  player_pass_interceptions: 'INT',
  player_pass_longest_completion: 'LONGEST COMP',
  player_rush_yds: 'RUSH YDS',
  player_rush_attempts: 'RUSH ATT',
  player_rush_longest: 'LONGEST RUSH',
  player_rush_tds: 'RUSH TD',
  player_receptions: 'REC',
  player_reception_yds: 'REC YDS',
  player_reception_longest: 'LONGEST REC',
  player_reception_tds: 'REC TD',
  player_anytime_td: 'ANYTIME TD',
  player_1st_td: '1ST TD',
  player_last_td: 'LAST TD',
  player_tds_over: 'TD',
  player_sacks: 'SACKS',
  player_solo_tackles: 'SOLO TKL',
  player_tackles_assists: 'TKL+AST',
  player_shots_on_goal: 'SOG',
  player_blocked_shots: 'BLK SHOTS',
  player_goals: 'GOALS',
  player_power_play_points: 'PP PTS',
  player_saves: 'SAVES',
  batter_hits: 'HITS',
  batter_total_bases: 'TB',
  batter_rbis: 'RBI',
  batter_runs_scored: 'RUNS',
  batter_home_runs: 'HR',
  batter_hits_runs_rbis: 'H+R+RBI',
  batter_singles: '1B',
  batter_doubles: '2B',
  batter_triples: '3B',
  batter_walks: 'WALKS',
  batter_strikeouts: 'K',
  pitcher_strikeouts: 'PITCHER K',
  pitcher_hits_allowed: 'H ALLOWED',
  pitcher_walks: 'BB ALLOWED',
  pitcher_outs: 'OUTS',
  pitcher_earned_runs: 'ER',
  pitcher_record_a_win: 'PITCHER WIN',
  player_shots_on_target: 'SHOTS ON TGT',
  player_to_score: 'TO SCORE',
  // SportsGameOdds stat IDs (used as market keys when it is the prop feed)
  points: 'PTS',
  rebounds: 'REB',
  assists: 'AST',
  steals: 'STL',
  blocks: 'BLK',
  turnovers: 'TO',
  threePointersMade: '3PM',
  points_rebounds_assists: 'PRA',
  points_rebounds: 'PR',
  points_assists: 'PA',
  rebounds_assists: 'RA',
  doubleDouble: 'DBL-DBL',
  tripleDouble: 'TRP-DBL',
  passing_yards: 'PASS YDS',
  passing_touchdowns: 'PASS TD',
  passing_completions: 'COMP',
  passing_attempts: 'ATT',
  passing_interceptions: 'INT',
  passing_longestCompletion: 'LONGEST COMP',
  rushing_yards: 'RUSH YDS',
  rushing_attempts: 'RUSH ATT',
  rushing_touchdowns: 'RUSH TD',
  rushing_longestRush: 'LONGEST RUSH',
  receiving_yards: 'REC YDS',
  receiving_receptions: 'REC',
  receiving_touchdowns: 'REC TD',
  receiving_longestReception: 'LONGEST REC',
  passing_rushing_yards: 'PASS+RUSH YDS',
  rushing_receiving_yards: 'RUSH+REC YDS',
  touchdowns: 'TD',
  firstTouchdown: '1ST TD',
  lastTouchdown: 'LAST TD',
  defense_sacks: 'SACKS',
  defense_tackles: 'TACKLES',
  kicking_totalPoints: 'KICKING PTS',
  fieldGoals_made: 'FG MADE',
  batting_hits: 'HITS',
  batting_totalBases: 'TB',
  batting_homeRuns: 'HR',
  batting_RBI: 'RBI',
  batting_runs: 'RUNS',
  batting_singles: '1B',
  batting_doubles: '2B',
  batting_triples: '3B',
  batting_basesOnBalls: 'WALKS',
  batting_strikeouts: 'K',
  batting_stolenBases: 'SB',
  batting_hits_runs_rbi: 'H+R+RBI',
  pitching_strikeouts: 'PITCHER K',
  pitching_hits: 'H ALLOWED',
  pitching_basesOnBalls: 'BB ALLOWED',
  pitching_outs: 'OUTS',
  pitching_earnedRuns: 'ER',
  pitching_win: 'PITCHER WIN',
  shots_onGoal: 'SOG',
  blockedShots: 'BLK SHOTS',
  goals: 'GOALS',
  powerPlayPoints: 'PP PTS',
  goalie_saves: 'SAVES',
  shots: 'SHOTS',
  shots_onTarget: 'SHOTS ON TGT',
};

const PERIOD_LABELS = {
  '1q': '1Q', '2q': '2Q', '3q': '3Q', '4q': '4Q', '1h': '1H', '2h': '2H',
  '1p': '1P', '2p': '2P', '3p': '3P', '1i': '1ST INN', reg: 'REG', ot: 'OT',
};

function humanizeMarketKey(market) {
  return String(market)
    .replace(/^(player_|batter_|pitcher_)/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export const SPORT_META = {
  basketball_nba: { label: 'NBA', icon: '🏀', family: 'basketball', espnPath: 'basketball/nba', logoSport: 'nba' },
  // Summer league rosters are NBA franchises, so NBA team logos apply.
  basketball_nba_summer_league: { label: 'NBA Summer', icon: '🏀', family: 'basketball', logoSport: 'nba' },
  basketball_wnba: { label: 'WNBA', icon: '🏀', family: 'basketball', espnPath: 'basketball/wnba', logoSport: 'wnba' },
  basketball_ncaab: { label: 'NCAAB', icon: '🏀', family: 'basketball', espnPath: 'basketball/mens-college-basketball', logoSport: 'ncb' },
  basketball_wncaab: { label: 'WNCAAB', icon: '🏀', family: 'basketball', espnPath: 'basketball/womens-college-basketball', logoSport: 'ncb' },
  americanfootball_nfl: { label: 'NFL', icon: '🏈', family: 'football', espnPath: 'football/nfl', logoSport: 'nfl' },
  americanfootball_ncaaf: { label: 'NCAAF', icon: '🏈', family: 'football', espnPath: 'football/college-football', logoSport: 'ncf' },
  icehockey_nhl: { label: 'NHL', icon: '🏒', family: 'hockey', espnPath: 'hockey/nhl', logoSport: 'nhl' },
  baseball_mlb: { label: 'MLB', icon: '⚾', family: 'baseball', espnPath: 'baseball/mlb', logoSport: 'mlb' },
  soccer_fifa_world_cup: { label: 'World Cup', icon: '🏆', family: 'soccer', espnPath: 'soccer/fifa.world', logoSport: 'soccer' },
  soccer_epl: { label: 'EPL', icon: '⚽', family: 'soccer', espnPath: 'soccer/eng.1', logoSport: 'soccer' },
  soccer_spain_la_liga: { label: 'La Liga', icon: '⚽', family: 'soccer', espnPath: 'soccer/esp.1', logoSport: 'soccer' },
  soccer_italy_serie_a: { label: 'Serie A', icon: '⚽', family: 'soccer', espnPath: 'soccer/ita.1', logoSport: 'soccer' },
  soccer_germany_bundesliga: { label: 'Bundesliga', icon: '⚽', family: 'soccer', espnPath: 'soccer/ger.1', logoSport: 'soccer' },
  soccer_france_ligue_one: { label: 'Ligue 1', icon: '⚽', family: 'soccer', espnPath: 'soccer/fra.1', logoSport: 'soccer' },
  soccer_uefa_champs_league: { label: 'UCL', icon: '⚽', family: 'soccer', espnPath: 'soccer/uefa.champions', logoSport: 'soccer' },
  soccer_usa_mls: { label: 'MLS', icon: '⚽', family: 'soccer', espnPath: 'soccer/usa.1', logoSport: 'soccer' },
  soccer_mexico_ligamx: { label: 'Liga MX', icon: '⚽', family: 'soccer', espnPath: 'soccer/mex.1', logoSport: 'soccer' },
  soccer_uefa_europa_league: { label: 'Europa League', icon: '⚽', family: 'soccer', espnPath: 'soccer/uefa.europa', logoSport: 'soccer' },
  soccer_uefa_europa_conference_league: { label: 'Conference League', icon: '⚽', family: 'soccer', espnPath: 'soccer/uefa.europa.conf', logoSport: 'soccer' },
  soccer_uefa_nations_league: { label: 'Nations League', icon: '⚽', family: 'soccer', espnPath: 'soccer/uefa.nations', logoSport: 'soccer' },
  soccer_conmebol_copa_libertadores: { label: 'Libertadores', icon: '⚽', family: 'soccer', espnPath: 'soccer/conmebol.libertadores', logoSport: 'soccer' },
  soccer_conmebol_copa_america: { label: 'Copa América', icon: '⚽', family: 'soccer', espnPath: 'soccer/conmebol.america', logoSport: 'soccer' },
  soccer_fa_cup: { label: 'FA Cup', icon: '⚽', family: 'soccer', espnPath: 'soccer/eng.fa', logoSport: 'soccer' },
  soccer_england_efl_cup: { label: 'EFL Cup', icon: '⚽', family: 'soccer', espnPath: 'soccer/eng.league_cup', logoSport: 'soccer' },
  soccer_netherlands_eredivisie: { label: 'Eredivisie', icon: '⚽', family: 'soccer', espnPath: 'soccer/ned.1', logoSport: 'soccer' },
  soccer_portugal_primeira_liga: { label: 'Primeira Liga', icon: '⚽', family: 'soccer', espnPath: 'soccer/por.1', logoSport: 'soccer' },
  soccer_spl: { label: 'Scottish Prem', icon: '⚽', family: 'soccer', espnPath: 'soccer/sco.1', logoSport: 'soccer' },
  soccer_turkey_super_league: { label: 'Süper Lig', icon: '⚽', family: 'soccer', espnPath: 'soccer/tur.1', logoSport: 'soccer' },
  soccer_belgium_first_div: { label: 'Belgian Pro', icon: '⚽', family: 'soccer', espnPath: 'soccer/bel.1', logoSport: 'soccer' },
  soccer_austria_bundesliga: { label: 'Austrian Liga', icon: '⚽', family: 'soccer', espnPath: 'soccer/aut.1', logoSport: 'soccer' },
  soccer_switzerland_superleague: { label: 'Swiss Super Lg', icon: '⚽', family: 'soccer', espnPath: 'soccer/sui.1', logoSport: 'soccer' },
  soccer_greece_super_league: { label: 'Greek Super Lg', icon: '⚽', family: 'soccer', espnPath: 'soccer/gre.1', logoSport: 'soccer' },
  soccer_brazil_campeonato: { label: 'Brasileirão', icon: '⚽', family: 'soccer', espnPath: 'soccer/bra.1', logoSport: 'soccer' },
  soccer_argentina_primera_division: { label: 'Argentina Primera', icon: '⚽', family: 'soccer', espnPath: 'soccer/arg.1', logoSport: 'soccer' },
  soccer_japan_j_league: { label: 'J League', icon: '⚽', family: 'soccer', espnPath: 'soccer/jpn.1', logoSport: 'soccer' },
  soccer_korea_kleague1: { label: 'K League', icon: '⚽', family: 'soccer', espnPath: 'soccer/kor.1', logoSport: 'soccer' },
  soccer_china_superleague: { label: 'Chinese SL', icon: '⚽', family: 'soccer', espnPath: 'soccer/chn.1', logoSport: 'soccer' },
  soccer_australia_aleague: { label: 'A-League', icon: '⚽', family: 'soccer', espnPath: 'soccer/aus.1', logoSport: 'soccer' },
  soccer_sweden_allsvenskan: { label: 'Allsvenskan', icon: '⚽', family: 'soccer', espnPath: 'soccer/swe.1', logoSport: 'soccer' },
  soccer_norway_eliteserien: { label: 'Eliteserien', icon: '⚽', family: 'soccer', espnPath: 'soccer/nor.1', logoSport: 'soccer' },
  soccer_denmark_superliga: { label: 'Danish Superliga', icon: '⚽', family: 'soccer', espnPath: 'soccer/den.1', logoSport: 'soccer' },
  soccer_finland_veikkausliiga: { label: 'Veikkausliiga', icon: '⚽', family: 'soccer' },
  soccer_league_of_ireland: { label: 'League of Ireland', icon: '⚽', family: 'soccer' },
  soccer_poland_ekstraklasa: { label: 'Ekstraklasa', icon: '⚽', family: 'soccer' },
  soccer_efl_champ: { label: 'Championship', icon: '⚽', family: 'soccer', espnPath: 'soccer/eng.2', logoSport: 'soccer' },
  soccer_england_league1: { label: 'League One', icon: '⚽', family: 'soccer', espnPath: 'soccer/eng.3', logoSport: 'soccer' },
  soccer_england_league2: { label: 'League Two', icon: '⚽', family: 'soccer', espnPath: 'soccer/eng.4', logoSport: 'soccer' },
  soccer_germany_bundesliga2: { label: 'Bundesliga 2', icon: '⚽', family: 'soccer', espnPath: 'soccer/ger.2', logoSport: 'soccer' },
  soccer_italy_serie_b: { label: 'Serie B', icon: '⚽', family: 'soccer', espnPath: 'soccer/ita.2', logoSport: 'soccer' },
  soccer_france_ligue_two: { label: 'Ligue 2', icon: '⚽', family: 'soccer', espnPath: 'soccer/fra.2', logoSport: 'soccer' },
  soccer_spain_segunda_division: { label: 'La Liga 2', icon: '⚽', family: 'soccer', espnPath: 'soccer/esp.2', logoSport: 'soccer' },
  tennis_atp_wimbledon: { label: 'ATP Wimbledon', icon: '🎾', family: 'tennis' },
  tennis_wta_wimbledon: { label: 'WTA Wimbledon', icon: '🎾', family: 'tennis' },
  tennis_atp_us_open: { label: 'ATP US Open', icon: '🎾', family: 'tennis' },
  tennis_wta_us_open: { label: 'WTA US Open', icon: '🎾', family: 'tennis' },
  tennis_atp_french_open: { label: 'ATP French Open', icon: '🎾', family: 'tennis' },
  tennis_wta_french_open: { label: 'WTA French Open', icon: '🎾', family: 'tennis' },
  tennis_atp_aus_open_singles: { label: 'ATP Aus Open', icon: '🎾', family: 'tennis' },
  tennis_wta_aus_open_singles: { label: 'WTA Aus Open', icon: '🎾', family: 'tennis' },
  tennis_atp_italian_open: { label: 'ATP Italian', icon: '🎾', family: 'tennis' },
  tennis_wta_italian_open: { label: 'WTA Italian', icon: '🎾', family: 'tennis' },
  americanfootball_cfl: { label: 'CFL', icon: '🏈', family: 'football', espnPath: 'football/cfl' },
  baseball_kbo: { label: 'KBO', icon: '⚾', family: 'baseball' },
  baseball_npb: { label: 'NPB', icon: '⚾', family: 'baseball' },
  basketball_euroleague: { label: 'EuroLeague', icon: '🏀', family: 'basketball' },
  basketball_nbl: { label: 'NBL', icon: '🏀', family: 'basketball' },
  icehockey_ahl: { label: 'AHL', icon: '🏒', family: 'hockey' },
  icehockey_sweden_hockey_league: { label: 'SHL', icon: '🏒', family: 'hockey' },
  icehockey_liiga: { label: 'Liiga', icon: '🏒', family: 'hockey' },
  cricket_ipl: { label: 'IPL', icon: '🏏', family: 'cricket' },
  cricket_big_bash: { label: 'Big Bash', icon: '🏏', family: 'cricket' },
  cricket_the_hundred: { label: 'The Hundred', icon: '🏏', family: 'cricket' },
  cricket_t20_blast: { label: 'T20 Blast', icon: '🏏', family: 'cricket' },
  cricket_international_t20: { label: 'Intl T20', icon: '🏏', family: 'cricket' },
  cricket_test_match: { label: 'Test Cricket', icon: '🏏', family: 'cricket' },
  cricket_odi: { label: 'ODI Cricket', icon: '🏏', family: 'cricket' },
  lacrosse_pll: { label: 'PLL', icon: '🥍', family: 'lacrosse' },
  rugbyunion_six_nations: { label: 'Six Nations', icon: '🏉', family: 'rugby' },
  mma_mixed_martial_arts: { label: 'MMA', icon: '🥊', family: 'combat' },
  boxing_boxing: { label: 'Boxing', icon: '🥊', family: 'combat' },
  golf_masters_tournament_winner: { label: 'Golf', icon: '⛳', family: 'golf' },
  aussierules_afl: { label: 'AFL', icon: '🏉', family: 'football' },
  rugbyleague_nrl: { label: 'NRL', icon: '🏉', family: 'rugby' },
};

export const SPORT_SORT_ORDER = ['basketball_nba', 'americanfootball_nfl', 'icehockey_nhl', 'baseball_mlb', 'basketball_wnba', 'basketball_ncaab', 'americanfootball_ncaaf', 'basketball_wncaab', 'soccer_fifa_world_cup', 'soccer_epl', 'soccer_spain_la_liga', 'soccer_italy_serie_a', 'soccer_germany_bundesliga', 'soccer_france_ligue_one', 'soccer_uefa_champs_league', 'soccer_usa_mls', 'soccer_mexico_ligamx', 'tennis_atp_italian_open', 'tennis_wta_italian_open', 'mma_mixed_martial_arts', 'boxing_boxing', 'golf_masters_tournament_winner', 'aussierules_afl', 'rugbyleague_nrl'];

export function getSportMeta(sport) {
  return SPORT_META[sport] || { label: sport?.split('_').slice(-1)[0]?.toUpperCase() || 'Other', icon: '🎯', family: 'other' };
}

export function getBookAbbreviation(book) {
  if (!book) return '?';
  if (BOOK_ABBREVIATIONS[book]) return BOOK_ABBREVIATIONS[book];
  const key = String(book).toLowerCase().replace(/[^a-z0-9]/g, '');
  return BOOK_ABBREVIATIONS_BY_KEY[key] || String(book).slice(0, 4);
}

const BOOK_DISPLAY_NAMES_BY_KEY = {
  fanduel: 'FanDuel', draftkings: 'DraftKings', betmgm: 'BetMGM', caesars: 'Caesars', williamhill: 'Caesars',
  williamhillus: 'Caesars', betrivers: 'BetRivers', pointsbet: 'PointsBet', pointsbetus: 'PointsBet', bet365: 'Bet365',
  espnbet: 'ESPN BET', fanatics: 'Fanatics', betonline: 'BetOnline', betonlineag: 'BetOnline', bovada: 'Bovada',
  hardrockbet: 'Hard Rock Bet', lowvig: 'LowVig', mybookie: 'MyBookie', mybookieag: 'MyBookie', betus: 'BetUS',
  prizepicks: 'PrizePicks', underdog: 'Underdog', pinnacle: 'Pinnacle', ballybet: 'Bally Bet', betparx: 'betPARX',
};

// Readable sportsbook name for any of the title/key spellings above.
export function getBookDisplayName(book) {
  if (!book) return book;
  const key = String(book).toLowerCase().replace(/[^a-z0-9]/g, '');
  return BOOK_DISPLAY_NAMES_BY_KEY[key] || book;
}

export function getMarketDisplayName(market) {
  if (!market) return market;
  if (MARKET_DISPLAY_NAMES[market]) return MARKET_DISPLAY_NAMES[market];
  // Period-scoped markets are keyed "<stat>_<period>" (e.g. points_1q).
  const periodMatch = String(market).match(/^(.+)_(1q|2q|3q|4q|1h|2h|1p|2p|3p|reg|ot|1i|1ix\d+)$/);
  if (periodMatch) {
    const [, base, period] = periodMatch;
    const periodLabel = PERIOD_LABELS[period] || (period.startsWith('1ix') ? `F${period.slice(3)}` : period.toUpperCase());
    return `${getMarketDisplayName(base)} ${periodLabel}`;
  }
  return humanizeMarketKey(market);
}
export function formatOdds(price) { return formatAmericanOdds(price).replace('-', '−'); }

export function normalizeMarketFilterLabel(market) {
  const display = getMarketDisplayName(market);
  return display.length <= 14 ? display : display.replaceAll(' ', '\n');
}

export function buildTeamVisuals(game, sport, logoMap = {}) {
  const [awayRaw, homeRaw] = String(game || '').split(' @ ');
  const away = awayRaw?.trim();
  const home = homeRaw?.trim();
  const sportMap = logoMap[sport] || {};
  return {
    away: away ? { name: away, logo: sportMap[normalizeTeamKey(away)] || null, initials: getInitials(away) } : null,
    home: home ? { name: home, logo: sportMap[normalizeTeamKey(home)] || null, initials: getInitials(home) } : null,
  };
}

export function getPropTimingState({ gameStatus, commenceTime }) {
  const started = gameStatus?.started ?? (commenceTime ? Date.parse(commenceTime) <= Date.now() : false);
  const completed = gameStatus?.completed ?? false;
  const live = gameStatus?.live ?? (started && !completed);
  const resolvedCommenceTime = gameStatus?.commenceTime || commenceTime || null;

  if (completed) {
    return {
      key: 'final',
      label: 'FINAL',
      detail: 'Props closed',
      color: '#94a3b8',
      background: 'rgba(100,116,139,0.14)',
      border: 'rgba(148,163,184,0.28)',
    };
  }

  if (live) {
    return {
      key: 'live',
      label: 'LIVE',
      detail: 'In progress',
      color: '#f43f5e',
      background: 'rgba(244,63,94,0.14)',
      border: 'rgba(244,63,94,0.32)',
    };
  }

  if (resolvedCommenceTime) {
    const startsAt = new Date(resolvedCommenceTime);
    const diffMs = startsAt.getTime() - Date.now();
    const diffMinutes = Math.round(diffMs / 60000);
    const absMinutes = Math.abs(diffMinutes);

    let detail = startsAt.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    if (diffMinutes >= 0 && diffMinutes <= 59) detail = `Starts in ${Math.max(1, diffMinutes)}m`;
    else if (diffMinutes >= 60 && diffMinutes <= 6 * 60) detail = `Starts in ${Math.round(diffMinutes / 60)}h`;
    else if (diffMinutes < 0 && absMinutes <= 15) detail = 'Starting now';

    return {
      key: 'pregame',
      label: 'PRE',
      detail,
      color: '#22c55e',
      background: 'rgba(34,197,94,0.12)',
      border: 'rgba(34,197,94,0.28)',
    };
  }

  return {
    key: 'unknown',
    label: 'SCHEDULED',
    detail: 'Start time pending',
    color: '#94a3b8',
    background: 'rgba(100,116,139,0.14)',
    border: 'rgba(148,163,184,0.28)',
  };
}

export function normalizeTeamKey(name) {
  return String(name || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function getInitials(name) {
  const words = String(name || '').split(/\s+/).filter(Boolean);
  return words.slice(-2).map(word => word[0]).join('').toUpperCase() || '—';
}

export function getPlayerInitials(name) {
  return String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'PP';
}

export function createPropHistoryKey(prop) {
  return [prop.sport, prop.gameId, prop.player, prop.market, prop.outcome, prop.book || prop.bookTitle || prop.bookKey].join('::');
}

export function createPropMarketKey(prop) {
  return [prop.sport, prop.gameId, prop.player, prop.market].join('::');
}

export function summarizeHistory(entries = []) {
  if (!entries.length) return null;
  const first = entries[0];
  const last = entries[entries.length - 1];
  return {
    priceChange: (last?.price != null && first?.price != null) ? last.price - first.price : null,
    lineChange: (last?.line != null && first?.line != null) ? Number((last.line - first.line).toFixed(2)) : null,
    startLine: first?.line ?? null,
    currentLine: last?.line ?? null,
    observations: entries.length,
    updatedAt: last?.capturedAt ?? null,
  };
}

// American odds jump from -100 to +100, so a raw price difference overstates
// any edge that straddles even money (+105 vs a -105 fair line is 10 cents,
// not 210). Map prices onto a continuous "cents" scale before subtracting.
function toCents(price) {
  return price >= 0 ? price - 100 : price + 100;
}

export function priceEdgeCents(price, fairPrice) {
  if (price == null || fairPrice == null) return null;
  return toCents(price) - toCents(fairPrice);
}

export function buildMarketInsights(mkt, propHistory = {}) {
  const overBooks = Object.keys(mkt.over || {}).filter(book => mkt.over[book] != null);
  const underBooks = Object.keys(mkt.under || {}).filter(book => mkt.under[book] != null);
  const books = Array.from(new Set([...(mkt.bookList || []), ...overBooks, ...underBooks]));
  const overPrices = overBooks.map(book => mkt.over[book]);
  const underPrices = underBooks.map(book => mkt.under[book]);
  const bestOver = overPrices.length ? Math.max(...overPrices) : null;
  const bestUnder = underPrices.length ? Math.max(...underPrices) : null;
  const bestOverBook = overBooks.find(book => mkt.over[book] === bestOver) || null;
  const bestUnderBook = underBooks.find(book => mkt.under[book] === bestUnder) || null;

  let fairOverProbSum = 0;
  let fairUnderProbSum = 0;
  let fairCount = 0;

  books.forEach(book => {
    const over = mkt.over?.[book];
    const under = mkt.under?.[book];
    if (over == null || under == null) return;
    const overImplied = americanToImplied(over);
    const underImplied = americanToImplied(under);
    if (!overImplied || !underImplied) return;
    const total = overImplied + underImplied;
    fairOverProbSum += overImplied / total;
    fairUnderProbSum += underImplied / total;
    fairCount += 1;
  });

  const fairOverProb = fairCount ? fairOverProbSum / fairCount : null;
  const fairUnderProb = fairCount ? fairUnderProbSum / fairCount : null;
  const fairOverPrice = fairOverProb ? impliedToAmerican(fairOverProb) : null;
  const fairUnderPrice = fairUnderProb ? impliedToAmerican(fairUnderProb) : null;
  const edgeOver = priceEdgeCents(bestOver, fairOverPrice);
  const edgeUnder = priceEdgeCents(bestUnder, fairUnderPrice);

  // Line disagreement compares each book's main number. Books can also post
  // alternate ladders, so every posted line would overstate the spread.
  const allLineEntries = Array.isArray(mkt.mainLines)
    ? mkt.mainLines.filter(line => line != null)
    : [];
  if (!Array.isArray(mkt.mainLines)) {
    Object.values(mkt._overByLine || {}).forEach(lines => {
      Object.keys(lines || {}).forEach(line => allLineEntries.push(Number(line)));
    });
    Object.values(mkt._underByLine || {}).forEach(lines => {
      Object.keys(lines || {}).forEach(line => allLineEntries.push(Number(line)));
    });
  }
  const minLine = allLineEntries.length ? Math.min(...allLineEntries) : mkt.line;
  const maxLine = allLineEntries.length ? Math.max(...allLineEntries) : mkt.line;
  const lineRange = minLine != null && maxLine != null ? Number((maxLine - minLine).toFixed(2)) : null;

  const historySummaries = books.flatMap(book => {
    const overKey = mkt.historyKeys?.over?.[book];
    const underKey = mkt.historyKeys?.under?.[book];
    return [
      overKey ? { side: 'over', book, ...summarizeHistory(propHistory[overKey]) } : null,
      underKey ? { side: 'under', book, ...summarizeHistory(propHistory[underKey]) } : null,
    ].filter(Boolean);
  });

  const lineMoves = historySummaries.filter(item => item.lineChange != null && item.lineChange !== 0);
  const strongestMove = lineMoves.sort((a, b) => Math.abs(b.lineChange) - Math.abs(a.lineChange))[0] || null;
  const priceMoves = historySummaries.filter(item => item.priceChange != null && item.priceChange !== 0);
  const strongestPriceMove = priceMoves.sort((a, b) => Math.abs(b.priceChange) - Math.abs(a.priceChange))[0] || null;

  const summaries = [];
  if (lineRange != null && lineRange > 0 && mkt.line != null) {
    summaries.push(`Best number is ${minLine} to ${maxLine} around a ${mkt.line} consensus.`);
  }
  if (strongestMove) {
    const direction = strongestMove.lineChange > 0 ? 'up' : 'down';
    summaries.push(`${getBookAbbreviation(strongestMove.book)} moved ${direction} ${Math.abs(strongestMove.lineChange)} on the ${getPropSideLabel(mkt, strongestMove.side).toLowerCase()}.`);
  }
  if (edgeOver != null || edgeUnder != null) {
    const side = (edgeOver ?? -Infinity) >= (edgeUnder ?? -Infinity) ? 'over' : 'under';
    const edge = side === 'over' ? edgeOver : edgeUnder;
    const book = side === 'over' ? bestOverBook : bestUnderBook;
    const sideLabel = getPropSideLabel(mkt, side).toLowerCase();
    if (edge != null && book) summaries.push(`${getBookAbbreviation(book)} shows the best ${sideLabel} price at ${formatOdds(side === 'over' ? bestOver : bestUnder)} (${edge > 0 ? '+' : ''}${Math.round(edge)}¢ vs fair).`);
  }

  const recommendationScore = Math.max(edgeOver ?? -999, edgeUnder ?? -999);
  let recommendation = 'Pass';
  if (recommendationScore >= 15 || (lineRange != null && lineRange >= 1)) recommendation = 'Playable';
  else if (recommendationScore >= 7 || strongestMove) recommendation = 'Monitor';

  return {
    booksCount: books.length,
    bestOver,
    bestUnder,
    bestOverBook,
    bestUnderBook,
    fairOverPrice,
    fairUnderPrice,
    edgeOver,
    edgeUnder,
    lineRange,
    strongestMove,
    strongestPriceMove,
    recommendation,
    summary: summaries[0] || 'Hold for a better read as books fill in.',
    details: summaries.slice(1),
    sortEdge: Math.max(edgeOver ?? Number.NEGATIVE_INFINITY, edgeUnder ?? Number.NEGATIVE_INFINITY),
    sortBooks: books.length,
    sortMovement: Math.max(Math.abs(strongestMove?.lineChange || 0), Math.abs(strongestPriceMove?.priceChange || 0) / 100),
  };
}

// ============================================================
// Prop market aggregation
// Collapses the flat per-book/per-outcome feed into one market per
// player + stat, with a consensus line and per-book prices.
// ============================================================
const SIDE_SLOTS = { Over: 'over', Yes: 'over', Under: 'under', No: 'under' };
const NO_LINE = 'none';

export function getPropSideSlot(outcome) {
  return SIDE_SLOTS[outcome] || null;
}

export function getPropSideLabel(mkt, side) {
  if (mkt?.yesNo) return side === 'over' ? 'Yes' : 'No';
  return side === 'over' ? 'Over' : 'Under';
}

// "Over 24.5", "Under 7", or just "Yes" for lineless yes/no markets.
export function formatPropPick(mkt, side, line = mkt?.line) {
  const label = getPropSideLabel(mkt, side);
  return line != null ? `${label} ${line}` : label;
}

function toLineKey(line) {
  const num = Number(line);
  return line == null || line === '' || !Number.isFinite(num) ? NO_LINE : String(num);
}

function fromLineKey(key) {
  return key === NO_LINE ? null : Number(key);
}

function compareLineKeys(a, b) {
  if (a === b) return 0;
  if (a === NO_LINE) return 1;
  if (b === NO_LINE) return -1;
  return Number(a) - Number(b);
}

// A book's main number is the line it prices closest to a coin flip; alt
// ladders sit at lopsided prices. One-sided lines only win when a book has
// no two-sided line at all.
function pickMainLineKey(overLines = {}, underLines = {}) {
  const keys = Array.from(new Set([...Object.keys(overLines), ...Object.keys(underLines)])).sort(compareLineKeys);
  let bestKey = null;
  let bestScore = Infinity;
  keys.forEach(key => {
    const over = overLines[key];
    const under = underLines[key];
    const score = over != null && under != null
      ? Math.abs((americanToImplied(over) ?? 0) - (americanToImplied(under) ?? 0))
      : 2;
    if (score < bestScore) {
      bestScore = score;
      bestKey = key;
    }
  });
  return bestKey;
}

function nearestLineKey(lines = {}, targetKey) {
  const keys = Object.keys(lines);
  if (!keys.length) return null;
  if (lines[targetKey] != null) return targetKey;
  if (targetKey === NO_LINE) return keys.sort(compareLineKeys)[0];
  const target = Number(targetKey);
  return keys
    .filter(key => key !== NO_LINE)
    .sort((a, b) => (Math.abs(Number(a) - target) - Math.abs(Number(b) - target)) || (Number(a) - Number(b)))[0]
    ?? keys[0];
}

function createEmptyMarket(marketKey) {
  return {
    marketKey,
    line: null,
    yesNo: false,
    books: new Set(),
    pricesByLine: { over: {}, under: {} },
    historyKeys: { over: {}, under: {} },
  };
}

function finalizeMarket(mkt, propHistory) {
  const bookList = Array.from(mkt.books).sort((a, b) => a.localeCompare(b));
  const mainLineByBook = {};
  bookList.forEach(book => {
    const key = pickMainLineKey(mkt.pricesByLine.over[book], mkt.pricesByLine.under[book]);
    if (key != null) mainLineByBook[book] = key;
  });

  const votes = {};
  Object.values(mainLineByBook).forEach(key => { votes[key] = (votes[key] || 0) + 1; });
  const consensusKey = Object.keys(votes)
    .sort((a, b) => (votes[b] - votes[a]) || compareLineKeys(a, b))[0] ?? NO_LINE;

  // over/under hold consensus-line prices only, so best price and fair value
  // never mix different numbers. cells carries what each book shows,
  // including an off-consensus line when that is all the book posts.
  const over = {};
  const under = {};
  const cells = { over: {}, under: {} };
  bookList.forEach(book => {
    ['over', 'under'].forEach(side => {
      const lines = mkt.pricesByLine[side][book];
      const key = nearestLineKey(lines, consensusKey);
      if (key == null) return;
      const price = lines[key];
      const alt = key !== consensusKey;
      cells[side][book] = { price, line: fromLineKey(key), alt };
      if (!alt) (side === 'over' ? over : under)[book] = price;
    });
  });

  const result = {
    ...mkt,
    line: fromLineKey(consensusKey),
    bookList,
    over,
    under,
    cells,
    mainLines: Object.values(mainLineByBook).map(fromLineKey).filter(line => line != null),
  };
  result.insights = buildMarketInsights(result, propHistory);
  return result;
}

// Returns one entry per sport + player with a `markets` map keyed by market.
export function aggregatePlayerProps(playerProps = [], propHistory = {}) {
  const players = new Map();
  playerProps.forEach(prop => {
    if (!prop?.player || !prop.market) return;
    const side = getPropSideSlot(prop.outcome);
    if (!side || prop.price == null || !Number.isFinite(Number(prop.price))) return;
    const sport = prop.sport || 'unknown';
    const playerKey = `${sport}::${prop.player}`;
    if (!players.has(playerKey)) {
      players.set(playerKey, {
        key: playerKey,
        sport,
        name: prop.player,
        game: prop.game,
        gameId: prop.gameId,
        commenceTime: prop.commence_time,
        markets: {},
      });
    }
    const player = players.get(playerKey);
    const mkt = player.markets[prop.market] || (player.markets[prop.market] = createEmptyMarket(prop.market));
    const book = prop.book || prop.bookTitle || prop.bookKey || 'Unknown';
    mkt.books.add(book);
    if (prop.outcome === 'Yes' || prop.outcome === 'No') mkt.yesNo = true;
    const byBook = mkt.pricesByLine[side][book] || (mkt.pricesByLine[side][book] = {});
    byBook[toLineKey(prop.line)] = Number(prop.price);
    mkt.historyKeys[side][book] = createPropHistoryKey(prop);
  });

  return Array.from(players.values()).map(player => {
    const markets = {};
    Object.entries(player.markets).forEach(([marketKey, mkt]) => {
      markets[marketKey] = finalizeMarket(mkt, propHistory);
    });
    return { ...player, markets };
  });
}

// ============================================================
// Composite prop scoring — powers "Best Props Right Now"
// Returns a 0-100 score plus the recommended side, best book/price,
// and a short list of human-readable reason strings.
// ============================================================
export function scorePropCandidate({ marketKey, mkt, timing }) {
  const insights = mkt?.insights;
  if (!insights || insights.booksCount < 2) {
    return { score: 0, side: null, edgeValue: null, bestPrice: null, bestBook: null, reasons: [] };
  }

  const edgeOver = insights.edgeOver;
  const edgeUnder = insights.edgeUnder;

  // Pick the better-value side
  const side = (edgeOver ?? Number.NEGATIVE_INFINITY) >= (edgeUnder ?? Number.NEGATIVE_INFINITY)
    ? 'over' : 'under';
  const edgeValue = side === 'over' ? edgeOver : edgeUnder;
  const bestPrice = side === 'over' ? insights.bestOver : insights.bestUnder;
  const bestBook = side === 'over' ? insights.bestOverBook : insights.bestUnderBook;

  let score = 0;
  const reasons = [];

  // 1. Price edge vs fair value — primary signal (0-40 pts, capped)
  if (edgeValue != null && edgeValue > 0) {
    const edgePts = Math.min(40, Math.round(edgeValue * 2));
    score += edgePts;
    if (edgeValue >= 10) reasons.push(`+${Math.round(edgeValue)}¢ vs fair line`);
    else if (edgeValue >= 5) reasons.push(`+${Math.round(edgeValue)}¢ above fair`);
  }

  // 2. Book depth — more books = more reliable fair model (0-20 pts)
  const booksCount = insights.booksCount ?? 0;
  const depthPts = Math.min(20, Math.round((Math.max(0, booksCount - 1) / 5) * 20));
  score += depthPts;
  if (booksCount >= 5) reasons.push(`${booksCount} books pricing market`);

  // 3. Line disagreement — books diverge on the number (0-15 pts)
  const lineRange = insights.lineRange;
  if (lineRange != null && lineRange > 0) {
    if (lineRange >= 1) { score += 15; reasons.push(`${lineRange.toFixed(1)}-pt line spread`); }
    else if (lineRange >= 0.5) { score += 9; reasons.push(`${lineRange.toFixed(1)}-pt disagreement`); }
    else { score += 4; }
  }

  // 4. Movement signal — observed line changes (0-15 pts)
  const move = insights.strongestMove;
  if (move?.lineChange != null) {
    const absMove = Math.abs(move.lineChange);
    if (absMove >= 1) {
      score += 15;
      reasons.push(`${move.lineChange > 0 ? '+' : ''}${move.lineChange} move at ${getBookAbbreviation(move.book)}`);
    } else if (absMove >= 0.5) {
      score += 8;
      reasons.push(`${move.lineChange > 0 ? '+' : ''}${move.lineChange} move`);
    }
  }

  // 5. Timing relevance — live & pre-game games are actionable (0-10 pts)
  if (timing?.key === 'live') score += 10;
  else if (timing?.key === 'pregame') score += 5;

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    side,
    edgeValue,
    bestPrice,
    bestBook,
    reasons: reasons.slice(0, 3),
  };
}

export function buildPropAlerts(players = [], propHistory = {}, propClosingLines = {}) {
  const alerts = [];

  players.forEach(player => {
    Object.entries(player.markets || {}).forEach(([marketKey, mkt]) => {
      const insights = mkt.insights;
      if (!insights) return;

      const edgeSlot = (insights.edgeOver ?? -Infinity) >= (insights.edgeUnder ?? -Infinity) ? 'over' : 'under';
      const edgeValue = edgeSlot === 'over' ? insights.edgeOver : insights.edgeUnder;
      const edgeBook = edgeSlot === 'over' ? insights.bestOverBook : insights.bestUnderBook;
      const edgePrice = edgeSlot === 'over' ? insights.bestOver : insights.bestUnder;
      const marketLabel = getMarketDisplayName(marketKey);
      const movement = insights.strongestMove;
      const priceMove = insights.strongestPriceMove;
      const marketKeyId = `${player.sport}::${player.game}::${player.name}::${marketKey}`;
      const closingEntries = Object.entries(propClosingLines).filter(([key]) => key.startsWith(`${player.sport}::`) && key.includes(`::${player.name}::${marketKey}::`));
      const validatedClosers = closingEntries.filter(([, item]) => item?.closingLine != null || item?.closingPrice != null);

      if (edgeBook && edgePrice != null && edgeValue != null && edgeValue >= 10 && insights.booksCount >= 3) {
        alerts.push({
          id: `${marketKeyId}::value::${edgeBook}`,
          type: 'value',
          playerKey: player.key,
          marketKey,
          sport: player.sportMeta?.label || player.sport,
          emoji: player.sportMeta?.icon || '🎯',
          player: player.name,
          game: player.game,
          market: marketLabel,
          side: edgeSlot,
          price: edgePrice,
          title: `${player.name} ${marketLabel} ${formatPropPick(mkt, edgeSlot)}`,
          edge: `${formatPropPick(mkt, edgeSlot)} at ${getBookAbbreviation(edgeBook)} ${formatOdds(edgePrice)}`,
          book: edgeBook,
          confidence: edgeValue >= 18 ? 'HIGH' : edgeValue >= 12 ? 'MEDIUM' : 'LOW',
          note: insights.summary,
          metric: edgeValue,
          metricDisplay: `${edgeValue > 0 ? '+' : ''}${Math.round(edgeValue)}¢ vs fair`,
        });
      }

      if (movement && Math.abs(movement.lineChange || 0) >= 0.5) {
        alerts.push({
          id: `${marketKeyId}::move::${movement.book}::${movement.side}`,
          type: 'movement',
          playerKey: player.key,
          marketKey,
          sport: player.sportMeta?.label || player.sport,
          emoji: player.sportMeta?.icon || '🎯',
          player: player.name,
          game: player.game,
          market: marketLabel,
          title: `${player.name} ${marketLabel} ${formatPropPick(mkt, movement.side)}`,
          edge: `${getBookAbbreviation(movement.book)} moved ${movement.lineChange > 0 ? '+' : ''}${movement.lineChange} on the ${getPropSideLabel(mkt, movement.side).toLowerCase()}`,
          book: movement.book,
          confidence: Math.abs(movement.lineChange) >= 1 ? 'HIGH' : 'MEDIUM',
          note: priceMove ? `Price also moved ${priceMove.priceChange > 0 ? '+' : ''}${priceMove.priceChange}.` : insights.summary,
          metric: Math.abs(movement.lineChange),
          metricDisplay: `${movement.lineChange > 0 ? '+' : ''}${movement.lineChange}`,
        });
      }

      if (validatedClosers.length > 0) {
        const latestClose = validatedClosers.sort((a, b) => new Date(b[1]?.capturedAt || 0) - new Date(a[1]?.capturedAt || 0))[0]?.[1];
        if (latestClose?.closingLine != null && latestClose?.firstLine != null) {
          const clv = Number((latestClose.closingLine - latestClose.firstLine).toFixed(2));
          if (Math.abs(clv) >= 0.5) {
            alerts.push({
              id: `${marketKeyId}::close::${latestClose.book || 'close'}`,
              type: 'closing',
              playerKey: player.key,
              marketKey,
              sport: player.sportMeta?.label || player.sport,
              emoji: player.sportMeta?.icon || '🎯',
              player: player.name,
              game: player.game,
              market: marketLabel,
              title: `${player.name} ${marketLabel} closing-line check`,
              edge: `${latestClose.side} ${latestClose.firstLine} → ${latestClose.closingLine}`,
              book: latestClose.book || 'Local',
              confidence: Math.abs(clv) >= 1 ? 'HIGH' : 'LOW',
              note: 'Tracked locally from the first observed line to the last pregame snapshot.',
              metric: Math.abs(clv),
              metricDisplay: `${clv > 0 ? '+' : ''}${clv} pts`,
            });
          }
        }
      }
    });
  });

  return alerts.sort((a, b) => (b.metric || 0) - (a.metric || 0)).slice(0, 20);
}
