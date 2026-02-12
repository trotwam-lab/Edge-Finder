import { useState, useEffect, useCallback, useMemo } from "react";

// ─── Constants ───
const ENTRY_FEE = 20;
const MAX_ENTRIES_PER_PLAYER = 5;
const MAX_PLAYERS = 100;
const REGIONS = ["South", "East", "Midwest", "West"];

const SCORING = { 64: 1, 32: 2, 16: 4, 8: 8, 4: 16, 2: 32 };
const ROUND_NAMES = {
  64: "Round of 64",
  32: "Round of 32",
  16: "Sweet 16",
  8: "Elite 8",
  4: "Final Four",
  2: "Championship",
};

// ─── 2026 Bracket Seeds (placeholder teams) ───
const SEED_TEAMS = {
  South: [
    "Houston", "Tennessee", "Kentucky", "Purdue",
    "Marquette", "Michigan St", "Texas Tech", "UCLA",
    "Creighton", "Utah St", "New Mexico", "McNeese St",
    "Samford", "Oakland", "Stetson", "Longwood"
  ],
  East: [
    "UConn", "Iowa St", "Illinois", "Auburn",
    "San Diego St", "BYU", "Texas", "Florida Atlantic",
    "Northwestern", "Drake", "NC State", "James Madison",
    "Vermont", "Morehead St", "South Dakota St", "Wagner"
  ],
  Midwest: [
    "North Carolina", "Arizona", "Baylor", "Alabama",
    "Saint Mary's", "Clemson", "Dayton", "Mississippi St",
    "Michigan", "Nevada", "Oregon", "Grand Canyon",
    "Charleston", "Colgate", "Troy", "Montana St"
  ],
  West: [
    "Duke", "Wisconsin", "Gonzaga", "Kansas",
    "Connecticut", "TCU", "Florida", "Nebraska",
    "Memphis", "Colorado St", "Colorado", "Western KY",
    "Yale", "Duquesne", "Grambling St", "Akron"
  ],
};

// Generate initial bracket structure for a region
function generateRegionBracket(region) {
  const teams = SEED_TEAMS[region];
  // Matchup order: 1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15
  const seedOrder = [0,15, 7,8, 4,11, 3,12, 5,10, 2,13, 6,9, 1,14];
  const round1 = [];
  for (let i = 0; i < seedOrder.length; i += 2) {
    round1.push({
      team1: { name: teams[seedOrder[i]], seed: seedOrder[i] + 1 },
      team2: { name: teams[seedOrder[i+1]], seed: seedOrder[i+1] + 1 },
      winner: null,
    });
  }
  return {
    64: round1,
    32: Array(4).fill(null).map(() => ({ team1: null, team2: null, winner: null })),
    16: Array(2).fill(null).map(() => ({ team1: null, team2: null, winner: null })),
    8: [{ team1: null, team2: null, winner: null }],
  };
}

function generateFullBracket() {
  const bracket = {};
  REGIONS.forEach(r => { bracket[r] = generateRegionBracket(r); });
  bracket.finalFour = {
    4: [
      { team1: null, team2: null, winner: null },
      { team1: null, team2: null, winner: null },
    ],
    2: [{ team1: null, team2: null, winner: null }],
  };
  bracket.champion = null;
  return bracket;
}

// Default 10 entrants
const DEFAULT_PLAYERS = [
  "Alex Johnson", "Maria Garcia", "James Wilson", "Sarah Chen", "Mike Thompson",
  "Lisa Anderson", "David Martinez", "Rachel Kim", "Chris Brown", "Emma Davis"
];

function initPlayers() {
  return DEFAULT_PLAYERS.map((name, i) => ({
    id: `p${i + 1}`,
    name,
    entries: [],
    paid: false,
  }));
}

// ─── Utility ───
const deepClone = obj => JSON.parse(JSON.stringify(obj));

// ─── Components ───

