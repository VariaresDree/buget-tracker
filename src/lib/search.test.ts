import { expect, test } from 'vitest';
import { matchesQuery } from './search';

const tx = { amount: -12550, note: 'Lunch at Jollibee' };
const match = (q: string) => matchesQuery(tx, q, 'GCash', 'Food & Dining');

test('an empty or blank query matches everything', () => {
  expect(match('')).toBe(true);
  expect(match('   ')).toBe(true);
});

test('matches note, category and account, ignoring case', () => {
  expect(match('jollibee')).toBe(true);
  expect(match('DINING')).toBe(true);
  expect(match('gcash')).toBe(true);
  expect(match('groceries')).toBe(false);
});

test('matches the amount as typed, without the sign', () => {
  expect(match('125.50')).toBe(true);
  expect(match('125')).toBe(true);
  expect(match('999')).toBe(false);
});

test('every word must match, in any field', () => {
  expect(match('lunch gcash')).toBe(true);
  expect(match('lunch bank')).toBe(false);
});
