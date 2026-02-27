"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Game, Sport } from "@/types";

interface UseOddsOptions {
  sport?: Sport;
  refreshInterval?: number; // seconds
  autoRefresh?: boolean;
}

interface UseOddsResult {
  games: Game[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

export function useOdds({
  sport,
  refreshInterval = 60,
  autoRefresh = true,
}: UseOddsOptions = {}): UseOddsResult {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchOdds = useCallback(async () => {
    try {
      setError(null);
      const params = new URLSearchParams();
      if (sport) params.set("sport", sport);
      else params.set("type", "all");

      const res = await fetch(`/api/odds?${params}`);
      if (!res.ok) throw new Error("Failed to fetch odds");

      const data = await res.json();
      setGames(data.games ?? []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [sport]);

  useEffect(() => {
    fetchOdds();
  }, [fetchOdds]);

  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0) return;
    intervalRef.current = setInterval(fetchOdds, refreshInterval * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchOdds, refreshInterval, autoRefresh]);

  return { games, loading, error, lastUpdated, refresh: fetchOdds };
}