function Header({ pool, view, setView }) {
  const totalPot = pool.players.reduce((sum, p) => sum + p.entries.length * ENTRY_FEE, 0);
  const totalEntries = pool.players.reduce((sum, p) => sum + p.entries.length, 0);

  return (
    <header style={{
      background: "linear-gradient(135deg, #1a0a2e 0%, #16213e 50%, #0f3460 100%)",
      borderBottom: "3px solid #e94560",
      padding: "0",
      position: "sticky",
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "16px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{
              fontFamily: "'Oswald', sans-serif",
              fontSize: 28,
              fontWeight: 700,
              color: "#fff",
              margin: 0,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}>
              🏀 March Madness 2026
            </h1>
            <p style={{ color: "#e94560", fontFamily: "'Oswald', sans-serif", fontSize: 14, margin: "2px 0 0", letterSpacing: 4, textTransform: "uppercase" }}>
              Bracket Pool
            </p>
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {[
              { label: "Prize Pool", value: `$${totalPot}` },
              { label: "Entries", value: totalEntries },
              { label: "Players", value: pool.players.length },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 24, fontWeight: 700, color: "#f0c040" }}>{s.value}</div>
                <div style={{ fontSize: 10, color: "#8892b0", textTransform: "uppercase", letterSpacing: 1 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
        <nav style={{ display: "flex", gap: 4, marginTop: 16, flexWrap: "wrap" }}>
          {["dashboard", "players", "bracket", "leaderboard", "rules"].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              fontFamily: "'Oswald', sans-serif",
              fontSize: 13,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              padding: "8px 18px",
              border: "none",
              borderRadius: "4px 4px 0 0",
              cursor: "pointer",
              background: view === v ? "#e94560" : "rgba(255,255,255,0.05)",
              color: view === v ? "#fff" : "#8892b0",
              transition: "all 0.2s",
            }}>
              {v}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}

function Dashboard({ pool, setView }) {
  const totalEntries = pool.players.reduce((sum, p) => sum + p.entries.length, 0);
  const paidPlayers = pool.players.filter(p => p.paid).length;
  const totalPot = pool.players.reduce((sum, p) => sum + p.entries.length * ENTRY_FEE, 0);
  const totalPaid = pool.players.filter(p => p.paid).reduce((sum, p) => sum + p.entries.length * ENTRY_FEE, 0);

  const cards = [
    { title: "Total Players", value: pool.players.length, sub: `of ${MAX_PLAYERS} max`, color: "#4fc3f7" },
    { title: "Total Entries", value: totalEntries, sub: `${pool.players.filter(p => p.entries.length > 0).length} players entered`, color: "#e94560" },
    { title: "Prize Pool", value: `$${totalPot}`, sub: `$${totalPaid} collected`, color: "#f0c040" },
    { title: "Paid Up", value: `${paidPlayers}/${pool.players.length}`, sub: `${pool.players.length - paidPlayers} outstanding`, color: "#66bb6a" },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 22, color: "#fff", marginBottom: 20, textTransform: "uppercase", letterSpacing: 2 }}>
        Pool Dashboard
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
        {cards.map(c => (
          <div key={c.title} style={{
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${c.color}33`,
            borderRadius: 8,
            padding: 20,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 11, color: "#8892b0", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>{c.title}</div>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 36, fontWeight: 700, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 12, color: "#556680", marginTop: 4 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 20, border: "1px solid rgba(255,255,255,0.06)" }}>
          <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, color: "#e94560", marginBottom: 12, textTransform: "uppercase" }}>Payout Structure</h3>
          <div style={{ fontSize: 14, color: "#ccd6f6", lineHeight: 1.8 }}>
            <div>🥇 1st Place: <span style={{ color: "#f0c040", fontWeight: 700 }}>{Math.round(totalPot * 0.6) || "—"}</span> (60%)</div>
            <div>🥈 2nd Place: <span style={{ color: "#c0c0c0", fontWeight: 700 }}>{Math.round(totalPot * 0.25) || "—"}</span> (25%)</div>
            <div>🥉 3rd Place: <span style={{ color: "#cd7f32", fontWeight: 700 }}>{Math.round(totalPot * 0.15) || "—"}</span> (15%)</div>
          </div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 20, border: "1px solid rgba(255,255,255,0.06)" }}>
          <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, color: "#4fc3f7", marginBottom: 12, textTransform: "uppercase" }}>Quick Actions</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={() => setView("players")} style={quickBtnStyle("#4fc3f7")}>Manage Players</button>
            <button onClick={() => setView("bracket")} style={quickBtnStyle("#e94560")}>Fill Brackets</button>
            <button onClick={() => setView("leaderboard")} style={quickBtnStyle("#f0c040")}>View Leaderboard</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const quickBtnStyle = (color) => ({
  fontFamily: "'Oswald', sans-serif",
  textTransform: "uppercase",
  letterSpacing: 1,
  padding: "10px 16px",
  border: `1px solid ${color}55`,
  borderRadius: 6,
  background: `${color}15`,
  color,
  cursor: "pointer",
  fontSize: 13,
  textAlign: "left",
});

function PlayersView({ pool, setPool }) {
  const [newName, setNewName] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const addPlayer = () => {
    if (!newName.trim() || pool.players.length >= MAX_PLAYERS) return;
    setPool(prev => ({
      ...prev,
      players: [...prev.players, { id: `p${Date.now()}`, name: newName.trim(), entries: [], paid: false }],
    }));
    setNewName("");
    setShowAdd(false);
  };

  const removePlayer = (id) => {
    setPool(prev => ({ ...prev, players: prev.players.filter(p => p.id !== id) }));
  };

  const togglePaid = (id) => {
    setPool(prev => ({
      ...prev,
      players: prev.players.map(p => p.id === id ? { ...p, paid: !p.paid } : p),
    }));
  };

  const addEntry = (id) => {
    setPool(prev => ({
      ...prev,
      players: prev.players.map(p => {
        if (p.id !== id || p.entries.length >= MAX_ENTRIES_PER_PLAYER) return p;
        return { ...p, entries: [...p.entries, { id: `e${Date.now()}`, bracket: generateFullBracket(), submitted: false, score: 0 }] };
      }),
    }));
  };

  const removeEntry = (playerId, entryId) => {
    setPool(prev => ({
      ...prev,
      players: prev.players.map(p => p.id === playerId ? { ...p, entries: p.entries.filter(e => e.id !== entryId) } : p),
    }));
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 22, color: "#fff", textTransform: "uppercase", letterSpacing: 2, margin: 0 }}>
          Players ({pool.players.length}/{MAX_PLAYERS})
        </h2>
        <button onClick={() => setShowAdd(true)} style={{
          fontFamily: "'Oswald', sans-serif",
          padding: "10px 20px",
          background: pool.players.length >= MAX_PLAYERS ? "#333" : "#e94560",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: pool.players.length >= MAX_PLAYERS ? "not-allowed" : "pointer",
          fontSize: 13,
          textTransform: "uppercase",
          letterSpacing: 1,
        }} disabled={pool.players.length >= MAX_PLAYERS}>
          + Add Player
        </button>
      </div>

      {showAdd && (
        <div style={{ background: "rgba(233,69,96,0.1)", border: "1px solid #e9456055", borderRadius: 8, padding: 16, marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addPlayer()}
            placeholder="Player name..."
            style={{
              flex: 1, minWidth: 200, padding: "10px 14px", background: "rgba(0,0,0,0.3)",
              border: "1px solid #e9456055", borderRadius: 6, color: "#fff", fontSize: 14, outline: "none",
            }}
          />
          <button onClick={addPlayer} style={{ ...quickBtnStyle("#66bb6a"), padding: "10px 20px" }}>Add</button>
          <button onClick={() => setShowAdd(false)} style={{ ...quickBtnStyle("#e94560"), padding: "10px 20px" }}>Cancel</button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {pool.players.map(player => (
          <div key={player.id} style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 8,
            padding: 16,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: player.paid ? "linear-gradient(135deg, #66bb6a, #43a047)" : "linear-gradient(135deg, #e94560, #c62828)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 700, color: "#fff",
                }}>
                  {player.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, color: "#fff" }}>{player.name}</div>
                  <div style={{ fontSize: 11, color: "#8892b0" }}>
                    {player.entries.length} {player.entries.length === 1 ? "entry" : "entries"} · ${player.entries.length * ENTRY_FEE} owed
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button onClick={() => togglePaid(player.id)} style={{
                  ...quickBtnStyle(player.paid ? "#66bb6a" : "#ff9800"),
                  padding: "6px 12px",
                  fontSize: 11,
                }}>
                  {player.paid ? "✓ Paid" : "Mark Paid"}
                </button>
                <button onClick={() => addEntry(player.id)} disabled={player.entries.length >= MAX_ENTRIES_PER_PLAYER} style={{
                  ...quickBtnStyle("#4fc3f7"),
                  padding: "6px 12px",
                  fontSize: 11,
                  opacity: player.entries.length >= MAX_ENTRIES_PER_PLAYER ? 0.4 : 1,
                }}>
                  + Entry
                </button>
                <button onClick={() => removePlayer(player.id)} style={{
                  ...quickBtnStyle("#e94560"),
                  padding: "6px 12px",
                  fontSize: 11,
                }}>
                  Remove
                </button>
              </div>
            </div>
            {player.entries.length > 0 && (
              <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {player.entries.map((entry, idx) => (
                  <div key={entry.id} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: "rgba(0,0,0,0.2)", borderRadius: 4, padding: "4px 10px",
                    fontSize: 12, color: "#ccd6f6",
                  }}>
                    <span>Bracket #{idx + 1}</span>
                    <span style={{ color: entry.submitted ? "#66bb6a" : "#ff9800" }}>
                      {entry.submitted ? "✓" : "⏳"}
                    </span>
                    <span style={{ color: "#4fc3f7" }}>({entry.score} pts)</span>
                    <button onClick={() => removeEntry(player.id, entry.id)} style={{
                      background: "none", border: "none", color: "#e94560", cursor: "pointer", fontSize: 14, padding: "0 2px",
                    }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Bracket View ───
function BracketView({ pool, setPool }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [activeRegion, setActiveRegion] = useState("South");
  const [isResults, setIsResults] = useState(false);

  const playersWithEntries = pool.players.filter(p => p.entries.length > 0);

  const currentBracket = useMemo(() => {
    if (isResults) return pool.results;
    if (!selectedPlayer || !selectedEntry) return null;
    const player = pool.players.find(p => p.id === selectedPlayer);
    if (!player) return null;
    const entry = player.entries.find(e => e.id === selectedEntry);
    return entry ? entry.bracket : null;
  }, [isResults, selectedPlayer, selectedEntry, pool]);

  const pickWinner = (region, round, matchIndex, team) => {
    if (!team) return;

    setPool(prev => {
      const newPool = deepClone(prev);

      if (isResults) {
        // Update results bracket
        const bracket = region === "finalFour" ? newPool.results.finalFour : newPool.results[region];
        const roundData = bracket[round];
        roundData[matchIndex].winner = team;
        propagateWinner(newPool.results, region, round, matchIndex, team);
        // Recalculate all scores
        newPool.players.forEach(p => {
          p.entries.forEach(e => {
            e.score = calculateScore(e.bracket, newPool.results);
          });
        });
        return newPool;
      } else {
        // Update player's entry bracket
        const player = newPool.players.find(p => p.id === selectedPlayer);
        const entry = player.entries.find(e => e.id === selectedEntry);
        const bracket = region === "finalFour" ? entry.bracket.finalFour : entry.bracket[region];
        bracket[round][matchIndex].winner = team;
        propagateWinner(entry.bracket, region, round, matchIndex, team);
        return newPool;
      }
    });
  };

  const submitEntry = () => {
    setPool(prev => {
      const newPool = deepClone(prev);
      const player = newPool.players.find(p => p.id === selectedPlayer);
      const entry = player.entries.find(e => e.id === selectedEntry);
      entry.submitted = true;
      return newPool;
    });
  };

  const regionBracket = currentBracket ? (activeRegion === "Final Four"
    ? currentBracket.finalFour
    : currentBracket[activeRegion]) : null;

  const isEntryBracketComplete = currentBracket && !isResults ? checkBracketComplete(currentBracket) : false;
  const currentEntry = useMemo(() => {
    if (!selectedPlayer || !selectedEntry) return null;
    const player = pool.players.find(p => p.id === selectedPlayer);
    return player?.entries.find(e => e.id === selectedEntry);
  }, [selectedPlayer, selectedEntry, pool]);

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 22, color: "#fff", textTransform: "uppercase", letterSpacing: 2, marginBottom: 16 }}>
        Bracket
      </h2>

      {/* Mode selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={() => { setIsResults(true); setSelectedPlayer(null); setSelectedEntry(null); }}
          style={{
            ...quickBtnStyle(isResults ? "#f0c040" : "#8892b0"),
            background: isResults ? "#f0c04025" : "transparent",
          }}>
          🏆 Actual Results
        </button>
        <button onClick={() => setIsResults(false)}
          style={{
            ...quickBtnStyle(!isResults ? "#4fc3f7" : "#8892b0"),
            background: !isResults ? "#4fc3f725" : "transparent",
          }}>
          📝 Player Entries
        </button>
      </div>

      {/* Player/Entry selector */}
      {!isResults && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <select
            value={selectedPlayer || ""}
            onChange={e => { setSelectedPlayer(e.target.value); setSelectedEntry(null); }}
            style={selectStyle}
          >
            <option value="">Select Player...</option>
            {playersWithEntries.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.entries.length} entries)</option>
            ))}
          </select>
          {selectedPlayer && (
            <select value={selectedEntry || ""} onChange={e => setSelectedEntry(e.target.value)} style={selectStyle}>
              <option value="">Select Entry...</option>
              {pool.players.find(p => p.id === selectedPlayer)?.entries.map((e, i) => (
                <option key={e.id} value={e.id}>Bracket #{i + 1} {e.submitted ? "✓" : ""}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Region tabs */}
      {(isResults || (selectedPlayer && selectedEntry)) && (
        <>
          <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
            {[...REGIONS, "Final Four"].map(r => (
              <button key={r} onClick={() => setActiveRegion(r)} style={{
                fontFamily: "'Oswald', sans-serif",
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: 1,
                padding: "8px 16px",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                background: activeRegion === r ? "#e94560" : "rgba(255,255,255,0.05)",
                color: activeRegion === r ? "#fff" : "#8892b0",
              }}>
                {r}
              </button>
            ))}
          </div>

          {/* Bracket display */}
          {regionBracket && (
            <RegionBracket
              bracket={regionBracket}
              regionName={activeRegion}
              pickWinner={pickWinner}
              isResults={isResults}
              readOnly={!isResults && currentEntry?.submitted}
            />
          )}

          {/* Submit button for player entries */}
          {!isResults && currentEntry && !currentEntry.submitted && (
            <div style={{ marginTop: 20, textAlign: "center" }}>
              <button onClick={submitEntry} disabled={!isEntryBracketComplete} style={{
                fontFamily: "'Oswald', sans-serif",
                padding: "12px 32px",
                fontSize: 16,
                textTransform: "uppercase",
                letterSpacing: 2,
                border: "none",
                borderRadius: 8,
                cursor: isEntryBracketComplete ? "pointer" : "not-allowed",
                background: isEntryBracketComplete ? "linear-gradient(135deg, #e94560, #c62828)" : "#333",
                color: "#fff",
                opacity: isEntryBracketComplete ? 1 : 0.5,
              }}>
                🔒 Submit Bracket
              </button>
              {!isEntryBracketComplete && (
                <p style={{ color: "#ff9800", fontSize: 12, marginTop: 8 }}>Complete all picks to submit</p>
              )}
            </div>
          )}
          {!isResults && currentEntry?.submitted && (
            <p style={{ color: "#66bb6a", fontSize: 14, marginTop: 16, textAlign: "center", fontFamily: "'Oswald', sans-serif", letterSpacing: 1 }}>
              ✓ Bracket Submitted — Score: {currentEntry.score} pts
            </p>
          )}
        </>
      )}

      {!isResults && !selectedPlayer && (
        <div style={{ textAlign: "center", padding: 40, color: "#556680" }}>
          <p style={{ fontSize: 48, marginBottom: 8 }}>🏀</p>
          <p style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, textTransform: "uppercase", letterSpacing: 2 }}>
            Select a player to fill out their bracket
          </p>
        </div>
      )}
    </div>
  );
}

const selectStyle = {
  padding: "10px 14px",
  background: "rgba(0,0,0,0.3)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 6,
  color: "#fff",
  fontSize: 14,
  outline: "none",
  minWidth: 180,
};

function RegionBracket({ bracket, regionName, pickWinner, isResults, readOnly }) {
  const region = regionName === "Final Four" ? "finalFour" : regionName;
  const rounds = regionName === "Final Four" ? [4, 2] : [64, 32, 16, 8];

  return (
    <div style={{
      display: "flex",
      gap: 0,
      overflowX: "auto",
      padding: "8px 0",
    }}>
      {rounds.map((round, rIdx) => (
        <div key={round} style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          minWidth: 170,
          gap: rIdx === 0 ? 4 : 0,
        }}>
          <div style={{
            fontFamily: "'Oswald', sans-serif",
            fontSize: 11,
            color: "#e94560",
            textTransform: "uppercase",
            letterSpacing: 1.5,
            padding: "0 8px 8px",
            textAlign: "center",
          }}>
            {ROUND_NAMES[round] || `Round`}
          </div>
          <div style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-around",
            flex: 1,
            gap: 4,
          }}>
            {bracket[round]?.map((match, mIdx) => (
              <MatchCard
                key={mIdx}
                match={match}
                round={round}
                onPick={(team) => !readOnly && pickWinner(region, round, mIdx, team)}
                readOnly={readOnly}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Champion display */}
      {regionName === "Final Four" && bracket[2]?.[0]?.winner && (
        <div style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          minWidth: 140,
          padding: 16,
        }}>
          <div style={{ fontSize: 32, marginBottom: 4 }}>🏆</div>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 11, color: "#f0c040", textTransform: "uppercase", letterSpacing: 2, marginBottom: 4 }}>Champion</div>
          <div style={{
            fontFamily: "'Oswald', sans-serif",
            fontSize: 16,
            color: "#f0c040",
            fontWeight: 700,
            padding: "8px 16px",
            background: "rgba(240,192,64,0.1)",
            border: "2px solid #f0c040",
            borderRadius: 8,
            textAlign: "center",
          }}>
            ({bracket[2][0].winner.seed}) {bracket[2][0].winner.name}
          </div>
        </div>
      )}
    </div>
  );
}

function MatchCard({ match, round, onPick, readOnly }) {
  const { team1, team2, winner } = match;

  const teamRow = (team, isWinner) => {
    if (!team) return (
      <div style={{
        padding: "5px 8px",
        fontSize: 12,
        color: "#444",
        fontStyle: "italic",
        background: "rgba(0,0,0,0.2)",
        borderRadius: 3,
        minHeight: 22,
      }}>TBD</div>
    );

    return (
      <div
        onClick={() => !readOnly && onPick(team)}
        style={{
          padding: "5px 8px",
          fontSize: 12,
          cursor: readOnly ? "default" : "pointer",
          background: isWinner
            ? "linear-gradient(90deg, rgba(102,187,106,0.25), rgba(102,187,106,0.1))"
            : "rgba(0,0,0,0.15)",
          color: isWinner ? "#66bb6a" : "#ccd6f6",
          fontWeight: isWinner ? 700 : 400,
          borderRadius: 3,
          borderLeft: isWinner ? "3px solid #66bb6a" : "3px solid transparent",
          transition: "all 0.15s",
          display: "flex",
          gap: 4,
          alignItems: "center",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={e => { if (!readOnly && !isWinner) e.currentTarget.style.background = "rgba(233,69,96,0.15)"; }}
        onMouseLeave={e => { if (!readOnly && !isWinner) e.currentTarget.style.background = "rgba(0,0,0,0.15)"; }}
      >
        <span style={{ color: "#8892b0", fontSize: 10, minWidth: 14 }}>({team.seed})</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{team.name}</span>
      </div>
    );
  };

  return (
    <div style={{
      margin: "2px 4px",
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 4,
      overflow: "hidden",
    }}>
      {teamRow(team1, winner && team1 && winner.name === team1.name)}
      <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />
      {teamRow(team2, winner && team2 && winner.name === team2.name)}
    </div>
  );
}

// ─── Leaderboard ───
function Leaderboard({ pool }) {
  const entries = [];
  pool.players.forEach(p => {
    p.entries.forEach((e, idx) => {
      entries.push({
        playerName: p.name,
        entryNum: idx + 1,
        score: e.score,
        submitted: e.submitted,
        champion: e.bracket?.finalFour?.[2]?.[0]?.winner?.name || "—",
      });
    });
  });

  entries.sort((a, b) => b.score - a.score);

  const totalPot = pool.players.reduce((sum, p) => sum + p.entries.length * ENTRY_FEE, 0);

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 22, color: "#fff", textTransform: "uppercase", letterSpacing: 2, marginBottom: 20 }}>
        Leaderboard
      </h2>

      {entries.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#556680" }}>
          <p style={{ fontSize: 48 }}>📊</p>
          <p style={{ fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", letterSpacing: 2 }}>No entries yet</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e94560" }}>
                {["Rank", "Player", "Entry", "Champion Pick", "Score", "Prize"].map(h => (
                  <th key={h} style={{
                    fontFamily: "'Oswald', sans-serif",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    fontSize: 11,
                    color: "#8892b0",
                    padding: "10px 12px",
                    textAlign: "left",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={`${e.playerName}-${e.entryNum}`} style={{
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  background: i < 3 ? `rgba(${i === 0 ? "240,192,64" : i === 1 ? "192,192,192" : "205,127,50"},0.05)` : "transparent",
                }}>
                  <td style={{ padding: "10px 12px", color: "#fff", fontWeight: 700 }}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#ccd6f6", fontFamily: "'Oswald', sans-serif" }}>{e.playerName}</td>
                  <td style={{ padding: "10px 12px", color: "#8892b0" }}>#{e.entryNum} {e.submitted ? "" : "⏳"}</td>
                  <td style={{ padding: "10px 12px", color: "#4fc3f7" }}>{e.champion}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 18, fontWeight: 700, color: "#f0c040" }}>{e.score}</span>
                  </td>
                  <td style={{ padding: "10px 12px", color: "#66bb6a", fontWeight: 700 }}>
                    {i === 0 ? `$${Math.round(totalPot * 0.6)}` : i === 1 ? `$${Math.round(totalPot * 0.25)}` : i === 2 ? `$${Math.round(totalPot * 0.15)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Rules() {
  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 22, color: "#fff", textTransform: "uppercase", letterSpacing: 2, marginBottom: 20 }}>
        Pool Rules
      </h2>
      <div style={{ color: "#ccd6f6", lineHeight: 1.9, fontSize: 14 }}>
        <Section title="Entry">
          Entry fee is <strong style={{ color: "#f0c040" }}>${ENTRY_FEE}</strong> per bracket. Each player may submit up to <strong style={{ color: "#4fc3f7" }}>{MAX_ENTRIES_PER_PLAYER} entries</strong>. The pool allows a maximum of <strong style={{ color: "#e94560" }}>{MAX_PLAYERS} players</strong>. All entries must be submitted before the first game tips off.
        </Section>
        <Section title="Scoring">
          Points are awarded for each correct pick per round:
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginTop: 10 }}>
            {Object.entries(SCORING).map(([round, pts]) => (
              <div key={round} style={{
                background: "rgba(255,255,255,0.04)",
                borderRadius: 6,
                padding: "8px 12px",
                display: "flex",
                justifyContent: "space-between",
              }}>
                <span style={{ color: "#8892b0" }}>{ROUND_NAMES[round]}</span>
                <span style={{ color: "#f0c040", fontWeight: 700 }}>{pts} pt{pts > 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Payouts">
          Prize pool is split: <strong style={{ color: "#f0c040" }}>60%</strong> to 1st, <strong style={{ color: "#c0c0c0" }}>25%</strong> to 2nd, <strong style={{ color: "#cd7f32" }}>15%</strong> to 3rd. Tiebreakers are decided by the highest seed champion pick, then coin flip.
        </Section>
        <Section title="Commissioner">
          The pool commissioner is responsible for entering actual tournament results and managing payments. All decisions by the commissioner are final.
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 15, color: "#e94560", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>{title}</h3>
      <div>{children}</div>
    </div>
  );
}

// ─── Helpers ───
function propagateWinner(fullBracket, region, round, matchIndex, team) {
  let nextRounds;
  if (region === "finalFour") {
    nextRounds = { 4: 2 };
  } else {
    nextRounds = { 64: 32, 32: 16, 16: 8 };
  }

  const nextRound = nextRounds[round];
  if (!nextRound) {
    // Regional winner goes to Final Four
    if (region !== "finalFour" && round === 8) {
      const regionIndex = REGIONS.indexOf(region);
      const ffMatchIdx = Math.floor(regionIndex / 2);
      const ffSlot = regionIndex % 2 === 0 ? "team1" : "team2";
      if (fullBracket.finalFour[4][ffMatchIdx]) {
        // Clear downstream if changing
        const oldTeam = fullBracket.finalFour[4][ffMatchIdx][ffSlot];
        fullBracket.finalFour[4][ffMatchIdx][ffSlot] = team;
        if (oldTeam && oldTeam.name !== team.name) {
          clearDownstream(fullBracket.finalFour, 4, ffMatchIdx);
        }
      }
    }
    return;
  }

  const bracket = region === "finalFour" ? fullBracket.finalFour : fullBracket[region];
  const nextMatchIdx = Math.floor(matchIndex / 2);
  const slot = matchIndex % 2 === 0 ? "team1" : "team2";

  if (bracket[nextRound][nextMatchIdx]) {
    const oldTeam = bracket[nextRound][nextMatchIdx][slot];
    bracket[nextRound][nextMatchIdx][slot] = team;
    if (oldTeam && oldTeam.name !== team.name) {
      clearDownstream(bracket, nextRound, nextMatchIdx);
    }
  }
}

function clearDownstream(bracket, round, matchIndex) {
  bracket[round][matchIndex].winner = null;
  const nextRounds = { 64: 32, 32: 16, 16: 8, 4: 2 };
  const nextRound = nextRounds[round];
  if (nextRound && bracket[nextRound]) {
    const nextMatchIdx = Math.floor(matchIndex / 2);
    const slot = matchIndex % 2 === 0 ? "team1" : "team2";
    if (bracket[nextRound][nextMatchIdx]) {
      bracket[nextRound][nextMatchIdx][slot] = null;
      clearDownstream(bracket, nextRound, nextMatchIdx);
    }
  }
}

function checkBracketComplete(bracket) {
  for (const region of REGIONS) {
    for (const round of [64, 32, 16, 8]) {
      for (const match of bracket[region][round]) {
        if (!match.winner) return false;
      }
    }
  }
  for (const round of [4, 2]) {
    for (const match of bracket.finalFour[round]) {
      if (!match.winner) return false;
    }
  }
  return true;
}

function calculateScore(playerBracket, resultsBracket) {
  let score = 0;
  for (const region of REGIONS) {
    for (const round of [64, 32, 16, 8]) {
      playerBracket[region][round].forEach((match, idx) => {
        const resultMatch = resultsBracket[region][round][idx];
        if (match.winner && resultMatch?.winner && match.winner.name === resultMatch.winner.name) {
          score += SCORING[round];
        }
      });
    }
  }
  // Final Four
  for (const round of [4, 2]) {
    playerBracket.finalFour[round].forEach((match, idx) => {
      const resultMatch = resultsBracket.finalFour[round][idx];
      if (match.winner && resultMatch?.winner && match.winner.name === resultMatch.winner.name) {
        score += SCORING[round];
      }
    });
  }
  return score;
}

// ─── Main App ───
export default function App() {
  const [pool, setPool] = useState(() => ({
    players: initPlayers(),
    results: generateFullBracket(),
  }));
  const [view, setView] = useState("dashboard");

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #0a0a1a 0%, #111127 50%, #0d1b2a 100%)",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}>
        <Header pool={pool} view={view} setView={setView} />
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          {view === "dashboard" && <Dashboard pool={pool} setView={setView} />}
          {view === "players" && <PlayersView pool={pool} setPool={setPool} />}
          {view === "bracket" && <BracketView pool={pool} setPool={setPool} />}
          {view === "leaderboard" && <Leaderboard pool={pool} />}
          {view === "rules" && <Rules />}
        </div>
      </div>
    </>
  );
}
