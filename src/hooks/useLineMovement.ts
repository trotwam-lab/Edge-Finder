"use client";

import { useState, useEffect, useCallback } from "react";
import type { LineMovement, Sport } from "@/types";

interface UseLineMovementOptions {
  gameId?: string;
  sport?: Sport;
  filter?: "steam" | "reverse" | "significant" | "all";
  minMovement?: number;
  refreshInterval?: number;
}

interface UseLineMovementResult {
  movements: LineMovement[];
  singleMovement: LineMovement | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  recordSnapshots: (sport: Sport) => Promise<void>;
}

export function useLineMovement({
  gameId,
  sport,
  filter = "all",
  minMovement = 1,
  refreshInterval = 120,
}: UseLineMovementOptions = {}): UseLineMovementResult {
  const [movements, setMovements] = useState<LineMovement[]>([]);
  const [singleMovement, setSingleMovement] = useState<LineMovement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMovements = useCallback(async () => {
    try {
      setError(null);
      const params = new URLSearchParams();
      if (gameId) params.set("gameId", gameId);
      if (sport) params.set("sport", sport);
      if (filter !== "all") params.set("filter", filter);
      if (minMovement > 0) params.set("minMovement", minMovement.toString());

      const res = await fetch(`/api/line-movement?${params}`);
      if (!res.ok) throw new Error("Failed to fetch line movement");

      const data = await res.json();

      if (gameId) {
        setSingleMovement(data);
      } else {
        setMovements(data.movements ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [gameId, sport, filter, minMovement]);

  const recordSnapshots = useCallback(async (sportKey: Sport) => {
    try {
      await fetch("/api/line-movement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sport: sportKey }),
      });
      await fetchMovements();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record snapshots");
    }
  }, [fetchMovements]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  useEffect(() => {
    if (refreshInterval <= 0) return;
    const interval = setInterval(fetchMovements, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [fetchMovements, refreshInterval]);

  return {
    movements,
    singleMovement,
    loading,
    error,
    refresh: fetchMovements,
    recordSnapshots,
  };
}
