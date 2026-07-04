import { useEffect, useState } from 'react';
import { normalizeTeamKey, getSportMeta } from './props.js';

// Sport visual metadata used across Games, Props, and Edges views so every
// sport has a consistent color, icon, gradient, and short label.
export const SPORT_VISUALS = {
  basketball_nba:       { short: 'NBA',   icon: '🏀', color: '#f97316', gradient: 'linear-gradient(135deg, #f97316, #ea580c)' },
  basketball_nba_summer_league: { short: 'NBA SL', icon: '🏀', color: '#fbbf24', gradient: 'linear-gradient(135deg, #fbbf24, #d97706)' },
  basketball_wnba:      { short: 'WNBA',  icon: '🏀', color: '#fb7185', gradient: 'linear-gradient(135deg, #fb7185, #be123c)' },
  basketball_ncaab:     { short: 'NCAAB', icon: '🏀', color: '#fb923c', gradient: 'linear-gradient(135deg, #fb923c, #c2410c)' },
  basketball_wncaab:    { short: 'WNBB',  icon: '🏀', color: '#f472b6', gradient: 'linear-gradient(135deg, #f472b6, #db2777)' },
  americanfootball_nfl: { short: 'NFL',   icon: '🏈', color: '#22c55e', gradient: 'linear-gradient(135deg, #22c55e, #15803d)' },
  americanfootball_ncaaf: { short: 'NCAAF', icon: '🏈', color: '#16a34a', gradient: 'linear-gradient(135deg, #16a34a, #166534)' },
  icehockey_nhl:        { short: 'NHL',   icon: '🏒', color: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
  baseball_mlb:         { short: 'MLB',   icon: '⚾', color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444, #b91c1c)' },
  mma_mixed_martial_arts: { short: 'MMA', icon: '🥊', color: '#dc2626', gradient: 'linear-gradient(135deg, #dc2626, #991b1b)' },
  boxing_boxing:        { short: 'BOX',   icon: '🥊', color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444, #7f1d1d)' },
  soccer_fifa_world_cup: { short: 'WC',   icon: '🏆', color: '#facc15', gradient: 'linear-gradient(135deg, #facc15, #ca8a04)' },
  soccer_epl:           { short: 'EPL',   icon: '⚽', color: '#a855f7', gradient: 'linear-gradient(135deg, #a855f7, #6b21a8)' },
  soccer_spain_la_liga: { short: 'LIGA',  icon: '⚽', color: '#a855f7', gradient: 'linear-gradient(135deg, #a855f7, #6b21a8)' },
  soccer_italy_serie_a: { short: 'SERIE', icon: '⚽', color: '#a855f7', gradient: 'linear-gradient(135deg, #a855f7, #6b21a8)' },
  soccer_germany_bundesliga: { short: 'BUND', icon: '⚽', color: '#a855f7', gradient: 'linear-gradient(135deg, #a855f7, #6b21a8)' },
  soccer_france_ligue_one: { short: 'L1', icon: '⚽', color: '#a855f7', gradient: 'linear-gradient(135deg, #a855f7, #6b21a8)' },
  soccer_uefa_champs_league: { short: 'UCL', icon: '⚽', color: '#7c3aed', gradient: 'linear-gradient(135deg, #7c3aed, #4c1d95)' },
  soccer_usa_mls:       { short: 'MLS',   icon: '⚽', color: '#a855f7', gradient: 'linear-gradient(135deg, #a855f7, #6b21a8)' },
  soccer_mexico_ligamx: { short: 'LIGAMX', icon: '⚽', color: '#a855f7', gradient: 'linear-gradient(135deg, #a855f7, #6b21a8)' },
  tennis_atp_italian_open: { short: 'ATP', icon: '🎾', color: '#eab308', gradient: 'linear-gradient(135deg, #eab308, #a16207)' },
  tennis_wta_italian_open: { short: 'WTA', icon: '🎾', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #b45309)' },
  tennis_atp_wimbledon:  { short: 'ATP',  icon: '🎾', color: '#22c55e', gradient: 'linear-gradient(135deg, #22c55e, #14532d)' },
  tennis_wta_wimbledon:  { short: 'WTA',  icon: '🎾', color: '#4ade80', gradient: 'linear-gradient(135deg, #4ade80, #166534)' },
  tennis_atp_us_open:    { short: 'ATP',  icon: '🎾', color: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6, #1e40af)' },
  tennis_wta_us_open:    { short: 'WTA',  icon: '🎾', color: '#60a5fa', gradient: 'linear-gradient(135deg, #60a5fa, #1d4ed8)' },
  tennis_atp_french_open: { short: 'ATP', icon: '🎾', color: '#f97316', gradient: 'linear-gradient(135deg, #f97316, #9a3412)' },
  tennis_wta_french_open: { short: 'WTA', icon: '🎾', color: '#fb923c', gradient: 'linear-gradient(135deg, #fb923c, #c2410c)' },
  tennis_atp_aus_open_singles: { short: 'ATP', icon: '🎾', color: '#06b6d4', gradient: 'linear-gradient(135deg, #06b6d4, #0e7490)' },
  tennis_wta_aus_open_singles: { short: 'WTA', icon: '🎾', color: '#22d3ee', gradient: 'linear-gradient(135deg, #22d3ee, #155e75)' },
  soccer_uefa_europa_league: { short: 'UEL', icon: '⚽', color: '#f97316', gradient: 'linear-gradient(135deg, #f97316, #9a3412)' },
  golf_masters_tournament_winner: { short: 'GOLF', icon: '⛳', color: '#10b981', gradient: 'linear-gradient(135deg, #10b981, #065f46)' },
  aussierules_afl:      { short: 'AFL',   icon: '🏉', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #b45309)' },
  rugbyleague_nrl:      { short: 'NRL',   icon: '🏉', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #b45309)' },
};

const DEFAULT_VISUAL = {
  short: 'SPORT', icon: '🎯', color: '#6366f1',
  gradient: 'linear-gradient(135deg, #6366f1, #4338ca)',
};

// Sports without an explicit entry above inherit a look from their key's
// family prefix (soccer_*, tennis_*, cricket_*, …) so a newly tracked league
// still renders with the right ball and color instead of the generic target.
const FAMILY_VISUALS = {
  soccer:           { icon: '⚽', color: '#a855f7', gradient: 'linear-gradient(135deg, #a855f7, #6b21a8)' },
  tennis:           { icon: '🎾', color: '#eab308', gradient: 'linear-gradient(135deg, #eab308, #a16207)' },
  cricket:          { icon: '🏏', color: '#10b981', gradient: 'linear-gradient(135deg, #10b981, #065f46)' },
  basketball:       { icon: '🏀', color: '#f97316', gradient: 'linear-gradient(135deg, #f97316, #ea580c)' },
  americanfootball: { icon: '🏈', color: '#22c55e', gradient: 'linear-gradient(135deg, #22c55e, #15803d)' },
  icehockey:        { icon: '🏒', color: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
  baseball:         { icon: '⚾', color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444, #b91c1c)' },
  lacrosse:         { icon: '🥍', color: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6, #5b21b6)' },
  rugbyunion:       { icon: '🏉', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #b45309)' },
  rugbyleague:      { icon: '🏉', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #b45309)' },
  aussierules:      { icon: '🏉', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #b45309)' },
  boxing:           { icon: '🥊', color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444, #7f1d1d)' },
  mma:              { icon: '🥊', color: '#dc2626', gradient: 'linear-gradient(135deg, #dc2626, #991b1b)' },
  golf:             { icon: '⛳', color: '#10b981', gradient: 'linear-gradient(135deg, #10b981, #065f46)' },
};

const ESPN_ABBR_FALLBACKS = {
  basketball_nba: {
    'atlanta hawks': 'atl', 'boston celtics': 'bos', 'brooklyn nets': 'bkn', 'charlotte hornets': 'cha',
    'chicago bulls': 'chi', 'cleveland cavaliers': 'cle', 'dallas mavericks': 'dal', 'denver nuggets': 'den',
    'detroit pistons': 'det', 'golden state warriors': 'gs', 'houston rockets': 'hou', 'indiana pacers': 'ind',
    'la clippers': 'lac', 'los angeles clippers': 'lac', 'los angeles lakers': 'lal', 'lakers': 'lal',
    'memphis grizzlies': 'mem', 'miami heat': 'mia', 'milwaukee bucks': 'mil', 'minnesota timberwolves': 'min',
    'new orleans pelicans': 'no', 'new york knicks': 'ny', 'oklahoma city thunder': 'okc', 'orlando magic': 'orl',
    'philadelphia 76ers': 'phi', 'phoenix suns': 'phx', 'portland trail blazers': 'por', 'sacramento kings': 'sac',
    'san antonio spurs': 'sa', 'toronto raptors': 'tor', 'utah jazz': 'utah', 'washington wizards': 'wsh',
  },
  americanfootball_nfl: {
    'arizona cardinals': 'ari', 'atlanta falcons': 'atl', 'baltimore ravens': 'bal', 'buffalo bills': 'buf',
    'carolina panthers': 'car', 'chicago bears': 'chi', 'cincinnati bengals': 'cin', 'cleveland browns': 'cle',
    'dallas cowboys': 'dal', 'denver broncos': 'den', 'detroit lions': 'det', 'green bay packers': 'gb',
    'houston texans': 'hou', 'indianapolis colts': 'ind', 'jacksonville jaguars': 'jax', 'kansas city chiefs': 'kc',
    'las vegas raiders': 'lv', 'los angeles chargers': 'lac', 'los angeles rams': 'lar', 'miami dolphins': 'mia',
    'minnesota vikings': 'min', 'new england patriots': 'ne', 'new orleans saints': 'no', 'new york giants': 'nyg',
    'new york jets': 'nyj', 'philadelphia eagles': 'phi', 'pittsburgh steelers': 'pit', 'san francisco 49ers': 'sf',
    'seattle seahawks': 'sea', 'tampa bay buccaneers': 'tb', 'tennessee titans': 'ten', 'washington commanders': 'wsh',
  },
  baseball_mlb: {
    'arizona diamondbacks': 'ari', 'atlanta braves': 'atl', 'baltimore orioles': 'bal', 'boston red sox': 'bos',
    'chicago cubs': 'chc', 'chicago white sox': 'chw', 'cincinnati reds': 'cin', 'cleveland guardians': 'cle',
    'colorado rockies': 'col', 'detroit tigers': 'det', 'houston astros': 'hou', 'kansas city royals': 'kc',
    'los angeles angels': 'laa', 'los angeles dodgers': 'lad', 'miami marlins': 'mia', 'milwaukee brewers': 'mil',
    'minnesota twins': 'min', 'new york mets': 'nym', 'new york yankees': 'nyy', 'athletics': 'ath',
    'philadelphia phillies': 'phi', 'pittsburgh pirates': 'pit', 'san diego padres': 'sd', 'san francisco giants': 'sf',
    'seattle mariners': 'sea', 'st louis cardinals': 'stl', 'tampa bay rays': 'tb', 'texas rangers': 'tex',
    'toronto blue jays': 'tor', 'washington nationals': 'wsh',
  },
  icehockey_nhl: {
    'anaheim ducks': 'ana', 'boston bruins': 'bos', 'buffalo sabres': 'buf', 'calgary flames': 'cgy',
    'carolina hurricanes': 'car', 'chicago blackhawks': 'chi', 'colorado avalanche': 'col', 'columbus blue jackets': 'cbj',
    'dallas stars': 'dal', 'detroit red wings': 'det', 'edmonton oilers': 'edm', 'florida panthers': 'fla',
    'los angeles kings': 'la', 'minnesota wild': 'min', 'montreal canadiens': 'mtl', 'nashville predators': 'nsh',
    'new jersey devils': 'nj', 'new york islanders': 'nyi', 'new york rangers': 'nyr', 'ottawa senators': 'ott',
    'philadelphia flyers': 'phi', 'pittsburgh penguins': 'pit', 'san jose sharks': 'sj', 'seattle kraken': 'sea',
    'st louis blues': 'stl', 'tampa bay lightning': 'tb', 'toronto maple leafs': 'tor', 'utah mammoth': 'utah',
    'vancouver canucks': 'van', 'vegas golden knights': 'vgk', 'washington capitals': 'wsh', 'winnipeg jets': 'wpg',
  },
};

function fallbackTeamLogo(sportKey, teamName) {
  const meta = getSportMeta(sportKey);
  const abbr = ESPN_ABBR_FALLBACKS[sportKey]?.[normalizeTeamKey(teamName)];
  return abbr && meta.logoSport
    ? `https://a.espncdn.com/i/teamlogos/${meta.logoSport}/500/${abbr}.png`
    : null;
}

export function getSportVisual(sportKey) {
  if (SPORT_VISUALS[sportKey]) return SPORT_VISUALS[sportKey];
  const family = FAMILY_VISUALS[String(sportKey || '').split('_')[0]];
  if (!family) return DEFAULT_VISUAL;
  // Short label comes from the sport's display name (e.g. "EREDIVISIE").
  const label = getSportMeta(sportKey).label || 'SPORT';
  return { ...family, short: label.toUpperCase().slice(0, 12) };
}

// Shared logo fetcher — keeps a sport->teamKey->logoUrl map in component state.
// Loads once per unique sport the first time a game in that sport appears.
export function useTeamLogos(games = []) {
  const [logoMap, setLogoMap] = useState({});

  useEffect(() => {
    const sports = Array.from(new Set(games.map(g => g?.sport_key).filter(Boolean)));
    sports.forEach(async (sportKey) => {
      if (logoMap[sportKey]) return;
      const meta = getSportMeta(sportKey);
      if (!meta.espnPath) return;
      try {
        const res = await fetch(`/api/espn-assets?type=teams&path=${encodeURIComponent(meta.espnPath)}`);
        if (!res.ok) return;
        const data = await res.json();
        const teams = data?.sports?.[0]?.leagues?.[0]?.teams || [];
        const next = {};
        teams.forEach(entry => {
          const team = entry.team;
          if (!team) return;
          const logo = team.logos?.[0]?.href ||
            (team.abbreviation && meta.logoSport
              ? `https://a.espncdn.com/i/teamlogos/${meta.logoSport}/500/${team.abbreviation.toLowerCase()}.png`
              : null);
          if (!logo) return;
          [team.displayName, team.shortDisplayName, team.location, team.name, team.abbreviation]
            .filter(Boolean)
            .forEach(name => { next[normalizeTeamKey(name)] = logo; });
        });
        setLogoMap(prev => ({ ...prev, [sportKey]: next }));
      } catch {}
    });
    // We intentionally depend on the sports list derived from games; logoMap
    // is checked inline so we don't re-fetch for sports we already loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [games.map(g => g?.sport_key).join('|')]);

  return logoMap;
}

// Resolve a team's logo url from the logoMap, returning null when missing.
export function resolveTeamLogo(logoMap, sportKey, teamName) {
  if (!teamName) return null;
  const sportMap = logoMap?.[sportKey];
  return sportMap?.[normalizeTeamKey(teamName)] || fallbackTeamLogo(sportKey, teamName);
}
