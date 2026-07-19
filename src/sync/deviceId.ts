const KEY = 'budget-tracker-device-id';

/** Stable, non-secret per-device id for sync bookkeeping. */
export function getDeviceId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
