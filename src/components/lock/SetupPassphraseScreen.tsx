import { useState, type FormEvent } from 'react';
import { isSyncConfigured } from '../../sync/client';
import { useAppStore } from '../../store/useAppStore';
import RestoreFromSyncForm from './RestoreFromSyncForm';
import FieldError, { useFieldError } from '../common/FieldError';
import PassphraseInput from '../common/PassphraseInput';

export default function SetupPassphraseScreen() {
  const setupPassphrase = useAppStore((s) => s.setupPassphrase);
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const { error, fail, clear, invalid } = useFieldError();
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);

  if (restoring) return <RestoreFromSyncForm onCancel={() => setRestoring(false)} />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (passphrase.length < 8) {
      fail('setup-passphrase', 'Passphrase must be at least 8 characters.');
      return;
    }
    if (passphrase !== confirm) {
      fail('setup-confirm', 'Passphrases do not match.');
      return;
    }
    clear();
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
        <PassphraseInput
          id="setup-passphrase" {...invalid('setup-passphrase')}
          autoComplete="new-password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
        />
        <FieldError error={error} field="setup-passphrase" />
        <label htmlFor="setup-confirm">Confirm passphrase</label>
        <PassphraseInput
          id="setup-confirm" {...invalid('setup-confirm')}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <FieldError error={error} field="setup-confirm" />
        <button type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create passphrase'}
        </button>
        {isSyncConfigured() && (
          <button type="button" className="secondary" onClick={() => setRestoring(true)}>
            Restore from another device
          </button>
        )}
      </form>
    </div>
  );
}
