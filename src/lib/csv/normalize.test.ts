import { describe, expect, test } from 'vitest';
import {
  detectDateOrder,
  detectHeaderRow,
  guessMapping,
  normalizeRows,
  parseCsvAmount,
  parseCsvDate,
} from './normalize';

describe('detectHeaderRow', () => {
  test('returns 0 when the first row is the header', () => {
    const rows = [
      ['Date', 'Description', 'Amount'],
      ['2026-07-01', 'Coffee', '-3.50'],
    ];
    expect(detectHeaderRow(rows)).toBe(0);
  });

  test('skips bank preamble above the header', () => {
    const rows = [
      ['My Bank Statement'],
      ['Account: 1234'],
      [''],
      ['Date', 'Description', 'Amount'],
      ['2026-07-01', 'Coffee', '-3.50'],
      ['2026-07-02', 'Lunch', '-12.00'],
    ];
    expect(detectHeaderRow(rows)).toBe(3);
  });

  test('returns 0 as a fallback when nothing looks like a header', () => {
    const rows = [['1', '2'], ['3', '4']];
    expect(detectHeaderRow(rows)).toBe(0);
  });
});

describe('guessMapping', () => {
  test('maps common header synonyms case-insensitively', () => {
    expect(guessMapping(['Transaction Date', 'Details', 'Amount', 'Balance'])).toEqual({
      date: 0,
      description: 1,
      amount: 2,
      debit: null,
      credit: null,
    });
  });

  test('recognizes separate debit and credit columns', () => {
    expect(guessMapping(['Posting Date', 'Particulars', 'Debit', 'Credit'])).toEqual({
      date: 0,
      description: 1,
      amount: null,
      debit: 2,
      credit: 3,
    });
  });

  test('leaves unknown columns unmapped', () => {
    expect(guessMapping(['Foo', 'Bar'])).toEqual({
      date: null,
      description: null,
      amount: null,
      debit: null,
      credit: null,
    });
  });
});

describe('detectDateOrder', () => {
  test('detects ISO dates', () => {
    expect(detectDateOrder(['2026-07-01', '2026-07-15'])).toBe('iso');
  });

  test('detects DMY when a day exceeds 12', () => {
    expect(detectDateOrder(['13/07/2026', '01/02/2026'])).toBe('dmy');
  });

  test('detects MDY when the first field exceeds 12', () => {
    expect(detectDateOrder(['07/13/2026', '02/01/2026'])).toBe('mdy');
  });

  test('reports ambiguous when no value disambiguates', () => {
    expect(detectDateOrder(['01/02/2026', '03/04/2026'])).toBe('ambiguous');
  });
});

describe('parseCsvDate', () => {
  test('parses ISO directly regardless of declared order', () => {
    expect(parseCsvDate('2026-07-01', 'iso')).toBe('2026-07-01');
    expect(parseCsvDate('2026-07-01', 'dmy')).toBe('2026-07-01');
  });

  test('parses DMY and MDY into ISO', () => {
    expect(parseCsvDate('13/07/2026', 'dmy')).toBe('2026-07-13');
    expect(parseCsvDate('07/13/2026', 'mdy')).toBe('2026-07-13');
  });

  test('accepts dash and dotted separators and 2-digit years', () => {
    expect(parseCsvDate('01-02-2026', 'dmy')).toBe('2026-02-01');
    expect(parseCsvDate('01.02.26', 'dmy')).toBe('2026-02-01');
  });

  test('parses named months like 01 Jul 2026', () => {
    expect(parseCsvDate('01 Jul 2026', 'dmy')).toBe('2026-07-01');
    expect(parseCsvDate('Jul 1, 2026', 'mdy')).toBe('2026-07-01');
  });

  test('returns null for unparseable values', () => {
    expect(parseCsvDate('not a date', 'iso')).toBeNull();
    expect(parseCsvDate('', 'iso')).toBeNull();
  });
});

describe('parseCsvAmount', () => {
  test('parses plain and thousands-separated amounts to minor units', () => {
    expect(parseCsvAmount('1234.56')).toBe(123456);
    expect(parseCsvAmount('1,234.56')).toBe(123456);
    expect(parseCsvAmount('1,234')).toBe(123400);
  });

  test('strips currency symbols and whitespace', () => {
    expect(parseCsvAmount('₱1,234.56')).toBe(123456);
    expect(parseCsvAmount('  $ 50.00 ')).toBe(5000);
  });

  test('reads leading and trailing minus signs as negative', () => {
    expect(parseCsvAmount('-1234.56')).toBe(-123456);
    expect(parseCsvAmount('1234.56-')).toBe(-123456);
  });

  test('reads parentheses and DR/CR markers', () => {
    expect(parseCsvAmount('(1,234.56)')).toBe(-123456);
    expect(parseCsvAmount('1,234.56 DR')).toBe(-123456);
    expect(parseCsvAmount('1,234.56 CR')).toBe(123456);
  });

  test('handles comma-decimal (European) formatting', () => {
    expect(parseCsvAmount('1.234,56')).toBe(123456);
    expect(parseCsvAmount('1234,56', 'comma')).toBe(123456);
  });

  test('returns null for blank or non-numeric cells', () => {
    expect(parseCsvAmount('')).toBeNull();
    expect(parseCsvAmount('n/a')).toBeNull();
  });
});

describe('normalizeRows', () => {
  const header = ['Date', 'Description', 'Amount'];
  const dataRows = [
    ['2026-07-01', 'Coffee Shop', '-3.50'],
    ['2026-07-02', 'Salary', '5,000.00'],
  ];

  test('produces signed minor-unit transactions from a single amount column', () => {
    const rows = normalizeRows(dataRows, guessMapping(header), { dateOrder: 'iso' });
    expect(rows).toEqual([
      { date: '2026-07-01', description: 'Coffee Shop', amount: -350, valid: true },
      { date: '2026-07-02', description: 'Salary', amount: 500000, valid: true },
    ]);
  });

  test('merges debit and credit columns into one signed amount', () => {
    const rows = normalizeRows(
      [
        ['2026-07-01', 'Coffee', '3.50', ''],
        ['2026-07-02', 'Refund', '', '20.00'],
      ],
      { date: 0, description: 1, amount: null, debit: 2, credit: 3 },
      { dateOrder: 'iso' },
    );
    expect(rows[0]).toMatchObject({ amount: -350, valid: true });
    expect(rows[1]).toMatchObject({ amount: 2000, valid: true });
  });

  test('flags rows with an unparseable date or amount as invalid', () => {
    const rows = normalizeRows(
      [
        ['nope', 'Bad date', '-3.50'],
        ['2026-07-02', 'Bad amount', 'xyz'],
      ],
      guessMapping(header),
      { dateOrder: 'iso' },
    );
    expect(rows[0].valid).toBe(false);
    expect(rows[1].valid).toBe(false);
  });

  test('normalizes varied formats to identical transactions', () => {
    const iso = normalizeRows(
      [['2026-07-01', 'Coffee', '-3.50']],
      { date: 0, description: 1, amount: 2, debit: null, credit: null },
      { dateOrder: 'iso' },
    );
    const dmyDebit = normalizeRows(
      [['01/07/2026', 'Coffee', '3.50', '']],
      { date: 0, description: 1, amount: null, debit: 2, credit: 3 },
      { dateOrder: 'dmy' },
    );
    expect(dmyDebit[0]).toEqual(iso[0]);
  });
});
