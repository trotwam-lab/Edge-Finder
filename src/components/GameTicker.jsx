import React, { useMemo } from 'react';
import { Trophy, Radio, CalendarClock } from 'lucide-react';
import { getSportVisual } from '../utils/team-logos.js';
import { buildFeaturedEvents, getGameStatus, formatStartTime } from '../utils/live-status.js';

// Compact status pill text for a ticker row.
function rowStatus(status, commence) {
  if (status.isLive) return status.detail || 'LIVE';
  if (status.isFinal) return 'Final';
  return formatStartTime(commence);
}

function TickerChip({ entry, onSelect }) {
  const { game, status, marquee } = entry;
  const visual = getSportVisual(game.sport_key);
  const live = status.isLive;
  return (
    <button
      onClick={() => onSelect?.(game)}
      title={`${game.away_team} @ ${game.home_team}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        padding: '6px 12px', margin: '0 4px', flexShrink: 0,
        background: 'rgba(15,23,42,0.7)', border: `1px solid ${live ? 'rgba(239,68,68,0.4)' : 'rgba(71,85,105,0.3)'}`,
        borderLeft: `3px solid ${visual.color}`, borderRadius: '8px',
        cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
      }}
    >
      <span style={{ fontSize: '13px' }} aria-hidden="true">{visual.icon}</span>
      {marquee?.isFeatured && (
        <span style={{
          fontSize: '8px', fontWeight: 800, letterSpacing: '0.04em', padding: '1px 5px',
          borderRadius: '4px', background: 'rgba(250,204,21,0.16)', color: '#fde047',
        }}>{marquee.label}</span>
      )}
      <span style={{ fontSize: '11px', fontWeight: 700, color: '#e2e8f0' }}>
        {game.liveStatus?.awayAbbr || game.away_team?.split(' ').pop()} @ {game.liveStatus?.homeAbbr || game.home_team?.split(' ').pop()}
      </span>
      {live ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 800, color: '#ef4444' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', animation: 'efPulse 1.4s ease-in-out infinite' }} />
          {(status.awayScore != null && status.homeScore != null) ? `${status.awayScore}-${status.homeScore}` : 'LIVE'}
          <span style={{ color: '#fca5a5', fontWeight: 700 }}>{status.detail || ''}</span>
        </span>
      ) : (
        <span style={{ fontSize: '10px', color: status.isFinal ? '#94a3b8' : '#5eead4', fontWeight: 700 }}>
          {rowStatus(status, game.commence_time)}
        </span>
      )}
    </button>
  );
}

export default function GameTicker({ games = [], onSelect }) {
  const featured = useMemo(() => buildFeaturedEvents(games, { maxTicker: 14 }), [games]);
  const { gameOfDay, ticker, liveCount } = featured;

  if (!gameOfDay && (!ticker || ticker.length === 0)) return null;

  const gd = gameOfDay;
  const gdStatus = gd ? getGameStatus(gd.game) : null;
  const gdVisual = gd ? getSportVisual(gd.game.sport_key) : null;
  const isMarquee = gd?.marquee?.isFeatured;

  return (
    <section
      aria-label="Featured games and live ticker"
      style={{
        marginBottom: '14px', borderRadius: '14px', overflow: 'hidden',
        border: `1px solid ${isMarquee ? 'rgba(250,204,21,0.35)' : 'rgba(71,85,105,0.3)'}`,
        background: isMarquee
          ? 'linear-gradient(135deg, rgba(250,204,21,0.10), rgba(99,102,241,0.08))'
          : 'rgba(15,23,42,0.6)',
      }}
    >
      {/* Game of the Day banner */}
      {gd && (
        <button
          onClick={() => onSelect?.(gd.game)}
          style={{
            display: 'flex', alignItems: 'center', gap: '14px', width: '100%', textAlign: 'left',
            padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: '1px solid rgba(71,85,105,0.25)', fontFamily: 'inherit',
          }}
        >
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            width: 46, height: 46, borderRadius: '12px', flexShrink: 0,
            background: isMarquee ? 'rgba(250,204,21,0.16)' : 'rgba(99,102,241,0.14)',
          }}>
            {isMarquee
              ? <Trophy size={22} color="#fde047" />
              : gdStatus?.isLive ? <Radio size={20} color="#ef4444" /> : <CalendarClock size={20} color="#818cf8" />}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '9px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: isMarquee ? '#fde047' : '#818cf8',
              }}>
                {isMarquee ? `${gd.marquee.label} · Game of the Day` : 'Game of the Day'}
              </span>
              <span style={{ fontSize: '10px' }} aria-hidden="true">{gdVisual.icon}</span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: gdVisual.color }}>{gdVisual.short}</span>
            </div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {gd.game.away_team} <span style={{ color: '#64748b', fontWeight: 500 }}>@</span> {gd.game.home_team}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {gdStatus?.isLive ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#ef4444', fontWeight: 800 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', animation: 'efPulse 1.4s ease-in-out infinite' }} />
                  LIVE
                  {(gdStatus.awayScore != null && gdStatus.homeScore != null) && (
                    <span style={{ color: '#f8fafc' }}>{gdStatus.awayScore}–{gdStatus.homeScore}</span>
                  )}
                  {gdStatus.detail && <span style={{ color: '#fca5a5', fontWeight: 700 }}>· {gdStatus.detail}</span>}
                </span>
              ) : gdStatus?.isFinal ? (
                <span style={{ fontWeight: 700, color: '#94a3b8' }}>
                  Final{gdStatus.awayScore != null && gdStatus.homeScore != null ? ` · ${gdStatus.awayScore}–${gdStatus.homeScore}` : ''}
                </span>
              ) : (
                <span style={{ fontWeight: 700, color: '#5eead4' }}>{formatStartTime(gd.game.commence_time)}</span>
              )}
              {gd.game.liveStatus?.broadcast && <span>· {gd.game.liveStatus.broadcast}</span>}
              {gd.game.liveStatus?.venue && <span style={{ color: '#64748b' }}>· {gd.game.liveStatus.venue}</span>}
            </div>
          </div>
        </button>
      )}

      {/* Scrolling ticker of live + upcoming games */}
      {ticker.length > 0 && (
        <div style={{ position: 'relative', overflow: 'hidden', padding: '8px 0' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '0 12px 6px', marginBottom: '2px',
          }}>
            <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#64748b' }}>
              {liveCount > 0 ? `${liveCount} live now` : 'Upcoming'} · tap to open
            </span>
          </div>
          <div className="ef-ticker-track ef-ticker-scroll" style={{ willChange: 'transform' }}>
            {[0, 1].map((dup) => (
              <div key={dup} className="ef-ticker-track" aria-hidden={dup === 1} style={{ paddingLeft: dup === 0 ? '8px' : 0 }}>
                {ticker.map((entry) => (
                  <TickerChip key={`${dup}-${entry.game.id}`} entry={entry} onSelect={onSelect} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
