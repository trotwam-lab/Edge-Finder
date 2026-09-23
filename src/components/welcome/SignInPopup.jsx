import { useState, useEffect } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification } from "firebase/auth";
import { auth } from "../../firebase";
import { LogoMark } from "../Logo.jsx";
import { COLORS } from "./theme.js";

// ─── SIGN IN POPUP ────────────────────────────────
export default function SignInPopup({ open, onClose, initialTab = "signin" }) {
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
        const credential = await createUserWithEmailAndPassword(auth, email, pass);
        // Best effort: a failed send must not block sign-up; the in-app
        // banner offers a resend.
        try { await sendEmailVerification(credential.user); } catch {}
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
