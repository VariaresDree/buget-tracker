import { useState } from 'react';
import { deleteCategory, type Category } from '../../db/repo';
import { refreshCategories, useCategories } from '../../hooks/useCategories';
import { formatMoney } from '../../lib/money';
import { useAppStore } from '../../store/useAppStore';
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
        <button onClick={() => setMode('add')}>Add category</button>
      </div>
      {categories.length === 0 ? (
        <p className="placeholder">
          No categories yet. Add ones like Food, Transport, or Salary — expense
          categories can carry a monthly budget cap.
        </p>
      ) : (
        <ul className="card-list">
          {categories.map((category) => (
            <li key={category.id}>
              <div className="row-main">
                <strong>
                  <span className="color-dot" style={{ background: category.color }} />
                  {category.name}
                </strong>
                <span className="muted">
                  {category.type === 'income'
                    ? 'Income'
                    : category.monthlyCap === null
                      ? 'No cap'
                      : `Cap: ${formatMoney(category.monthlyCap, symbol)}/month`}
                </span>
              </div>
              <div className="row-side">
                <button
                  className="secondary"
                  aria-label={`Edit ${category.name}`}
                  onClick={() => setMode({ editId: category.id })}
                >
                  Edit
                </button>
                <button
                  className="secondary danger"
                  aria-label={`Delete ${category.name}`}
                  onClick={() => void onDelete(category)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
