import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Target } from 'lucide-react';
import { listTransactions, type Transaction } from '../../db/repo';
import { useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import { computeBalances } from '../../lib/balances';
import { budgetRows, categorySpend, monthTotals } from '../../lib/budgets';
import { cumulativeSpendSeries, pieData } from '../../lib/charts';
import { addMonths, monthOf, todayISO } from '../../lib/dates';
import { useAppStore } from '../../store/useAppStore';
import EmptyState from '../common/EmptyState';
import AccountChips from './AccountChips';
import BalanceHero from './BalanceHero';
import BudgetBar from './BudgetBar';
import CategoryPie from './CategoryPie';
import SpendLine from './SpendLine';

export default function DashboardScreen() {
  const categories = useCategories();
  const accounts = useAccounts();
  const symbol = useAppStore((s) => s.settings.currencySymbol);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const [month, setMonth] = useState(() => monthOf(todayISO()));
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);

  useEffect(() => {
    void listTransactions().then(setTransactions);
  }, []);

  const spend = useMemo(
    () => categorySpend(transactions ?? [], month),
    [transactions, month],
  );
  const totals = useMemo(
    () => monthTotals(transactions ?? [], month),
    [transactions, month],
  );
  const rows = useMemo(
    () => budgetRows(categories.filter((c) => !c.archived), spend),
    [categories, spend],
  );
  const uncategorized = spend.get(null) ?? 0;
  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const balances = useMemo(
    () => computeBalances(accounts, transactions ?? []),
    [accounts, transactions],
  );
  const totalBalance = useMemo(
    () => accounts.reduce((sum, a) => sum + (balances.get(a.id) ?? a.startingBalance), 0),
    [accounts, balances],
  );
  const slices = useMemo(() => pieData(categories, spend), [categories, spend]);
  const series = useMemo(() => {
    const today = todayISO();
    const throughDay =
      month === monthOf(today) ? Number(today.slice(8, 10)) : undefined;
    return cumulativeSpendSeries(transactions ?? [], month, throughDay);
  }, [transactions, month]);

  return (
    <section>
      <div className="screen-head">
        <h2>Dashboard</h2>
        <div className="month-nav">
          <button
            className="icon-btn"
            aria-label="Previous month"
            onClick={() => setMonth((m) => addMonths(m, -1))}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <span className="month-label">{month}</span>
          <button
            className="icon-btn"
            aria-label="Next month"
            onClick={() => setMonth((m) => addMonths(m, 1))}
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      <BalanceHero
        totalBalance={totalBalance}
        income={totals.income}
        expense={totals.expense}
        symbol={symbol}
      />

      <AccountChips accounts={accounts} balances={balances} symbol={symbol} />

      <h3 className="section-title">Budgets</h3>
      {rows.length === 0 && uncategorized === 0 ? (
        <EmptyState
          icon={Target}
          title="No expense categories yet"
          hint="Add categories like Food or Transport to track spending against a monthly cap."
          actionLabel="Add a category"
          onAction={() => setActiveTab('categories')}
        />
      ) : (
        <ul className="card-list budget-list" aria-label="Budgets">
          {rows.map((row) => {
            const category = categoryById.get(row.categoryId);
            if (!category) return null;
            return (
              <BudgetBar
                key={row.categoryId}
                name={category.name}
                color={category.color}
                spent={row.spent}
                cap={row.cap}
                remaining={row.remaining}
                over={row.over}
                symbol={symbol}
              />
            );
          })}
          {uncategorized > 0 && (
            <BudgetBar
              name="Uncategorized"
              color="var(--text-dim)"
              spent={uncategorized}
              cap={null}
              remaining={null}
              over={false}
              symbol={symbol}
            />
          )}
        </ul>
      )}

      <h3 className="section-title">Spending by category</h3>
      <CategoryPie slices={slices} symbol={symbol} />

      <h3 className="section-title">Spend over time</h3>
      <SpendLine series={series} symbol={symbol} />
    </section>
  );
}
