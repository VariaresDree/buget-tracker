import { describe, expect, test } from 'vitest';
import { decryptField, encryptField } from './envelope';
import {
  createKeycheck,
  deriveKey,
  generateSalt,
  KDF_ITERATIONS,
  verifyKeycheck,
} from './keys';

// Low iteration count keeps tests fast; production uses KDF_ITERATIONS.
const TEST_ITERATIONS = 1000;

describe('generateSalt', () => {
  test('returns 16 random bytes, different each call', () => {
    const a = generateSalt();
    const b = generateSalt();
    expect(a).toHaveLength(16);
    expect(b).toHaveLength(16);
    expect(a).not.toEqual(b);
  });
});

describe('deriveKey', () => {
  test('production iteration count meets OWASP guidance', () => {
    expect(KDF_ITERATIONS).toBeGreaterThanOrEqual(600_000);
  });

  test('same passphrase and salt derive interoperable keys', async () => {
    const salt = generateSalt();
    const k1 = await deriveKey('correct horse battery', salt, TEST_ITERATIONS);
    const k2 = await deriveKey('correct horse battery', salt, TEST_ITERATIONS);
    const env = await encryptField(k1, '123456');
    expect(await decryptField(k2, env)).toBe('123456');
  });

  test('a different passphrase cannot decrypt', async () => {
    const salt = generateSalt();
    const right = await deriveKey('correct horse battery', salt, TEST_ITERATIONS);
    const wrong = await deriveKey('wrong passphrase', salt, TEST_ITERATIONS);
    const env = await encryptField(right, '123456');
    await expect(decryptField(wrong, env)).rejects.toThrow();
  });

  test('derived key is not extractable', async () => {
    const key = await deriveKey('correct horse battery', generateSalt(), TEST_ITERATIONS);
    expect(key.extractable).toBe(false);
  });
});

describe('keycheck', () => {
  test('verifies with the key that created it', async () => {
    const key = await deriveKey('correct horse battery', generateSalt(), TEST_ITERATIONS);
    const keycheck = await createKeycheck(key);
    expect(await verifyKeycheck(key, keycheck)).toBe(true);
  });

  test('fails with a key from the wrong passphrase', async () => {
    const salt = generateSalt();
    const right = await deriveKey('correct horse battery', salt, TEST_ITERATIONS);
    const wrong = await deriveKey('wrong passphrase', salt, TEST_ITERATIONS);
    const keycheck = await createKeycheck(right);
    expect(await verifyKeycheck(wrong, keycheck)).toBe(false);
  });
});
