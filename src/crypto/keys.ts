// Passphrase → session key derivation (PBKDF2-SHA-256 → AES-GCM-256).
// The passphrase is never stored; only kdf params + a keycheck envelope are
// persisted, and the derived CryptoKey is non-extractable.

import { decryptField, encryptField, type Envelope } from './envelope';

export const KDF_ITERATIONS = 600_000;

const KEYCHECK_SENTINEL = 'budget-tracker-keycheck-v1';

export function generateSalt(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(16));
}

export async function deriveKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number = KDF_ITERATIONS,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function createKeycheck(key: CryptoKey): Promise<Envelope> {
  return encryptField(key, KEYCHECK_SENTINEL);
}

export async function verifyKeycheck(
  key: CryptoKey,
  keycheck: Envelope,
): Promise<boolean> {
  try {
    return (await decryptField(key, keycheck)) === KEYCHECK_SENTINEL;
  } catch {
    return false;
  }
}
