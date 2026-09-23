import { useState, useEffect, useRef, useCallback } from "react";
import { COLORS } from "./welcome/theme.js";
import SignInPopup from "./welcome/SignInPopup.jsx";
import FeaturePreview from "./welcome/FeaturePreview.jsx";
import { WelcomeNav, InSeasonSection, FeatureGrid, PricingSection, WelcomeFooter } from "./welcome/Sections.jsx";

// Signed-out landing page. Sections live in ./welcome/; this file keeps the
// hero, audience block, sample-signal strip and the page shell.

function HeroPreviewPanel() {
  const books = [
    { name: "FanDuel", line: "Bills -2.5", price: "-108", tag: "Best", color: "#22c55e" },
    { name: "DraftKings", line: "Bills -3", price: "-110", tag: "Hold", color: COLORS.textMuted },
    { name: "BetMGM", line: "Bills -3.5", price: "-105", tag: "Weak", color: COLORS.amber },
  ];
  const signals = [
    { label: "Steam", value: "HIGH", color: COLORS.accent },
    { label: "CLV Window", value: "OPEN", color: "#22c55e" },
    { label: "Public", value: "68% Favorite", color: COLORS.amber },
  ];

  return (
    <div className="hero-preview-panel" style={{
      width: "100%",
      maxWidth: 500,
      border: `1px solid ${COLORS.border}`,
      background: "rgba(10, 15, 24, 0.82)",
      borderRadius: 8,
      overflow: "hidden",
      boxShadow: "0 28px 80px rgba(0,0,0,0.42)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 16px", borderBottom: `1px solid ${COLORS.border}`,
      }}>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: COLORS.accent, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 5 }}>
            Sample · NFL Sunday
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>Bills @ Dolphins</div>
        </div>
        <div style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#22c55e" }}>82</div>
          <div style={{ fontSize: 10, color: COLORS.textMuted }}>Edge Score</div>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <div className="hero-signal-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
          {signals.map((signal) => (
            <div className="hero-signal-card" key={signal.label} style={{
              minHeight: 68,
              padding: "10px 8px",
              borderRadius: 8,
              background: `${signal.color}10`,
              border: `1px solid ${signal.color}33`,
            }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>
                {signal.label}
              </div>
              <div style={{ marginTop: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 800, color: signal.color }}>
                {signal.value}
              </div>
            </div>
          ))}
        </div>

        <div className="hero-move-row" style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 0", borderTop: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}`,
          marginBottom: 12,
        }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>
              Market Move
            </div>
            <div style={{ marginTop: 6, color: COLORS.text, fontSize: 14, fontWeight: 600 }}>-2 to -3 as sharp money lands</div>
          </div>
          <div style={{ width: 96, height: 38 }}>
            <svg viewBox="0 0 120 46" style={{ width: "100%", height: "100%", display: "block" }}>
              <polyline points="2,34 18,31 34,28 50,29 66,20 82,18 98,12 118,10" fill="none" stroke={COLORS.accent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="118" cy="10" r="4" fill={COLORS.accent} />
            </svg>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {books.map((book) => (
            <div className="hero-book-row" key={book.name} style={{
              display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "center",
              padding: "10px 12px", borderRadius: 8,
              background: "rgba(13, 17, 23, 0.72)",
              border: `1px solid ${book.tag === "Best" ? "#22c55e55" : COLORS.border}`,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              <span style={{ color: COLORS.text, fontSize: 12, fontWeight: 700 }}>{book.name}</span>
              <span style={{ color: COLORS.textMuted, fontSize: 12 }}>{book.line} {book.price}</span>
              <span style={{ color: book.color, fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>{book.tag}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HeroSection({ onSignUp }) {
  // Live, verifiable proof: the 30-day close-beat rate from the public
  // graded track record (/api/edge-receipts). Falls back to static copy
  // until enough days have graded out.
  const [trackRecord, setTrackRecord] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/edge-receipts")
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (cancelled || !json?.available) return;
        const d30 = json.rolling?.d30;
        if (d30?.graded >= 10 && d30.beatRate != null) {
          setTrackRecord({ beatRate: d30.beatRate, graded: d30.graded });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const metrics = [
    ["Live odds", "7+ books"],
    trackRecord
      ? ["30-day receipts", `${trackRecord.beatRate}% beat close`]
      : ["Signal stack", "Steam + CLV"],
    ["Decision view", "Best number first"],
  ];

  return (
    <section className="welcome-hero" style={{
      minHeight: "calc(100vh - 100px)",
      display: "grid",
      gridTemplateColumns: "minmax(0, 1.05fr) minmax(340px, 0.95fr)",
      alignItems: "center",
      gap: 48,
      padding: "34px 0 66px",
    }}>
      <div className="hero-copy">
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "7px 12px", borderRadius: 8,
          border: `1px solid ${COLORS.accent}33`,
          background: COLORS.accentDim,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: COLORS.accent,
          marginBottom: 22,
        }}>
          Live betting intelligence
        </div>
        <h1 className="hero-title" style={{
          margin: 0,
          maxWidth: 720,
          fontSize: "clamp(42px, 7vw, 82px)",
          lineHeight: 0.98,
          letterSpacing: 0,
          color: COLORS.text,
          fontWeight: 700,
        }}>
          EdgeFinder shows the number worth betting.
        </h1>
        <p style={{
          maxWidth: 620,
          margin: "24px 0 0",
          color: COLORS.textMuted,
          fontSize: "clamp(16px, 2vw, 20px)",
          lineHeight: 1.55,
        }}>
          Compare books, track steam, rank player props, and protect closing line value from one clean board — NFL, college football, MLB, NHL and more.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 30 }}>
          <button onClick={onSignUp} style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13,
            letterSpacing: 1,
            padding: "13px 22px",
            borderRadius: 8,
            border: "none",
            background: COLORS.gradient,
            color: "#fff",
            cursor: "pointer",
            fontWeight: 700,
          }}>
            Start Free
          </button>
          <a href="#in-season" style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13,
            letterSpacing: 1,
            padding: "12px 18px",
            borderRadius: 8,
            border: `1px solid ${COLORS.borderActive}`,
            color: COLORS.text,
            textDecoration: "none",
          }}>
            What's In Season
          </a>
          <a href="#preview" style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13,
            letterSpacing: 1,
            padding: "12px 18px",
            borderRadius: 8,
            color: COLORS.textMuted,
            textDecoration: "none",
          }}>
            Try the demo →
          </a>
        </div>

        <div className="hero-metrics" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, maxWidth: 600, marginTop: 34 }}>
          {metrics.map(([label, value]) => (
            <div key={label} style={{
              minHeight: 74,
              padding: "12px 14px",
              border: `1px solid ${COLORS.border}`,
              borderRadius: 8,
              background: "rgba(21, 27, 37, 0.56)",
            }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1.2 }}>{label}</div>
              <div style={{ marginTop: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: COLORS.text, fontWeight: 800 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
      <HeroPreviewPanel />
    </section>
  );
}

// ─── QUALIFIER BLOCK ──────────────────────────────
function QualifierBlock() {
  const forItems = [
    { icon: "◉", text: "Self-directed bettors who do their own research" },
    { icon: "◉", text: "Daily grinders looking for edges, not picks" },
    { icon: "◉", text: "Anyone tired of checking 5 apps for one play" },
    { icon: "◉", text: "Bettors who care about closing line value" },
  ];
  const notItems = [
    { icon: "✕", text: "People looking for guaranteed winners" },
    { icon: "✕", text: "Anyone who wants someone else to think for them" },
    { icon: "✕", text: "Tail-and-pray pick followers" },
    { icon: "✕", text: "Get-rich-quick gamblers" },
  ];

  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="welcome-section" ref={ref} style={{ padding: "80px 0" }}>
      <div style={{ textAlign: "center", marginBottom: 56 }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11, letterSpacing: 4, textTransform: "uppercase",
          background: COLORS.gradientText, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          display: "block", marginBottom: 16,
        }}>Who This Is For</span>
        <h2 style={{
          fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(28px, 4vw, 42px)",
          fontWeight: 600, color: COLORS.text, margin: 0, lineHeight: 1.2,
        }}>
          We're not for everyone.<br />
          <span style={{ color: COLORS.textMuted }}>And that's the point.</span>
        </h2>
      </div>
      <div className="qualifier-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 24, maxWidth: 880, margin: "0 auto" }}>
        <div className="qualifier-card" style={{
          background: COLORS.accentDim, border: `1px solid ${COLORS.accent}33`,
          borderRadius: 16, padding: 36,
          opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(24px)",
          transition: "all 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
        }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: 3, textTransform: "uppercase",
            color: COLORS.accent, marginBottom: 28, display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.accent, boxShadow: `0 0 8px ${COLORS.accent}` }} />
            EdgeFinder is for
          </div>
          {forItems.map((item, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 14,
              marginBottom: i < forItems.length - 1 ? 20 : 0,
              opacity: visible ? 1 : 0, transform: visible ? "translateX(0)" : "translateX(-16px)",
              transition: `all 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${0.2 + i * 0.1}s`,
            }}>
              <span style={{ color: COLORS.accent, fontSize: 10, marginTop: 5, flexShrink: 0 }}>{item.icon}</span>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, color: COLORS.text, lineHeight: 1.5 }}>{item.text}</span>
            </div>
          ))}
        </div>
        <div className="qualifier-card" style={{
          background: COLORS.redDim, border: `1px solid ${COLORS.red}22`,
          borderRadius: 16, padding: 36,
          opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(24px)",
          transition: "all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.15s",
        }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: 3, textTransform: "uppercase",
            color: COLORS.red, marginBottom: 28, display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.red, boxShadow: `0 0 8px ${COLORS.red}` }} />
            EdgeFinder is NOT for
          </div>
          {notItems.map((item, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 14,
              marginBottom: i < notItems.length - 1 ? 20 : 0,
              opacity: visible ? 1 : 0, transform: visible ? "translateX(0)" : "translateX(16px)",
              transition: `all 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${0.35 + i * 0.1}s`,
            }}>
              <span style={{ color: COLORS.red, fontSize: 11, marginTop: 4, flexShrink: 0, fontWeight: 700 }}>{item.icon}</span>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, color: COLORS.textMuted, lineHeight: 1.5 }}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── LIVE SIGNAL STRIP ────────────────────────────
