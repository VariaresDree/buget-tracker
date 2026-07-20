import { useState } from 'react';
import { Pencil, PieChart, Trash2 } from 'lucide-react';
import { deleteCategory, type Category } from '../../db/repo';
import { refreshCategories, useCategories } from '../../hooks/useCategories';
import { formatMoney } from '../../lib/money';
import { useAppStore } from '../../store/useAppStore';
import EmptyState from '../common/EmptyState';
import CategoryForm from './CategoryForm';

type Mode = 'list' | 'add' | { editId: number };

export default function CategoriesScreen() {
  const categories = useCategories();
  const symbol = useAppStore((s) => s.settings.currencySymbol);
  const [mode, setMode] = useState<Mode>('list');

  async function onDelete(category: Category) {
    if (
      !window.confirm(
        `Delete ${category.name}? Its transactions become uncategorized.`,
      )
    ) {
      return;
    }
    await deleteCategory(category.id);
    await refreshCategories();
  }

  if (mode === 'add') {
    return <CategoryForm onDone={() => setMode('list')} />;
  }
  if (typeof mode === 'object') {
    return (
      <CategoryForm
        category={categories.find((c) => c.id === mode.editId)}
        onDone={() => setMode('list')}
      />
    );
  }

  return (
    <section>
      <div className="screen-head">
        <h2>Categories</h2>
        {categories.length > 0 && (
          <button className="btn-primary" onClick={() => setMode('add')}>
            Add category
          </button>
        )}
      </div>
      {categories.length === 0 ? (
        <EmptyState
          icon={PieChart}
          title="No categories yet"
          hint="Add ones like Food, Transport, or Salary — expense categories can carry a monthly budget cap."
          actionLabel="Add category"
          onAction={() => setMode('add')}
        />
      ) : (
        <ul className="card-list">
          {categories.map((category) => (
            <li key={category.id}>
              <div className="row-lead">
                <span
                  className="row-avatar"
                  aria-hidden="true"
                  style={{ background: `${category.color}22`, color: category.color }}
                >
                  <PieChart size={20} strokeWidth={1.75} />
                </span>
                <div className="row-main">
                  <strong>{category.name}</strong>
                  <span className="muted">
                    {category.type === 'income'
                      ? 'Income'
                      : category.monthlyCap === null
                        ? 'No cap'
                        : `Cap: ${formatMoney(category.monthlyCap, symbol)}/month`}
                  </span>
                </div>
              </div>
              <div className="row-side">
                <button
                  className="icon-btn"
                  aria-label={`Edit ${category.name}`}
                  onClick={() => setMode({ editId: category.id })}
                >
                  <Pencil size={18} aria-hidden="true" />
                </button>
                <button
                  className="icon-btn danger"
                  aria-label={`Delete ${category.name}`}
                  onClick={() => void onDelete(category)}
                >
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
