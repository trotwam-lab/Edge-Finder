import { americanToImplied, impliedToAmerican, formatOdds as formatAmericanOdds } from './odds-math.js';

export const BOOK_ABBREVIATIONS = {
  FanDuel: 'FD', DraftKings: 'DK', BetMGM: 'MGM', Caesars: 'Csr',
  BetRivers: 'BR', PointsBet: 'PB', Bet365: 'B365', WynnBET: 'Wynn',
  Unibet: 'Uni', Barstool: 'BAR', 'ESPN BET': 'ESPN', Fanatics: 'Fan',
  BetOnline: 'BOL', Bovada: 'BVD', HardRockBet: 'HRB'
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
};

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

export function getBookAbbreviation(book) { return BOOK_ABBREVIATIONS[book] || book?.slice(0, 4) || '?'; }
export function getMarketDisplayName(market) { return MARKET_DISPLAY_NAMES[market] || market?.replace(/^(player_|batter_|pitcher_)/, '').replaceAll('_', ' ').toUpperCase() || market; }
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
  const edgeOver = bestOver != null && fairOverPrice != null ? bestOver - fairOverPrice : null;
  const edgeUnder = bestUnder != null && fairUnderPrice != null ? bestUnder - fairUnderPrice : null;

  const allLineEntries = [];
  Object.entries(mkt._overByLine || {}).forEach(([book, lines]) => {
    Object.keys(lines || {}).forEach(line => allLineEntries.push(Number(line)));
  });
  Object.entries(mkt._underByLine || {}).forEach(([book, lines]) => {
    Object.keys(lines || {}).forEach(line => allLineEntries.push(Number(line)));
  });
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
    summaries.push(`${getBookAbbreviation(strongestMove.book)} moved ${direction} ${Math.abs(strongestMove.lineChange)} on the ${strongestMove.side}.`);
  }
  if (edgeOver != null || edgeUnder != null) {
    const side = (edgeOver ?? -Infinity) >= (edgeUnder ?? -Infinity) ? 'over' : 'under';
    const edge = side === 'over' ? edgeOver : edgeUnder;
    const book = side === 'over' ? bestOverBook : bestUnderBook;
    if (edge != null && book) summaries.push(`${getBookAbbreviation(book)} shows the best ${side} price at ${formatOdds(side === 'over' ? bestOver : bestUnder)} (${edge > 0 ? '+' : ''}${Math.round(edge)} vs fair).`);
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
    sortEdge: Math.max(edgeOver || Number.NEGATIVE_INFINITY, edgeUnder || Number.NEGATIVE_INFINITY),
    sortBooks: books.length,
    sortMovement: Math.max(Math.abs(strongestMove?.lineChange || 0), Math.abs(strongestPriceMove?.priceChange || 0) / 100),
  };
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
    if (edgeValue >= 10) reasons.push(`+${Math.round(edgeValue)} vs fair line`);
    else if (edgeValue >= 5) reasons.push(`+${Math.round(edgeValue)} above fair`);
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

      const edgeSide = (insights.edgeOver ?? -Infinity) >= (insights.edgeUnder ?? -Infinity) ? 'Over' : 'Under';
      const edgeValue = edgeSide === 'Over' ? insights.edgeOver : insights.edgeUnder;
      const edgeBook = edgeSide === 'Over' ? insights.bestOverBook : insights.bestUnderBook;
      const edgePrice = edgeSide === 'Over' ? insights.bestOver : insights.bestUnder;
      const movement = insights.strongestMove;
      const priceMove = insights.strongestPriceMove;
      const marketKeyId = `${player.sport}::${player.game}::${player.name}::${marketKey}`;
      const closingEntries = Object.entries(propClosingLines).filter(([key]) => key.startsWith(`${player.sport}::`) && key.includes(`::${player.name}::${marketKey}::`));
      const validatedClosers = closingEntries.filter(([, item]) => item?.closingLine != null || item?.closingPrice != null);

      if (edgeBook && edgePrice != null && edgeValue != null && edgeValue >= 10 && insights.booksCount >= 3) {
        alerts.push({
          id: `${marketKeyId}::value::${edgeBook}`,
          type: 'value',
          sport: player.sportMeta?.label || player.sport,
          emoji: player.sportMeta?.icon || '🎯',
          player: player.name,
          game: player.game,
          market: getMarketDisplayName(marketKey),
          title: `${player.name} ${marketKey ? getMarketDisplayName(marketKey) : 'Prop'} ${edgeSide} ${mkt.line ?? '—'}`,
          edge: `${edgeSide} ${mkt.line ?? '—'} at ${getBookAbbreviation(edgeBook)} ${formatOdds(edgePrice)}`,
          book: edgeBook,
          confidence: edgeValue >= 18 ? 'HIGH' : edgeValue >= 12 ? 'MEDIUM' : 'LOW',
          note: insights.summary,
          metric: edgeValue,
          metricDisplay: `${edgeValue > 0 ? '+' : ''}${Math.round(edgeValue)} fair`,
        });
      }

      if (movement && Math.abs(movement.lineChange || 0) >= 0.5) {
        alerts.push({
          id: `${marketKeyId}::move::${movement.book}::${movement.side}`,
          type: 'movement',
          sport: player.sportMeta?.label || player.sport,
          emoji: player.sportMeta?.icon || '🎯',
          player: player.name,
          game: player.game,
          market: getMarketDisplayName(marketKey),
          title: `${player.name} ${getMarketDisplayName(marketKey)} ${movement.side === 'over' ? 'Over' : 'Under'} ${mkt.line ?? '—'}`,
          edge: `${getBookAbbreviation(movement.book)} moved ${movement.lineChange > 0 ? '+' : ''}${movement.lineChange} on the ${movement.side}`,
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
              sport: player.sportMeta?.label || player.sport,
              emoji: player.sportMeta?.icon || '🎯',
              player: player.name,
              game: player.game,
              market: getMarketDisplayName(marketKey),
              title: `${player.name} ${getMarketDisplayName(marketKey)} closing-line check`,
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
