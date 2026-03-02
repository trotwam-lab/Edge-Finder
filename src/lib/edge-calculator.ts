import type {
    Game,
    Edge,
    EdgeType,
    EdgeStrength,
    EdgeOutcome,
    ArbitrageOpportunity,
    LineMovement,
    Injury,
    Bookmaker,
    Market,
    Outcome,
} from "@/types";

// ============================================================
// ID generation: use a monotonic counter so multiple edges
// detected within the same millisecond still get unique IDs.
// ============================================================
let _edgeSeq = 0;
function nextEdgeId(prefix: string): string {
    return `${prefix}-${Date.now()}-${++_edgeSeq}`;
}

// Convert American odds to decimal
export function americanToDecimal(american: number): number {
    if (american > 0) return american / 100 + 1;
    return 100 / Math.abs(american) + 1;
}

// Convert American odds to implied probability
export function impliedProbability(american: number): number {
    if (american > 0) return 100 / (american + 100);
    return Math.abs(american) / (Math.abs(american) + 100);
}

// Calculate no-vig (fair) probability
export function removeVig(probabilities: number[]): number[] {
    const total = probabilities.reduce((sum, p) => sum + p, 0);
    return probabilities.map((p) => p / total);
}

// Calculate expected value
export function calculateEV(
    fairProbability: number,
    decimalOdds: number
  ): number {
    return fairProbability * (decimalOdds - 1) - (1 - fairProbability);
}

// ============================================================
// Arbitrage Detection
// ============================================================

interface BestOdds {
    selection: string;
    bookmaker: string;
    bookmakerTitle: string;
    odds: number;
    decimalOdds: number;
}

function findBestOddsPerOutcome(
    game: Game,
    marketKey: string
  ): BestOdds[] {
    const bestBySelection = new Map<string, BestOdds>();

  for (const bookmaker of game.bookmakers) {
        const market = bookmaker.markets.find((m) => m.key === marketKey);
        if (!market) continue;

      for (const outcome of market.outcomes) {
              const key =
                        outcome.point !== undefined
                  ? `${outcome.name}|${outcome.point}`
                          : outcome.name;
              const decimal = americanToDecimal(outcome.price);
              const current = bestBySelection.get(key);
              if (!current || decimal > current.decimalOdds) {
                        bestBySelection.set(key, {
                                    selection:
                                                  outcome.point !== undefined
                                        ? `${outcome.name} ${outcome.point > 0 ? "+" : ""}${outcome.point}`
                                                    : outcome.name,
                                    bookmaker: bookmaker.key,
                                    bookmakerTitle: bookmaker.title,
                                    odds: outcome.price,
                                    decimalOdds: decimal,
                        });
              }
      }
  }

  return Array.from(bestBySelection.values());
}

export function detectArbitrage(game: Game): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];
    const marketKeys = ["h2h", "spreads", "totals"];

  for (const marketKey of marketKeys) {
        const bestOdds = findBestOddsPerOutcome(game, marketKey);
        if (bestOdds.length < 2) continue;

      const groups = groupOutcomesForArbitrage(bestOdds, marketKey);

      for (const group of groups) {
              const totalImplied = group.reduce(
                        (sum, o) => sum + 1 / o.decimalOdds,
                        0
                      );

          if (totalImplied < 1) {
                    const profitPct = (1 / totalImplied - 1) * 100;
                    const totalStake = 1000; // base stake for calculation
                const optimalStakes = group.map((o) => ({
                            bookmaker: o.bookmakerTitle,
                            selection: o.selection,
                            stake:
                                          Math.round(
                                                          (totalStake / (o.decimalOdds * totalImplied)) * 100
                                                        ) / 100,
                }));

                const outcomes: EdgeOutcome[] = group.map((o) => ({
                            bookmaker: o.bookmakerTitle,
                            selection: o.selection,
                            odds: o.odds,
                }));

                opportunities.push({
                            id: nextEdgeId(`arb-${game.id}-${marketKey}`),
                            type: "arbitrage",
                            strength: getEdgeStrength(profitPct),
                            gameId: game.id,
                            sport: game.sport,
                            homeTeam: game.homeTeam,
                            awayTeam: game.awayTeam,
                            commenceTime: game.commenceTime,
                            market: marketKey,
                            description: `${profitPct.toFixed(2)}% guaranteed profit across ${group
                                                                                                          .map((o) => o.bookmakerTitle)
                                                                                                          .join(" & ")}`,
                            profitPercentage: profitPct,
                            confidence: Math.min(99, 70 + profitPct * 10),
                            bookmakers: group.map((o) => o.bookmakerTitle),
                            outcomes,
                            detectedAt: new Date().toISOString(),
                            totalImpliedProbability: totalImplied,
                            guaranteedProfit: Math.round(profitPct * 10) / 10,
                            optimalStakes,
                            metadata: { marketKey, totalImplied },
                });
          }
      }
  }

  return opportunities;
}

