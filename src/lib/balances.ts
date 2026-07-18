// Pure balance math over decrypted values (no crypto, no Dexie).

interface AccountLike {
  id: number;
  startingBalance: number;
}

interface TransactionLike {
  accountId: number;
  amount: number;
  transferGroupId: string | null;
}

/** Current balance per account: starting balance + signed transaction sums. */
export function computeBalances(
  accounts: AccountLike[],
  transactions: TransactionLike[],
): Map<number, number> {
  const balances = new Map<number, number>();
  for (const account of accounts) {
    balances.set(account.id, account.startingBalance);
  }
  for (const tx of transactions) {
    const current = balances.get(tx.accountId);
    if (current !== undefined) balances.set(tx.accountId, current + tx.amount);
  }
  return balances;
}

/** Total spent (positive number). Income and transfer legs don't count. */
export function totalSpend(transactions: TransactionLike[]): number {
  let spend = 0;
  for (const tx of transactions) {
    if (tx.amount < 0 && tx.transferGroupId === null) spend -= tx.amount;
  }
  return spend;
}
