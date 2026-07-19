import { describe, expect, test } from 'vitest';
import { decryptVault, encryptVault } from './vaultCrypto';

function makeKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

describe('vault crypto', () => {
  test('round-trips a JSON string', async () => {
    const key = await makeKey();
    const json = JSON.stringify({ hello: 'world', n: 42 });
    const ct = await encryptVault(key, json);
    expect(ct).not.toContain('world');
    expect(await decryptVault(key, ct)).toBe(json);
  });

  test('produces a serializable string ciphertext', async () => {
    const key = await makeKey();
    const ct = await encryptVault(key, 'payload');
    expect(typeof ct).toBe('string');
    expect(() => JSON.parse(ct)).not.toThrow();
  });

  test('a different key cannot decrypt', async () => {
    const ct = await encryptVault(await makeKey(), 'secret');
    await expect(decryptVault(await makeKey(), ct)).rejects.toThrow();
  });
});
