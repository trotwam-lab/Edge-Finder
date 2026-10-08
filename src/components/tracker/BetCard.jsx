// One row in the bet tracker: the bet, its trust label (verified or
// self-reported), timing/CLV details, settle buttons and the timing editor.
import React, { useState } from 'react';
import { Trash2, Clock, Edit3, Check } from 'lucide-react';
import {
  calculateCLV, formatMoney, formatOdds, formatPoint, getBetPoint, getPointCLV, gradeLineTiming, gradeTiming,
} from '../../utils/bets.js';
import { closingEvPct } from '../../utils/ledger.js';
import { cardStyle, inputStyle } from './styles.js';

// Trust label for a tracker row. "Verified" comes only from the server
// ledger (never from fields on the bet, which the user can edit).
function VerificationBadge({ bet, verified }) {
  const chip = (label, color, title) => (
    <span title={title} style={{
      fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 700,
      background: `${color}22`, color, display: 'inline-flex', alignItems: 'center', gap: '3px',
    }}>{label}</span>
  );
  if (verified) {
    if (verified.voided) return chip('VOIDED', '#94a3b8', 'Voided before kick-off. The void is part of your verified record.');
    return chip('✓ VERIFIED', '#22c55e', `Recorded by the server ${new Date(verified.recordedAt).toLocaleString()} at ${formatOdds(verified.odds)} (${verified.bookTitle}). Entry #${verified.seq}.`);
  }
  const v = bet.verification;
  if (v?.status === 'verifying' || v?.status === 'retry') return chip('VERIFYING…', '#38bdf8', 'Checking this bet against the live market.');
  if (v?.status === 'rejected') return chip('NOT VERIFIED', '#f59e0b', v.message || 'This bet could not be verified.');
  if (v?.status === 'failed') return chip('NOT VERIFIED', '#f59e0b', v.message || 'The verification service was unreachable.');
  return chip('SELF-REPORTED', '#64748b', 'Entered by you and not verified by the server. Only bets logged from the board before kick-off can be verified.');
}

