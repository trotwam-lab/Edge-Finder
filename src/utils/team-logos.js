import { useEffect, useState } from 'react';
import { normalizeTeamKey, getSportMeta } from './props.js';

// Sport visual metadata used across Games, Props, and Edges views so every
// sport has a consistent color, icon, gradient, and short label.
export const SPORT_VISUALS = {
  basketball_nba:       { short: 'NBA',   icon: '🏀', color: '#f97316', gradient: 'linear-gradient(135deg, #f97316, #ea580c)' },
  basketball_ncaab:     { short: 'NCAAB', icon: '🏀', color: '#fb923c', gradient: 'linear-gradient(135deg, #fb923c, #c2410c)' },
  basketball_wncaab:    { short: 'WNBB',  icon: '🏀', color: '#f472b6', gradient: 'linear-gradient(135deg, #f472b6, #db2777)' },
  americanfootball_nfl: { short: 'NFL',   icon: '🏈', color: '#22c55e', gradient: 'linear-gradient(135deg, #22c55e, #15803d)' },
  americanfootball_ncaaf: { short: 'NCAAF', icon: '🏈', color: '#16a34a', gradient: 'linear-gradient(135deg, #16a34a, #166534)' },
  icehockey_nhl:        { short: 'NHL',   icon: '🏒', color: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
  baseball_mlb:         { short: 'MLB',   icon: '⚾', color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444, #b91c1c)' },
  mma_mixed_martial_arts: { short: 'MMA', icon: '🥊', color: '#dc2626', gradient: 'linear-gradient(135deg, #dc2626, #991b1b)' },
  boxing_boxing:        { short: 'BOX',   icon: '🥊', color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444, #7f1d1d)' },
  soccer_epl:           { short: 'EPL',   icon: '⚽', color: '#a855f7', gradient: 'linear-gradient(135deg, #a855f7, #6b21a8)' },
  soccer_spain_la_liga: { short: 'LIGA',  icon: '⚽', color: '#a855f7', gradient: 'linear-gradient(135deg, #a855f7, #6b21a8)' },
  soccer_italy_serie_a: { short: 'SERIE', icon: '⚽', color: '#a855f7', gradient: 'linear-gradient(135deg, #a855f7, #6b21a8)' },
  soccer_germany_bundesliga: { short: 'BUND', icon: '⚽', color: '#a855f7', gradient: 'linear-gradient(135deg, #a855f7, #6b21a8)' },
  soccer_france_ligue_one: { short: 'L1', icon: '⚽', color: '#a855f7', gradient: 'linear-gradient(135deg, #a855f7, #6b21a8)' },
  soccer_uefa_champs_league: { short: 'UCL', icon: '⚽', color: '#7c3aed', gradient: 'linear-gradient(135deg, #7c3aed, #4c1d95)' },
  soccer_usa_mls:       { short: 'MLS',   icon: '⚽', color: '#a855f7', gradient: 'linear-gradient(135deg, #a855f7, #6b21a8)' },
  soccer_mexico_ligamx: { short: 'LIGAMX', icon: '⚽', color: '#a855f7', gradient: 'linear-gradient(135deg, #a855f7, #6b21a8)' },
  tennis_atp_qatar_open: { short: 'ATP', icon: '🎾', color: '#eab308', gradient: 'linear-gradient(135deg, #eab308, #a16207)' },
  tennis_wta_dubai:     { short: 'WTA',   icon: '🎾', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #b45309)' },
  golf_masters_tournament_winner: { short: 'GOLF', icon: '⛳', color: '#10b981', gradient: 'linear-gradient(135deg, #10b981, #065f46)' },
  aussierules_afl:      { short: 'AFL',   icon: '🏉', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #b45309)' },
  rugbyleague_nrl:      { short: 'NRL',   icon: '🏉', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #b45309)' },
};

const DEFAULT_VISUAL = {
  short: 'SPORT', icon: '🎯', color: '#6366f1',
  gradient: 'linear-gradient(135deg, #6366f1, #4338ca)',
};

export function getSportVisual(sportKey) {
  return SPORT_VISUALS[sportKey] || DEFAULT_VISUAL;
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
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${meta.espnPath}/teams`);
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
  if (!sportMap) return null;
  return sportMap[normalizeTeamKey(teamName)] || null;
}
