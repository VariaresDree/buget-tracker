import { describe, expect, test } from 'vitest';
import { computeBalances, totalSpend } from './balances';

const acct = (id: number, startingBalance: number) => ({ id, startingBalance });
const tx = (
  accountId: number,
  amount: number,
  transferGroupId: string | null = null,
) => ({ accountId, amount, transferGroupId });

describe('computeBalances', () => {
  test('balance is starting balance plus signed transaction sums', () => {
    const balances = computeBalances(
      [acct(1, 10000), acct(2, 0)],
      [tx(1, -2500), tx(1, 50000), tx(2, -100)],
    );
    expect(balances.get(1)).toBe(57500);
    expect(balances.get(2)).toBe(-100);
  });

  test('accounts with no transactions keep their starting balance', () => {
    const balances = computeBalances([acct(7, 4200)], []);
    expect(balances.get(7)).toBe(4200);
  });

  test('a transfer moves money between accounts without changing the total', () => {
    const before = [acct(1, 10000), acct(2, 5000)];
    const legs = [tx(1, -3000, 'g1'), tx(2, 3000, 'g1')];
    const balances = computeBalances(before, legs);
    expect(balances.get(1)).toBe(7000);
    expect(balances.get(2)).toBe(8000);
    expect(balances.get(1)! + balances.get(2)!).toBe(15000);
  });
});

describe('totalSpend', () => {
  test('sums expenses as a positive number, ignoring income', () => {
    expect(totalSpend([tx(1, -2500), tx(1, -1000), tx(1, 50000)])).toBe(3500);
  });

  test('excludes transfer legs entirely', () => {
    expect(totalSpend([tx(1, -3000, 'g1'), tx(2, 3000, 'g1'), tx(1, -500)])).toBe(500);
  });
});
