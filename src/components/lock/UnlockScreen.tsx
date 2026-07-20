import { useState, type FormEvent } from 'react';
import { Lock } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export default function UnlockScreen() {
  const unlock = useAppStore((s) => s.unlock);
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const ok = await unlock(passphrase);
      if (!ok) {
        setError('Wrong passphrase.');
        setPassphrase('');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lock-screen">
      <span className="lock-mark" aria-hidden="true">
        <Lock size={28} strokeWidth={1.75} />
      </span>
      <h1>Unlock</h1>
      <form onSubmit={onSubmit}>
        <label htmlFor="unlock-passphrase">Passphrase</label>
        <input
          id="unlock-passphrase"
          type="password"
          autoComplete="current-password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
        />
        {error && <p className="form-error">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Unlocking…' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}
