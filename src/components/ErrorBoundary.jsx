import React from 'react';
import { isChunkLoadError, recoverFromStaleBuild } from '../utils/chunk-recovery.js';

// Keeps a failure in one screen from blanking the whole app. `resetKey`
// (the active tab) clears the error when the user navigates elsewhere, so a
// broken tab never traps them. A stale/missing code file self-heals with a
// one-time reload; anything else shows a retry card.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, recovering: false };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('Screen crashed:', error);
    if (isChunkLoadError(error)) {
      recoverFromStaleBuild().then(started => {
        if (started) this.setState({ recovering: true });
      });
    }
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null, recovering: false });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    const { fullScreen = false } = this.props;
    const stale = isChunkLoadError(this.state.error);
    return (
      <div role="alert" style={{
        padding: '32px 24px', textAlign: 'center', color: '#94a3b8',
        minHeight: fullScreen ? '100vh' : undefined,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px',
        background: fullScreen ? '#070b14' : undefined,
      }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
          {this.state.recovering ? 'Updating EdgeFinder…' : 'This screen hit a problem'}
        </div>
        <div style={{ fontSize: '12px', maxWidth: '320px', lineHeight: 1.5 }}>
          {stale
            ? 'A newer version is available or the connection dropped. Reload to get the latest.'
            : 'Your data is safe. Try again, or switch tabs — the rest of the app still works.'}
        </div>
        {!this.state.recovering && (
          <div style={{ display: 'flex', gap: '8px' }}>
            {!stale && (
              <button onClick={() => this.setState({ error: null })}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.2)', color: '#c7d2fe', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                Try again
              </button>
            )}
            <button onClick={() => window.location.reload()}
              style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(71,85,105,0.5)', background: 'rgba(30,41,59,0.6)', color: '#e2e8f0', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
              Reload app
            </button>
          </div>
        )}
      </div>
    );
  }
}
