"use client";

import { useState, useEffect, useCallback } from "react";
import type { Edge, EdgeType, Sport } from "@/types";

interface UseEdgesOptions {
  sport?: Sport;
  type?: EdgeType;
  minProfit?: number;
  minConfidence?: number;
  refreshInterval?: number;
}

interface EdgeSummary {
  total: number;
  arbitrage: number;
  positiveEV: number;
  steamMoves: number;
  reverseLineMoves: number;
  injuryEdges: number;
  extreme: number;
  strong: number;
}

interface UseEdgesResult {
  edges: Edge[];
  summary: EdgeSummary | null;
  loading: boolean;
  error: string | null;
  gamesAnalyzed: number;
  refresh: () => Promise<void>;
}

export function useEdges({
  sport,
  type,
  minProfit = 0,
  minConfidence = 0,
  refreshInterval = 120,
}: UseEdgesOptions = {}): UseEdgesResult {
  const [edges, setEdges] = useState<Edge[]>([]);
  const [summary, setSummary] = useState<EdgeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gamesAnalyzed, setGamesAnalyzed] = useState(0);

  const fetchEdges = useCallback(async () => {
    try {
      setError(null);
      const params = new URLSearchParams();
      if (sport) params.set("sport", sport);
      if (type) params.set("type", type);
      if (minProfit > 0) params.set("minProfit", minProfit.toString());
      if (minConfidence > 0)
        params.set("minConfidence", minConfidence.toString());

      const res = await fetch(`/api/edges?${params}`);
      if (!res.ok) throw new Error("Failed to fetch edges");

      const data = await res.json();
      setEdges(data.edges ?? []);
      setSummary(data.summary ?? null);
      setGamesAnalyzed(data.gamesAnalyzed ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [sport, type, minProfit, minConfidence]);

  useEffect(() => {
    fetchEdges();
  }, [fetchEdges]);

  useEffect(() => {
    if (refreshInterval <= 0) return;
    const interval = setInterval(fetchEdges, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [fetchEdges, refreshInterval]);

  return { edges, summary, loading, error, gamesAnalyzed, refresh: fetchEdges };
}
