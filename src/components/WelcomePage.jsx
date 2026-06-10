import { useState, useEffect, useRef } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";

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
    { name: "FanDuel", line: "Knicks +3.5", price: "-108", tag: "Best", color: "#22c55e" },
    { name: "DraftKings", line: "Knicks +3", price: "-112", tag: "Hold", color: COLORS.textMuted },
    { name: "BetMGM", line: "Knicks +2.5", price: "-110", tag: "Weak", color: COLORS.amber },
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
            Market Intelligence
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>Knicks @ Celtics</div>
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
            <div style={{ marginTop: 6, color: COLORS.text, fontSize: 14, fontWeight: 600 }}>+2.5 to +3.5 against public pressure</div>
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

function HeroSection({ onSignIn }) {
  const metrics = [
    ["Live odds", "7+ books"],
    ["Signal stack", "Steam + CLV"],
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
          Compare books, track steam, spot public traps, and protect closing line value from one clean board.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 30 }}>
          <button onClick={onSignIn} style={{
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
            Open The Board
          </button>
          <a href="#preview" style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13,
            letterSpacing: 1,
            padding: "12px 18px",
            borderRadius: 8,
            border: `1px solid ${COLORS.borderActive}`,
            color: COLORS.text,
            textDecoration: "none",
          }}>
            Preview Signals
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
function SignInPopup({ open, onClose }) {
  const [tab, setTab] = useState("signin");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      <div className="welcome-signin-popup" style={{
        position: "fixed", top: 72, right: 28, width: 360,
        background: COLORS.surface, border: `1px solid ${COLORS.border}`,
        borderRadius: 16, zIndex: 1000, overflow: "hidden",
        boxShadow: `0 24px 64px rgba(0,0,0,0.5), 0 0 40px rgba(0,200,255,0.06)`,
        animation: "slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
      }}>
        <div style={{ padding: "24px 28px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                width: 28, height: 28, borderRadius: 7,
                background: COLORS.gradient,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 700, color: "#fff",
              }}>E</span>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 15, color: COLORS.text }}>EdgeFinder</span>
            </div>
            <button onClick={onClose} style={{
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
              <button key={key} onClick={() => setTab(key)} style={{
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
              Free plan includes 3 sports, daily alerts, and basic prop screen.
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
const SIGNALS = [
  { type: "line", text: "Line move: MIA Heat -3 → -2.5", sport: "NBA", time: "2m ago", color: COLORS.accent },
  { type: "prop", text: "Prop edge: Jalen Brunson O 24.5 pts", sport: "NBA", time: "4m ago", color: COLORS.blue },
  { type: "injury", text: "Injury alert: Joel Embiid questionable", sport: "NBA", time: "6m ago", color: COLORS.amber },
  { type: "line", text: "Line move: KC Chiefs -1.5 → -2.5", sport: "NFL", time: "8m ago", color: COLORS.accent },
  { type: "prop", text: "Prop edge: Saquon Barkley O 82.5 rush yds", sport: "NFL", time: "11m ago", color: COLORS.blue },
  { type: "injury", text: "News alert: Lakers starting lineup confirmed", sport: "NBA", time: "13m ago", color: COLORS.amber },
  { type: "line", text: "Line move: BOS Celtics -6 → -5.5", sport: "NBA", time: "15m ago", color: COLORS.accent },
  { type: "prop", text: "Prop edge: Tyrese Maxey O 5.5 ast", sport: "NBA", time: "18m ago", color: COLORS.blue },
  { type: "line", text: "Reverse line move: NYK Knicks +2 → +3", sport: "NBA", time: "20m ago", color: COLORS.accent },
  { type: "injury", text: "Injury alert: Luka Dončić out tonight", sport: "NBA", time: "22m ago", color: COLORS.amber },
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
            width: 7, height: 7, borderRadius: "50%", background: COLORS.accent,
            boxShadow: `0 0 10px ${COLORS.accent}`, animation: "pulse 2s ease-in-out infinite",
          }} />
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: 2,
            textTransform: "uppercase", color: COLORS.accent,
          }}>Live Feed</span>
        </div>
        <h2 style={{
          fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(24px, 3.5vw, 36px)",
          fontWeight: 600, color: COLORS.text, margin: 0, lineHeight: 1.3,
        }}>
          The market never stops moving.<br />
          <span style={{ color: COLORS.textMuted }}>Neither does EdgeFinder.</span>
        </h2>
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
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: COLORS.textDim }}>{signal.time}</span>
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
      away: "Miami Heat", home: "Charlotte Hornets",
      awayEmoji: "🔥", homeEmoji: "🐝",
      badges: [
        { text: "NBA", color: COLORS.accent },
        { text: "HOT 🔥", color: "#ff4466" },
        { text: "MOVING", color: COLORS.amber },
        { text: "FADE", color: COLORS.accentPurple },
      ],
      hold: "4.4%",
      fairML: "-239 / +239",
      mlHold: "4.3%",
      totalHold: "4.7%",
      currentSpread: "7.5",
      currentTotal: "228.5",
      gameTime: "4:10 PM",
      books: [
        { name: "FanDuel",    awayML: "-295", homeML: "+240", homeBest: true, spread: "-7.5 (-106)", spreadAlt: "+7.5 (-114)", total: "Over 228.5 (-112)", totalAlt: "Under 228.5 (-108)" },
        { name: "BetOnline",  awayML: "-280", homeML: "+230", homeBest: false, spread: "-7 (-115)", spreadAlt: "+7 (-105)", total: "Over 229 (-110)", totalAlt: "Under 229 (-110)" },
        { name: "DraftKings", awayML: "-285", homeML: "+230", homeBest: false, spread: "-7.5 (-105)", spreadAlt: "+7.5 (-115)", spreadBest: true, total: "Over 228.5 (-115)", totalAlt: "Under 228.5 (-113)", totalAltBest: true },
        { name: "BetRivers",  awayML: "-240", homeML: "+188", homeBest: false, awayBest: true, spread: "-6 (-113)", spreadAlt: "+6 (-110)", total: "Over 228.5 (-110)", totalAlt: "Under 228.5 (-113)" },
        { name: "BetMGM",     awayML: "-295", homeML: "+230", homeBest: false, spread: "-7.5 (-105)", spreadAlt: "+7.5 (-115)", total: "Over 229.5 (-105)", totalBest: true, totalAlt: "Under 229.5 (-115)" },
        { name: "Bovada",     awayML: "-280", homeML: "+230", homeBest: false, spread: "-7 (-115)", spreadAlt: "+7 (-105)", total: "Over 228.5 (-110)", totalAlt: "Under 228.5 (-110)" },
      ],
      lineMovement: { opener: "-6", change: "-1.5", current: "-7.5", totalRange: "228.5 → 228.5" },
      fadingNote: "Line fading Charlotte Hornets",
      sparklinePoints: [6, 6, 6.5, 6.5, 6.5, 7, 7, 7, 7, 7.5, 7.5, 7.5],
      historyPoints: [6, 6, 6, 6.5, 6.5, 6.5, 6.5, 7, 7, 7, 7, 7, 7, 7, 7.5, 7.5],
    },
  },
  {
    id: "alerts", label: "Game Research", icon: "◈",
    description: "Form, head-to-head, trends, and injury reports — all in one view.",
    subTabs: ["Form", "H2H", "Trends"],
    source: "ESPN",
    teams: [
      {
        name: "Charlotte Hornets",
        homeRec: "3-3", awayRec: "4-0",
        last10: "7-3", streak: "W6", streakColor: "#22c55e",
        games: [
          { result: "W", opp: "@BOS" }, { result: "W", opp: "vsDAL" }, { result: "W", opp: "vsPOR" },
          { result: "W", opp: "@IND" }, { result: "W", opp: "@CHI" }, { result: "W", opp: "@WSH" },
          { result: "L", opp: "vsCLE" }, { result: "L", opp: "vsHOU" }, { result: "W", opp: "vsATL" },
          { result: "L", opp: "vsDET" },
        ],
      },
      {
        name: "Miami Heat",
        homeRec: "4-1", awayRec: "3-2",
        last10: "7-3", streak: "W3", streakColor: "#22c55e",
        games: [
          { result: "W", opp: "vsBKN" }, { result: "W", opp: "vsBKN" }, { result: "W", opp: "vsHOU" },
          { result: "L", opp: "@PHI" }, { result: "L", opp: "@MIL" }, { result: "W", opp: "vsMEM" },
          { result: "W", opp: "@ATL" }, { result: "W", opp: "@IND" }, { result: "L", opp: "vsUTA" },
          { result: "W", opp: "@WSH" },
        ],
      },
    ],
    timestamp: "10:46:43 PM · ESPN",
    injuries: [
      { player: "Simone Fontecchio", team: "Heat", status: "Out", reason: "Groin" },
      { player: "Nikola Jovic", team: "Heat", status: "Out", reason: "Back" },
      { player: "Norman Powell", team: "Heat", status: "Out", reason: "Groin" },
      { player: "Terry Rozier", team: "Heat", status: "Out", reason: "Not Injury Related" },
      { player: "Tidjane Salaun", team: "Hornets", status: "Out", reason: "Calf" },
    ],
  },
  {
    id: "props", label: "Prop Finder", icon: "◎",
    description: "Surface player prop edges backed by market movement.",
    players: [
      {
        name: "Karl-Anthony Towns",
        game: "New York Knicks @ Denver Nuggets",
        marketCount: 4,
        markets: [
          {
            stat: "PTS", line: 17.5, books: ["BetO", "Csr", "FD"],
            over:  [{ odds: -127, best: true }, { odds: -134, best: false }, { odds: -132, best: false }],
            under: [{ odds: -102, best: false }, { odds: +100, best: true }, { odds: +100, best: true }],
          },
          {
            stat: "REB", line: 11.5, books: ["BetO", "Csr", "FD"],
            over:  [{ odds: -118, best: true }, { odds: -122, best: false }, { odds: -125, best: false }],
            under: [{ odds: -110, best: false }, { odds: -108, best: false }, { odds: -106, best: true }],
          },
        ],
      },
      {
        name: "Jalen Brunson",
        game: "New York Knicks @ Denver Nuggets",
        marketCount: 3,
        markets: [
          {
            stat: "PTS", line: 24.5, books: ["BetO", "Csr", "FD"],
            over:  [{ odds: -115, best: true }, { odds: -125, best: false }, { odds: -120, best: false }],
            under: [{ odds: -105, best: false }, { odds: +105, best: true }, { odds: +100, best: false }],
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
          No login wall. No bait and switch. Explore the actual product.
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
            <span>Spread: -181 / +181</span>
            <span>Total: -100 / +100</span>
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
                    <span style={{ background: "rgba(0,200,255,0.15)", color: COLORS.accent, padding: "3px 8px", borderRadius: 4, fontWeight: 600 }}>{book.awayML}</span>
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

// ─── COMMUNITY / SOCIAL PROOF ─────────────────────
const AVATAR_COLORS = ["#00c8ff", "#7b5cff", "#5b8cff", "#22c55e", "#ffaa22", "#ff6b9d"];

const avatarColor = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

const COMMUNITY_ACTIVITY = [
  { user: "mikey_clv", action: "beat the close by 14¢ on Knicks +3.5", tag: "CLV", tagColor: "#22c55e", time: "just now" },
  { user: "SharpSarah", action: "logged Over 228.5 (-105) at DraftKings", tag: "TRACKED", tagColor: "#00c8ff", time: "1m ago" },
  { user: "props_paul", action: "found a +3.1% edge on Brunson O 24.5 PTS", tag: "EDGE", tagColor: "#7b5cff", time: "2m ago" },
  { user: "BankrollBen", action: "is up +8.4u over his last 47 bets", tag: "STREAK", tagColor: "#ffaa22", time: "4m ago" },
  { user: "underdog_amy", action: "grabbed Heat ML +240 before the move to +215", tag: "CLV", tagColor: "#22c55e", time: "6m ago" },
  { user: "steamchaser", action: "caught steam on Chiefs -1.5 → -2.5", tag: "STEAM", tagColor: "#ff4466", time: "8m ago" },
  { user: "TJ_fades", action: "faded the public on Celtics -6", tag: "TRACKED", tagColor: "#00c8ff", time: "11m ago" },
  { user: "linewatcher", action: "flagged a reverse line move on Knicks +2 → +3", tag: "EDGE", tagColor: "#7b5cff", time: "13m ago" },
  { user: "CLV_Carl", action: "closed the week +2.2¢ avg vs close", tag: "CLV", tagColor: "#22c55e", time: "15m ago" },
  { user: "NightCapNick", action: "logged Maxey O 5.5 AST (-110) at BetMGM", tag: "TRACKED", tagColor: "#00c8ff", time: "18m ago" },
];

const COMMUNITY_STATS = [
  ["Active members", "2,300+"],
  ["Bets tracked / mo", "12,400+"],
  ["Avg CLV beat", "+1.8¢"],
  ["Edges flagged daily", "150+"],
];

const TESTIMONIALS = [
  {
    name: "Marcus T.",
    handle: "@mikey_clv",
    role: "NBA grinder · Member since 2024",
    metric: "CLV +2.3¢ avg",
    quote: "I stopped checking five apps before every bet. The board shows the best number instantly, and my closing line value went positive within a month.",
  },
  {
    name: "Sarah K.",
    handle: "@SharpSarah",
    role: "Props specialist · Member since 2023",
    metric: "+11.2% ROI",
    quote: "The prop screen pays for itself. Same line, three different prices — EdgeFinder just shows me which book is soft before the market corrects.",
  },
  {
    name: "Devon R.",
    handle: "@BankrollBen",
    role: "Multi-sport · Member since 2024",
    metric: "+8.4u tracked",
    quote: "The tracker forced me to be honest about my results. Turns out my NBA sides were carrying everything — now I size accordingly.",
  },
];

function AvatarBadge({ user, size = 28 }) {
  const color = avatarColor(user);
  return (
    <span style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: `${color}1f`, border: `1px solid ${color}55`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'JetBrains Mono', monospace", fontSize: size * 0.36,
      fontWeight: 700, color, textTransform: "uppercase", letterSpacing: 0.5,
    }}>{user.replace(/[^a-zA-Z]/g, "").slice(0, 2)}</span>
  );
}

function CommunityProof() {
  const [visible, setVisible] = useState(false);
  const [feedIndex, setFeedIndex] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setFeedIndex((prev) => prev + 1);
    }, 3200);
    return () => clearInterval(interval);
  }, [visible]);

  const FEED_SIZE = 5;
  const feedItems = Array.from({ length: FEED_SIZE }, (_, i) => {
    const idx = feedIndex + i;
    return { ...COMMUNITY_ACTIVITY[idx % COMMUNITY_ACTIVITY.length], key: idx };
  });

  return (
    <section className="welcome-section" ref={ref} style={{ padding: "80px 0" }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: 4, textTransform: "uppercase",
          background: COLORS.gradientText, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          display: "block", marginBottom: 16,
        }}>The Community</span>
        <h2 style={{
          fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(28px, 4vw, 42px)",
          fontWeight: 600, color: COLORS.text, margin: "0 0 8px 0", lineHeight: 1.2,
        }}>
          Sharp bettors don't bet alone.
        </h2>
        <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, color: COLORS.textMuted, margin: 0 }}>
          See what members choose to share from the board.
        </p>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8, marginTop: 14,
          padding: "6px 14px", borderRadius: 100,
          border: `1px solid ${COLORS.border}`, background: "rgba(21, 27, 37, 0.56)",
        }}>
          <span style={{ color: "#22c55e", fontSize: 11 }}>✓</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: COLORS.textMuted }}>
            Opt-in only · Sharing is off by default
          </span>
        </div>
      </div>

      {/* ── Community stats row ── */}
      <div className="community-stats" style={{
        display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10,
        maxWidth: 920, margin: "0 auto 28px",
        opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: "all 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
      }}>
        {COMMUNITY_STATS.map(([label, value]) => (
          <div key={label} style={{
            minHeight: 74, padding: "12px 14px",
            border: `1px solid ${COLORS.border}`, borderRadius: 8,
            background: "rgba(21, 27, 37, 0.56)",
          }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1.2 }}>{label}</div>
            <div style={{ marginTop: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 18, color: COLORS.text, fontWeight: 800 }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="community-grid" style={{
        display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.1fr)", gap: 24,
        maxWidth: 920, margin: "0 auto", alignItems: "start",
      }}>
        {/* ── Live member activity feed ── */}
        <div style={{
          background: COLORS.surface, border: `1px solid ${COLORS.border}`,
          borderRadius: 16, overflow: "hidden",
          opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(24px)",
          transition: "all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.15s",
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 18px", borderBottom: `1px solid ${COLORS.border}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                width: 7, height: 7, borderRadius: "50%", background: COLORS.accent,
                boxShadow: `0 0 10px ${COLORS.accent}`, animation: "pulse 2s ease-in-out infinite",
              }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: COLORS.accent }}>
                Member Activity
              </span>
            </div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: COLORS.textDim, letterSpacing: 1, textTransform: "uppercase" }}>Live</span>
          </div>
          <div style={{ padding: "8px 0" }}>
            {feedItems.map((item, i) => (
              <div key={item.key} className="community-feed-row" style={{
                display: "flex", alignItems: "center", gap: 12, minWidth: 0,
                padding: "11px 18px",
                borderBottom: i < feedItems.length - 1 ? `1px solid ${COLORS.border}55` : "none",
                animation: i === 0 ? "feedIn 0.45s cubic-bezier(0.16, 1, 0.3, 1)" : "none",
              }}>
                <AvatarBadge user={item.user} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: COLORS.text, lineHeight: 1.45, overflowWrap: "anywhere" }}>
                    <span style={{ color: avatarColor(item.user), fontWeight: 700 }}>{item.user}</span>
                    {" "}{item.action}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: 1, fontWeight: 700,
                      textTransform: "uppercase", background: `${item.tagColor}15`, color: item.tagColor,
                      padding: "2px 7px", borderRadius: 4,
                    }}>{item.tag}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: COLORS.textDim }}>{item.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{
            padding: "12px 18px", borderTop: `1px solid ${COLORS.border}`,
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: COLORS.textDim,
            letterSpacing: 1, textTransform: "uppercase",
          }}>
            Sample feed · members pick a handle and opt in to appear here
          </div>
        </div>

        {/* ── Member testimonials ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {TESTIMONIALS.map((t, i) => (
            <div key={t.handle} style={{
              background: COLORS.surface, border: `1px solid ${COLORS.border}`,
              borderRadius: 16, padding: "20px 22px",
              opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(24px)",
              transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${0.25 + i * 0.12}s`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <AvatarBadge user={t.handle.slice(1)} size={36} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: COLORS.text }}>{t.name}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: avatarColor(t.handle.slice(1)) }}>{t.handle}</span>
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: COLORS.textDim, marginTop: 3, letterSpacing: 0.5 }}>{t.role}</div>
                </div>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700,
                  background: "rgba(34,197,94,0.12)", color: "#22c55e",
                  padding: "4px 10px", borderRadius: 100, whiteSpace: "nowrap", flexShrink: 0,
                }}>{t.metric}</span>
              </div>
              <p style={{
                margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 14,
                color: COLORS.textMuted, lineHeight: 1.6,
              }}>
                “{t.quote}”
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── MAIN APP ─────────────────────────────────────
export default function EdgeFinderSections() {
  const [signInOpen, setSignInOpen] = useState(false);

  return (
    <div className="welcome-shell" style={{
      background: COLORS.bg, minHeight: "100vh",
      padding: "0 clamp(20px, 4vw, 48px)", fontFamily: "'Space Grotesk', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-12px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes feedIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        html { scroll-behavior: smooth; }
        * { box-sizing: border-box; }
        body { margin: 0; background: ${COLORS.bg}; }
        ::-webkit-scrollbar { height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 4px; }
        input::placeholder { color: ${COLORS.textDim}; }

        @media (max-width: 640px) {
          .welcome-shell {
            width: min(100%, 390px) !important;
            padding-left: max(14px, env(safe-area-inset-left, 0px)) !important;
            padding-right: max(14px, env(safe-area-inset-right, 0px)) !important;
            overflow-x: hidden;
          }

          .welcome-header {
            padding-top: calc(14px + env(safe-area-inset-top, 0px)) !important;
            padding-bottom: 16px !important;
            gap: 12px;
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

          .community-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .community-grid {
            grid-template-columns: 1fr !important;
            gap: 14px !important;
          }

          .community-feed-row {
            padding: 10px 14px !important;
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

      <SignInPopup open={signInOpen} onClose={() => setSignInOpen(false)} />

      <header className="welcome-header" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "24px 0", borderBottom: `1px solid ${COLORS.border}`, marginBottom: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 28, height: 28, borderRadius: 7, background: COLORS.gradient,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700, color: "#fff",
          }}>E</span>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: COLORS.text, letterSpacing: -0.5 }}>EdgeFinder</span>
        </div>
        <button onClick={() => setSignInOpen(true)} style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: 1,
          padding: "8px 20px", borderRadius: 8, border: "none",
          background: COLORS.gradient, color: "#fff", cursor: "pointer", fontWeight: 600,
          boxShadow: `0 0 20px rgba(0,200,255,0.1)`,
        }}>Sign In</button>
      </header>

      <HeroSection onSignIn={() => setSignInOpen(true)} />
      <QualifierBlock />
      <div style={{ height: 1, background: COLORS.border, margin: "0 -48px" }} />
      <LiveSignalStrip />
      <div style={{ height: 1, background: COLORS.border, margin: "0 -48px" }} />
      <div id="preview">
        <FeaturePreview />
      </div>
      <div style={{ height: 1, background: COLORS.border, margin: "0 -48px" }} />
      <CommunityProof />

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
        <button onClick={() => setSignInOpen(true)} style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 14, letterSpacing: 1,
          padding: "14px 36px", borderRadius: 10, border: "none",
          background: COLORS.gradient, color: "#fff", cursor: "pointer", fontWeight: 600,
          boxShadow: `0 0 30px rgba(0,200,255,0.15)`,
        }}>Create Free Account</button>
      </section>
    </div>
  );
}
