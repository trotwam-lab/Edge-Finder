import { useState } from "react";
import { COLORS } from "./theme.js";

// ─── INTERACTIVE FEATURE PREVIEW ──────────────────
const TABS = [
  {
    id: "odds", label: "Odds Movement", icon: "⟋",
    description: "Track where lines are shifting across books in real time.",
    game: {
      away: "Buffalo Bills", home: "Miami Dolphins",
      awayEmoji: "🦬", homeEmoji: "🐬",
      badges: [
        { text: "NFL", color: COLORS.accent },
        { text: "HOT 🔥", color: "#ff4466" },
        { text: "MOVING", color: COLORS.amber },
        { text: "FADE", color: COLORS.accentPurple },
      ],
      hold: "4.3%",
      fairML: "-145 / +145",
      fairSpread: "-101 / +101",
      fairTotal: "-100 / +100",
      mlHold: "4.1%",
      totalHold: "4.8%",
      currentSpread: "3",
      currentTotal: "48.5",
      gameTime: "1:00 PM",
      books: [
        { name: "FanDuel",    awayML: "-155", homeML: "+130", homeBest: false, awayBest: true, spread: "-3 (-108)", spreadAlt: "+3 (-112)", spreadBest: true, total: "Over 48.5 (-110)", totalAlt: "Under 48.5 (-110)" },
        { name: "BetOnline",  awayML: "-160", homeML: "+135", homeBest: false, spread: "-3 (-110)", spreadAlt: "+3 (-110)", total: "Over 49 (-110)", totalAlt: "Under 49 (-110)", totalAltBest: true },
        { name: "DraftKings", awayML: "-162", homeML: "+136", homeBest: false, spread: "-3 (-112)", spreadAlt: "+3 (-108)", total: "Over 48.5 (-112)", totalAlt: "Under 48.5 (-108)" },
        { name: "BetRivers",  awayML: "-165", homeML: "+140", homeBest: true, spread: "-3.5 (+100)", spreadAlt: "+3.5 (-120)", total: "Over 48.5 (-110)", totalAlt: "Under 48.5 (-110)" },
        { name: "BetMGM",     awayML: "-160", homeML: "+135", homeBest: false, spread: "-3 (-110)", spreadAlt: "+3 (-110)", total: "Over 48 (-105)", totalBest: true, totalAlt: "Under 48 (-115)" },
        { name: "Bovada",     awayML: "-160", homeML: "+135", homeBest: false, spread: "-3 (-115)", spreadAlt: "+3 (-105)", total: "Over 48.5 (-110)", totalAlt: "Under 48.5 (-110)" },
      ],
      lineMovement: { opener: "-2", change: "-1", current: "-3", totalRange: "50.5 → 48.5" },
      fadingNote: "Line moving toward Buffalo Bills",
      sparklinePoints: [2, 2, 2, 2.5, 2.5, 2.5, 2.5, 3, 3, 3, 3, 3],
      historyPoints: [2, 2, 2, 2, 2.5, 2.5, 2.5, 2.5, 2.5, 3, 3, 3, 3, 3, 3, 3],
    },
  },
  {
    id: "alerts", label: "Game Research", icon: "◈",
    description: "Form, head-to-head, trends, and injury reports — all in one view.",
    subTabs: ["Form", "H2H", "Trends"],
    source: "ESPN",
    teams: [
      {
        name: "Miami Dolphins",
        homeRec: "4-1", awayRec: "2-3",
        last10: "6-4", streak: "W2", streakColor: "#22c55e",
        games: [
          { result: "W", opp: "vsNE" }, { result: "W", opp: "@NYJ" }, { result: "L", opp: "vsBUF" },
          { result: "W", opp: "@TEN" }, { result: "L", opp: "@HOU" }, { result: "W", opp: "vsSF" },
          { result: "L", opp: "@CLE" }, { result: "W", opp: "vsNYJ" }, { result: "W", opp: "@NE" },
          { result: "L", opp: "vsKC" },
        ],
      },
      {
        name: "Buffalo Bills",
        homeRec: "5-0", awayRec: "3-2",
        last10: "8-2", streak: "W4", streakColor: "#22c55e",
        games: [
          { result: "W", opp: "vsBAL" }, { result: "W", opp: "@NYJ" }, { result: "W", opp: "vsMIA" },
          { result: "W", opp: "@NE" }, { result: "L", opp: "@KC" }, { result: "W", opp: "vsLAC" },
          { result: "W", opp: "vsNYJ" }, { result: "L", opp: "@DEN" }, { result: "W", opp: "vsPIT" },
          { result: "W", opp: "@CIN" },
        ],
      },
    ],
    timestamp: "10:46:43 AM · ESPN",
    injuries: [
      { player: "WR (starter)", team: "Dolphins", status: "Questionable", reason: "Hamstring" },
      { player: "LB (rotation)", team: "Dolphins", status: "Out", reason: "Knee" },
      { player: "CB (starter)", team: "Bills", status: "Questionable", reason: "Ankle" },
      { player: "OL (reserve)", team: "Bills", status: "Out", reason: "Illness" },
    ],
  },
  {
    id: "props", label: "Prop Finder", icon: "◎",
    description: "Surface player prop edges backed by market movement.",
    players: [
      {
        name: "Josh Allen",
        game: "Buffalo Bills @ Miami Dolphins",
        marketCount: 4,
        markets: [
          {
            stat: "PASS YDS", line: 245.5, books: ["BetO", "Csr", "FD"],
            over:  [{ odds: -110, best: false }, { odds: -115, best: false }, { odds: +100, best: true }],
            under: [{ odds: -110, best: false }, { odds: -105, best: true }, { odds: -120, best: false }],
          },
          {
            stat: "RUSH YDS", line: 32.5, books: ["BetO", "Csr", "FD"],
            over:  [{ odds: -118, best: false }, { odds: -112, best: true }, { odds: -125, best: false }],
            under: [{ odds: -110, best: false }, { odds: -112, best: false }, { odds: -106, best: true }],
          },
        ],
      },
      {
        name: "James Cook",
        game: "Buffalo Bills @ Miami Dolphins",
        marketCount: 3,
        markets: [
          {
            stat: "RUSH YDS", line: 64.5, books: ["BetO", "Csr", "FD"],
            over:  [{ odds: -115, best: false }, { odds: -110, best: true }, { odds: -120, best: false }],
            under: [{ odds: -105, best: false }, { odds: -110, best: false }, { odds: +100, best: true }],
          },
        ],
      },
    ],
  },
  {
    id: "tracker", label: "Bet Tracker", icon: "◧",
    description: "Track your performance with ROI, units, and P&L by sport.",
    stats: {
      topRow: [
        { label: "Total Bets", icon: "◎", value: "47" },
        { label: "Record", icon: "🏆", value: "28-17-2" },
        { label: "Win %", icon: "📈", value: "62.2%" },
        { label: "ROI", icon: "📊", value: "+14.3%" },
        { label: "Units", icon: "$", value: "+8.41u" },
        { label: "Net P&L", icon: "📊", value: "+$1,261.50" },
      ],
      breakdown: {
        unitSize: "$150",
        netPL: { value: "+$1,261.50", wagered: "$7,050.00" },
        roi: { value: "+14.3%" },
        units: { value: "+8.41u", settled: "47 settled bets" },
      },
      bySport: [
        { sport: "NBA", bets: "22b", roi: "+18.7%", roiColor: "#22c55e", units: "+4.12u", unitsColor: "#22c55e" },
        { sport: "NFL", bets: "14b", roi: "+11.2%", roiColor: "#22c55e", units: "+2.85u", unitsColor: "#22c55e" },
        { sport: "MLB", bets: "8b", roi: "+9.6%", roiColor: "#22c55e", units: "+1.15u", unitsColor: "#22c55e" },
        { sport: "NHL", bets: "3b", roi: "+4.1%", roiColor: "#22c55e", units: "+0.29u", unitsColor: "#22c55e" },
      ],
    },
  },
];

