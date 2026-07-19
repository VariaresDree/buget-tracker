import { useState, type FormEvent } from 'react';
import { useAppStore } from '../../store/useAppStore';

/** New-device onboarding: sign in and decrypt the synced vault with the passphrase. */
export default function RestoreFromSyncForm({ onCancel }: { onCancel: () => void }) {
  const restoreFromSync = useAppStore((s) => s.restoreFromSync);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await restoreFromSync(email, password, passphrase);
    } catch (err) {
      setError(
        err instanceof Error && /operationerror|decrypt/i.test(err.message)
          ? 'Wrong passphrase for this vault.'
          : err instanceof Error
            ? err.message
            : 'Could not restore.',
      );
      setBusy(false);
    }
  }

  return (
    <div className="lock-screen">
      <h1>Restore from sync</h1>
      <p className="lock-warning">
        Sign in with your sync account, then enter this vault’s passphrase to
        decrypt and restore your data onto this device.
      </p>
      <form onSubmit={onSubmit}>
        <label htmlFor="restore-email">Email</label>
        <input id="restore-email" type="email" autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="restore-password">Account password</label>
        <input id="restore-password" type="password" autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)} />
        <label htmlFor="restore-passphrase">Vault passphrase</label>
        <input id="restore-passphrase" type="password" autoComplete="off"
          value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
        {error && <p className="form-error">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Restoring…' : 'Restore'}
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Back
        </button>
      </form>
    </div>
  );
}