// Sample feed items — in-season sports so the strip matches the live board.
const SIGNALS = [
  { type: "line", text: "Line move: Bills -2 → -3", sport: "NFL", color: COLORS.accent },
  { type: "prop", text: "Prop edge: Josh Allen O 245.5 pass yds", sport: "NFL", color: COLORS.blue },
  { type: "injury", text: "Injury report: WR questionable (hamstring)", sport: "NFL", color: COLORS.amber },
  { type: "line", text: "Total move: Ohio State @ Michigan 47.5 → 45.5", sport: "NCAAF", color: COLORS.accent },
  { type: "prop", text: "Prop edge: Aaron Judge O 1.5 total bases", sport: "MLB", color: COLORS.blue },
  { type: "injury", text: "Lineup confirmed: Yankees starting nine posted", sport: "MLB", color: COLORS.amber },
  { type: "line", text: "Steam: Liberty -4.5 → -6 in the playoffs", sport: "WNBA", color: COLORS.accent },
  { type: "prop", text: "Prop edge: Saquon Barkley O 82.5 rush yds", sport: "NFL", color: COLORS.blue },
  { type: "line", text: "Reverse line move: Chiefs -3.5 → -3", sport: "NFL", color: COLORS.accent },
  { type: "line", text: "Puck line move: Rangers -1.5 (+165) → (+150)", sport: "NHL", color: COLORS.accent },
];

