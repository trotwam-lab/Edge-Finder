import type { SportConfig } from "@/types";

export const SPORTS: SportConfig[] = [
  { key: "americanfootball_nfl", label: "NFL", icon: "🏈", group: "Football", active: true },
  { key: "americanfootball_ncaaf", label: "NCAAF", icon: "🏈", group: "Football", active: true },
  { key: "basketball_nba", label: "NBA", icon: "🏀", group: "Basketball", active: true },
  { key: "basketball_ncaab", label: "NCAAB", icon: "🏀", group: "Basketball", active: true },
  { key: "baseball_mlb", label: "MLB", icon: "⚾", group: "Baseball", active: true },
  { key: "icehockey_nhl", label: "NHL", icon: "🏒", group: "Hockey", active: true },
  { key: "soccer_epl", label: "EPL", icon: "⚽", group: "Soccer", active: true },
  { key: "soccer_usa_mls", label: "MLS", icon: "⚽", group: "Soccer", active: true },
  { key: "mma_mixed_martial_arts", label: "MMA", icon: "🥊", group: "Combat", active: true },
];

export function getSportLabel(key: string): string {
  return SPORTS.find((s) => s.key === key)?.label ?? key;
}

export function getSportIcon(key: string): string {
  return SPORTS.find((s) => s.key === key)?.icon ?? "🎯";
}
