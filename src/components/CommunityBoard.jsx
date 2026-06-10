import React, { useEffect, useMemo, useState } from 'react';
import { Radio, Eye } from 'lucide-react';
import { BOOKMAKERS } from '../constants.js';

const AVATAR_COLORS = ['#2dd4bf', '#818cf8', '#38bdf8', '#22c55e', '#fbbf24', '#f472b6'];

const avatarColor = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

const initials = (name) => (name.replace(/[^a-zA-Z]/g, '').slice(0, 2) || '??').toUpperCase();

// Demo members shown while the community grows. Real member activity is
// appended client-side from the user's own tracked bets when sharing is on.
const SAMPLE_FEED = [
  { user: 'mikey_clv', action: 'beat the close by 14¢ on Knicks +3.5', tag: 'CLV', tagColor: '#22c55e', time: 'just now' },
  { user: 'SharpSarah', action: 'logged Over 228.5 (-105) at DraftKings', tag: 'TRACKED', tagColor: '#38bdf8', time: '1m ago' },
  { user: 'props_paul', action: 'found a +3.1% edge on Brunson O 24.5 PTS', tag: 'EDGE', tagColor: '#818cf8', time: '2m ago' },
  { user: 'BankrollBen', action: 'is up +8.4u over his last 47 bets', tag: 'STREAK', tagColor: '#fbbf24', time: '4m ago' },
  { user: 'underdog_amy', action: 'grabbed Heat ML +240 before the move to +215', tag: 'CLV', tagColor: '#22c55e', time: '6m ago' },
  { user: 'steamchaser', action: 'caught steam on Chiefs -1.5 → -2.5', tag: 'STEAM', tagColor: '#ef4444', time: '8m ago' },
  { user: 'TJ_fades', action: 'faded the public on Celtics -6', tag: 'TRACKED', tagColor: '#38bdf8', time: '11m ago' },
  { user: 'linewatcher', action: 'flagged a reverse line move on Knicks +2 → +3', tag: 'EDGE', tagColor: '#818cf8', time: '13m ago' },
  { user: 'CLV_Carl', action: 'closed the week +2.2¢ avg vs close', tag: 'CLV', tagColor: '#22c55e', time: '15m ago' },
  { user: 'NightCapNick', action: 'logged Maxey O 5.5 AST (-110) at BetMGM', tag: 'TRACKED', tagColor: '#38bdf8', time: '18m ago' },
];

const STATUS_STYLES = {
  pending: { label: 'PENDING', color: '#fbbf24' },
  won: { label: 'WON', color: '#22c55e' },
  lost: { label: 'LOST', color: '#ef4444' },
  push: { label: 'PUSH', color: '#94a3b8' },
};

const cardStyle = {
  padding: '16px',
  background: 'rgba(30,41,59,0.6)',
  border: '1px solid rgba(71,85,105,0.2)',
  borderRadius: '12px',
  marginBottom: '12px',
};

function Avatar({ name, size = 30 }) {
  const color = avatarColor(name);
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `${color}1f`, border: `1px solid ${color}55`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '"JetBrains Mono", monospace', fontSize: size * 0.36,
      fontWeight: 700, color, letterSpacing: 0.5,
    }}>{initials(name)}</span>
  );
}

function formatOdds(odds) {
  if (odds == null || odds === '' || isNaN(Number(odds))) return '';
  const n = Number(odds);
  return n > 0 ? `+${n}` : `${n}`;
}

// Reads the user's tracked bets straight from the tracker's localStorage
// cache. Only market-level fields are surfaced — never wager or profit.
function loadOwnBets() {
  try {
    const raw = localStorage.getItem('edgefinder_bets');
    const bets = JSON.parse(raw);
    if (!Array.isArray(bets)) return [];
    return bets
      .filter(b => b && !b.deleted && (b.pick || b.game))
      .sort((a, b) => (b.id || 0) - (a.id || 0))
      .slice(0, 8);
  } catch {
    return [];
  }
}

