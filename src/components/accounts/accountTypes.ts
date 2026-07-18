import type { AccountType } from '../../db/db';

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: 'Cash',
  ewallet: 'E-Wallet',
  bank: 'Bank',
  credit: 'Credit Card',
};