export default function FeaturePreview() {
  const [activeTab, setActiveTab] = useState("odds");
  const tab = TABS.find((t) => t.id === activeTab);

  return (
    <section style={{ padding: "80px 0" }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: 4, textTransform: "uppercase",
          background: COLORS.gradientText, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          display: "block", marginBottom: 16,
        }}>Product Preview</span>
        <h2 style={{
          fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(28px, 4vw, 42px)",
          fontWeight: 600, color: COLORS.text, margin: "0 0 8px 0", lineHeight: 1.2,
        }}>See it before you sign up.</h2>
        <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, color: COLORS.textMuted, margin: 0 }}>
          No login wall. Click through the real screens, filled with sample data.
        </p>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 32 }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: 1,
            padding: "10px 22px", borderRadius: 8,
            border: `1px solid ${activeTab === t.id ? COLORS.accent + "55" : COLORS.border}`,
            background: activeTab === t.id ? COLORS.accentDim : "transparent",
            color: activeTab === t.id ? COLORS.accent : COLORS.textMuted,
            cursor: "pointer", transition: "all 0.25s ease", display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: 14 }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>
      <div style={{
        maxWidth: 920, margin: "0 auto", background: COLORS.surface,
        border: `1px solid ${COLORS.border}`, borderRadius: 16, overflow: "hidden",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 24px", borderBottom: `1px solid ${COLORS.border}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57" }} />
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e" }} />
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840" }} />
            </div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: COLORS.textDim, marginLeft: 8 }}>edgefinder.app / {tab.id}</span>
          </div>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: COLORS.textDim, letterSpacing: 1, textTransform: "uppercase" }}>Demo View</span>
        </div>
        <div style={{ padding: "20px 24px 0 24px" }}>
          <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, color: COLORS.textMuted, margin: "0 0 20px 0" }}>{tab.description}</p>
        </div>
        <div style={{ padding: "0 24px 24px 24px" }}>
          {activeTab === "odds" && <OddsView tab={tab} />}
          {activeTab === "alerts" && <AlertsView tab={tab} />}
          {activeTab === "props" && <PropsView tab={tab} />}
          {activeTab === "tracker" && <TrackerView tab={tab} />}
        </div>
      </div>
    </section>
  );
}

