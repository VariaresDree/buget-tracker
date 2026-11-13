// Download the encrypted vault as a JSON file and record when it happened, so
// both Settings and the first-run wizard trigger an identical backup and the
// "last backed up" nudge stays accurate.
import { exportBackup } from '../db/repo';
import { db } from '../db/db';
import { useAppStore } from '../store/useAppStore';

export async function downloadBackup(): Promise<void> {
  const json = await exportBackup();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `budget-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);

  const at = Date.now();
  await db.meta.put({ key: 'lastBackupAt', value: at });
  useAppStore.setState({ lastBackupAt: at });
}
