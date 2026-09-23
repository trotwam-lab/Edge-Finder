import { useState, useEffect } from "react";
import { LogoMark } from "../Logo.jsx";
import { PRO_FEATURES } from "../../constants.js";
import { getSeasonBoard } from "../../utils/season-calendar.js";
import { COLORS } from "./theme.js";

// ─── NAVIGATION ───────────────────────────────────
const NAV_LINKS = [
  ["in-season", "In Season"],
  ["features", "Features"],
  ["preview", "Preview"],
  ["pricing", "Pricing"],
];

export function WelcomeNav({ onSignIn, onSignUp }) {
  const linkStyle = {
    fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: 1,
    color: COLORS.textMuted, textDecoration: "none", padding: "8px 10px", borderRadius: 8,
    whiteSpace: "nowrap",
  };
  return (
    <header className="welcome-header" style={{
      position: "sticky", top: 0, zIndex: 50,
      background: "rgba(13,17,23,0.88)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
      margin: "0 calc(-1 * clamp(20px, 4vw, 48px))", padding: "14px clamp(20px, 4vw, 48px)",
      borderBottom: `1px solid ${COLORS.border}`, marginBottom: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <a href="#top" aria-label="EdgeFinder home" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <LogoMark size={30} />
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: COLORS.text, letterSpacing: -0.5 }}>EdgeFinder</span>
        </a>
        <nav className="welcome-nav-links" aria-label="Page sections" style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {NAV_LINKS.map(([id, label]) => (
            <a key={id} href={`#${id}`} style={linkStyle}>{label}</a>
          ))}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={onSignIn} style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: 1,
            padding: "8px 16px", borderRadius: 8, border: `1px solid ${COLORS.borderActive}`,
            background: "transparent", color: COLORS.text, cursor: "pointer", fontWeight: 600,
          }}>Sign In</button>
          <button className="welcome-nav-cta" onClick={onSignUp} style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: 1,
            padding: "8px 16px", borderRadius: 8, border: "none",
            background: COLORS.gradient, color: "#fff", cursor: "pointer", fontWeight: 700,
            boxShadow: `0 0 20px rgba(0,200,255,0.1)`,
          }}>Start Free</button>
        </div>
      </div>
      <nav className="welcome-nav-mobile" aria-label="Page sections" style={{ display: "none", gap: 4, overflowX: "auto", marginTop: 10 }}>
        {NAV_LINKS.map(([id, label]) => (
          <a key={id} href={`#${id}`} style={{ ...linkStyle, border: `1px solid ${COLORS.border}`, fontSize: 11 }}>{label}</a>
        ))}
      </nav>
    </header>
  );
}

function SectionHeading({ eyebrow, title, subtitle }) {
  return (
    <div style={{ textAlign: "center", marginBottom: 40 }}>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: 4, textTransform: "uppercase",
        background: COLORS.gradientText, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        display: "block", marginBottom: 16,
      }}>{eyebrow}</span>
      <h2 style={{
        fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(28px, 4vw, 42px)",
        fontWeight: 600, color: COLORS.text, margin: "0 0 8px 0", lineHeight: 1.2,
      }}>{title}</h2>
      {subtitle && <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, color: COLORS.textMuted, margin: "0 auto", maxWidth: 640, lineHeight: 1.5 }}>{subtitle}</p>}
    </div>
  );
}

// ─── IN SEASON NOW ────────────────────────────────
const SEASON_STATE_STYLES = {
  live: { label: "In season", color: "#22c55e" },
  soon: { label: "Starting soon", color: COLORS.amber },
  off: { label: "Off-season", color: COLORS.textDim },
};

function formatShortDate(date) {
  return date ? date.toLocaleDateString([], { month: "short", day: "numeric" }) : "";
}

