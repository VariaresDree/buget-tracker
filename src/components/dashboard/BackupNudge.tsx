import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';

const STALE_MS = 14 * 24 * 60 * 60 * 1000;

/** Gentle reminder when the only copy of the data is this browser. */
export default function BackupNudge() {
  const lastBackupAt = useAppStore((s) => s.lastBackupAt);
  const syncEmail = useAppStore((s) => s.syncEmail);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const [dismissed, setDismissed] = useState(false);

  const stale = lastBackupAt === null || Date.now() - lastBackupAt > STALE_MS;
  if (dismissed || syncEmail || !stale) return null;

  return (
    <div className="backup-nudge" role="status">
      <span>
        {lastBackupAt === null
          ? 'Your data lives only in this browser. Save a backup file to keep it safe.'
          : 'It’s been over two weeks since your last backup.'}
      </span>
      <div className="backup-nudge-actions">
        <button className="secondary" onClick={() => setDismissed(true)}>
          Later
        </button>
        <button className="btn-primary" onClick={() => setActiveTab('settings')}>
          Back up
        </button>
      </div>
    </div>
  );
}
