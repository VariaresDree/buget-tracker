import { useState, type FormEvent } from 'react';
import { useAppStore } from '../../store/useAppStore';

export default function SetupPassphraseScreen() {
  const setupPassphrase = useAppStore((s) => s.setupPassphrase);
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (passphrase.length < 8) {
      setError('Passphrase must be at least 8 characters.');
      return;
    }
    if (passphrase !== confirm) {
      setError('Passphrases do not match.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await setupPassphrase(passphrase);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lock-screen">
      <h1>Set up your passphrase</h1>
      <p className="lock-warning">
        Your financial data is encrypted with this passphrase. It is never
        stored anywhere — if you forget it, your data cannot be recovered.
      </p>
      <form onSubmit={onSubmit}>
        <label htmlFor="setup-passphrase">Passphrase</label>
        <input
          id="setup-passphrase"
          type="password"
          autoComplete="new-password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
        />
        <label htmlFor="setup-confirm">Confirm passphrase</label>
        <input
          id="setup-confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error && <p className="form-error">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create passphrase'}
        </button>
      </form>
    </div>
  );
}