export function InSeasonSection({ onSignUp }) {
  const board = getSeasonBoard(new Date());
  // /api/sports is quota-free and lists which odds boards are live right now;
  // the calendar alone covers the case where it is unreachable.
  const [activeKeys, setActiveKeys] = useState(null);
  const [showOff, setShowOff] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/sports")
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (cancelled || !Array.isArray(json)) return;
        setActiveKeys(new Set(json.map(sport => sport.key)));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const inSeason = board.filter(sport => sport.status.state !== "off");
  const offSeason = board.filter(sport => sport.status.state === "off");
  const visible = showOff ? board : inSeason;
  const month = new Date().toLocaleDateString([], { month: "long" });

  return (
    <section id="in-season" className="welcome-section" style={{ padding: "64px 0", scrollMarginTop: 90 }}>
      <SectionHeading
        eyebrow="In Season Now"
        title={`What's on the board this ${month}.`}
        subtitle="Live odds, line movement, and research for every sport below — player props where books post them."
      />
      <div className="season-grid" style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 250px), 1fr))",
        gap: 12, maxWidth: 980, margin: "0 auto",
      }}>
        {visible.map(sport => {
          const state = SEASON_STATE_STYLES[sport.status.state];
          const boardLive = activeKeys?.has(sport.key);
          const detail = sport.status.state === "live"
            ? sport.status.phase
            : sport.status.state === "soon"
              ? `${sport.status.phase} starts ${sport.status.daysUntil <= 1 ? "tomorrow" : `in ${sport.status.daysUntil} days`}`
              : `${sport.status.phase} returns ${formatShortDate(sport.status.startsOn)}`;
          return (
            <div key={sport.key} style={{
              background: COLORS.surface, border: `1px solid ${sport.status.state === "live" ? `${state.color}33` : COLORS.border}`,
              borderRadius: 12, padding: "16px 18px", opacity: sport.status.state === "off" ? 0.65 : 1,
              display: "flex", flexDirection: "column", gap: 10,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <span style={{ fontSize: 22 }} aria-hidden="true">{sport.icon}</span>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 600, color: COLORS.text }}>{sport.label}</span>
                </div>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: 1, fontWeight: 700,
                  textTransform: "uppercase", color: state.color, background: `${state.color}14`,
                  padding: "4px 8px", borderRadius: 100,
                }}>
                  {sport.status.state === "live" && <span style={{ width: 6, height: 6, borderRadius: "50%", background: state.color, animation: "pulse 2s ease-in-out infinite" }} />}
                  {state.label}
                </span>
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: COLORS.textMuted }}>{detail}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["Odds", sport.props ? "Props" : null, "Research"].filter(Boolean).map(tag => (
                  <span key={tag} style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: COLORS.text,
                    border: `1px solid ${COLORS.border}`, padding: "3px 8px", borderRadius: 4,
                  }}>{tag}</span>
                ))}
                {boardLive && (
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: COLORS.accent,
                    background: COLORS.accentDim, padding: "3px 8px", borderRadius: 4, fontWeight: 700,
                  }}>Board live</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginTop: 24 }}>
        {offSeason.length > 0 && (
          <button onClick={() => setShowOff(v => !v)} style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: 1,
            padding: "10px 18px", borderRadius: 8, border: `1px solid ${COLORS.borderActive}`,
            background: "transparent", color: COLORS.textMuted, cursor: "pointer",
          }}>{showOff ? "Hide off-season" : `Show off-season (${offSeason.length})`}</button>
        )}
        <button onClick={onSignUp} style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: 1,
          padding: "10px 18px", borderRadius: 8, border: "none",
          background: COLORS.gradient, color: "#fff", cursor: "pointer", fontWeight: 700,
        }}>See today's board</button>
      </div>
      <p style={{ textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: COLORS.textDim, margin: "16px 0 0", letterSpacing: 0.5 }}>
        Season windows are typical dates; "Board live" means sportsbooks are posting odds right now.
      </p>
    </section>
  );
}

// ─── FEATURES ─────────────────────────────────────
const FEATURES = [
  { icon: "📝", title: "Daily Pro Report", tier: "Pro", isNew: true, text: "Top edges, steam moves, best books, and games to avoid — one morning screen that does the scanning for you." },
  { icon: "🧾", title: "Yesterday's Receipts", tier: "Free", isNew: true, text: "Every edge we flagged yesterday, auto-graded against the closing line. A public track record, not screenshots." },
  { icon: "⚖️", title: "Arbitrage & Low-Hold Scanner", tier: "Pro", isNew: true, text: "Guaranteed-profit and near-free markets across books, with the stake split computed for you." },
  { icon: "⚡", title: "Best Props ranking", tier: "Free preview", isNew: true, text: "Props scored on price edge vs no-vig fair value, book depth, and line disagreement — best number first." },
  { icon: "🚨", title: "Prop alerts", tier: "Free preview", isNew: true, text: "Flags props where a book's price beats the no-vig fair line — tap one to jump straight to that market." },
  { icon: "🎯", title: "Live edge board", tier: "Pro", text: "Exact book, line, EV, and fair probability for every flagged edge across every sportsbook we track." },
  { icon: "🔥", title: "Steam & line movement", tier: "Pro", text: "See where lines opened, where they are now, and which books moved first." },
  { icon: "🔎", title: "Game research", tier: "Free", text: "Recent form, head-to-head, trends, and injury reports next to the odds." },
  { icon: "🧩", title: "Parlay Builder", tier: "Free", text: "Build legs from the board and see the true combined price before you place it." },
  { icon: "📈", title: "Bet Tracker with CLV", tier: "Free", text: "W/L, ROI, units, streaks, and closing-line grading on every bet you log — synced across devices." },
  { icon: "🧮", title: "EV & Kelly calculators", tier: "Pro", text: "Size stakes to the edge instead of the gut feeling." },
];

