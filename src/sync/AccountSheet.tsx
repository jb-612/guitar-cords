/** Account: sign in to sync songs and My chords across devices, see sync status, sign out. */
import { useState, type FormEvent } from 'react';
import { SheetHeader } from '../components/Sheet';
import type { SyncApi } from './useSync';
import '../song/HitSheet.css';
import './AccountSheet.css';

const STATUS_TEXT: Record<string, string> = {
  local: 'Saved on this device',
  'signed-out': 'Saved on this device — sign in to sync',
  syncing: 'Syncing…',
  synced: 'Synced',
  offline: 'Offline — changes are kept and will sync when you are back online',
  error: 'Sync problem',
};

export const statusText = (status: string) => STATUS_TEXT[status] ?? status;

export function AccountSheet({ sync, onClose }: { sync: SyncApi; onClose: () => void }) {
  return (
    <div className="account">
      <SheetHeader title="Account" onClose={onClose} />
      {!sync.configured ? <NotConfigured /> : sync.user ? <SignedIn sync={sync} /> : <SignInForm sync={sync} />}
      {sync.error && (
        <p className="account-error" role="alert">
          {sync.error}
        </p>
      )}
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="hit-section account-text">
      <p>
        <strong>Cloud sync isn't set up yet.</strong> Your songs are saved on this device.
      </p>
      <p>
        To sync across devices, create a Firebase project (Authentication: Email/Password and Google; Firestore), then copy its web app config into{' '}
        <code>.env.local</code> (see <code>.env.example</code>): <code>VITE_FIREBASE_API_KEY</code>, <code>VITE_FIREBASE_AUTH_DOMAIN</code>,{' '}
        <code>VITE_FIREBASE_PROJECT_ID</code>, <code>VITE_FIREBASE_APP_ID</code> and the rest, and restart the app.
      </p>
    </div>
  );
}

function SignedIn({ sync }: { sync: SyncApi }) {
  return (
    <div className="hit-section account-text">
      <p className="signed-in-as">Signed in as {sync.user!.email ?? sync.user!.name}</p>
      <p className={`sync-status is-${sync.status}`}>{statusText(sync.status)}</p>
      <div className="hit-actions">
        <button type="button" className="btn ghost" onClick={() => void sync.signOut()}>
          Sign out
        </button>
      </div>
    </div>
  );
}

function SignInForm({ sync }: { sync: SyncApi }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const submit = (create: boolean) => (e?: FormEvent) => {
    e?.preventDefault();
    void sync.signInWithEmail(email.trim(), password, create);
  };
  return (
    <form className="account-form" onSubmit={submit(false)}>
      <p className="hit-section account-text">Sign in to keep your songs and chords in sync on all your devices.</p>
      <div className="hit-actions">
        <button type="button" className="btn ghost" onClick={() => void sync.signInWithGoogle()}>
          Continue with Google
        </button>
      </div>
      <label className="hit-section">
        <span className="section-label">Email</span>
        <input className="text-input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="hit-section">
        <span className="section-label">Password</span>
        <input className="text-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <div className="hit-actions">
        <button type="submit" className="btn primary" disabled={!email || !password}>
          Sign in
        </button>
        <button type="button" className="btn ghost" disabled={!email || !password} onClick={submit(true)}>
          Create account
        </button>
      </div>
    </form>
  );
}