function OddsView({ tab }) {
  const g = tab.game;
  const mono = "'JetBrains Mono', monospace";
  const sans = "'Space Grotesk', sans-serif";
  const cardBg = COLORS.bg;
  const bdr = COLORS.border;

  // Simple SVG sparkline renderer
  const Sparkline = ({ points, width = "100%", height = 40, color = COLORS.accent }) => {
    const max = Math.max(...points);
    const min = Math.min(...points);
    const range = max - min || 1;
    const svgPoints = points.map((p, i) => {
      const x = (i / (points.length - 1)) * 100;
      const y = 100 - ((p - min) / range) * 80 - 10;
      return `${x},${y}`;
    }).join(" ");
    return (
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width, height, display: "block" }}>
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={COLORS.accentPurple} />
            <stop offset="100%" stopColor={COLORS.accent} />
          </linearGradient>
        </defs>
        <polyline points={svgPoints} fill="none" stroke="url(#sparkGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── Game Header ── */}
      <div style={{
        background: cardBg, border: `1px solid ${bdr}`, borderRadius: 12,
        padding: "16px 20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              {g.badges.map((b, i) => (
                <span key={i} style={{
                  fontFamily: mono, fontSize: 10, letterSpacing: 1,
                  textTransform: "uppercase", padding: "3px 8px", borderRadius: 4,
                  background: `${b.color}22`, color: b.color, fontWeight: 600,
                }}>{b.text}</span>
              ))}
            </div>
            <div style={{
              fontFamily: sans, fontSize: 18, fontWeight: 600, color: COLORS.text,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span>{g.awayEmoji}</span> {g.away}
              <span style={{ color: COLORS.textDim, fontWeight: 400, fontSize: 14 }}>@</span>
              <span>{g.homeEmoji}</span> {g.home}
            </div>
            <div style={{
              fontFamily: mono, fontSize: 11, color: COLORS.textMuted, marginTop: 6,
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <span style={{ background: `${COLORS.amber}22`, color: COLORS.amber, padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>Hold: {g.hold}</span>
              <span>Fair ML: {g.fairML}</span>
              <span>ML Hold: {g.mlHold}</span>
              <span>Total Hold: {g.totalHold}</span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: mono, fontSize: 24, fontWeight: 700, color: COLORS.text }}>{g.currentSpread}</div>
            <div style={{ fontFamily: mono, fontSize: 11, color: COLORS.textMuted }}>Spread</div>
            <div style={{ fontFamily: mono, fontSize: 16, fontWeight: 600, color: COLORS.textMuted, marginTop: 4 }}>O/U {g.currentTotal}</div>
            <div style={{ fontFamily: mono, fontSize: 11, color: COLORS.textDim }}>{g.gameTime}</div>
          </div>
        </div>
      </div>

      {/* ── ALL LINES Table ── */}
      <div style={{
        background: cardBg, border: `1px solid ${bdr}`, borderRadius: 12, overflow: "hidden",
      }}>
        <div style={{
          padding: "14px 20px", borderBottom: `1px solid ${bdr}`,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: COLORS.text }}>All Lines</span>
          <span style={{ fontFamily: mono, fontSize: 10, background: `${COLORS.amber}22`, color: COLORS.amber, padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>Hold: {g.hold}</span>
        </div>

        {/* Column headers */}
        <div style={{ padding: "0 20px" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "110px 1fr 1fr 1fr",
            padding: "10px 0", borderBottom: `1px solid ${bdr}`,
            fontFamily: mono, fontSize: 10, letterSpacing: 1.5,
            textTransform: "uppercase", color: COLORS.textDim,
          }}>
            <span></span>
            <span style={{ display: "flex", gap: 4 }}>
              <span style={{ color: COLORS.accentPurple }}>⚡</span> Fair Line
              <span style={{ marginLeft: 8, color: COLORS.textDim }}>ML: {g.fairML}</span>
            </span>
            <span>Spread: {g.fairSpread}</span>
            <span>Total: {g.fairTotal}</span>
          </div>

          {/* Book rows */}
          {g.books.map((book, i) => (
            <div key={i} style={{
              display: "grid",
              gridTemplateColumns: "110px 1fr 1fr 1fr",
              padding: "12px 0",
              borderBottom: i < g.books.length - 1 ? `1px solid ${bdr}` : "none",
              fontFamily: mono, fontSize: 13, color: COLORS.text,
              alignItems: "center",
            }}>
              <span style={{ fontWeight: 500, fontSize: 12 }}>{book.name}</span>

              {/* ML */}
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span>
                  {book.awayBest ? (
                    <span style={{ background: "rgba(0,200,255,0.15)", color: COLORS.accent, padding: "3px 8px", borderRadius: 4, fontWeight: 600 }}>{g.away.split(" ").pop()} {book.awayML}</span>
                  ) : (
                    <span>{g.away.split(" ").pop()} {book.awayML}</span>
                  )}
                </span>
                <span>
                  {book.homeBest ? (
                    <span style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", padding: "3px 8px", borderRadius: 4, fontWeight: 600 }}>{g.home.split(" ").pop()} {book.homeML}</span>
                  ) : (
                    <span>{g.home.split(" ").pop()} {book.homeML}</span>
                  )}
                </span>
              </div>

              {/* Spread */}
              <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 12 }}>
                <span style={book.spreadBest ? { color: COLORS.accent } : {}}>{book.spread}</span>
                <span style={{ color: COLORS.textMuted }}>{book.spreadAlt}</span>
              </div>

              {/* Total */}
              <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 12 }}>
                <span style={book.totalBest ? { color: "#22c55e" } : {}}>{book.total}</span>
                <span style={book.totalAltBest ? { color: COLORS.accent } : { color: COLORS.textMuted }}>{book.totalAlt}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Spread Sparkline ── */}
      <div style={{
        background: cardBg, border: `1px solid ${bdr}`, borderRadius: 12, padding: "16px 20px",
      }}>
        <div style={{
          fontFamily: mono, fontSize: 11, letterSpacing: 2, textTransform: "uppercase",
          color: COLORS.textMuted, marginBottom: 12,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span style={{ color: COLORS.amber }}>⚡</span> Spread Sparkline
        </div>
        <Sparkline points={g.sparklinePoints} height={48} />
      </div>

      {/* ── Line Movement ── */}
      <div style={{
        background: cardBg, border: `1px solid ${COLORS.accentPurple}33`,
        borderRadius: 12, padding: "20px 24px",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 24,
        }}>
          <div style={{
            fontFamily: mono, fontSize: 11, letterSpacing: 2, textTransform: "uppercase",
            color: COLORS.textMuted, display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ color: COLORS.amber }}>⚡</span> Line Movement
          </div>
          <span style={{
            fontFamily: mono, fontSize: 10, color: COLORS.accent,
            border: `1px solid ${COLORS.accent}33`, borderRadius: 4,
            padding: "3px 10px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 4,
          }}>
            <span style={{ color: COLORS.amber }}>⚡</span> Historic Opener
          </span>
        </div>

        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          {/* Opener */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: COLORS.textDim, marginBottom: 6 }}>Opener</div>
            <div style={{ fontFamily: mono, fontSize: 28, fontWeight: 700, color: COLORS.text }}>{g.lineMovement.opener}</div>
          </div>

          {/* Arrow + Change */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <div style={{ flex: 1, height: 2, background: `linear-gradient(to right, ${COLORS.textDim}, ${COLORS.red})` }} />
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ color: COLORS.red, fontSize: 14 }}>▼</span>
              <span style={{
                fontFamily: mono, fontSize: 14, fontWeight: 700,
                background: `${COLORS.red}22`, color: COLORS.red,
                padding: "4px 12px", borderRadius: 6,
              }}>{g.lineMovement.change}</span>
            </div>
            <div style={{ flex: 1, height: 2, background: `linear-gradient(to right, ${COLORS.red}, ${COLORS.textDim})` }} />
          </div>

          {/* Current */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: COLORS.textDim, marginBottom: 6 }}>Current</div>
            <div style={{ fontFamily: mono, fontSize: 28, fontWeight: 700, color: COLORS.text }}>{g.lineMovement.current}</div>
          </div>
        </div>

        <div style={{
          fontFamily: mono, fontSize: 11, color: COLORS.textDim,
          textAlign: "center", marginTop: 16,
        }}>Total: {g.lineMovement.totalRange}</div>
      </div>

      {/* ── Fading Note ── */}
      <div style={{
        background: cardBg, border: `1px solid ${COLORS.accentPurple}33`,
        borderRadius: 12, padding: "14px 20px",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ color: COLORS.amber }}>⚡</span>
        <span style={{ fontFamily: sans, fontSize: 14, color: COLORS.text }}>{g.fadingNote}</span>
      </div>

      {/* ── Line History Chart ── */}
      <div style={{
        background: cardBg, border: `1px solid ${bdr}`, borderRadius: 12, padding: "16px 20px",
      }}>
        <div style={{
          fontFamily: mono, fontSize: 11, letterSpacing: 2, textTransform: "uppercase",
          color: COLORS.textMuted, marginBottom: 12,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          📈 Line History Chart
        </div>
        <Sparkline points={g.historyPoints} height={64} />
      </div>

      {/* ── Set True Opener ── */}
      <div style={{
        background: cardBg, border: `1px solid ${bdr}`, borderRadius: 12, padding: "16px 20px",
      }}>
        <div style={{
          fontFamily: mono, fontSize: 11, letterSpacing: 2, textTransform: "uppercase",
          color: COLORS.textMuted, marginBottom: 12,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          ⚙ Set True Opener
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{
            fontFamily: mono, fontSize: 12, color: COLORS.text,
            background: COLORS.surface, border: `1px solid ${bdr}`,
            borderRadius: 6, padding: "8px 16px", minWidth: 70, textAlign: "center",
          }}>Spread</div>
          <div style={{
            fontFamily: mono, fontSize: 12, color: COLORS.text,
            background: COLORS.surface, border: `1px solid ${bdr}`,
            borderRadius: 6, padding: "8px 16px", minWidth: 70, textAlign: "center",
          }}>Total</div>
          <span style={{
            fontFamily: mono, fontSize: 11, color: "#fff",
            background: COLORS.red, borderRadius: 6,
            padding: "8px 16px", cursor: "pointer", fontWeight: 600,
          }}>Clear</span>
        </div>
        <div style={{
          fontFamily: mono, fontSize: 11, color: COLORS.textDim, marginTop: 10,
        }}>Enter the true opening line to track movement from there</div>
      </div>
    </div>
  );
}

function AlertsView({ tab }) {
  const [subTab, setSubTab] = useState("Form");
  const mono = "'JetBrains Mono', monospace";
  const sans = "'Space Grotesk', sans-serif";
  const cardBg = COLORS.bg;
  const bdr = COLORS.border;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Game Research Header ── */}
      <div style={{
        background: cardBg, border: `1px solid ${bdr}`, borderRadius: 12, overflow: "hidden",
      }}>
        {/* Title bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 20px", borderBottom: `1px solid ${bdr}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 14 }}>📊</span>
            <span style={{ fontFamily: sans, fontSize: 15, fontWeight: 600, color: COLORS.text }}>Game Research</span>
            <span style={{
              fontFamily: mono, fontSize: 10, letterSpacing: 1,
              background: `${COLORS.accent}18`, color: COLORS.accent,
              padding: "3px 8px", borderRadius: 4, fontWeight: 600,
            }}>◎ {tab.source}</span>
          </div>
          <span style={{ color: COLORS.textMuted, cursor: "pointer", fontSize: 16 }}>⟳</span>
        </div>

        {/* Sub-tabs */}
        <div style={{
          display: "flex", borderBottom: `1px solid ${bdr}`,
        }}>
          {tab.subTabs.map((st) => (
            <button key={st} onClick={() => setSubTab(st)} style={{
              flex: 1, fontFamily: sans, fontSize: 13, fontWeight: 500,
              padding: "12px 0", background: "none", border: "none",
              borderBottom: `2px solid ${subTab === st ? COLORS.accent : "transparent"}`,
              color: subTab === st ? COLORS.accent : COLORS.textMuted,
              cursor: "pointer", transition: "all 0.2s ease",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              {st === "Form" && "✦"}{st === "H2H" && "⏱"}{st === "Trends" && "📈"} {st}
            </button>
          ))}
        </div>

        {/* Form content */}
        <div style={{ padding: "20px" }}>
          {tab.teams.map((team, ti) => (
            <div key={ti} style={{ marginBottom: ti < tab.teams.length - 1 ? 28 : 0 }}>
              {/* Team header row */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: 12,
              }}>
                <div>
                  <div style={{
                    fontFamily: sans, fontSize: 16, fontWeight: 600, color: COLORS.text,
                    marginBottom: 8,
                  }}>{team.name}</div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <span style={{
                      fontFamily: mono, fontSize: 12, color: COLORS.textMuted,
                      background: COLORS.surface, border: `1px solid ${bdr}`,
                      borderRadius: 6, padding: "4px 10px",
                      display: "flex", alignItems: "center", gap: 5,
                    }}>🏠 {team.homeRec}</span>
                    <span style={{
                      fontFamily: mono, fontSize: 12, color: COLORS.textMuted,
                      background: COLORS.surface, border: `1px solid ${bdr}`,
                      borderRadius: 6, padding: "4px 10px",
                      display: "flex", alignItems: "center", gap: 5,
                    }}>✈ {team.awayRec}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{
                    fontFamily: mono, fontSize: 12, fontWeight: 600,
                    background: `${COLORS.accent}18`, color: COLORS.accent,
                    padding: "5px 12px", borderRadius: 6,
                  }}>{team.last10} L10</span>
                  <span style={{
                    fontFamily: mono, fontSize: 12, fontWeight: 700,
                    background: `${team.streakColor}22`, color: team.streakColor,
                    padding: "5px 10px", borderRadius: 6,
                  }}>{team.streak}</span>
                </div>
              </div>

              {/* Last 10 games strip */}
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 4,
              }}>
                {team.games.map((game, gi) => {
                  const isWin = game.result === "W";
                  return (
                    <div key={gi} style={{
                      background: isWin ? "rgba(34,197,94,0.18)" : "rgba(220,80,100,0.16)",
                      borderRadius: 6, padding: "10px 4px", textAlign: "center",
                      border: `1px solid ${isWin ? "rgba(34,197,94,0.25)" : "rgba(220,80,100,0.22)"}`,
                    }}>
                      <div style={{
                        fontFamily: mono, fontSize: 13, fontWeight: 700,
                        color: isWin ? "#22c55e" : "#ef4444",
                        marginBottom: 3,
                      }}>{game.result}</div>
                      <div style={{
                        fontFamily: mono, fontSize: 9, color: COLORS.textDim,
                        letterSpacing: 0.5,
                      }}>{game.opp}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Timestamp */}
          <div style={{
            textAlign: "center", marginTop: 20,
            fontFamily: mono, fontSize: 11, color: COLORS.textDim,
          }}>{tab.timestamp}</div>
        </div>
      </div>

      {/* ── Injury Report ── */}
      <div style={{
        background: cardBg, border: `1px solid ${bdr}`, borderRadius: 12, overflow: "hidden",
      }}>
        <div style={{
          padding: "14px 20px", borderBottom: `1px solid ${bdr}`,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ color: COLORS.red }}>🏥</span>
          <span style={{
            fontFamily: mono, fontSize: 12, fontWeight: 700, letterSpacing: 2,
            textTransform: "uppercase", color: COLORS.red,
          }}>Injury Report ({tab.injuries.length})</span>
        </div>

        <div style={{ padding: "4px 0" }}>
          {tab.injuries.map((inj, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 20px",
              borderBottom: i < tab.injuries.length - 1 ? `1px solid ${bdr}` : "none",
              borderLeft: `3px solid ${inj.status === "Out" ? COLORS.red : COLORS.amber}`,
            }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{
                  fontFamily: sans, fontSize: 14, fontWeight: 600, color: COLORS.text,
                }}>{inj.player}</span>
                <span style={{
                  fontFamily: sans, fontSize: 13, color: COLORS.textMuted,
                }}>{inj.team}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{
                  fontFamily: mono, fontSize: 13, fontWeight: 700,
                  color: inj.status === "Out" ? COLORS.red : COLORS.amber,
                }}>{inj.status}</div>
                <div style={{
                  fontFamily: mono, fontSize: 11, color: COLORS.textMuted,
                }}>{inj.reason}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PropsView({ tab }) {
  const fmtOdds = (v) => (v > 0 ? `+${v}` : `${v}`);
  const bestGreen = "rgba(34,197,94,0.18)";
  const bestRed = "rgba(220,80,100,0.14)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {tab.players.map((player, pi) => (
        <div key={pi} style={{
          background: COLORS.bg, borderRadius: 12,
          border: `1px solid ${COLORS.border}`, overflow: "hidden",
        }}>
          {/* Player header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 20px", borderBottom: `1px solid ${COLORS.border}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{
                width: 32, height: 32, borderRadius: "50%",
                background: `${COLORS.accentPurple}22`,
                border: `1px solid ${COLORS.accentPurple}44`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14,
              }}>🏀</span>
              <div>
                <div style={{
                  fontFamily: "'Space Grotesk', sans-serif", fontSize: 16,
                  fontWeight: 600, color: COLORS.text, lineHeight: 1.2,
                }}>{player.name}</div>
                <div style={{
                  fontFamily: "'Space Grotesk', sans-serif", fontSize: 12,
                  color: COLORS.textMuted, marginTop: 2,
                }}>{player.game}</div>
              </div>
            </div>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
              color: COLORS.textMuted, border: `1px solid ${COLORS.border}`,
              borderRadius: 6, padding: "4px 12px", letterSpacing: 0.5,
            }}>{player.marketCount} markets</span>
          </div>

          {/* Markets */}
          <div style={{ padding: "12px 20px 16px" }}>
            {player.markets.map((market, mi) => (
              <div key={mi} style={{
                marginBottom: mi < player.markets.length - 1 ? 16 : 0,
                background: COLORS.surface, borderRadius: 10,
                border: `1px solid ${COLORS.border}`, overflow: "hidden",
              }}>
                {/* Market header */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 16px",
                }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 14,
                      fontWeight: 700, color: COLORS.text,
                    }}>{market.stat}</span>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 13,
                      color: COLORS.textMuted,
                    }}>O/U {market.line}</span>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                      color: COLORS.textDim,
                    }}>{market.books.length} books</span>
                  </div>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                    color: COLORS.accent, border: `1px solid ${COLORS.accent}33`,
                    borderRadius: 4, padding: "3px 10px", letterSpacing: 0.5,
                    cursor: "pointer",
                  }}>tap odds to add</span>
                </div>

                {/* Odds grid */}
                <div style={{ padding: "0 16px 14px" }}>
                  <table style={{
                    width: "100%", borderCollapse: "collapse",
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 13,
                  }}>
                    <thead>
                      <tr>
                        <th style={{
                          textAlign: "left", padding: "6px 10px", color: COLORS.textDim,
                          fontWeight: 500, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", width: 70,
                        }}>Side</th>
                        {market.books.map((b) => (
                          <th key={b} style={{
                            textAlign: "center", padding: "6px 10px", color: COLORS.textDim,
                            fontWeight: 500, fontSize: 11, letterSpacing: 1, textTransform: "uppercase",
                          }}>{b}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Over row */}
                      <tr>
                        <td style={{
                          padding: "8px 10px", color: "#22c55e",
                          fontWeight: 600, fontSize: 13,
                        }}>Over</td>
                        {market.over.map((o, oi) => (
                          <td key={oi} style={{
                            textAlign: "center", padding: "8px 10px",
                          }}>
                            <span style={{
                              display: "inline-block", padding: "5px 16px",
                              borderRadius: 6, fontWeight: 600, fontSize: 13,
                              color: o.best ? "#22c55e" : COLORS.text,
                              background: o.best ? bestGreen : "transparent",
                              minWidth: 70,
                            }}>
                              {fmtOdds(o.odds)}{o.best ? " ★" : ""}
                            </span>
                          </td>
                        ))}
                      </tr>
                      {/* Under row */}
                      <tr>
                        <td style={{
                          padding: "8px 10px", color: "#ef4444",
                          fontWeight: 600, fontSize: 13,
                        }}>Under</td>
                        {market.under.map((u, ui) => (
                          <td key={ui} style={{
                            textAlign: "center", padding: "8px 10px",
                          }}>
                            <span style={{
                              display: "inline-block", padding: "5px 16px",
                              borderRadius: 6, fontWeight: 600, fontSize: 13,
                              color: u.best ? "#ef4444" : COLORS.text,
                              background: u.best ? bestRed : "transparent",
                              minWidth: 70,
                            }}>
                              {fmtOdds(u.odds)}{u.best ? " ★" : ""}
                            </span>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TrackerView({ tab }) {
  const s = tab.stats;
  const cardBg = COLORS.bg;
  const cardBorder = COLORS.border;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Top stat row */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10,
      }}>
        {s.topRow.map((stat, i) => (
          <div key={i} style={{
            background: cardBg, border: `1px solid ${cardBorder}`,
            borderRadius: 10, padding: "14px 12px", textAlign: "center",
          }}>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
              color: COLORS.textMuted, marginBottom: 8,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            }}>
              <span style={{ fontSize: 12 }}>{stat.icon}</span>
              {stat.label}
            </div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 18,
              fontWeight: 700,
              color: stat.value.startsWith("+") ? "#22c55e" : stat.value.startsWith("-") ? "#ef4444" : COLORS.accent,
            }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* ROI & Units Breakdown */}
      <div style={{
        background: cardBg, border: `1px solid ${cardBorder}`,
        borderRadius: 12, padding: "20px 24px", overflow: "hidden",
        position: "relative",
      }}>
        {/* Subtle purple gradient accent on right edge */}
        <div style={{
          position: "absolute", top: 0, right: 0, bottom: 0, width: 4,
          background: COLORS.gradient, borderRadius: "0 12px 12px 0",
        }} />

        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 20,
        }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
            fontWeight: 700, letterSpacing: 2, textTransform: "uppercase",
            color: COLORS.text,
          }}>ROI & Units Breakdown</span>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
            color: COLORS.textMuted,
          }}>1u = {s.breakdown.unitSize} avg wager</span>
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14,
          marginBottom: 24,
        }}>
          {/* Net P/L card */}
          <div style={{
            background: COLORS.surface, border: `1px solid ${cardBorder}`,
            borderRadius: 10, padding: "18px 16px", textAlign: "center",
          }}>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
              color: COLORS.textMuted, marginBottom: 10, letterSpacing: 1,
            }}>Net P/L</div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 24,
              fontWeight: 700,
              color: s.breakdown.netPL.value.startsWith("+") ? "#22c55e" : "#ef4444",
              marginBottom: 6,
            }}>{s.breakdown.netPL.value}</div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
              color: COLORS.textDim,
            }}>on +${s.breakdown.netPL.wagered} wagered</div>
          </div>

          {/* ROI card */}
          <div style={{
            background: COLORS.surface, border: `1px solid ${cardBorder}`,
            borderRadius: 10, padding: "18px 16px", textAlign: "center",
          }}>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
              color: COLORS.textMuted, marginBottom: 10, letterSpacing: 1,
            }}>ROI</div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 24,
              fontWeight: 700,
              color: s.breakdown.roi.value.startsWith("+") ? "#22c55e" : "#ef4444",
              marginBottom: 6,
            }}>{s.breakdown.roi.value}</div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
              color: COLORS.textDim,
            }}>Net Profit / Total Wagered</div>
          </div>

          {/* Units Won card */}
          <div style={{
            background: COLORS.surface, border: `1px solid ${cardBorder}`,
            borderRadius: 10, padding: "18px 16px", textAlign: "center",
          }}>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
              color: COLORS.textMuted, marginBottom: 10, letterSpacing: 1,
            }}>Units Won</div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 24,
              fontWeight: 700,
              color: s.breakdown.units.value.startsWith("+") ? "#22c55e" : "#ef4444",
              marginBottom: 6,
            }}>{s.breakdown.units.value}</div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
              color: COLORS.textDim,
            }}>{s.breakdown.units.settled}</div>
          </div>
        </div>

        {/* BY SPORT */}
        <div>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
            fontWeight: 600, letterSpacing: 2, textTransform: "uppercase",
            color: COLORS.textMuted, marginBottom: 14, paddingLeft: 2,
          }}>By Sport</div>
          {s.bySport.map((sport, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 2px",
              borderTop: `1px solid ${cardBorder}`,
            }}>
              <span style={{
                fontFamily: "'Space Grotesk', sans-serif", fontSize: 15,
                fontWeight: 600, color: COLORS.text,
              }}>{sport.sport}</span>
              <div style={{
                display: "flex", alignItems: "center", gap: 24,
                fontFamily: "'JetBrains Mono', monospace", fontSize: 13,
              }}>
                <span style={{ color: COLORS.textDim, minWidth: 30, textAlign: "right" }}>{sport.bets}</span>
                <span style={{ color: sport.roiColor, fontWeight: 600, minWidth: 60, textAlign: "right" }}>{sport.roi}</span>
                <span style={{ color: sport.unitsColor, fontWeight: 600, minWidth: 60, textAlign: "right" }}>{sport.units}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