function LiveSignalStrip() {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => { setOffset((prev) => prev - 0.5); }, 30);
    return () => clearInterval(interval);
  }, []);

  const doubled = [...SIGNALS, ...SIGNALS];

  return (
    <section style={{ padding: "60px 0", overflow: "hidden" }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: COLORS.accentDim, border: `1px solid ${COLORS.accent}33`,
          borderRadius: 100, padding: "6px 16px", marginBottom: 20,
        }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: 2,
            textTransform: "uppercase", color: COLORS.accent,
          }}>Sample Signals</span>
        </div>
        <h2 style={{
          fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(24px, 3.5vw, 36px)",
          fontWeight: 600, color: COLORS.text, margin: 0, lineHeight: 1.3,
        }}>
          The market never stops moving.<br />
          <span style={{ color: COLORS.textMuted }}>Neither does EdgeFinder.</span>
        </h2>
        <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, color: COLORS.textMuted, margin: "12px 0 0" }}>
          Examples of the line moves, prop edges, and news alerts the board flags.
        </p>
      </div>
      {[false, true].map((reverse, ri) => (
        <div key={ri} style={{ position: "relative", marginBottom: ri === 0 ? 12 : 0 }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 80, background: `linear-gradient(to right, ${COLORS.bg}, transparent)`, zIndex: 2, pointerEvents: "none" }} />
          <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 80, background: `linear-gradient(to left, ${COLORS.bg}, transparent)`, zIndex: 2, pointerEvents: "none" }} />
          <div style={{
            display: "flex", gap: 12, width: "max-content",
            transform: `translateX(${reverse ? -offset - 200 : offset}px)`,
          }}>
            {(reverse ? [...doubled].reverse() : doubled).map((signal, i) => (
              <div key={i} style={{
                display: "inline-flex", alignItems: "center", gap: 12,
                background: COLORS.surface, border: `1px solid ${COLORS.border}`,
                borderRadius: 10, padding: "12px 18px", whiteSpace: "nowrap",
              }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: signal.color, boxShadow: `0 0 6px ${signal.color}`, flexShrink: 0 }} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: COLORS.text, letterSpacing: 0.3 }}>{signal.text}</span>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: COLORS.textDim,
                  letterSpacing: 1, textTransform: "uppercase", background: `${signal.color}11`, padding: "3px 8px", borderRadius: 4,
                }}>{signal.sport}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

