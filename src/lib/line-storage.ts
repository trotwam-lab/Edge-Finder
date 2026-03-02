import type { LineMovement, LineSnapshot, Game, MarketType } from "@/types";
import { promises as fs } from "fs";
import path from "path";

// ============================================================
// Persistent Line Movement Storage
// Stores line snapshots to disk so history is NOT limited to
// the user's session - data accumulates over time.
//
// IMPORTANT: On Vercel (read-only filesystem), /tmp is used
// for disk writes. /tmp is ephemeral and wiped on cold starts,
// so the in-memory memoryIndex is the authoritative source
// during a function's lifetime. For true cross-session
// persistence, replace STORAGE_DIR with an external store
// (e.g. Supabase, Redis, Planetscale).
// ============================================================

const IS_VERCEL = !!process.env.VERCEL;
const STORAGE_DIR =
    process.env.LINE_STORAGE_PATH ||
    (IS_VERCEL ? "/tmp/line-history" : "./data/line-history");

// In-memory index for fast lookups (loaded from disk on startup)
let memoryIndex: Map<string, LineMovement> = new Map();
let initialized = false;

async function ensureDir(dir: string): Promise<void> {
    try {
          await fs.mkdir(dir, { recursive: true });
    } catch {
          // directory exists
    }
}

function getFilePath(gameId: string): string {
    return path.join(STORAGE_DIR, `${gameId}.json`);
}

export async function initialize(): Promise<void> {
    if (initialized) return;
    await ensureDir(STORAGE_DIR);
    try {
          const files = await fs.readdir(STORAGE_DIR);
          for (const file of files) {
                  if (!file.endsWith(".json")) continue;
                  try {
                            const content = await fs.readFile(
                                        path.join(STORAGE_DIR, file),
                                        "utf-8"
                                      );
                            const movement: LineMovement = JSON.parse(content);
                            memoryIndex.set(movement.gameId, movement);
                  } catch {
                            // skip corrupted files
                  }
          }
    } catch {
          // no existing data
    }
    initialized = true;
}

export async function recordSnapshot(
    game: Game,
    marketKey: MarketType = "spreads"
  ): Promise<LineMovement> {
    await initialize();
    const existing = memoryIndex.get(game.id);
    const now = new Date().toISOString();

  // Extract snapshots from all bookmakers
  const newSnapshots: LineSnapshot[] = [];
    for (const bookmaker of game.bookmakers) {
          const market = bookmaker.markets.find((m) => m.key === marketKey);
          if (!market) continue;
          newSnapshots.push({
                  timestamp: now,
                  bookmaker: bookmaker.title,
                  market: marketKey,
                  outcomes: market.outcomes.map((o) => ({
                            name: o.name,
                            price: o.price,
                            point: o.point,
                  })),
          });
    }

  if (existing) {
        // Append new snapshots, deduplicate by checking if odds changed
      const lastTimestamps = new Map<string, LineSnapshot>();
        for (const snap of existing.snapshots) {
                lastTimestamps.set(snap.bookmaker, snap);
        }
        for (const newSnap of newSnapshots) {
                const last = lastTimestamps.get(newSnap.bookmaker);
                if (!last || hasOddsChanged(last, newSnap)) {
                          existing.snapshots.push(newSnap);
                }
        }

      // Update derived fields
      existing.currentLine = existing.snapshots[existing.snapshots.length - 1];
        existing.totalMovement = calculateTotalMovement(existing);
        existing.direction = detectDirection(existing);
        existing.steamMove = detectSteamMove(existing);
        existing.reverseLineMove = detectReverseLineMove(existing);
        await persistMovement(existing);
        return existing;
  }

  // New game tracking
  const movement: LineMovement = {
        gameId: game.id,
        sport: game.sport,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        commenceTime: game.commenceTime,
        snapshots: newSnapshots,
        openingLine: newSnapshots[0],
        currentLine: newSnapshots[newSnapshots.length - 1],
        totalMovement: 0,
        direction: "stable",
        steamMove: false,
        reverseLineMove: false,
  };
    memoryIndex.set(game.id, movement);
    await persistMovement(movement);
    return movement;
}

async function persistMovement(movement: LineMovement): Promise<void> {
    await ensureDir(STORAGE_DIR);
    // Note: memoryIndex is updated by the caller before this function is invoked.
  // We only write to disk here to keep the two responsibilities separate.
  const filePath = getFilePath(movement.gameId);
    await fs.writeFile(filePath, JSON.stringify(movement, null, 2));
}

function hasOddsChanged(a: LineSnapshot, b: LineSnapshot): boolean {
    if (a.outcomes.length !== b.outcomes.length) return true;
    for (let i = 0; i < a.outcomes.length; i++) {
          if (a.outcomes[i].price !== b.outcomes[i].price) return true;
          if (a.outcomes[i].point !== b.outcomes[i].point) return true;
    }
    return false;
}

