import { useState, type ChangeEvent } from 'react';
import { exportBackup, importBackup } from '../../db/repo';
import { useAppStore } from '../../store/useAppStore';

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

  async function onSave() {
    await saveSettings({
      currencySymbol: symbol.trim() || '₱',
      currencyCode: code.trim() || 'PHP',
      autoLockMinutes: Math.max(1, Number(autoLock) || 5),
    });
    setSaved(true);
  }

  function onExport() {
    void exportBackup().then((json) => {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `budget-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
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

      <h3 className="section-title">Currency</h3>
      <label htmlFor="set-symbol">Currency symbol</label>
      <input id="set-symbol" value={symbol} onChange={(e) => { setSymbol(e.target.value); setSaved(false); }} />
      <label htmlFor="set-code">Currency code</label>
      <input id="set-code" value={code} onChange={(e) => { setCode(e.target.value); setSaved(false); }} />

      <h3 className="section-title">Security</h3>
      <label htmlFor="set-autolock">Auto-lock after (minutes)</label>
      <input
        id="set-autolock"
        inputMode="numeric"
        value={autoLock}
        onChange={(e) => { setAutoLock(e.target.value); setSaved(false); }}
      />

      <div className="form-actions">
        <button onClick={() => void onSave()}>Save settings</button>
        {saved && <span className="muted">Settings saved.</span>}
      </div>

      <h3 className="section-title">Backup</h3>
      <p className="muted">
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
    </section>
  );
}
