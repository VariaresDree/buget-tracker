// Whole-vault encryption for sync. The backup JSON is encrypted client-side
// under a passphrase-derived AES-GCM key; the server only ever sees this
// opaque ciphertext string. Reuses the field envelope primitives.

import { decryptField, encryptField, type Envelope } from '../crypto/envelope';

/** Encrypt a JSON string into a single opaque ciphertext string. */
export function encryptVault(key: CryptoKey, plaintext: string): Promise<string> {
  return encryptField(key, plaintext).then((env) => JSON.stringify(env));
}

/** Decrypt a ciphertext string produced by {@link encryptVault}. */
export function decryptVault(key: CryptoKey, ciphertext: string): Promise<string> {
  return decryptField(key, JSON.parse(ciphertext) as Envelope);
}
