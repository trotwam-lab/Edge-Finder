// api/_espn-paths.js — single source of truth for Odds-API sport key -> ESPN path.
//
// ESPN's site API addresses leagues as "<sport>/<league-code>" (e.g.
// "baseball/mlb", "soccer/eng.1"). Our sport keys come from The Odds API
// ("baseball_mlb", "soccer_epl"), so every route that talks to ESPN needs this
// translation. Keys absent from this map (KBO, MMA, tennis, cricket, ...) have
// no ESPN coverage — callers must degrade gracefully, not guess a path.

export const ESPN_SITE_BASE = 'https://site.api.espn.com/apis/site/v2/sports';

export const SPORT_PATHS = {
  basketball_nba: 'basketball/nba',
  basketball_wnba: 'basketball/wnba',
  basketball_ncaab: 'basketball/mens-college-basketball',
  basketball_wncaab: 'basketball/womens-college-basketball',
  americanfootball_nfl: 'football/nfl',
  americanfootball_ncaaf: 'football/college-football',
  icehockey_nhl: 'hockey/nhl',
  baseball_mlb: 'baseball/mlb',
  soccer_fifa_world_cup: 'soccer/fifa.world',
  soccer_epl: 'soccer/eng.1',
  soccer_spain_la_liga: 'soccer/esp.1',
  soccer_italy_serie_a: 'soccer/ita.1',
  soccer_germany_bundesliga: 'soccer/ger.1',
  soccer_france_ligue_one: 'soccer/fra.1',
  soccer_uefa_champs_league: 'soccer/uefa.champions',
  soccer_usa_mls: 'soccer/usa.1',
  soccer_mexico_ligamx: 'soccer/mex.1',
  soccer_uefa_europa_league: 'soccer/uefa.europa',
  soccer_uefa_europa_conference_league: 'soccer/uefa.europa.conf',
  soccer_uefa_nations_league: 'soccer/uefa.nations',
  soccer_conmebol_copa_libertadores: 'soccer/conmebol.libertadores',
  soccer_conmebol_copa_america: 'soccer/conmebol.america',
  soccer_fa_cup: 'soccer/eng.fa',
  soccer_england_efl_cup: 'soccer/eng.league_cup',
  soccer_efl_champ: 'soccer/eng.2',
  soccer_england_league1: 'soccer/eng.3',
  soccer_england_league2: 'soccer/eng.4',
  soccer_netherlands_eredivisie: 'soccer/ned.1',
  soccer_portugal_primeira_liga: 'soccer/por.1',
  soccer_spl: 'soccer/sco.1',
  soccer_turkey_super_league: 'soccer/tur.1',
  soccer_belgium_first_div: 'soccer/bel.1',
  soccer_austria_bundesliga: 'soccer/aut.1',
  soccer_switzerland_superleague: 'soccer/sui.1',
  soccer_greece_super_league: 'soccer/gre.1',
  soccer_brazil_campeonato: 'soccer/bra.1',
  soccer_argentina_primera_division: 'soccer/arg.1',
  soccer_japan_j_league: 'soccer/jpn.1',
  soccer_korea_kleague1: 'soccer/kor.1',
  soccer_china_superleague: 'soccer/chn.1',
  soccer_australia_aleague: 'soccer/aus.1',
  soccer_sweden_allsvenskan: 'soccer/swe.1',
  soccer_norway_eliteserien: 'soccer/nor.1',
  soccer_denmark_superliga: 'soccer/den.1',
  soccer_germany_bundesliga2: 'soccer/ger.2',
  soccer_italy_serie_b: 'soccer/ita.2',
  soccer_france_ligue_two: 'soccer/fra.2',
  soccer_spain_segunda_division: 'soccer/esp.2',
  americanfootball_cfl: 'football/cfl',
};
