import { useState, type FormEvent } from 'react';
import { Lock } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import FieldError, { useFieldError } from '../common/FieldError';
import PassphraseInput from '../common/PassphraseInput';

export default function UnlockScreen() {
  const unlock = useAppStore((s) => s.unlock);
  const [passphrase, setPassphrase] = useState('');
  const { error, fail, invalid } = useFieldError();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const ok = await unlock(passphrase);
      if (!ok) {
        setPassphrase('');
        fail('unlock-passphrase', 'Wrong passphrase.');
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
        <PassphraseInput
          id="unlock-passphrase" {...invalid('unlock-passphrase')}
          autoComplete="current-password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
        />
        <FieldError error={error} field="unlock-passphrase" />
        <button type="submit" disabled={busy}>
          {busy ? 'Unlocking…' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}
