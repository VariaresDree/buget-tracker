import { describe, expect, test } from 'vitest';
import { decodeBuffer, parseDelimited } from './parse';

function bytes(...b: number[]): ArrayBuffer {
  return new Uint8Array(b).buffer;
}

describe('decodeBuffer', () => {
  test('decodes valid UTF-8 (including multibyte) as utf-8', () => {
    const buf = new TextEncoder().encode('Café ₱100').buffer;
    expect(decodeBuffer(buf)).toEqual({ text: 'Café ₱100', encoding: 'utf-8' });
  });

  test('falls back to windows-1252 for bytes that are invalid UTF-8', () => {
    // 0x96 is an en dash in windows-1252 but an invalid lone UTF-8 byte.
    const { text, encoding } = decodeBuffer(bytes(0x41, 0x96, 0x42));
    expect(encoding).toBe('windows-1252');
    expect(text).toBe('A–B');
  });

  test('honors an explicit encoding override', () => {
    const { encoding } = decodeBuffer(bytes(0x41, 0x42), 'windows-1252');
    expect(encoding).toBe('windows-1252');
  });

  test('strips a UTF-8 BOM', () => {
    const { text } = decodeBuffer(bytes(0xef, 0xbb, 0xbf, 0x41));
    expect(text).toBe('A');
  });
});

describe('parseDelimited', () => {
  test('parses comma-separated rows into a string matrix', () => {
    const rows = parseDelimited('Date,Amount\n2026-07-01,-3.50\n2026-07-02,5.00');
    expect(rows).toEqual([
      ['Date', 'Amount'],
      ['2026-07-01', '-3.50'],
      ['2026-07-02', '5.00'],
    ]);
  });

  test('auto-detects a semicolon delimiter', () => {
    const rows = parseDelimited('Date;Amount\n2026-07-01;-3,50');
    expect(rows).toEqual([
      ['Date', 'Amount'],
      ['2026-07-01', '-3,50'],
    ]);
  });

  test('respects quoted fields containing the delimiter', () => {
    const rows = parseDelimited('Date,Description,Amount\n2026-07-01,"Shop, Inc.",-3.50');
    expect(rows[1]).toEqual(['2026-07-01', 'Shop, Inc.', '-3.50']);
  });

  test('drops fully blank lines', () => {
    const rows = parseDelimited('A,B\n\n1,2\n');
    expect(rows).toEqual([
      ['A', 'B'],
      ['1', '2'],
    ]);
  });
});
