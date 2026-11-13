// Download the encrypted vault as a JSON file and record when it happened, so
// both Settings and the first-run wizard trigger an identical backup and the
// "last backed up" nudge stays accurate.
import { exportBackup } from '../db/repo';
import { db } from '../db/db';
import { useAppStore } from '../store/useAppStore';

/** Hand the user a file to save; `name` gets today's date and the extension. */
export function saveFile(name: string, ext: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadBackup(): Promise<void> {
  saveFile('budget-backup', 'json', await exportBackup(), 'application/json');

  const at = Date.now();
  await db.meta.put({ key: 'lastBackupAt', value: at });
  useAppStore.setState({ lastBackupAt: at });
}
