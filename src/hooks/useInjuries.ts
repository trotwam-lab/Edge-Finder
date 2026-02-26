"use client";

import { useState, useEffect, useCallback } from "react";
import type { Injury, InjuryImpactAnalysis, Sport } from "@/types";

interface UseInjuriesOptions {
  sport?: Sport;
  team?: string;
  highImpactOnly?: boolean;
  gameId?: string;
  homeTeam?: string;
  awayTeam?: string;
  refreshInterval?: number;
}

interface UseInjuriesResult {
  injuries: Injury[];
  analysis: InjuryImpactAnalysis | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useInjuries({
  sport,
  team,
  highImpactOnly = false,
  gameId,
  homeTeam,
  awayTeam,
  refreshInterval = 300,
}: UseInjuriesOptions = {}): UseInjuriesResult {
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [analysis, setAnalysis] = useState<InjuryImpactAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInjuries = useCallback(async () => {
    try {
      setError(null);
      const params = new URLSearchParams();
      if (sport) params.set("sport", sport);
      if (team) params.set("team", team);
      if (highImpactOnly) params.set("highImpact", "true");
      if (gameId) params.set("gameId", gameId);
      if (homeTeam) params.set("homeTeam", homeTeam);
      if (awayTeam) params.set("awayTeam", awayTeam);

      const res = await fetch(`/api/injuries?${params}`);
      if (!res.ok) throw new Error("Failed to fetch injuries");

      const data = await res.json();
      setInjuries(data.injuries ?? []);
      setAnalysis(data.analysis ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [sport, team, highImpactOnly, gameId, homeTeam, awayTeam]);

  useEffect(() => {
    fetchInjuries();
  }, [fetchInjuries]);

  useEffect(() => {
    if (refreshInterval <= 0) return;
    const interval = setInterval(fetchInjuries, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [fetchInjuries, refreshInterval]);

  return { injuries, analysis, loading, error, refresh: fetchInjuries };
}