function calculateTotalMovement(movement: LineMovement): number {
    if (movement.snapshots.length < 2) return 0;
    const opening = movement.snapshots[0];
    const current = movement.snapshots[movement.snapshots.length - 1];

  // Calculate movement based on spread points or odds
  const openPoint = opening.outcomes[0]?.point ?? 0;
    const currentPoint = current.outcomes[0]?.point ?? 0;
    if (openPoint !== 0 || currentPoint !== 0) {
          return currentPoint - openPoint;
    }

  // Fallback to odds movement
  const openOdds = opening.outcomes[0]?.price ?? 0;
    const currentOdds = current.outcomes[0]?.price ?? 0;
    return currentOdds - openOdds;
}

function detectDirection(
    movement: LineMovement
  ): "home" | "away" | "stable" {
    const totalMove = movement.totalMovement ?? 0;
    if (Math.abs(totalMove) < 0.5) return "stable";
    return totalMove > 0 ? "away" : "home";
}

function detectSteamMove(movement: LineMovement): boolean {
    // Steam move: rapid line movement in the same direction across 3+ bookmakers.
  // We compare the earliest snapshot per bookmaker (as opening) against
  // the most recent snapshot per bookmaker (as current) to avoid
  // mixing cross-bookmaker entries in a sequential loop.
  if (movement.snapshots.length < 4) return false;

  // Group snapshots by bookmaker
  const byBook = new Map<string, LineSnapshot[]>();
    for (const snap of movement.snapshots) {
          const list = byBook.get(snap.bookmaker) ?? [];
          list.push(snap);
          byBook.set(snap.bookmaker, list);
    }

  if (byBook.size < 3) return false;

  // Determine direction of movement per bookmaker
  const directions: number[] = [];
    for (const snaps of byBook.values()) {
          if (snaps.length < 2) continue;
          const first = snaps[0];
          const last = snaps[snaps.length - 1];
          const openVal =
                  first.outcomes[0]?.point ?? first.outcomes[0]?.price ?? 0;
          const closeVal =
                  last.outcomes[0]?.point ?? last.outcomes[0]?.price ?? 0;
          const diff = closeVal - openVal;
          if (Math.abs(diff) > 0) directions.push(Math.sign(diff));
    }

  if (directions.length < 3) return false;

  // Steam if 70%+ of books moved in the same direction
  const dominant = directions.filter((d) => d === directions[0]).length;
    return dominant / directions.length >= 0.7;
}

function detectReverseLineMove(movement: LineMovement): boolean {
    // Reverse line move: line moves against the favourite (opposite to public money).
  // Uses implied probability so this works correctly for both favourites
  // (negative American odds) and underdogs (positive American odds).
  if (movement.snapshots.length < 3) return false;

  const open = movement.snapshots[0];
    const current = movement.snapshots[movement.snapshots.length - 1];

  // Find the opening favourite by highest implied probability
  function impliedProb(americanOdds: number): number {
        if (americanOdds > 0) return 100 / (americanOdds + 100);
        return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  }

  const openFav = open.outcomes.reduce((a, b) =>
        impliedProb(a.price) > impliedProb(b.price) ? a : b
                                         );
    const currentFav = current.outcomes.find((o) => o.name === openFav.name);
    if (!currentFav) return false;

  // RLM: the favourite's implied probability decreased by more than 2%
  // (i.e. the line moved against them despite public backing)
  const openProb = impliedProb(openFav.price);
    const currentProb = impliedProb(currentFav.price);
    return openProb - currentProb > 0.02;
}

// ============================================================
// Query Functions
// ============================================================

export async function getMovement(gameId: string): Promise<LineMovement | null> {
    await initialize();
    return memoryIndex.get(gameId) ?? null;
}

export async function getAllMovements(): Promise<LineMovement[]> {
    await initialize();
    return Array.from(memoryIndex.values());
}

export async function getMovementsBySport(sport: string): Promise<LineMovement[]> {
    await initialize();
    return Array.from(memoryIndex.values()).filter(
          (m) => m.sport === sport
        );
}

export async function getSignificantMovements(
    minMovement: number = 1
  ): Promise<LineMovement[]> {
    await initialize();
    return Array.from(memoryIndex.values()).filter(
          (m) => Math.abs(m.totalMovement ?? 0) >= minMovement
        );
}

export async function getSteamMoves(): Promise<LineMovement[]> {
    await initialize();
    return Array.from(memoryIndex.values()).filter((m) => m.steamMove);
}

export async function getReverseLineMoves(): Promise<LineMovement[]> {
    await initialize();
    return Array.from(memoryIndex.values()).filter(
          (m) => m.reverseLineMove
        );
}

// Cleanup old data (games that have passed)
export async function cleanup(daysOld: number = 7): Promise<number> {
    await initialize();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);
    let removed = 0;
    for (const [gameId, movement] of memoryIndex) {
          if (new Date(movement.commenceTime) < cutoff) {
                  memoryIndex.delete(gameId);
                  try {
                            await fs.unlink(getFilePath(gameId));
                  } catch {
                            // file already gone
                  }
                  removed++;
          }
    }
    return removed;
}
