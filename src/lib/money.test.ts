import { describe, expect, test } from 'vitest';
import { formatMoney, parseAmountInput } from './money';

describe('formatMoney', () => {
  test('formats minor units with symbol and thousands separators', () => {
    expect(formatMoney(123456, '₱')).toBe('₱1,234.56');
    expect(formatMoney(500, '$')).toBe('$5.00');
    expect(formatMoney(0, '₱')).toBe('₱0.00');
  });

  test('puts the minus sign before the symbol for negatives', () => {
    expect(formatMoney(-123456, '₱')).toBe('-₱1,234.56');
  });
});

describe('parseAmountInput', () => {
  test('parses plain and comma-separated decimals to minor units', () => {
    expect(parseAmountInput('1234.56')).toBe(123456);
    expect(parseAmountInput('1,234.56')).toBe(123456);
    expect(parseAmountInput('1234')).toBe(123400);
    expect(parseAmountInput('0.05')).toBe(5);
  });

  test('accepts a leading minus (for starting balances)', () => {
    expect(parseAmountInput('-500.00')).toBe(-50000);
  });

  test('avoids float drift', () => {
    expect(parseAmountInput('0.29')).toBe(29);
    expect(parseAmountInput('1.13')).toBe(113);
  });

  test('rejects junk, empty, and more than 2 decimal places', () => {
    expect(parseAmountInput('')).toBeNull();
    expect(parseAmountInput('abc')).toBeNull();
    expect(parseAmountInput('12.345')).toBeNull();
    expect(parseAmountInput('1,23.45')).toBeNull();
  });
});
