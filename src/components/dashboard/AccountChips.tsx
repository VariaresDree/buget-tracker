import { Banknote, CreditCard, Landmark, Smartphone } from 'lucide-react';
import type { AccountType } from '../../db/db';
import type { Account } from '../../db/repo';
import { formatMoney } from '../../lib/money';
import { ACCOUNT_TYPE_LABELS } from '../accounts/accountTypes';

export const ACCOUNT_ICONS: Record<AccountType, typeof Banknote> = {
  cash: Banknote,
  ewallet: Smartphone,
  bank: Landmark,
  credit: CreditCard,
};

interface Props {
  accounts: Account[];
  balances: Map<number, number>;
  symbol: string;
}

/** Per-account balances at a glance, the way Tarsi surfaces BPI / GCash. */
export default function AccountChips({ accounts, balances, symbol }: Props) {
  if (accounts.length === 0) return null;

  return (
    <div className="account-chips" aria-label="Account balances">
      {accounts.map((account) => {
        const Icon = ACCOUNT_ICONS[account.type];
        return (
          <div className="account-chip" key={account.id}>
            <span className="chip-name">
              <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
              {account.name}
            </span>
            <span className="chip-balance">
              {formatMoney(balances.get(account.id) ?? account.startingBalance, symbol)}
            </span>
            <span className="muted">{ACCOUNT_TYPE_LABELS[account.type]}</span>
          </div>
        );
      })}
    </div>
  );
}
