import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { downloadBackup } from '../../lib/backupFile';
import StarterPicker from './StarterPicker';

type Step = 'accounts' | 'categories' | 'backup';

/** One-time first-run wizard: seed starter accounts/categories, then prompt a backup. */
export default function StarterSetupScreen() {
  const finishOnboarding = useAppStore((s) => s.finishOnboarding);
  const [step, setStep] = useState<Step>('accounts');
  const [exported, setExported] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onExport() {
    setBusy(true);
    try {
      await downloadBackup();
      setExported(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lock-screen onboarding">
      <header className="onboarding-head">
        <h1>Welcome to Budget Tracker</h1>
        <p className="muted">
          Everything stays on this device, encrypted with your passphrase. Add a
          few starters to get going — skip anything and add your own anytime.
        </p>
      </header>

      {step === 'accounts' && (
        <StarterPicker kind="accounts" onDone={() => setStep('categories')} />
      )}
      {step === 'categories' && (
        <StarterPicker kind="categories" onDone={() => setStep('backup')} />
      )}
      {step === 'backup' && (
        <section className="panel-form">
          <h2>Keep your data safe</h2>
          <p className="lock-warning">
            Your passphrase is never stored — if you forget it, or clear this
            browser, your data can't be recovered. Save a backup file somewhere
            safe, and turn on sync later if you want a second copy.
          </p>
          <div className="form-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => void onExport()}
              disabled={busy}
            >
              {busy ? 'Exporting…' : exported ? 'Backup saved ✓' : 'Export backup now'}
            </button>
            <button type="button" onClick={finishOnboarding}>
              Finish setup
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
