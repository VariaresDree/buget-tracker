import { restoreSafetySnapshot } from '../../lib/backupFile';
import { useAppStore } from '../../store/useAppStore';

/** Shown when a sync replaced edits on this device that had not synced yet. */
export default function SyncNotice() {
  const show = useAppStore((s) => s.syncReplacedEdits);
  const dismiss = useAppStore((s) => s.dismissSyncNotice);
  if (!show) return null;

  function onRestore() {
    if (
      window.confirm(
        'Bring back this device\u2019s edits? Changes from your other device since then will be replaced, and the app will lock.',
      )
    ) {
      void restoreSafetySnapshot();
    }
  }

  return (
    <div className="backup-nudge" role="alert">
      <span>
        Sync loaded newer data from another device and replaced edits made here that hadn&rsquo;t
        synced yet.
      </span>
      <div className="backup-nudge-actions">
        <button className="secondary" onClick={dismiss}>
          Keep synced data
        </button>
        <button className="btn-primary" onClick={onRestore}>
          Restore my edits
        </button>
      </div>
    </div>
  );
}
