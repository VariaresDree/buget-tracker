import { useEffect, useMemo, useState } from 'react';
import { listTransactions, type Transaction } from '../../db/repo';
import { useCategories } from '../../hooks/useCategories';
import { budgetRows, categorySpend, monthTotals } from '../../lib/budgets';
import { cumulativeSpendSeries, pieData } from '../../lib/charts';
import { addMonths, monthOf, todayISO } from '../../lib/dates';
import { formatMoney } from '../../lib/money';
import { useAppStore } from '../../store/useAppStore';
import BudgetBar from './BudgetBar';
import CategoryPie from './CategoryPie';
import SpendLine from './SpendLine';

export default function DashboardScreen() {
  const categories = useCategories();
  const symbol = useAppStore((s) => s.settings.currencySymbol);
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
            className="secondary"
            aria-label="Previous month"
            onClick={() => setMonth((m) => addMonths(m, -1))}
          >
            ‹
          </button>
          <span className="month-label">{month}</span>
          <button
            className="secondary"
            aria-label="Next month"
            onClick={() => setMonth((m) => addMonths(m, 1))}
          >
            ›
          </button>
        </div>
      </div>

      <div className="stat-cards">
        <div className="stat-card">
          <span className="muted">Income</span>
          <span className="amount income">{formatMoney(totals.income, symbol)}</span>
        </div>
        <div className="stat-card">
          <span className="muted">Spent</span>
          <span className="amount">{formatMoney(totals.expense, symbol)}</span>
        </div>
      </div>

      <h3 className="section-title">Budgets</h3>
      {rows.length === 0 && uncategorized === 0 ? (
        <p className="placeholder">
          No expense categories yet — create them in the Categories tab to track
          spending against monthly caps.
        </p>
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
