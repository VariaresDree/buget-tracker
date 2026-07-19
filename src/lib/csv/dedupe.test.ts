import { describe, expect, test } from 'vitest';
import { computeImportHash } from './dedupe';

describe('computeImportHash', () => {
  test('is a stable hex digest for the same inputs', async () => {
    const a = await computeImportHash(1, '2026-07-01', -350, 'Coffee Shop');
    const b = await computeImportHash(1, '2026-07-01', -350, 'Coffee Shop');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  test('ignores case and surrounding/collapsible whitespace in the description', async () => {
    const a = await computeImportHash(1, '2026-07-01', -350, 'Coffee  Shop');
    const b = await computeImportHash(1, '2026-07-01', -350, '  coffee shop ');
    expect(a).toBe(b);
  });

  test('differs when account, date, amount, or description differ', async () => {
    const base = await computeImportHash(1, '2026-07-01', -350, 'Coffee');
    expect(await computeImportHash(2, '2026-07-01', -350, 'Coffee')).not.toBe(base);
    expect(await computeImportHash(1, '2026-07-02', -350, 'Coffee')).not.toBe(base);
    expect(await computeImportHash(1, '2026-07-01', -351, 'Coffee')).not.toBe(base);
    expect(await computeImportHash(1, '2026-07-01', -350, 'Tea')).not.toBe(base);
  });
});
