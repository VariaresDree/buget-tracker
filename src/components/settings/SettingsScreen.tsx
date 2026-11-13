import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  changePassphrase,
  importBackup,
  listAccounts,
  listCategories,
  listTransactions,
} from '../../db/repo';
import {
  downloadBackup,
  getSafetySnapshot,
  restoreSafetySnapshot,
  saveFile,
  type SafetySnapshot,
} from '../../lib/backupFile';
import { transactionsCsv } from '../../lib/exportCsv';
import { storageStatus } from '../../lib/persistence';
import { useAppStore, type Settings } from '../../store/useAppStore';
import SyncSection from './SyncSection';

/** Read a File as text; prefers Blob.text, falls back to FileReader (jsdom). */
function readText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export default function SettingsScreen() {
  const settings = useAppStore((s) => s.settings);
  const saveSettings = useAppStore((s) => s.saveSettings);
  const lockNow = useAppStore((s) => s.lockNow);

  const [symbol, setSymbol] = useState(settings.currencySymbol);
  const [code, setCode] = useState(settings.currencyCode);
  const [autoLock, setAutoLock] = useState(String(settings.autoLockMinutes));
  const [saved, setSaved] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // Change-passphrase form
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passError, setPassError] = useState<string | null>(null);
  const [passDone, setPassDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSave() {
    await saveSettings({
      currencySymbol: symbol.trim() || '₱',
      currencyCode: code.trim() || 'PHP',
      autoLockMinutes: Math.max(1, Number(autoLock) || 5),
    });
    setSaved(true);
  }

  function onExport() {
    void downloadBackup();
  }

  async function onExportCsv() {
    const [transactions, accounts, categories] = await Promise.all([
      listTransactions(),
      listAccounts(),
      listCategories(),
    ]);
    saveFile(
      'budget-transactions',
      'csv',
      transactionsCsv(transactions, accounts, categories),
      'text/csv',
    );
  }

  const lastBackupAt = useAppStore((s) => s.lastBackupAt);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [safety, setSafety] = useState<SafetySnapshot | null>(null);

  useEffect(() => {
    void storageStatus().then((s) => setPersisted(s.persisted));
    void getSafetySnapshot().then(setSafety);
  }, []);

  async function onRestoreSafety() {
    if (!safety) return;
    if (
      !window.confirm(
        'Restore the copy saved before the last sync replaced this device’s data? This replaces all current data and locks the app.',
      )
    ) {
      return;
    }
    await restoreSafetySnapshot();
  }

  async function onChangePassphrase(e: FormEvent) {
    e.preventDefault();
    setPassError(null);
    setPassDone(false);
    if (next.length < 8) {
      setPassError('New passphrase must be at least 8 characters.');
      return;
    }
    if (next !== confirm) {
      setPassError('New passphrases do not match.');
      return;
    }
    setBusy(true);
    try {
      await changePassphrase(current, next);
      setPassDone(true);
      setShowPassphrase(false);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setPassError(err instanceof Error ? err.message : 'Could not change passphrase.');
    } finally {
      setBusy(false);
    }
  }

  async function onRestore(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!window.confirm('Restoring replaces all current data and locks the app. Continue?')) return;
    try {
      await importBackup(await readText(file));
      lockNow(); // the restored keycheck belongs to the backup's passphrase
    } catch {
      setRestoreError('That file is not a valid backup.');
    }
  }

  return (
    <section className="settings">
      <h2>Settings</h2>

      <div className="settings-card">
        <h3 className="section-title">Appearance</h3>
        <label htmlFor="set-theme">Theme</label>
        <select
          id="set-theme"
          value={settings.theme}
          onChange={(e) => void saveSettings({ theme: e.target.value as Settings['theme'] })}
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>

      <div className="settings-card">
        <h3 className="section-title">Currency</h3>
        <label htmlFor="set-symbol">Currency symbol</label>
        <input id="set-symbol" value={symbol} onChange={(e) => { setSymbol(e.target.value); setSaved(false); }} />
        <label htmlFor="set-code">Currency code</label>
        <input id="set-code" value={code} onChange={(e) => { setCode(e.target.value); setSaved(false); }} />

        <label htmlFor="set-autolock">Auto-lock after (minutes)</label>
        <input
          id="set-autolock"
          inputMode="numeric"
          value={autoLock}
          onChange={(e) => { setAutoLock(e.target.value); setSaved(false); }}
        />
        <p className="helper-text">The vault locks itself after this much inactivity.</p>

        <div className="form-actions">
          <button className="btn-primary" onClick={() => void onSave()}>
            Save settings
          </button>
          {saved && <span className="muted">Settings saved.</span>}
        </div>
      </div>

      <div className="settings-card">
        <h3 className="section-title">Security</h3>
        {passDone && <p className="muted">Passphrase changed.</p>}
        {!showPassphrase ? (
          <>
            <p className="helper-text">
              Changing it re-encrypts everything on this device.
            </p>
            <div className="form-actions">
              <button
                className="secondary"
                onClick={() => { setShowPassphrase(true); setPassDone(false); }}
              >
                Change passphrase
              </button>
            </div>
          </>
        ) : (
          <form className="panel-form" onSubmit={onChangePassphrase}>
            <label htmlFor="pp-current">Current passphrase</label>
            <input id="pp-current" type="password" autoComplete="current-password"
              value={current} onChange={(e) => setCurrent(e.target.value)} />
            <label htmlFor="pp-new">New passphrase</label>
            <input id="pp-new" type="password" autoComplete="new-password"
              value={next} onChange={(e) => setNext(e.target.value)} />
            <label htmlFor="pp-confirm">Confirm new passphrase</label>
            <input id="pp-confirm" type="password" autoComplete="new-password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            {passError && <p className="form-error">{passError}</p>}
            <div className="form-actions">
              <button type="button" className="secondary" onClick={() => setShowPassphrase(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? 'Updating…' : 'Update passphrase'}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="settings-card">
        <h3 className="section-title">Backup</h3>
        <p className="helper-text">
          Your backup stays encrypted and only opens with your current passphrase.
        </p>
        <div className="backup-actions">
          <button className="secondary" onClick={onExport}>Export backup</button>
          <label htmlFor="set-restore" className="file-button">Restore from backup</label>
          <input
            id="set-restore"
            type="file"
            accept="application/json,.json"
            onChange={(e) => void onRestore(e)}
          />
        </div>
        {restoreError && <p className="form-error">{restoreError}</p>}
        <p className="helper-text">
          Last backup:{' '}
          {lastBackupAt ? new Date(lastBackupAt).toLocaleDateString() : 'never'}
          {persisted !== null && (
            <>
              {' · '}Offline storage:{' '}
              {persisted ? 'protected' : 'best-effort (the browser may clear it — keep a backup)'}
            </>
          )}
        </p>
        <div className="backup-actions">
          <button className="secondary" onClick={() => void onExportCsv()}>
            Export transactions (CSV)
          </button>
        </div>
        <p className="helper-text">
          A readable spreadsheet of every transaction. This file is not encrypted — keep it
          somewhere private.
        </p>
        {safety && (
          <div className="backup-actions">
            <button className="secondary" onClick={() => void onRestoreSafety()}>
              Restore pre-sync snapshot ({new Date(safety.at).toLocaleDateString()})
            </button>
          </div>
        )}
      </div>

      <div className="settings-card">
        <SyncSection />
      </div>
    </section>
  );
}
