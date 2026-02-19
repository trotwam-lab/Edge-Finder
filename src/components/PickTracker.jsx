// PickTracker.jsx — Pro pick performance tracker
// Shows historical pick results with W/L record, ROI, streaks, and profit chart
// Uses Firebase to store/retrieve pick history

import React, { useState, useEffect, useMemo } from 'react';
import {
  Trophy, XCircle, TrendingUp, Target, BarChart3,
  Lock, Clock, Flame, ChevronDown, ChevronUp, Pencil, Save, X
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine
} from 'recharts';
import { useAuth } from '../AuthGate.jsx';
import ProBanner from './ProBanner.jsx';
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.js';

// ── Styles ─────────────────────────────────────────────────────────────────

const cardStyle = {
  padding: '16px',
  background: 'rgba(30, 41, 59, 0.6)',
  border: '1px solid rgba(71, 85, 105, 0.2)',
  borderRadius: '12px',
};

const statBoxStyle = {
  padding: '14px',
  background: 'rgba(15, 23, 42, 0.5)',
  borderRadius: '10px',
  textAlign: 'center',
};

// ── Component ──────────────────────────────────────────────────────────────

export default function PickTracker() {
  const { user, tier } = useAuth();
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedPick, setExpandedPick] = useState(null);
  const [filterResult, setFilterResult] = useState('ALL'); // ALL, WIN, LOSS, PUSH
  const [editingPick, setEditingPick] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  // Edit handlers
  const startEdit = (pick) => {
    setEditingPick(pick.id);
    setEditForm({
      game: pick.game || '',
      edge: pick.edge || pick.pick || '',
      odds: pick.odds || '',
      stake: pick.stake || '',
      book: pick.book || '',
      sport: pick.sport || '',
      confidence: pick.confidence || '',
      notes: pick.notes || '',
    });
  };

  const cancelEdit = () => {
    setEditingPick(null);
    setEditForm({});
  };

  const saveEdit = async (pickId) => {
    setSaving(true);
    try {
      const updatedFields = {};
      if (editForm.game) updatedFields.game = editForm.game;
      if (editForm.edge) { updatedFields.edge = editForm.edge; updatedFields.pick = editForm.edge; }
      if (editForm.odds !== '') updatedFields.odds = parseFloat(editForm.odds) || 0;
      if (editForm.stake !== '') updatedFields.stake = parseFloat(editForm.stake) || 0;
      if (editForm.book) updatedFields.book = editForm.book;
      if (editForm.sport) updatedFields.sport = editForm.sport;
      updatedFields.confidence = editForm.confidence;
      updatedFields.notes = editForm.notes;
      await updateDoc(doc(db, 'picks', pickId), updatedFields);
      setEditingPick(null);
      setEditForm({});
    } catch (err) {
      console.error('Error updating pick:', err);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Subscribe to Firebase picks collection
  useEffect(() => {
    if (tier !== 'pro' || !user) {
      setLoading(false);
      return;
    }

    const picksRef = collection(db, 'picks');
    const q = query(picksRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pickData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPicks(pickData);
      setLoading(false);
    }, (err) => {
      console.error('Picks subscription error:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tier, user]);

  // ── Computed Stats ─────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const settled = picks.filter(p => p.result && p.result !== 'PENDING');
    const wins = settled.filter(p => p.result === 'WIN');
    const losses = settled.filter(p => p.result === 'LOSS');
    const pushes = settled.filter(p => p.result === 'PUSH');

    const totalWagered = settled.reduce((sum, p) => sum + (p.stake || 0), 0);
    const totalProfit = settled.reduce((sum, p) => sum + (p.profit || 0), 0);
    const roi = totalWagered > 0 ? (totalProfit / totalWagered) * 100 : 0;

    // Streak calculation
    let currentStreak = 0;
    let streakType = null;
    for (const pick of settled) {
      if (pick.result === 'PUSH') continue;
      if (!streakType) {
        streakType = pick.result;
        currentStreak = 1;
      } else if (pick.result === streakType) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Longest win streak
    let longestWin = 0;
    let tempStreak = 0;
    for (const pick of [...settled].reverse()) {
      if (pick.result === 'WIN') {
        tempStreak++;
        longestWin = Math.max(longestWin, tempStreak);
      } else if (pick.result !== 'PUSH') {
        tempStreak = 0;
      }
    }

    // Profit over time for chart
    const profitData = [];
    let runningProfit = 0;
    const chronological = [...settled].reverse();
    chronological.forEach((pick, i) => {
      runningProfit += pick.profit || 0;
      profitData.push({
        pick: i + 1,
        profit: parseFloat(runningProfit.toFixed(2)),
        label: pick.game || `Pick ${i + 1}`,
      });
    });

    return {
      total: settled.length,
      wins: wins.length,
      losses: losses.length,
      pushes: pushes.length,
      winRate: settled.length > 0 ? ((wins.length / (settled.length - pushes.length)) * 100) : 0,
      totalProfit,
      roi,
      currentStreak,
      streakType,
      longestWin,
      profitData,
      pending: picks.filter(p => !p.result || p.result === 'PENDING').length,
    };
  }, [picks]);

  // Filtered picks
  const filteredPicks = useMemo(() => {
    if (filterResult === 'ALL') return picks;
    if (filterResult === 'PENDING') return picks.filter(p => !p.result || p.result === 'PENDING');
    return picks.filter(p => p.result === filterResult);
  }, [picks, filterResult]);

  // ── Free user gate ─────────────────────────────────────────────────────

  if (tier !== 'pro') {
    return (
      <div style={{ padding: '20px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '56px', height: '56px', margin: '0 auto 16px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2))',
            borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Lock size={28} color="#818cf8" />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#f8fafc', marginBottom: '8px' }}>
            Pick Tracker
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '360px', margin: '0 auto', lineHeight: '1.6' }}>
            Track expert picks with W/L records, ROI, streak tracking, and profit charts. See exactly how the picks perform over time.
          </p>
        </div>

        {/* Blurred preview */}
        <div style={{ position: 'relative', marginBottom: '24px' }}>
          <div style={{ filter: 'blur(6px)', pointerEvents: 'none', opacity: 0.5 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
              {['67-41', '+23.4%', '8W'].map((val, i) => (
                <div key={i} style={statBoxStyle}>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#22c55e' }}>{val}</div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>{['Record', 'ROI', 'Streak'][i]}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={40} color="#818cf8" style={{ opacity: 0.8 }} />
          </div>
        </div>

        <ProBanner />
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px' }}>
        <Target size={36} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: '16px', color: '#94a3b8', fontSize: '13px' }}>Loading picks...</p>
      </div>
    );
  }

  // ── Main View ──────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <Target size={20} color="#818cf8" />
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>Pick Tracker</h2>
        {stats.pending > 0 && (
          <span style={{
            padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700,
            background: 'rgba(234, 179, 8, 0.2)', color: '#eab308',
          }}>
            {stats.pending} pending
          </span>
        )}
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '16px' }}>
        <div style={statBoxStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '4px' }}>
            <Trophy size={14} color="#22c55e" />
            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>RECORD</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#f8fafc' }}>
            {stats.wins}-{stats.losses}{stats.pushes > 0 ? `-${stats.pushes}` : ''}
          </div>
          <div style={{ fontSize: '11px', color: stats.winRate >= 55 ? '#22c55e' : stats.winRate >= 50 ? '#eab308' : '#f87171' }}>
            {stats.winRate.toFixed(1)}% win rate
          </div>
        </div>

        <div style={statBoxStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '4px' }}>
            <TrendingUp size={14} color={stats.roi >= 0 ? '#22c55e' : '#ef4444'} />
            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>ROI</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: stats.roi >= 0 ? '#22c55e' : '#ef4444' }}>
            {stats.roi >= 0 ? '+' : ''}{stats.roi.toFixed(1)}%
          </div>
          <div style={{ fontSize: '11px', color: stats.totalProfit >= 0 ? '#22c55e' : '#f87171' }}>
            {stats.totalProfit >= 0 ? '+' : ''}${stats.totalProfit.toFixed(2)}
          </div>
        </div>

        <div style={statBoxStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '4px' }}>
            <Flame size={14} color="#f97316" />
            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>STREAK</span>
          </div>
          <div style={{
            fontSize: '20px', fontWeight: 800,
            color: stats.streakType === 'WIN' ? '#22c55e' : stats.streakType === 'LOSS' ? '#ef4444' : '#64748b',
          }}>
            {stats.currentStreak > 0 ? `${stats.currentStreak}${stats.streakType === 'WIN' ? 'W' : 'L'}` : '—'}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            Best: {stats.longestWin}W
          </div>
        </div>

        <div style={statBoxStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '4px' }}>
            <BarChart3 size={14} color="#818cf8" />
            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>TOTAL PICKS</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#f8fafc' }}>
            {stats.total}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            {stats.pending} pending
          </div>
        </div>
      </div>

      {/* Profit Chart */}
      {stats.profitData.length >= 2 && (
        <div style={{ ...cardStyle, marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginBottom: '12px' }}>
            📈 Profit Over Time
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={stats.profitData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(71, 85, 105, 0.2)" />
              <XAxis
                dataKey="pick"
                tick={{ fill: '#64748b', fontSize: 10 }}
                axisLine={{ stroke: 'rgba(71, 85, 105, 0.3)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 10 }}
                axisLine={{ stroke: 'rgba(71, 85, 105, 0.3)' }}
                tickLine={false}
                tickFormatter={v => `$${v}`}
              />
              <ReferenceLine y={0} stroke="rgba(71, 85, 105, 0.5)" strokeDasharray="3 3" />
              <Tooltip
                contentStyle={{
                  background: 'rgba(15, 23, 42, 0.95)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(value) => [`$${value.toFixed(2)}`, 'Profit']}
                labelFormatter={(label) => `Pick #${label}`}
              />
              <Line
                type="monotone"
                dataKey="profit"
                stroke="#818cf8"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#818cf8', stroke: '#f8fafc', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {['ALL', 'WIN', 'LOSS', 'PUSH', 'PENDING'].map(f => (
          <button key={f} onClick={() => setFilterResult(f)} style={{
            padding: '6px 14px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
            background: filterResult === f ? 'rgba(99, 102, 241, 0.3)' : 'rgba(30, 41, 59, 0.4)',
            border: filterResult === f ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid rgba(71, 85, 105, 0.3)',
            color: filterResult === f ? '#f8fafc' : '#64748b',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {f}
          </button>
        ))}
      </div>

      {/* Picks list */}
      {filteredPicks.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '13px' }}>
          {picks.length === 0 ? 'No picks yet. Picks will appear here as they are published.' : 'No picks match this filter.'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredPicks.map(pick => {
          const isExpanded = expandedPick === pick.id;
          const resultColor = pick.result === 'WIN' ? '#22c55e'
            : pick.result === 'LOSS' ? '#ef4444'
            : pick.result === 'PUSH' ? '#eab308'
            : '#64748b';
          const ResultIcon = pick.result === 'WIN' ? Trophy
            : pick.result === 'LOSS' ? XCircle
            : Clock;

          return (
            <div key={pick.id} style={{
              ...cardStyle,
              cursor: 'pointer',
              borderColor: isExpanded ? 'rgba(99, 102, 241, 0.3)' : 'rgba(71, 85, 105, 0.2)',
            }} onClick={() => setExpandedPick(isExpanded ? null : pick.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <ResultIcon size={14} color={resultColor} />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
                      {pick.game || 'Unknown Game'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    {pick.edge || pick.pick || 'No description'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div>
                    <div style={{
                      fontSize: '12px', fontWeight: 700, color: resultColor,
                      padding: '2px 8px', borderRadius: '6px',
                      background: `${resultColor}20`,
                    }}>
                      {pick.result || 'PENDING'}
                    </div>
                    {pick.profit !== undefined && pick.result !== 'PENDING' && (
                      <div style={{ fontSize: '11px', color: pick.profit >= 0 ? '#22c55e' : '#ef4444', marginTop: '2px' }}>
                        {pick.profit >= 0 ? '+' : ''}${pick.profit?.toFixed(2)}
                      </div>
                    )}
                  </div>
                  {isExpanded ? <ChevronUp size={14} color="#64748b" /> : <ChevronDown size={14} color="#64748b" />}
                </div>
              </div>

              {isExpanded && (
                <div style={{
                  marginTop: '12px', paddingTop: '12px',
                  borderTop: '1px solid rgba(71, 85, 105, 0.2)',
                }}>
                  {editingPick === pick.id ? (
                    /* ── Edit Form ── */
                    <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        {[
                          { label: 'Game', key: 'game', type: 'text' },
                          { label: 'Pick / Edge', key: 'edge', type: 'text' },
                          { label: 'Odds', key: 'odds', type: 'number' },
                          { label: 'Stake ($)', key: 'stake', type: 'number' },
                          { label: 'Book', key: 'book', type: 'text' },
                          { label: 'Sport', key: 'sport', type: 'text' },
                          { label: 'Confidence', key: 'confidence', type: 'text' },
                        ].map(f => (
                          <div key={f.key}>
                            <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '3px' }}>{f.label}</label>
                            <input
                              type={f.type}
                              value={editForm[f.key] || ''}
                              onChange={e => setEditForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                              style={{
                                width: '100%', padding: '8px 10px', background: 'rgba(15, 23, 42, 0.8)',
                                border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '6px',
                                color: '#e2e8f0', fontSize: '12px', fontFamily: "'JetBrains Mono', monospace",
                                outline: 'none', boxSizing: 'border-box',
                              }}
                            />
                          </div>
                        ))}
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '3px' }}>Notes</label>
                        <textarea
                          value={editForm.notes || ''}
                          onChange={e => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                          rows={2}
                          style={{
                            width: '100%', padding: '8px 10px', background: 'rgba(15, 23, 42, 0.8)',
                            border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '6px',
                            color: '#e2e8f0', fontSize: '12px', fontFamily: "'JetBrains Mono', monospace",
                            outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => saveEdit(pick.id)}
                          disabled={saving}
                          style={{
                            padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none',
                            color: '#fff', cursor: saving ? 'wait' : 'pointer', display: 'flex',
                            alignItems: 'center', gap: '6px', fontFamily: "'JetBrains Mono', monospace",
                            opacity: saving ? 0.7 : 1,
                          }}
                        >
                          <Save size={12} /> {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={saving}
                          style={{
                            padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                            background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(71, 85, 105, 0.3)',
                            color: '#94a3b8', cursor: 'pointer', display: 'flex',
                            alignItems: 'center', gap: '6px', fontFamily: "'JetBrains Mono', monospace",
                          }}
                        >
                          <X size={12} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Normal expanded view ── */
                    <>
                      <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px',
                        fontSize: '11px', color: '#94a3b8',
                      }}>
                        {pick.sport && <div><span style={{ color: '#64748b' }}>Sport:</span> {pick.sport}</div>}
                        {pick.book && <div><span style={{ color: '#64748b' }}>Book:</span> {pick.book}</div>}
                        {pick.odds && <div><span style={{ color: '#64748b' }}>Odds:</span> {pick.odds > 0 ? '+' : ''}{pick.odds}</div>}
                        {pick.stake && <div><span style={{ color: '#64748b' }}>Stake:</span> ${pick.stake}</div>}
                        {pick.ev && <div><span style={{ color: '#64748b' }}>EV:</span> {pick.ev}</div>}
                        {pick.confidence && <div><span style={{ color: '#64748b' }}>Confidence:</span> {pick.confidence}</div>}
                        {pick.timestamp && (
                          <div style={{ gridColumn: '1 / -1' }}>
                            <span style={{ color: '#64748b' }}>Date:</span>{' '}
                            {new Date(pick.timestamp.seconds ? pick.timestamp.seconds * 1000 : pick.timestamp).toLocaleDateString()}
                          </div>
                        )}
                        {pick.notes && (
                          <div style={{ gridColumn: '1 / -1', color: '#cbd5e1', lineHeight: '1.5' }}>
                            <span style={{ color: '#64748b' }}>Notes:</span> {pick.notes}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); startEdit(pick); }}
                        style={{
                          marginTop: '10px', padding: '6px 14px', borderRadius: '6px', fontSize: '11px',
                          fontWeight: 600, background: 'rgba(99, 102, 241, 0.15)',
                          border: '1px solid rgba(99, 102, 241, 0.3)', color: '#818cf8',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        <Pencil size={12} /> Edit Pick
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
