import React, { useState, useEffect } from 'react';
import { TrendingUp, History, Activity, AlertCircle, CheckCircle, RefreshCw, BarChart3, Home, Plane, Clock, Zap, Users, Trophy } from 'lucide-react';

// Get trend color based on confidence
function getTrendColor(confidence) {
  switch (confidence) {
    case 'high': return '#22c55e';
    case 'medium': return '#eab308';
    default: return '#64748b';
  }
}

function getTrendBg(confidence) {
  switch (confidence) {
    case 'high': return 'rgba(34, 197, 94, 0.15)';
    case 'medium': return 'rgba(234, 179, 8, 0.15)';
    default: return 'rgba(100, 116, 139, 0.15)';
  }
}

// Team Stats Card Component
function TeamStatsCard({ teamData, isHome }) {
  // Handle completely missing data
  if (!teamData) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
        <AlertCircle size={28} style={{ marginBottom: '10px', opacity: 0.5 }} />
        <div style={{ fontSize: '13px', marginBottom: '4px' }}>Team data unavailable</div>
        <div style={{ fontSize: '11px', opacity: 0.7 }}>ESPN API may be temporarily down</div>
      </div>
    );
  }

  const { team, record, wins, losses, streak, homeRecord, awayRecord, restDays, stats, logo, recentGames } = teamData;
  
  // Check if we have actual game data
  const hasGameData = recentGames && recentGames.length > 0;
  const winPct = wins + losses > 0 ? (wins / (wins + losses)) : 0;
  
  return (
    <div style={{ padding: '16px' }}>
      {/* Team Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        {logo && (
          <img src={logo} alt={team} style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>{team}</div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>Season: {record || 'N/A'}</div>
        </div>
        <div style={{ 
          padding: '6px 12px', 
          borderRadius: '8px', 
          background: !hasGameData ? 'rgba(100, 116, 139, 0.2)' : winPct > 0.6 ? 'rgba(34, 197, 94, 0.2)' : winPct < 0.4 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(234, 179, 8, 0.2)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: !hasGameData ? '#64748b' : winPct > 0.6 ? '#22c55e' : winPct < 0.4 ? '#ef4444' : '#eab308' }}>
            {!hasGameData ? '—' : `${wins}-${losses}`}
          </div>
          <div style={{ fontSize: '10px', color: '#64748b' }}>Last 10</div>
        </div>
      </div>

      {/* Streak & Rest */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {streak && streak !== '-' && (
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 12px',
            borderRadius: '6px',
            background: streak.startsWith('W') ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: streak.startsWith('W') ? '#22c55e' : '#ef4444',
            fontSize: '12px',
            fontWeight: 600,
          }}>
            <Activity size={14} />
            {streak} Streak
          </div>
        )}
        {restDays !== null && (
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 12px',
            borderRadius: '6px',
            background: 'rgba(99, 102, 241, 0.15)',
            color: '#818cf8',
            fontSize: '12px',
            fontWeight: 600,
          }}>
            <Clock size={14} />
            {restDays}d Rest
          </div>
        )}
      </div>

      {/* Home/Away Splits */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '8px',
        marginBottom: '16px'
      }}>
        <div style={{ 
          padding: '10px', 
          background: 'rgba(30, 41, 59, 0.5)', 
          borderRadius: '6px',
          textAlign: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '4px' }}>
            <Home size={12} color="#64748b" />
            <span style={{ fontSize: '10px', color: '#64748b' }}>Home</span>
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>
            {homeRecord?.wins || 0}-{homeRecord?.losses || 0}
          </div>
        </div>
        <div style={{ 
          padding: '10px', 
          background: 'rgba(30, 41, 59, 0.5)', 
          borderRadius: '6px',
          textAlign: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '4px' }}>
            <Plane size={12} color="#64748b" />
            <span style={{ fontSize: '10px', color: '#64748b' }}>Away</span>
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>
            {awayRecord?.wins || 0}-{awayRecord?.losses || 0}
          </div>
        </div>
      </div>

      {/* Stats Grid - HIDDEN: Data fetching still works but display removed until stats are accurate */}
      {/* {stats && (stats.ppg || stats.papg) && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '8px',
          marginBottom: '16px'
        }}>
          {stats.ppg && (
            <div style={{ padding: '8px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: '#64748b' }}>PPG</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#22c55e' }}>{stats.ppg}</div>
            </div>
          )}
          {stats.papg && (
            <div style={{ padding: '8px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: '#64748b' }}>PAPG</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#ef4444' }}>{stats.papg}</div>
            </div>
          )}
          {stats.fgPct && (
            <div style={{ padding: '8px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: '#64748b' }}>FG%</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#818cf8' }}>{stats.fgPct}</div>
            </div>
          )}
          {stats.threePtPct && (
            <div style={{ padding: '8px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: '#64748b' }}>3P%</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#818cf8' }}>{stats.threePtPct}</div>
            </div>
          )}
        </div>
      )} */}

      {/* Recent Games */}
      <div style={{ marginTop: '12px' }}>
        <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>Last 5 Games</div>
        {!hasGameData ? (
          <div style={{ 
            padding: '12px', 
            background: 'rgba(30, 41, 59, 0.5)', 
            borderRadius: '6px',
            textAlign: 'center',
            color: '#64748b',
            fontSize: '12px'
          }}>
            No recent game data available
          </div>
        ) : (
        <div style={{ display: 'flex', gap: '4px' }}>
          {teamData.recentGames?.slice(0, 5).map((game, idx) => (
            <div
              key={idx}
              style={{
                flex: 1,
                height: '36px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                background: game.won ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: game.won ? '#22c55e' : '#ef4444',
                fontSize: '11px',
                fontWeight: 700,
              }}
              title={`${game.isHome ? 'vs' : '@'} ${game.opponentAbbr}: ${game.teamScore}-${game.opponentScore}`}
            >
              {game.won ? 'W' : 'L'}
              <span style={{ fontSize: '8px', fontWeight: 400, opacity: 0.8 }}>
                {game.isHome ? 'vs' : '@'}{game.opponentAbbr}
              </span>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}

// H2H Component
function H2H({ games, homeTeam, awayTeam }) {
  if (!games || games.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
        <History size={28} style={{ marginBottom: '10px', opacity: 0.5 }} />
        <div style={{ fontSize: '13px', marginBottom: '4px' }}>No recent matchups</div>
        <div style={{ fontSize: '11px', opacity: 0.7 }}>These teams haven't played recently</div>
      </div>
    );
  }

  // Safely get team name parts
  const homeTeamPart = homeTeam?.split(' ')?.pop() || '';
  const awayTeamPart = awayTeam?.split(' ')?.pop() || '';

  // Calculate series lead
  let homeWins = 0, awayWins = 0;
  games.forEach(g => {
    const homeScore = parseInt(g.homeScore) || 0;
    const awayScore = parseInt(g.awayScore) || 0;
    const isHomeTeam = homeTeamPart && g.homeTeam?.includes(homeTeamPart);
    if (homeScore > awayScore) {
      isHomeTeam ? homeWins++ : awayWins++;
    } else {
      isHomeTeam ? awayWins++ : homeWins++;
    }
  });

  return (
    <div style={{ padding: '16px' }}>
      {/* Series Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        gap: '16px',
        padding: '12px',
        background: 'rgba(30, 41, 59, 0.5)',
        borderRadius: '8px',
        marginBottom: '16px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc' }}>{homeWins}</div>
          <div style={{ fontSize: '10px', color: '#64748b' }}>{homeTeam?.split(' ').pop()}</div>
        </div>
        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>VS</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc' }}>{awayWins}</div>
          <div style={{ fontSize: '10px', color: '#64748b' }}>{awayTeam?.split(' ').pop()}</div>
        </div>
      </div>

      {/* Games List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {games.map((game, idx) => {
          const date = new Date(game.date);
          const homeScore = parseInt(game.homeScore) || 0;
          const awayScore = parseInt(game.awayScore) || 0;
          const homeWon = homeScore > awayScore;
          const isHomeTeam = homeTeamPart && game.homeTeam?.includes(homeTeamPart);
          
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px',
                background: 'rgba(30, 41, 59, 0.4)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#64748b', fontSize: '11px', minWidth: '60px' }}>
                  {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <span style={{ 
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 600,
                  background: isHomeTeam ? (homeWon ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)') : (homeWon ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)'),
                  color: isHomeTeam ? (homeWon ? '#22c55e' : '#ef4444') : (homeWon ? '#ef4444' : '#22c55e'),
                }}>
                  {isHomeTeam ? (homeWon ? 'W' : 'L') : (homeWon ? 'L' : 'W')}
                </span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#f8fafc', fontWeight: 500 }}>
                  {game.awayTeam?.split(' ')?.pop() || '???'}
                </span>
                <span style={{ 
                  fontFamily: 'monospace', 
                  fontWeight: 700, 
                  color: '#f8fafc',
                  background: 'rgba(15, 23, 42, 0.5)',
                  padding: '3px 8px',
                  borderRadius: '4px',
                }}>
                  {awayScore} - {homeScore}
                </span>
                <span style={{ color: '#f8fafc', fontWeight: 500 }}>
                  {game.homeTeam?.split(' ')?.pop() || '???'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Trends Component
function Trends({ trends }) {
  if (!trends || trends.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
        <TrendingUp size={28} style={{ marginBottom: '10px', opacity: 0.5 }} />
        <div style={{ fontSize: '13px', marginBottom: '4px' }}>No significant trends</div>
        <div style={{ fontSize: '11px', opacity: 0.7 }}>Check back closer to game time</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px',
        marginBottom: '16px',
        padding: '10px 14px',
        background: 'rgba(99, 102, 241, 0.1)',
        borderRadius: '8px',
      }}>
        <Zap size={16} color="#818cf8" />
        <span style={{ fontSize: '12px', color: '#818cf8', fontWeight: 600 }}>
          {trends.filter(t => t.confidence === 'high').length} High Confidence Insights
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {trends.map((trend, idx) => (
          <div
            key={idx}
            style={{
              padding: '14px',
              borderRadius: '10px',
              background: getTrendBg(trend.confidence),
              border: `1px solid ${getTrendColor(trend.confidence)}30`,
            }}
          >
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px',
              marginBottom: '6px'
            }}>
              <span style={{ fontSize: '16px' }}>{trend.icon}</span>
              <span style={{ 
                fontSize: '13px', 
                fontWeight: 700, 
                color: getTrendColor(trend.confidence),
                flex: 1,
              }}>
                {trend.label}
              </span>
              <span style={{
                fontSize: '9px',
                padding: '3px 8px',
                borderRadius: '4px',
                background: getTrendColor(trend.confidence) + '25',
                color: getTrendColor(trend.confidence),
                textTransform: 'uppercase',
                fontWeight: 700,
                letterSpacing: '0.5px',
              }}>
                {trend.confidence}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', paddingLeft: '26px' }}>
              {trend.description}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Player Props Component
function PlayerProps({ props, homeTeam, awayTeam }) {
  if (!props || props.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
        <Users size={28} style={{ marginBottom: '10px', opacity: 0.5 }} />
        <div style={{ fontSize: '13px', marginBottom: '4px' }}>No player props available</div>
        <div style={{ fontSize: '11px', opacity: 0.7 }}>Props may not be released yet for this game</div>
      </div>
    );
  }

  // Group by market type
  const marketLabels = {
    'player_points': '🏀 Points',
    'player_rebounds': '💪 Rebounds', 
    'player_assists': '🎯 Assists',
    'player_threes': '👌 3-Pointers',
    'player_passing_tds': '🏈 Passing TDs',
    'player_rushing_yards': '🏃 Rushing Yards',
    'player_receiving_yards': '✋ Receiving Yards',
  };

  const grouped = props.reduce((acc, prop) => {
    if (!acc[prop.market]) acc[prop.market] = [];
    acc[prop.market].push(prop);
    return acc;
  }, {});

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px',
        marginBottom: '16px',
        padding: '10px 14px',
        background: 'rgba(99, 102, 241, 0.1)',
        borderRadius: '8px',
      }}>
        <Trophy size={16} color="#818cf8" />
        <span style={{ fontSize: '12px', color: '#818cf8', fontWeight: 600 }}>
          {props.length} Player Props Available
        </span>
      </div>

      {Object.entries(grouped).map(([market, marketProps]) => (
        <div key={market} style={{ marginBottom: '16px' }}>
          <div style={{ 
            fontSize: '12px', 
            fontWeight: 700, 
            color: '#f8fafc',
            marginBottom: '10px',
            padding: '8px 12px',
            background: 'rgba(30, 41, 59, 0.5)',
            borderRadius: '6px',
          }}>
            {marketLabels[market] || market.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {marketProps.slice(0, 5).map((prop, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
                  background: 'rgba(30, 41, 59, 0.4)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 600, color: '#f8fafc' }}>{prop.player}</span>
                  <span style={{ color: '#64748b' }}>@{prop.line}</span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {prop.over && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ 
                        fontSize: '11px', 
                        color: '#22c55e',
                        fontWeight: 600,
                        padding: '4px 10px',
                        background: 'rgba(34, 197, 94, 0.15)',
                        borderRadius: '4px',
                      }}>
                        O {prop.over.price > 0 ? '+' : ''}{prop.over.price}
                      </div>
                      <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>{prop.over.book}</div>
                    </div>
                  )}
                  {prop.under && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ 
                        fontSize: '11px', 
                        color: '#ef4444',
                        fontWeight: 600,
                        padding: '4px 10px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        borderRadius: '4px',
                      }}>
                        U {prop.under.price > 0 ? '+' : ''}{prop.under.price}
                      </div>
                      <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>{prop.under.book}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {marketProps.length > 5 && (
              <div style={{ textAlign: 'center', padding: '8px', color: '#64748b', fontSize: '11px' }}>
                +{marketProps.length - 5} more {marketLabels[market] || market} props
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Loading State
function LoadingState() {
  return (
    <div style={{ padding: '32px', textAlign: 'center' }}>
      <div style={{ 
        width: '32px', 
        height: '32px', 
        border: '3px solid rgba(99, 102, 241, 0.2)',
        borderTop: '3px solid #6366f1',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        margin: '0 auto 16px'
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ fontSize: '13px', color: '#64748b' }}>Loading game research...</div>
    </div>
  );
}

// Error State
function ErrorState({ error, onRetry }) {
  return (
    <div style={{ padding: '24px', textAlign: 'center' }}>
      <AlertCircle size={28} color="#ef4444" style={{ marginBottom: '10px' }} />
      <div style={{ fontSize: '13px', color: '#ef4444', marginBottom: '12px' }}>
        {error || 'Failed to load data'}
      </div>
      <button
        onClick={onRetry}
        style={{
          padding: '8px 16px',
          background: 'rgba(99, 102, 241, 0.2)',
          border: '1px solid rgba(99, 102, 241, 0.5)',
          borderRadius: '6px',
          color: '#818cf8',
          fontSize: '12px',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <RefreshCw size={14} />
        Try Again
      </button>
    </div>
  );
}

// Main Component
export default function GameResearch({ gameId, sport, homeTeam, awayTeam, commenceTime }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('form');
  const [renderError, setRenderError] = useState(null);

  const fetchResearch = async () => {
    setLoading(true);
    setError(null);
    setRenderError(null);
    
    try {
      const timestamp = Date.now();
      const params = new URLSearchParams({
        gameId,
        sport,
        homeTeam,
        awayTeam,
        _t: timestamp.toString(),
      });
      if (commenceTime) params.append('commenceTime', commenceTime);
      
      const response = await fetch(`/api/game-research?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load: ${response.status}`);
      }
      
      const result = await response.json();
      setData(result);
    } catch (e) {
      console.error('Failed to fetch game research:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (gameId && homeTeam && awayTeam) {
      fetchResearch();
    }
  }, [gameId, homeTeam, awayTeam, sport]);

  // Catch any render errors
  try {
    if (loading) return <LoadingState />;
    if (error) return <ErrorState error={error} onRetry={fetchResearch} />;
    if (!data) return <ErrorState error="No data received" onRetry={fetchResearch} />;

    const hasValidData = data?.accurate;
    const trends = data?.trends || [];
    const trendCount = trends.length;
    const highConfidenceCount = data?.meta?.highConfidenceTrends || 0;

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.6)',
      borderRadius: '12px',
      border: '1px solid rgba(71, 85, 105, 0.2)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 18px',
        borderBottom: '1px solid rgba(71, 85, 105, 0.2)',
        background: 'rgba(30, 41, 59, 0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BarChart3 size={18} color="#818cf8" />
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>
            Game Research
          </span>
          {hasValidData ? (
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '10px',
              color: '#22c55e',
              padding: '3px 10px',
              background: 'rgba(34, 197, 94, 0.15)',
              borderRadius: '20px',
              fontWeight: 600,
            }}>
              <CheckCircle size={10} />
              Verified
            </span>
          ) : (
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '10px',
              color: '#64748b',
              padding: '3px 10px',
              background: 'rgba(100, 116, 139, 0.15)',
              borderRadius: '20px',
            }}>
              <AlertCircle size={10} />
              Limited
            </span>
          )}
        </div>
        
        <button
          onClick={fetchResearch}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '6px',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            borderRadius: '4px',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#818cf8'}
          onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
          title="Refresh data"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(71, 85, 105, 0.2)',
      }}>
        {[
          { key: 'form', label: 'Team Form', icon: Activity, count: (data?.meta?.homeGamesFound || 0) + (data?.meta?.awayGamesFound || 0) },
          { key: 'h2h', label: 'H2H', icon: History, count: data?.h2h?.length || 0 },
          { key: 'trends', label: 'Trends', icon: TrendingUp, count: trendCount },
        ].filter(tab => tab.count > 0 || tab.key === 'form').map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              padding: '12px 8px',
              background: activeTab === tab.key ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #6366f1' : '2px solid transparent',
              color: activeTab === tab.key ? '#818cf8' : '#64748b',
              fontSize: '12px',
              fontWeight: activeTab === tab.key ? 700 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s',
            }}
          >
            <tab.icon size={14} />
            {tab.label}
            {tab.count && (
              <span style={{
                padding: '2px 6px',
                background: activeTab === tab.key ? 'rgba(99, 102, 241, 0.2)' : 'rgba(100, 116, 139, 0.2)',
                borderRadius: '10px',
                fontSize: '10px',
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {activeTab === 'form' && (
          <div>
            <TeamStatsCard teamData={data?.teams?.home} isHome={true} />
            <div style={{ height: '1px', background: 'rgba(71, 85, 105, 0.2)' }} />
            <TeamStatsCard teamData={data?.teams?.away} isHome={false} />
          </div>
        )}
        
        {activeTab === 'h2h' && (
          <H2H 
            games={data?.h2h} 
            homeTeam={homeTeam} 
            awayTeam={awayTeam} 
          />
        )}
        
        {activeTab === 'trends' && (
          <Trends trends={data?.trends} />
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid rgba(71, 85, 105, 0.2)',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: '10px',
          color: '#64748b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '8px',
        }}>
          <span>Source: {data?.dataSource || 'Unknown'}</span>
          <span>•</span>
          <span>{data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : 'N/A'}</span>
          {data?.meta?.highConfidenceTrends > 0 && (
            <>
              <span>•</span>
              <span style={{ color: '#22c55e' }}>{data.meta.highConfidenceTrends} 🔥 trends</span>
            </>
          )}
        </div>
        
        {/* Tagline */}
        <div style={{
          fontSize: '11px',
          fontWeight: 700,
          color: '#818cf8',
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          padding: '8px 0',
          borderTop: '1px solid rgba(71, 85, 105, 0.15)',
        }}>
          <span style={{ marginRight: '6px' }}>⚡</span>
          Engineered by Pros for Pros
          <span style={{ marginLeft: '6px' }}>⚡</span>
        </div>
      </div>
    </div>
  );
  } catch (e) {
    console.error("GameResearch render error:", e);
    return (
      <div style={{ padding: "20px", textAlign: "center", color: "#ef4444" }}>
        <div style={{ fontSize: "13px" }}>Error displaying game research</div>
        <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>{e.message}</div>
      </div>
    );
  }
}