export default function BetCard({ bet, verified, onSettle, onDelete, onSetTimingOdds, isPending }) {
  const statusColors = {
    pending: '#f59e0b', won: '#22c55e', lost: '#ef4444', push: '#64748b',
  };

  const [editingTiming, setEditingTiming] = useState(false);
  const [openDraft, setOpenDraft] = useState(bet.openingOdds ?? '');
  const [closeDraft, setCloseDraft] = useState(bet.closingOdds ?? '');
  const [openPointDraft, setOpenPointDraft] = useState(bet.openingPoint ?? getBetPoint(bet) ?? '');
  const [closePointDraft, setClosePointDraft] = useState(bet.closingPoint ?? '');

  const clv = calculateCLV(bet.odds, bet.closingOdds);
  const pointClv = getPointCLV(bet);
  const grade = pointClv != null ? gradeLineTiming(pointClv) : gradeTiming(clv);
  const hasTiming = bet.openingOdds != null || bet.closingOdds != null || bet.openingPoint != null || bet.closingPoint != null || getBetPoint(bet) != null;

  function saveTiming() {
    onSetTimingOdds?.(bet.id, {
      openingOdds: openDraft === '' ? null : openDraft,
      closingOdds: closeDraft === '' ? null : closeDraft,
      openingPoint: openPointDraft === '' ? null : openPointDraft,
      closingPoint: closePointDraft === '' ? null : closePointDraft,
    });
    setEditingTiming(false);
  }

  return (
    <div style={{ ...cardStyle, padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>{bet.game}</span>
            <span style={{
              fontSize: '10px', padding: '2px 6px',
              background: 'rgba(99, 102, 241, 0.15)', borderRadius: '4px', color: '#818cf8',
            }}>{bet.type}</span>
            {(pointClv != null || clv != null) && (
              <span style={{
                fontSize: '10px', padding: '2px 6px', borderRadius: '4px',
                background: grade.bg, color: grade.color, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', gap: '3px',
              }}>
                <Clock size={9} />
                {pointClv != null
                  ? `${grade.label} ${pointClv >= 0 ? '+' : ''}${pointClv.toFixed(2)} pts`
                  : `${grade.label} ${clv >= 0 ? '+' : ''}${clv.toFixed(2)}%`}
              </span>
            )}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
            {bet.pick} @ {formatOdds(bet.odds)} • ${bet.wager}
          </div>
          {Array.isArray(bet.legs) && bet.legs.length > 0 && (
            <div style={{ marginTop: '4px', display: 'grid', gap: '2px' }}>
              {bet.legs.map((leg, i) => {
                const legResult = verified?.derived?.legGrades?.[i]?.result;
                return (
                  <div key={i} style={{ fontSize: '11px', color: '#94a3b8' }}>
                    • {leg.label} <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#a5b4fc' }}>{formatOdds(leg.odds)}</span>
                    {leg.game && leg.game !== leg.label ? <span style={{ color: '#64748b' }}> · {leg.game}</span> : null}
                    {legResult && <span style={{ fontSize: '9px', fontWeight: 800, marginLeft: '6px', color: statusColors[legResult] || '#94a3b8' }}>{legResult.toUpperCase()}</span>}
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginTop: '4px' }}>
            <VerificationBadge bet={bet} verified={verified} />
            {verified && !verified.voided && closingEvPct(verified) != null && (
              <span style={{ fontSize: '10px', color: closingEvPct(verified) > 0 ? '#22c55e' : '#f87171' }} title="Value of your recorded price against the no-vig market consensus at kick-off">
                CLV vs market close {closingEvPct(verified) > 0 ? '+' : ''}{closingEvPct(verified).toFixed(1)}%
              </span>
            )}
            {bet.gradedBy === 'auto' && (
              <span style={{ fontSize: '10px', color: '#64748b' }} title="Graded automatically from the final score">
                Auto-graded{bet.gradeDetail ? ` · ${bet.gradeDetail}` : ''}
              </span>
            )}
            {bet.verification?.status === 'rejected' && bet.verification.message && (
              <span style={{ fontSize: '10px', color: '#f59e0b' }}>{bet.verification.message}</span>
            )}
          </div>
          {hasTiming && !editingTiming && (
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {getBetPoint(bet) != null && <span>Bet line: {formatPoint(getBetPoint(bet))}</span>}
              {bet.closingPoint != null && <span>Close line: {formatPoint(bet.closingPoint)}</span>}
              {bet.openingOdds != null && <span>Open: {formatOdds(bet.openingOdds)}</span>}
              {bet.closingOdds != null && <span>Close: {formatOdds(bet.closingOdds)}</span>}
              {clv != null && pointClv != null && <span>Price CLV: {clv >= 0 ? '+' : ''}{clv.toFixed(2)}%</span>}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {isPending ? (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => onSettle(bet.id, 'won')} style={{
                padding: '6px 12px', background: 'rgba(34, 197, 94, 0.2)',
                border: '1px solid rgba(34, 197, 94, 0.5)', borderRadius: '6px',
                color: '#22c55e', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
              }}>Won</button>
              <button onClick={() => onSettle(bet.id, 'lost')} style={{
                padding: '6px 12px', background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: '6px',
                color: '#ef4444', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
              }}>Lost</button>
              <button onClick={() => onSettle(bet.id, 'push')} style={{
                padding: '6px 12px', background: 'rgba(100, 116, 139, 0.2)',
                border: '1px solid rgba(100, 116, 139, 0.5)', borderRadius: '6px',
                color: '#64748b', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
              }}>Push</button>
            </div>
          ) : (
            <div>
              <div style={{
                fontSize: '12px', fontWeight: 700,
                color: bet.profit >= 0 ? '#22c55e' : '#ef4444',
              }}>
                {formatMoney(bet.profit)}
              </div>
              <div style={{
                fontSize: '10px', padding: '2px 6px',
                background: `rgba(${bet.status === 'won' ? '34, 197, 94' : bet.status === 'lost' ? '239, 68, 68' : '100, 116, 139'}, 0.15)`,
                borderRadius: '4px', color: statusColors[bet.status], display: 'inline-block',
              }}>
                {bet.status.toUpperCase()}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          {onSetTimingOdds && (
            <button
              onClick={() => setEditingTiming(v => !v)}
              title="Edit opening/closing odds for CLV tracking"
              style={{
                padding: '6px', background: editingTiming ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                border: 'none', borderRadius: '4px',
                color: editingTiming ? '#818cf8' : '#64748b', cursor: 'pointer',
              }}>
              <Edit3 size={14} />
            </button>
          )}
          <button onClick={() => onDelete(bet.id)} style={{
            padding: '6px', background: 'transparent', border: 'none',
            color: '#64748b', cursor: 'pointer',
          }}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {editingTiming && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          marginTop: '10px', paddingTop: '10px',
          borderTop: '1px solid rgba(71, 85, 105, 0.2)',
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Bet Line</label>
            <input
              type="number" value={openPointDraft} onChange={(e) => setOpenPointDraft(e.target.value)}
              placeholder="-3.5"
              style={{ ...inputStyle, width: '80px', padding: '6px 8px', fontSize: '12px' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Close Line</label>
            <input
              type="number" value={closePointDraft} onChange={(e) => setClosePointDraft(e.target.value)}
              placeholder="-5"
              style={{ ...inputStyle, width: '80px', padding: '6px 8px', fontSize: '12px' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Open Odds</label>
            <input
              type="number" value={openDraft} onChange={(e) => setOpenDraft(e.target.value)}
              placeholder="-105"
              style={{ ...inputStyle, width: '80px', padding: '6px 8px', fontSize: '12px' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Close Odds</label>
            <input
              type="number" value={closeDraft} onChange={(e) => setCloseDraft(e.target.value)}
              placeholder="-115"
              style={{ ...inputStyle, width: '80px', padding: '6px 8px', fontSize: '12px' }}
            />
          </div>
          <button onClick={saveTiming} style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '6px 10px',
            background: 'rgba(34, 197, 94, 0.2)',
            border: '1px solid rgba(34, 197, 94, 0.5)', borderRadius: '6px',
            color: '#22c55e', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
          }}>
            <Check size={12} /> Save
          </button>
          <button onClick={() => {
            setEditingTiming(false);
            setOpenDraft(bet.openingOdds ?? '');
            setCloseDraft(bet.closingOdds ?? '');
            setOpenPointDraft(bet.openingPoint ?? getBetPoint(bet) ?? '');
            setClosePointDraft(bet.closingPoint ?? '');
          }} style={{
            padding: '6px 10px', background: 'transparent',
            border: '1px solid rgba(71, 85, 105, 0.3)', borderRadius: '6px',
            color: '#94a3b8', fontSize: '11px', cursor: 'pointer',
          }}>Cancel</button>
        </div>
      )}
    </div>
  );
}
