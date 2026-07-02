import React, { useMemo, useState } from 'react';
import { Scale, ShieldCheck } from 'lucide-react';
import { useAuth } from '../AuthGate.jsx';
import ProBanner from './ProBanner.jsx';
import { americanToDecimal, formatOdds } from '../utils/odds-math.js';

// Arbitrage & Low-Hold Scanner — Pro tool.
// Scans every game already on the board for outcome sets where taking the
// best available price on each side at different books adds up to less than
// 100% implied probability (a guaranteed profit) or just above it (a
// near-free "low hold" market, ideal for promo conversion). Stake splits are
// computed so each outcome returns the same amount.

const MARKET_LABELS = { h2h: 'Moneyline', spreads: 'Spread', totals: 'Total' };

// A real arb is sum < 1. We also surface "low hold" markets up to this
// threshold because they are the industry-standard way to convert bonuses
// with minimal loss.
const LOW_HOLD_THRESHOLD = 1.015;

function bestPricesForOutcomeSet(game, marketKey) {
  // Group outcomes by a key that makes the set complementary:
  //  - h2h: all outcomes in the market (2-way, or 3-way with Draw)
  //  - spreads: the absolute point (home -3.5 pairs with away +3.5)
  //  - totals: the point (Over 210.5 pairs with Under 210.5)
  const groups = new Map();
  (game.bookmakers || []).forEach(book => {
    const market = book.markets?.find(m => m.key === marketKey);
    if (!market?.outcomes?.length) return;
    market.outcomes.forEach(outcome => {
      if (outcome.price == null) return;
      let groupKey = 'default';
      if (marketKey === 'spreads') {
        if (outcome.point == null) return;
        groupKey = Math.abs(outcome.point).toString();
      } else if (marketKey === 'totals') {
        if (outcome.point == null) return;
        groupKey = outcome.point.toString();
      }
      if (!groups.has(groupKey)) groups.set(groupKey, new Map());
      const outcomes = groups.get(groupKey);
      const outcomeKey = marketKey === 'spreads' ? `${outcome.name} ${outcome.point > 0 ? '+' : ''}${outcome.point}` : outcome.name;
      const existing = outcomes.get(outcomeKey);
      if (!existing || outcome.price > existing.price) {
        outcomes.set(outcomeKey, {
          name: outcomeKey,
          price: outcome.price,
          book: book.title || book.key,
        });
      }
    });
  });
  return groups;
}

function scanGame(game) {
  const found = [];
  ['h2h', 'spreads', 'totals'].forEach(marketKey => {
    const groups = bestPricesForOutcomeSet(game, marketKey);
    groups.forEach(outcomes => {
      const sides = Array.from(outcomes.values());
      // Complementary sets only: 2 sides, or 3 for soccer moneylines.
      if (sides.length < 2 || sides.length > 3) return;
      if (marketKey !== 'h2h' && sides.length !== 2) return;
      // The sides must come from at least 2 books for this to be executable.
      const bookSet = new Set(sides.map(s => s.book));
      const implied = sides.reduce((sum, s) => sum + 1 / americanToDecimal(s.price), 0);
      if (implied >= LOW_HOLD_THRESHOLD) return;
      found.push({
        gameId: game.id,
        matchup: `${game.away_team} @ ${game.home_team}`,
        sport: game.sport_title || game.sport_key,
        market: MARKET_LABELS[marketKey],
        sides,
        implied,
        roi: (1 / implied - 1) * 100,
        isArb: implied < 1,
        multiBook: bookSet.size > 1,
      });
    });
  });
  return found;
}