// ─── MAIN APP ─────────────────────────────────────
export default function EdgeFinderSections() {
  const [signInOpen, setSignInOpen] = useState(false);
  const [signInTab, setSignInTab] = useState("signin");
  const openAuth = (tab) => { setSignInTab(tab); setSignInOpen(true); };
  const openSignIn = () => openAuth("signin");
  const openSignUp = () => openAuth("signup");
  const closeAuth = useCallback(() => setSignInOpen(false), []);

  return (
    <div id="top" className="welcome-shell" style={{
      background: COLORS.bg, minHeight: "100vh",
      padding: "0 clamp(20px, 4vw, 48px)", fontFamily: "'Space Grotesk', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-12px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        html { scroll-behavior: smooth; }
        * { box-sizing: border-box; }
        body { margin: 0; background: ${COLORS.bg}; }
        ::-webkit-scrollbar { height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 4px; }
        input::placeholder { color: ${COLORS.textDim}; }

        .welcome-nav-links a:hover { color: ${COLORS.text} !important; background: ${COLORS.surfaceHover}; }
        .welcome-nav-mobile::-webkit-scrollbar { display: none; }

        @media (max-width: 860px) {
          .welcome-nav-links { display: none !important; }
          .welcome-nav-mobile { display: flex !important; }
        }

        @media (max-width: 640px) {
          .welcome-shell {
            width: min(100%, 390px) !important;
            padding-left: max(14px, env(safe-area-inset-left, 0px)) !important;
            padding-right: max(14px, env(safe-area-inset-right, 0px)) !important;
            overflow-x: clip;
          }

          .welcome-header {
            padding-top: calc(12px + env(safe-area-inset-top, 0px)) !important;
            padding-bottom: 12px !important;
            padding-left: max(14px, env(safe-area-inset-left, 0px)) !important;
            padding-right: max(14px, env(safe-area-inset-right, 0px)) !important;
            margin-left: calc(-1 * max(14px, env(safe-area-inset-left, 0px))) !important;
            margin-right: calc(-1 * max(14px, env(safe-area-inset-right, 0px))) !important;
          }

          .welcome-header button {
            padding: 8px 14px !important;
            font-size: 11px !important;
          }

          .welcome-section {
            padding: 44px 0 !important;
          }

          .welcome-hero {
            min-height: auto !important;
            grid-template-columns: 1fr !important;
            gap: 26px !important;
            padding: 24px 0 44px !important;
          }

          .hero-copy,
          .hero-title {
            max-width: 100% !important;
            min-width: 0 !important;
          }

          .hero-title {
            font-size: 34px !important;
            line-height: 1.08 !important;
            overflow-wrap: anywhere;
          }

          .hero-preview-panel {
            max-width: none !important;
          }

          .hero-signal-grid {
            grid-template-columns: 1fr !important;
          }

          .hero-signal-card {
            min-height: auto !important;
          }

          .hero-move-row {
            grid-template-columns: 1fr !important;
          }

          .hero-book-row {
            grid-template-columns: 1fr !important;
            gap: 5px !important;
          }

          .hero-metrics {
            grid-template-columns: 1fr !important;
          }

          .qualifier-grid {
            grid-template-columns: 1fr !important;
            gap: 14px !important;
          }

          .qualifier-card {
            padding: 22px !important;
          }


          .welcome-signin-popup {
            top: calc(58px + env(safe-area-inset-top, 0px)) !important;
            left: 14px !important;
            right: 14px !important;
            width: auto !important;
            max-height: calc(100vh - 80px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
            overflow-y: auto !important;
          }
        }
      `}</style>

      <SignInPopup open={signInOpen} onClose={closeAuth} initialTab={signInTab} />

      <WelcomeNav onSignIn={openSignIn} onSignUp={openSignUp} />

      <HeroSection onSignUp={openSignUp} />
      <Divider />
      <InSeasonSection onSignUp={openSignUp} />
      <Divider />
      <FeatureGrid />
      <Divider />
      <div id="preview" style={{ scrollMarginTop: 90 }}>
        <FeaturePreview />
      </div>
      <Divider />
      <LiveSignalStrip />
      <Divider />
      <PricingSection onSignUp={openSignUp} />
      <Divider />
      <QualifierBlock />

      <section style={{ textAlign: "center", padding: "80px 0 60px" }}>
        <h2 style={{
          fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(24px, 3.5vw, 36px)",
          fontWeight: 600, color: COLORS.text, margin: "0 0 12px 0", lineHeight: 1.3,
        }}>
          Stop chasing picks.<br />
          <span style={{ background: COLORS.gradientText, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Start spotting edges.</span>
        </h2>
        <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, color: COLORS.textMuted, margin: "0 0 32px 0" }}>
          Join the bettors who find value before the line moves.
        </p>
        <button onClick={openSignUp} style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 14, letterSpacing: 1,
          padding: "14px 36px", borderRadius: 10, border: "none",
          background: COLORS.gradient, color: "#fff", cursor: "pointer", fontWeight: 600,
          boxShadow: `0 0 30px rgba(0,200,255,0.15)`,
        }}>Create Free Account</button>
      </section>
      <WelcomeFooter />
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: COLORS.border, margin: "0 calc(-1 * clamp(20px, 4vw, 48px))" }} />;
}
