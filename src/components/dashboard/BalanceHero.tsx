import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { formatMoney } from '../../lib/money';

interface Props {
  totalBalance: number;
  income: number;
  expense: number;
  symbol: string;
}

/** Leads the dashboard with the number people open the app to see. */
export default function BalanceHero({ totalBalance, income, expense, symbol }: Props) {
  return (
    <section className="balance-hero" aria-label="Total balance">
      <span className="hero-label">Total balance</span>
      <span className="hero-amount">{formatMoney(totalBalance, symbol)}</span>
      <div className="hero-pills">
        <span className="hero-pill income">
          <ArrowDownLeft size={16} aria-hidden="true" />
          <span>Income</span>
          <span className="amount">{formatMoney(income, symbol)}</span>
        </span>
        <span className="hero-pill expense">
          <ArrowUpRight size={16} aria-hidden="true" />
          <span>Spent</span>
          <span className="amount">{formatMoney(expense, symbol)}</span>
        </span>
      </div>
    </section>
  );
}