function StakeSplit({ opportunity, totalStake }) {
  const total = parseFloat(totalStake);
  if (!Number.isFinite(total) || total <= 0) return null;
  const guaranteed = total / opportunity.implied;
  return (
    <div style={{ marginTop: '10px', display: 'grid', gap: '4px' }}>
      {opportunity.sides.map(side => {
        const imp = 1 / americanToDecimal(side.price);
        const stake = total * (imp / opportunity.implied);
        return (
          <div key={side.name} className="ef-mono" style={{ fontSize: '11px', color: 'var(--ef-text-muted)', display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
            <span>${stake.toFixed(2)} on {side.name} {formatOdds(side.price)} at {side.book}</span>
            <span style={{ color: 'var(--ef-text-dim)' }}>returns ${guaranteed.toFixed(2)}</span>
          </div>
        );
      })}
      <div className="ef-mono" style={{
        fontSize: '11px', fontWeight: 700, marginTop: '2px',
        color: opportunity.isArb ? 'var(--ef-green)' : 'var(--ef-amber)',
      }}>
        {opportunity.isArb
          ? `Locked profit: $${(guaranteed - total).toFixed(2)} no matter the result`
          : `Worst case: -$${(total - guaranteed).toFixed(2)} (${((1 - 1 / opportunity.implied) * 100).toFixed(2)}% hold)`}
      </div>
    </div>
  );
}

export default function ArbitrageScanner({ games = [] }) {
  const { tier } = useAuth();
  const [stake, setStake] = useState('100');

  const opportunities = useMemo(() => {
    return games
      .flatMap(scanGame)
      .filter(op => op.multiBook)
      .sort((a, b) => b.roi - a.roi)
      .slice(0, 12);
  }, [games]);

  if (tier !== 'pro') {
    return (
      <div style={{ padding: '16px', display: 'grid', gap: '14px' }}>
        <div style={{ color: 'var(--ef-text-muted)', fontSize: '12px', lineHeight: 1.6 }}>
          The scanner watches every market on the board and flags outcome pairs where the best prices at
          two different books add up to a guaranteed profit — or a near-zero hold for converting promos.
          Stake splits are computed for you.
        </div>
        <ProBanner />
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', display: 'grid', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ color: 'var(--ef-text-muted)', fontSize: '12px', lineHeight: 1.6, maxWidth: '560px' }}>
          Best price on each side, always at different books. <strong style={{ color: 'var(--ef-green)' }}>ARB</strong> locks
          a profit at any result; <strong style={{ color: 'var(--ef-amber)' }}>LOW HOLD</strong> is a near-free market —
          the cheapest way to work through deposit promos.
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--ef-text-muted)' }}>
          Total stake $
          <input
            type="text"
            inputMode="decimal"
            value={stake}
            onChange={e => setStake(e.target.value.replace(/[^0-9.]/g, ''))}
            style={{
              width: '90px', padding: '8px 10px', borderRadius: '8px',
              border: '1px solid var(--ef-border-strong)', background: 'rgba(7,11,20,0.7)',
              color: 'var(--ef-text)', fontSize: '13px', fontFamily: 'var(--ef-font-mono)', outline: 'none',
            }}
          />
        </label>
      </div>

      {opportunities.length === 0 ? (
        <div style={{ padding: '18px 4px', color: 'var(--ef-text-dim)', fontSize: '12px', lineHeight: 1.6 }}>
          No arbitrage or low-hold markets on the current board. That&apos;s normal — true arbs are rare and
          close fast. The scanner re-checks automatically every time odds refresh, so leave this open on
          busy slates (line moves near tip-off are when books disagree most).
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '10px' }}>
          {opportunities.map((op, idx) => (
            <div key={`${op.gameId}-${op.market}-${idx}`} style={{
              padding: '14px',
              borderRadius: 'var(--ef-radius)',
              border: `1px solid ${op.isArb ? 'rgba(34,197,94,0.35)' : 'var(--ef-border)'}`,
              background: op.isArb ? 'rgba(34,197,94,0.06)' : 'var(--ef-surface)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ef-text)' }}>{op.matchup}</div>
                  <div style={{ fontSize: '11px', color: 'var(--ef-text-dim)', marginTop: '2px' }}>{op.sport} · {op.market}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    fontSize: '10px', fontWeight: 800, letterSpacing: '0.06em',
                    padding: '4px 9px', borderRadius: '6px',
                    background: op.isArb ? 'var(--ef-green-soft)' : 'var(--ef-amber-soft)',
                    color: op.isArb ? 'var(--ef-green)' : 'var(--ef-amber)',
                  }}>
                    {op.isArb ? <ShieldCheck size={11} /> : <Scale size={11} />}
                    {op.isArb ? 'ARB' : 'LOW HOLD'}
                  </span>
                  <span className="ef-mono" style={{
                    fontSize: '15px', fontWeight: 800,
                    color: op.isArb ? 'var(--ef-green)' : 'var(--ef-amber)',
                  }}>
                    {op.isArb ? '+' : ''}{op.roi.toFixed(2)}%
                  </span>
                </div>
              </div>
              <StakeSplit opportunity={op} totalStake={stake} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