function groupOutcomesForArbitrage(
    bestOdds: BestOdds[],
    marketKey: string
  ): BestOdds[][] {
    if (marketKey === "h2h") {
          // For moneyline, all outcomes form one group
      return [bestOdds];
    }

  if (marketKey === "spreads" || marketKey === "totals") {
        // Pair opposite outcomes (e.g., Over/Under or Home +3 vs Away -3)
      const pairs: BestOdds[][] = [];
        const used = new Set<number>();

      for (let i = 0; i < bestOdds.length; i++) {
              if (used.has(i)) continue;
              for (let j = i + 1; j < bestOdds.length; j++) {
                        if (used.has(j)) continue;
                        if (areOppositeOutcomes(bestOdds[i], bestOdds[j])) {
                                    pairs.push([bestOdds[i], bestOdds[j]]);
                                    used.add(i);
                                    used.add(j);
                                    break;
                        }
              }
      }
        return pairs;
  }

  return [bestOdds];
}

function areOppositeOutcomes(a: BestOdds, b: BestOdds): boolean {
    // Over/Under pairing
  if (
        (a.selection.includes("Over") && b.selection.includes("Under")) ||
        (a.selection.includes("Under") && b.selection.includes("Over"))
      ) {
        return true;
  }

  // Spread pairing: team names must differ AND points must be equal-and-opposite.
  // e.g. "Chiefs +3" pairs with "Eagles -3" (same absolute value, opposite signs).
  // This prevents incorrectly pairing 3+ outcomes in multi-way markets.
  const aMatch = a.selection.match(/([+-]?\d+(?:\.\d+)?)$/);
    const bMatch = b.selection.match(/([+-]?\d+(?:\.\d+)?)$/);
    if (aMatch && bMatch) {
          const aPoint = parseFloat(aMatch[1]);
          const bPoint = parseFloat(bMatch[1]);
          return aPoint + bPoint === 0;
    }

  return false;
}

// ============================================================
// Positive EV Detection
// ============================================================

export function detectPositiveEV(game: Game): Edge[] {
    const edges: Edge[] = [];
    const marketKeys = ["h2h", "spreads", "totals"];

  for (const marketKey of marketKeys) {
        // Calculate consensus (no-vig) probabilities from all bookmakers
      const consensusProbs = calculateConsensusProbs(game.bookmakers, marketKey);
        if (!consensusProbs) continue;

      // Check each bookmaker's odds against consensus
      for (const bookmaker of game.bookmakers) {
              const market = bookmaker.markets.find((m) => m.key === marketKey);
              if (!market) continue;

          for (const outcome of market.outcomes) {
                    const key =
                                outcome.point !== undefined
                        ? `${outcome.name}|${outcome.point}`
                                  : outcome.name;
                    const fairProb = consensusProbs.get(key);
                    if (!fairProb) continue;

                const decimal = americanToDecimal(outcome.price);
                    const ev = calculateEV(fairProb, decimal);

                if (ev > 0.02) {
                            // 2%+ positive EV threshold
                      const evPct = ev * 100;
                            edges.push({
                                          id: nextEdgeId(`pev-${game.id}-${bookmaker.key}-${key}`),
                                          type: "positive_ev",
                                          strength: getEdgeStrength(evPct),
                                          gameId: game.id,
                                          sport: game.sport,
                                          homeTeam: game.homeTeam,
                                          awayTeam: game.awayTeam,
                                          commenceTime: game.commenceTime,
                                          market: marketKey,
                                          description: `+${evPct.toFixed(1)}% EV on ${outcome.name} at ${
                                                          bookmaker.title
                                          } (${outcome.price > 0 ? "+" : ""}${outcome.price})`,
                                          profitPercentage: evPct,
                                          confidence: Math.min(95, 50 + evPct * 5),
                                          bookmakers: [bookmaker.title],
                                          outcomes: [
                                            {
                                                              bookmaker: bookmaker.title,
                                                              selection: outcome.name,
                                                              odds: outcome.price,
                                            },
                                                        ],
                                          detectedAt: new Date().toISOString(),
                                          metadata: { fairProbability: fairProb, ev, marketKey },
                            });
                }
          }
      }
  }

  return edges;
}

function calculateConsensusProbs(
    bookmakers: Bookmaker[],
    marketKey: string
  ): Map<string, number> | null {
    const probSums = new Map<string, number[]>();

  for (const bookmaker of bookmakers) {
        const market = bookmaker.markets.find((m) => m.key === marketKey);
        if (!market) continue;

      const probs = market.outcomes.map((o) => impliedProbability(o.price));
        const fairProbs = removeVig(probs);

      market.outcomes.forEach((outcome, i) => {
              const key =
                        outcome.point !== undefined
                  ? `${outcome.name}|${outcome.point}`
                          : outcome.name;
              const existing = probSums.get(key) ?? [];
              existing.push(fairProbs[i]);
              probSums.set(key, existing);
      });
  }

  if (probSums.size === 0) return null;

  const consensus = new Map<string, number>();
    for (const [key, probs] of probSums) {
          consensus.set(key, probs.reduce((a, b) => a + b, 0) / probs.length);
    }
    return consensus;
}

// ============================================================
// Line Movement Edge Detection
// ============================================================

