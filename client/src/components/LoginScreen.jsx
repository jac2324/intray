import React, { useState } from 'react';
import { Lock, Loader2 } from 'lucide-react';

// Normally the server itself gates page loads and serves a plain login page
// before the SPA is ever sent (see server/src/auth.js), so this component
// only comes into play if a session cookie expires while the app is already
// open in the tab — a mutation comes back 401 and we need to re-prompt
// without a full page reload.
export default function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      await onLogin(password);
    } catch (e) {
      setError('Incorrect password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gtd-app center-screen">
      <div className="card" style={{ width: 320, maxWidth: '90%' }}>
        <div className="row" style={{ gap: 8, marginBottom: 4 }}>
          <Lock size={16} color="var(--indigo)" />
          <div className="gtd-title" style={{ fontSize: 19 }}>Sign in to Intray</div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '8px 0 14px' }}>
          Your session expired. Enter your password to continue.
        </div>
        <input
          type="password"
          className="text-input"
          style={{ width: '100%', marginBottom: 8 }}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          autoFocus
        />
        {error && <div style={{ fontSize: 12, color: 'var(--rust)', marginBottom: 8 }}>{error}</div>}
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={submit} disabled={busy}>
          {busy ? <Loader2 size={14} className="spin" /> : 'Sign in'}
        </button>
      </div>
    </div>
  );
}