export default function CommunityBoard({ shareActivity, setShareActivity, communityHandle, setCommunityHandle }) {
  const [ownBets, setOwnBets] = useState([]);
  const [draftHandle, setDraftHandle] = useState(communityHandle);
  const [feedOffset, setFeedOffset] = useState(0);

  useEffect(() => {
    if (shareActivity) setOwnBets(loadOwnBets());
  }, [shareActivity]);

  // Gentle rotation so the board feels live without being distracting
  useEffect(() => {
    const interval = setInterval(() => setFeedOffset(prev => prev + 1), 6000);
    return () => clearInterval(interval);
  }, []);

  const feed = useMemo(
    () => Array.from({ length: SAMPLE_FEED.length }, (_, i) => SAMPLE_FEED[(feedOffset + i) % SAMPLE_FEED.length]),
    [feedOffset]
  );

  const handleJoin = () => {
    const clean = draftHandle.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20);
    if (!clean) return;
    setCommunityHandle(clean);
    setDraftHandle(clean);
    setShareActivity(true);
  };

  return (
    <main className="edge-app-main" style={{ maxWidth: '760px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>Community Board</h2>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '3px 10px', borderRadius: '100px',
          background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.3)',
        }}>
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%', background: '#2dd4bf',
            boxShadow: '0 0 8px #2dd4bf', animation: 'pulse 2s ease-in-out infinite',
          }} />
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', letterSpacing: '1.5px', color: '#2dd4bf' }}>LIVE</span>
        </span>
      </div>

      {/* ── Opt-in / status panel ── */}
      {!shareActivity ? (
        <div style={{ ...cardStyle, border: '1px solid rgba(45,212,191,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <Eye size={16} color="#94a3b8" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginBottom: '4px' }}>You're browsing anonymously</div>
              <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.6, marginBottom: '12px' }}>
                Pick a handle to share your tracked bets on the board. Only the market and line are shown — never your stake, bankroll, or email. You can stop sharing any time.
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={draftHandle}
                  onChange={(e) => setDraftHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20))}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleJoin(); }}
                  placeholder="pick a handle"
                  style={{
                    flex: '1 1 160px', maxWidth: '220px', padding: '8px 12px', borderRadius: '6px',
                    border: '1px solid rgba(71,85,105,0.4)', background: 'rgba(15,23,42,0.7)',
                    color: '#e2e8f0', fontSize: '12px', fontFamily: '"JetBrains Mono", monospace', outline: 'none',
                  }}
                />
                <button
                  onClick={handleJoin}
                  disabled={!draftHandle}
                  style={{
                    padding: '8px 16px', borderRadius: '6px',
                    background: draftHandle ? 'rgba(45,212,191,0.18)' : 'rgba(30,41,59,0.4)',
                    border: draftHandle ? '1px solid rgba(45,212,191,0.42)' : '1px solid rgba(71,85,105,0.3)',
                    color: draftHandle ? '#5eead4' : '#475569', fontSize: '11px', fontWeight: 700,
                    cursor: draftHandle ? 'pointer' : 'not-allowed', fontFamily: '"JetBrains Mono", monospace',
                  }}
                >Join The Board</button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ ...cardStyle, border: '1px solid rgba(34,197,94,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <Avatar name={communityHandle || 'me'} />
            <div style={{ flex: 1, minWidth: '160px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>
                You're on the board as <span style={{ color: avatarColor(communityHandle || 'me'), fontFamily: '"JetBrains Mono", monospace' }}>@{communityHandle || '—'}</span>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Your tracked bets appear below. Stop sharing any time.</div>
            </div>
            <button
              onClick={() => setShareActivity(false)}
              style={{
                padding: '6px 14px', borderRadius: '6px',
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)',
                color: '#f87171', fontSize: '11px', cursor: 'pointer', fontFamily: '"JetBrains Mono", monospace',
              }}
            >Stop Sharing</button>
          </div>
        </div>
      )}

      {/* ── Your shared activity ── */}
      {shareActivity && (
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderBottom: '1px solid rgba(71,85,105,0.2)',
          }}>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', letterSpacing: '1.5px', color: '#5eead4' }}>YOUR SHARED ACTIVITY</span>
            <span style={{ fontSize: '10px', color: '#475569' }}>{ownBets.length} shared</span>
          </div>
          {ownBets.length === 0 ? (
            <div style={{ padding: '20px 16px', fontSize: '12px', color: '#64748b' }}>
              No tracked bets yet — log a bet in the Tracker and it will show up here under your handle.
            </div>
          ) : ownBets.map((bet, i) => {
            const status = STATUS_STYLES[bet.status] || STATUS_STYLES.pending;
            return (
              <div key={bet.id || i} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '11px 16px',
                borderBottom: i < ownBets.length - 1 ? '1px solid rgba(71,85,105,0.12)' : 'none',
              }}>
                <Avatar name={communityHandle || 'me'} size={26} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', color: '#e2e8f0', overflowWrap: 'anywhere' }}>
                    <span style={{ color: avatarColor(communityHandle || 'me'), fontWeight: 700 }}>{communityHandle}</span>
                    {' '}tracked {bet.pick || bet.game}{bet.odds != null && bet.odds !== '' ? ` (${formatOdds(bet.odds)})` : ''}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px', flexWrap: 'wrap' }}>
                    <span style={{
                      fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', fontWeight: 700, letterSpacing: '1px',
                      background: `${status.color}1a`, color: status.color, padding: '2px 7px', borderRadius: '4px',
                    }}>{status.label}</span>
                    {bet.type && <span style={{ fontSize: '10px', color: '#64748b' }}>{bet.type}</span>}
                    {bet.book && BOOKMAKERS[bet.book] && <span style={{ fontSize: '10px', color: '#64748b' }}>· {BOOKMAKERS[bet.book]}</span>}
                    {bet.date && <span style={{ fontSize: '10px', color: '#475569' }}>· {bet.date}</span>}
                  </div>
                </div>
                <span style={{
                  fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', fontWeight: 800, letterSpacing: '1px',
                  background: 'rgba(45,212,191,0.12)', color: '#5eead4', padding: '2px 6px', borderRadius: '4px', flexShrink: 0,
                }}>YOU</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Member feed ── */}
      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '12px 16px', borderBottom: '1px solid rgba(71,85,105,0.2)',
        }}>
          <Radio size={13} color="#2dd4bf" />
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', letterSpacing: '1.5px', color: '#94a3b8' }}>MEMBER FEED</span>
        </div>
        {feed.map((item, i) => (
          <div key={`${item.user}-${i}`} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '11px 16px',
            borderBottom: i < feed.length - 1 ? '1px solid rgba(71,85,105,0.12)' : 'none',
          }}>
            <Avatar name={item.user} size={26} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', color: '#e2e8f0', overflowWrap: 'anywhere' }}>
                <span style={{ color: avatarColor(item.user), fontWeight: 700 }}>{item.user}</span>
                {' '}{item.action}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                <span style={{
                  fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', fontWeight: 700, letterSpacing: '1px',
                  background: `${item.tagColor}1a`, color: item.tagColor, padding: '2px 7px', borderRadius: '4px',
                }}>{item.tag}</span>
                <span style={{ fontSize: '10px', color: '#475569' }}>{item.time}</span>
              </div>
            </div>
          </div>
        ))}
        <div style={{
          padding: '10px 16px', borderTop: '1px solid rgba(71,85,105,0.2)',
          fontSize: '10px', color: '#475569', lineHeight: 1.6,
        }}>
          Demo members shown while the community grows — the feed fills in as more members opt in to share.
        </div>
      </div>
    </main>
  );
}
