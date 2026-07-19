import { useState, type FormEvent } from 'react';
import { signIn, signOut, signUp } from '../../sync/auth';
import { isSyncConfigured } from '../../sync/client';
import { useAppStore } from '../../store/useAppStore';

export default function SyncSection() {
  const syncEmail = useAppStore((s) => s.syncEmail);
  const syncStatus = useAppStore((s) => s.syncStatus);
  const lastSyncedAt = useAppStore((s) => s.lastSyncedAt);
  const refreshSyncEmail = useAppStore((s) => s.refreshSyncEmail);
  const runSync = useAppStore((s) => s.runSync);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isSyncConfigured()) {
    return (
      <>
        <h3 className="section-title">Sync</h3>
        <p className="muted">Sync isn’t configured on this build.</p>
      </>
    );
  }

  async function authenticate(mode: 'in' | 'up', e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === 'up') {
        await signUp(email, password);
        setNotice('Account created. If email confirmation is on, confirm then sign in.');
      } else {
        await signIn(email, password);
      }
      await refreshSyncEmail();
      if (useAppStore.getState().syncEmail) {
        setPassword('');
        await runSync();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  async function onSignOut() {
    await signOut();
    await refreshSyncEmail();
  }

  return (
    <>
      <h3 className="section-title">Sync</h3>
      {syncEmail ? (
        <div className="sync-status">
          <p className="muted">
            Signed in as <strong>{syncEmail}</strong>.
          </p>
          <p className="muted">
            {syncStatus === 'syncing'
              ? 'Syncing…'
              : syncStatus === 'error'
                ? 'Last sync failed — will retry.'
                : lastSyncedAt
                  ? `Last synced ${new Date(lastSyncedAt).toLocaleTimeString()}.`
                  : 'Not synced yet.'}
          </p>
          <div className="backup-actions">
            <button onClick={() => void runSync()} disabled={syncStatus === 'syncing'}>
              Sync now
            </button>
            <button className="secondary" onClick={() => void onSignOut()}>
              Sign out
            </button>
          </div>
        </div>
      ) : (
        <form className="panel-form" onSubmit={(e) => authenticate('in', e)}>
          <p className="muted">
            Sign in to sync your encrypted vault across devices. Your vault
            passphrase is separate and never leaves this device.
          </p>
          <label htmlFor="sync-email">Email</label>
          <input id="sync-email" type="email" autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)} />
          <label htmlFor="sync-password">Account password</label>
          <input id="sync-password" type="password" autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="form-error">{error}</p>}
          {notice && <p className="muted">{notice}</p>}
          <div className="backup-actions">
            <button type="submit" disabled={busy}>Sign in</button>
            <button type="button" className="secondary" disabled={busy}
              onClick={(e) => void authenticate('up', e)}>
              Create account
            </button>
          </div>
        </form>
      )}
    </>
  );
}
