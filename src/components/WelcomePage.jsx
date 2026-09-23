import { useState, useEffect, useRef, useCallback } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";
import { LogoMark } from "./Logo.jsx";
import { PRO_FEATURES } from "../constants.js";
import { getSeasonBoard } from "../utils/season-calendar.js";

const COLORS = {
  bg: "#0d1117",
  surface: "#151b25",
  surfaceHover: "#1a2230",
  border: "#1e2a3a",
  borderActive: "#2a3a4e",
  text: "#e2e8f0",
  textMuted: "#7b8ba3",
  textDim: "#3d4f65",
  accent: "#00c8ff",
  accentMid: "#5b8cff",
  accentPurple: "#7b5cff",
  accentDim: "rgba(0,200,255,0.08)",
  accentGlow: "rgba(0,200,255,0.2)",
  gradient: "linear-gradient(135deg, #7b5cff, #00c8ff)",
  gradientText: "linear-gradient(135deg, #7b5cff, #00c8ff)",
  red: "#ff4466",
  redDim: "rgba(255,68,102,0.08)",
  amber: "#ffaa22",
  amberDim: "rgba(255,170,34,0.08)",
  blue: "#5b8cff",
};

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

// ─── SIGN IN POPUP ────────────────────────────────
function SignInPopup({ open, onClose, initialTab = "signin" }) {
  const [tab, setTab] = useState(initialTab);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Each open starts on the tab the CTA asked for ("Start Free" → sign up).
  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setError("");
    setNotice("");
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);
    try {
      if (tab === "signin") {
        await signInWithEmailAndPassword(auth, email, pass);
      } else {
        await createUserWithEmailAndPassword(auth, email, pass);
      }
      onClose();
      setEmail("");
      setPass("");
    } catch (err) {
      setError(err.message.replace("Firebase: ", ""));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    const trimmedEmail = email.trim();
    setError("");
    setNotice("");

    if (!trimmedEmail) {
      setError("Enter your email first, then tap Forgot password.");
      return;
    }

    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      setNotice("Password reset email sent. Check your inbox and spam folder.");
    } catch (err) {
      setError(err.message.replace("Firebase: ", ""));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(5,8,14,0.75)",
          backdropFilter: "blur(8px)",
          zIndex: 999, animation: "fadeIn 0.25s ease",
        }}
      />
      <div className="welcome-signin-popup" role="dialog" aria-modal="true" aria-label={tab === "signin" ? "Sign in" : "Create account"} style={{
        position: "fixed", top: 72, right: 28, width: 360,
        background: COLORS.surface, border: `1px solid ${COLORS.border}`,
        borderRadius: 16, zIndex: 1000, overflow: "hidden",
        boxShadow: `0 24px 64px rgba(0,0,0,0.5), 0 0 40px rgba(0,200,255,0.06)`,
        animation: "slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
      }}>
        <div style={{ padding: "24px 28px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <LogoMark size={28} />
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 15, color: COLORS.text }}>EdgeFinder</span>
            </div>
            <button onClick={onClose} aria-label="Close" style={{
              background: "none", border: "none", color: COLORS.textMuted,
              fontSize: 18, cursor: "pointer", padding: 4, lineHeight: 1,
            }}>✕</button>
          </div>
          <div style={{
            display: "flex", gap: 0,
            borderBottom: `1px solid ${COLORS.border}`,
            marginLeft: -28, marginRight: -28, paddingLeft: 28, paddingRight: 28,
          }}>
            {[["signin", "Sign In"], ["signup", "Create Account"]].map(([key, label]) => (
              <button key={key} type="button" onClick={() => { setTab(key); setError(""); setNotice(""); }} style={{
                fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 500,
                padding: "10px 0", marginRight: 24, background: "none", border: "none",
                borderBottom: `2px solid ${tab === key ? COLORS.accent : "transparent"}`,
                color: tab === key ? COLORS.text : COLORS.textMuted,
                cursor: "pointer", transition: "all 0.2s ease",
              }}>{label}</button>
            ))}
          </div>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "24px 28px 28px" }}>
          <label style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: 1,
            textTransform: "uppercase", color: COLORS.textMuted, display: "block", marginBottom: 8,
          }}>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            required autoComplete="email" aria-label="Email"
            placeholder="you@email.com"
            style={{
              width: "100%", padding: "11px 14px", borderRadius: 8,
              border: `1px solid ${COLORS.border}`, background: COLORS.bg,
              color: COLORS.text, fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 14, outline: "none", marginBottom: 16, transition: "border 0.2s ease",
            }}
            onFocus={(e) => e.target.style.borderColor = COLORS.accent + "66"}
            onBlur={(e) => e.target.style.borderColor = COLORS.border}
          />
          <label style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: 1,
            textTransform: "uppercase", color: COLORS.textMuted, display: "block", marginBottom: 8,
          }}>Password</label>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)}
            required minLength={6} aria-label="Password"
            autoComplete={tab === "signin" ? "current-password" : "new-password"}
            placeholder="••••••••"
            style={{
              width: "100%", padding: "11px 14px", borderRadius: 8,
              border: `1px solid ${COLORS.border}`, background: COLORS.bg,
              color: COLORS.text, fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 14, outline: "none", marginBottom: 24, transition: "border 0.2s ease",
            }}
            onFocus={(e) => e.target.style.borderColor = COLORS.accent + "66"}
            onBlur={(e) => e.target.style.borderColor = COLORS.border}
          />
          {error && (
            <div style={{
              padding: "10px 12px", borderRadius: 8,
              border: `1px solid ${COLORS.red}66`, background: COLORS.redDim,
              color: COLORS.red, fontSize: 12, marginBottom: 16,
              fontFamily: "'Space Grotesk', sans-serif",
            }}>
              {error}
            </div>
          )}
          {notice && (
            <div style={{
              padding: "10px 12px", borderRadius: 8,
              border: `1px solid ${COLORS.accent}66`, background: COLORS.accentDim,
              color: COLORS.accent, fontSize: 12, marginBottom: 16,
              fontFamily: "'Space Grotesk', sans-serif",
            }}>
              {notice}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            style={{
            width: "100%", padding: "12px 0", borderRadius: 10,
            border: "none", background: COLORS.gradient,
            color: "#fff", fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 14, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer",
            opacity: submitting ? 0.8 : 1,
            boxShadow: `0 0 24px rgba(0,200,255,0.15)`, letterSpacing: 0.5,
          }}
          >
            {submitting ? "Please wait..." : tab === "signin" ? "Sign In" : "Create Free Account"}
          </button>
          {tab === "signin" && (
            <p style={{ textAlign: "center", margin: "16px 0 0", fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, color: COLORS.textDim }}>
              <button
                type="button"
                onClick={handlePasswordReset}
                disabled={submitting}
                style={{
                  background: "none", border: "none", padding: 0,
                  color: COLORS.accent, cursor: submitting ? "not-allowed" : "pointer",
                  fontFamily: "inherit", fontSize: "inherit",
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                Forgot password?
              </button>
            </p>
          )}
          {tab === "signup" && (
            <p style={{ textAlign: "center", margin: "16px 0 0", fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, color: COLORS.textDim, lineHeight: 1.5 }}>
              Free plan includes 3 sportsbooks, the props preview, Parlay Builder, bet tracker, and Yesterday's Receipts.
            </p>
          )}
        </form>
      </div>
    </>
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

function FeaturePreview() {
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

// ─── NAVIGATION ───────────────────────────────────
const NAV_LINKS = [
  ["in-season", "In Season"],
  ["features", "Features"],
  ["preview", "Preview"],
  ["pricing", "Pricing"],
];

function WelcomeNav({ onSignIn, onSignUp }) {
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

function InSeasonSection({ onSignUp }) {
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

function FeatureGrid() {
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

function PricingSection({ onSignUp }) {
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

function WelcomeFooter() {
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
