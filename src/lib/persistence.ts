// Ask the browser to keep this origin's IndexedDB in the durable (persistent)
// bucket so it isn't silently evicted under storage pressure — the single
// biggest data-loss risk for a local-first app. Best-effort and non-blocking:
// a denied or unsupported request never stops a local write.

export async function requestPersistentStorage(): Promise<boolean> {
  const storage = navigator.storage;
  if (!storage?.persist) return false;
  if (await storage.persisted()) return true;
  return storage.persist();
}

export interface StorageStatus {
  persisted: boolean;
  usage?: number;
  quota?: number;
}

export async function storageStatus(): Promise<StorageStatus> {
  const storage = navigator.storage;
  if (!storage?.persisted) return { persisted: false };
  const persisted = await storage.persisted();
  if (!storage.estimate) return { persisted };
  const { usage, quota } = await storage.estimate();
  return { persisted, usage, quota };
}
