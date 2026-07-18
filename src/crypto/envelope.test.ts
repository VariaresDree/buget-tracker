import { describe, expect, test } from 'vitest';
import { decryptField, encryptField } from './envelope';

function makeKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

describe('envelope', () => {
  test('round-trips plaintext including unicode', async () => {
    const key = await makeKey();
    const plaintext = '₱1,234.56 — lunch at Café';
    const env = await encryptField(key, plaintext);
    expect(await decryptField(key, env)).toBe(plaintext);
  });

  test('stores iv and ct as base64 strings, not plaintext', async () => {
    const key = await makeKey();
    const env = await encryptField(key, 'secret-note');
    expect(typeof env.iv).toBe('string');
    expect(typeof env.ct).toBe('string');
    expect(env.ct).not.toContain('secret-note');
  });

  test('uses a fresh iv per encryption so identical plaintexts differ', async () => {
    const key = await makeKey();
    const a = await encryptField(key, '5000');
    const b = await encryptField(key, '5000');
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });

  test('rejects tampered ciphertext', async () => {
    const key = await makeKey();
    const env = await encryptField(key, '5000');
    const tampered = {
      iv: env.iv,
      ct: env.ct.slice(0, -4) + (env.ct.endsWith('AAAA') ? 'BBBB' : 'AAAA'),
    };
    await expect(decryptField(key, tampered)).rejects.toThrow();
  });

  test('rejects decryption with a different key', async () => {
    const env = await encryptField(await makeKey(), '5000');
    await expect(decryptField(await makeKey(), env)).rejects.toThrow();
  });
});