export function FeatureGrid() {
  return (
    <section id="features" className="welcome-section" style={{ padding: "64px 0", scrollMarginTop: 90 }}>
      <SectionHeading
        eyebrow="What's Inside"
        title="Everything you need to bet the better number."
        subtitle="New this season: the Daily Pro Report, graded Receipts, the arbitrage scanner, and ranked props."
      />
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
        gap: 12, maxWidth: 980, margin: "0 auto",
      }}>
        {FEATURES.map(feature => (
          <div key={feature.title} style={{
            background: COLORS.surface, border: `1px solid ${feature.isNew ? `${COLORS.accent}33` : COLORS.border}`,
            borderRadius: 12, padding: "18px 20px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 20 }} aria-hidden="true">{feature.icon}</span>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 600, color: COLORS.text }}>{feature.title}</span>
              {feature.isNew && (
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: 1, fontWeight: 700,
                  color: COLORS.accent, background: COLORS.accentDim, padding: "2px 7px", borderRadius: 4,
                }}>NEW</span>
              )}
            </div>
            <p style={{ margin: "0 0 12px", fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, color: COLORS.textMuted, lineHeight: 1.55 }}>{feature.text}</p>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: 1, textTransform: "uppercase",
              color: feature.tier === "Pro" ? COLORS.accentPurple : "#22c55e",
            }}>{feature.tier}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── PRICING ──────────────────────────────────────
const FREE_PLAN = [
  "Odds board with FanDuel, DraftKings & BetMGM",
  "Player props preview + Best Props top 3",
  "Game research: form, head-to-head, and injuries",
  "Parlay Builder and Yesterday's Receipts",
  "Bet Tracker with CLV grading",
];

export function PricingSection({ onSignUp }) {
  const cardBase = { borderRadius: 16, padding: 28, display: "flex", flexDirection: "column", gap: 16 };
  const listItem = (text, color) => (
    <li key={text} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, color: COLORS.text, lineHeight: 1.5 }}>
      <span style={{ color, flexShrink: 0 }}>✓</span><span>{text}</span>
    </li>
  );
  return (
    <section id="pricing" className="welcome-section" style={{ padding: "64px 0", scrollMarginTop: 90 }}>
      <SectionHeading eyebrow="Pricing" title="Start free. Upgrade when it pays for itself." subtitle={PRO_FEATURES.subheadline} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 16, maxWidth: 880, margin: "0 auto" }}>
        <div style={{ ...cardBase, background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: COLORS.textMuted }}>Free</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 34, fontWeight: 700, color: COLORS.text, marginTop: 6 }}>$0</div>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {FREE_PLAN.map(text => listItem(text, "#22c55e"))}
          </ul>
          <button onClick={onSignUp} style={{
            marginTop: "auto", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, letterSpacing: 1,
            padding: "12px 0", borderRadius: 8, border: `1px solid ${COLORS.borderActive}`,
            background: "transparent", color: COLORS.text, cursor: "pointer", fontWeight: 700,
          }}>Create Free Account</button>
        </div>
        <div style={{ ...cardBase, background: "linear-gradient(160deg, rgba(123,92,255,0.12), rgba(0,200,255,0.06))", border: `1px solid ${COLORS.accentPurple}55` }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: COLORS.accent }}>Pro</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 34, fontWeight: 700, color: COLORS.text, marginTop: 6 }}>{PRO_FEATURES.price}</div>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {PRO_FEATURES.features.map(({ text }) => listItem(text, COLORS.accent))}
          </ul>
          <button onClick={onSignUp} style={{
            marginTop: "auto", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, letterSpacing: 1,
            padding: "12px 0", borderRadius: 8, border: "none",
            background: COLORS.gradient, color: "#fff", cursor: "pointer", fontWeight: 700,
          }}>Start Free, Upgrade In-App</button>
        </div>
      </div>
    </section>
  );
}

export function WelcomeFooter() {
  return (
    <footer style={{
      borderTop: `1px solid ${COLORS.border}`, padding: "28px 0 40px",
      display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "space-between", alignItems: "center",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <LogoMark size={22} />
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600, color: COLORS.textMuted }}>EdgeFinder</span>
      </div>
      <nav aria-label="Footer" style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {NAV_LINKS.map(([id, label]) => (
          <a key={id} href={`#${id}`} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: COLORS.textMuted, textDecoration: "none" }}>{label}</a>
        ))}
      </nav>
      <p style={{ width: "100%", margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, color: COLORS.textDim, lineHeight: 1.6 }}>
        EdgeFinder is an odds-comparison and analytics tool — not a sportsbook, and not a picks service. Must be 21+ and in a jurisdiction where sports betting is legal. Gambling problem? Call 1-800-GAMBLER.
      </p>
    </footer>
  );
}