export function detectLineMovementEdges(
    movements: LineMovement[]
  ): Edge[] {
    const edges: Edge[] = [];

  for (const movement of movements) {
        if (movement.steamMove) {
                edges.push({
                          id: nextEdgeId(`steam-${movement.gameId}`),
                          type: "steam_move",
                          strength: "strong",
                          gameId: movement.gameId,
                          sport: movement.sport,
                          homeTeam: movement.homeTeam,
                          awayTeam: movement.awayTeam,
                          commenceTime: movement.commenceTime,
                          market: "spreads",
                          description: `Steam move detected: ${Math.abs(
                                      movement.totalMovement ?? 0
                                    ).toFixed(1)} point shift toward ${movement.direction}`,
                          profitPercentage: Math.abs(movement.totalMovement ?? 0) * 2,
                          confidence: 75,
                          bookmakers: [],
                          outcomes: [],
                          detectedAt: new Date().toISOString(),
                          metadata: {
                                      direction: movement.direction,
                                      totalMovement: movement.totalMovement,
                          },
                });
        }

      if (movement.reverseLineMove) {
              edges.push({
                        id: nextEdgeId(`rlm-${movement.gameId}`),
                        type: "reverse_line",
                        strength: "moderate",
                        gameId: movement.gameId,
                        sport: movement.sport,
                        homeTeam: movement.homeTeam,
                        awayTeam: movement.awayTeam,
                        commenceTime: movement.commenceTime,
                        market: "spreads",
                        description: `Reverse line movement: line moving opposite to public money`,
                        profitPercentage: 3,
                        confidence: 65,
                        bookmakers: [],
                        outcomes: [],
                        detectedAt: new Date().toISOString(),
                        metadata: { direction: movement.direction },
              });
      }
  }

  return edges;
}

// ============================================================
// Injury Impact Edge Detection
// ============================================================

export function detectInjuryEdges(
    game: Game,
    injuries: Injury[]
  ): Edge[] {
    const edges: Edge[] = [];

  const gameInjuries = injuries.filter(
        (inj) => inj.team === game.homeTeam || inj.team === game.awayTeam
      );
    if (gameInjuries.length === 0) return [];

  const homeInjuries = gameInjuries.filter((i) => i.team === game.homeTeam);
    const awayInjuries = gameInjuries.filter((i) => i.team === game.awayTeam);

  const homeImpact = homeInjuries.reduce((sum, i) => sum + i.impactRating, 0);
    const awayImpact = awayInjuries.reduce((sum, i) => sum + i.impactRating, 0);
    const impactDiff = Math.abs(homeImpact - awayImpact);

  if (impactDiff >= 5) {
        const favoredSide = homeImpact > awayImpact ? "away" : "home";
        const favoredTeam =
                favoredSide === "home" ? game.homeTeam : game.awayTeam;
        const impactedTeam =
                favoredSide === "home" ? game.awayTeam : game.homeTeam;

      edges.push({
              id: nextEdgeId(`inj-${game.id}`),
              type: "injury_impact",
              strength:
                        impactDiff >= 15
                  ? "extreme"
                          : impactDiff >= 10
                  ? "strong"
                          : "moderate",
              gameId: game.id,
              sport: game.sport,
              homeTeam: game.homeTeam,
              awayTeam: game.awayTeam,
              commenceTime: game.commenceTime,
              market: "h2h",
              description: `Significant injury advantage for ${favoredTeam}. ${impactedTeam} missing key players (impact: ${Math.max(
                        homeImpact,
                        awayImpact
                      )}/10)`,
              profitPercentage: impactDiff * 0.5,
              confidence: Math.min(85, 40 + impactDiff * 3),
              bookmakers: [],
              outcomes: [],
              detectedAt: new Date().toISOString(),
              relatedInjuries: gameInjuries,
              metadata: { homeImpact, awayImpact, favoredSide },
      });
  }

  return edges;
}

// ============================================================
// Aggregate All Edges for a Game
// ============================================================

export function findAllEdges(
    game: Game,
    lineMovements: LineMovement[],
    injuries: Injury[]
  ): Edge[] {
    const arbs = detectArbitrage(game);
    const pevEdges = detectPositiveEV(game);
    const lineEdges = detectLineMovementEdges(
          lineMovements.filter((lm) => lm.gameId === game.id)
        );
    const injuryEdges = detectInjuryEdges(game, injuries);

  // Merge all edge types; final sort happens at the API layer after
  // aggregation across all games, so no need to sort here.
  return [...arbs, ...pevEdges, ...lineEdges, ...injuryEdges];
}

// ============================================================
// Edge Strength Classification
// Real-world arb opportunities are typically 0.5%–2%.
// Thresholds reflect realistic market conditions:
//   mild     < 1%   (marginal edge, worth tracking)
//   moderate 1–2%   (solid positive EV)
//   strong   2–4%   (significant edge)
//   extreme  >= 4%  (rare; verify odds are current before acting)
// ============================================================
function getEdgeStrength(profitPct: number): EdgeStrength {
    if (profitPct >= 4) return "extreme";
    if (profitPct >= 2) return "strong";
    if (profitPct >= 1) return "moderate";
    return "mild";
}
