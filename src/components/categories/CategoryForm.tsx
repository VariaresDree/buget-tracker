import { useState, type FormEvent } from 'react';
import type { CategoryType } from '../../db/db';
import { addCategory, updateCategory, type Category } from '../../db/repo';
import { refreshCategories } from '../../hooks/useCategories';
import { parseAmountInput } from '../../lib/money';
import { PRESET_COLORS } from './presetColors';

const DEFAULT_COLOR = PRESET_COLORS[0];

interface Props {
  category?: Category;
  onDone: () => void;
}

export default function CategoryForm({ category, onDone }: Props) {
  const [name, setName] = useState(category?.name ?? '');
  const [type, setType] = useState<CategoryType>(category?.type ?? 'expense');
  const [capInput, setCapInput] = useState(
    category?.monthlyCap != null ? (category.monthlyCap / 100).toFixed(2) : '',
  );
  const [color, setColor] = useState(category?.color ?? DEFAULT_COLOR);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required.');
      return;
    }
    let monthlyCap: number | null = null;
    if (type === 'expense' && capInput.trim() !== '') {
      monthlyCap = parseAmountInput(capInput);
      if (monthlyCap === null || monthlyCap <= 0) {
        setError('Enter a valid monthly cap, or leave it empty for no cap.');
        return;
      }
    }
    if (category) {
      await updateCategory(category.id, { name: trimmedName, type, monthlyCap, color });
    } else {
      await addCategory({ name: trimmedName, type, monthlyCap, color });
    }
    await refreshCategories();
    onDone();
  }

  return (
    <form className="panel-form" onSubmit={onSubmit}>
      <h2>{category ? 'Edit category' : 'Add category'}</h2>
      <label htmlFor="category-name">Name</label>
      <input
        id="category-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <fieldset className="kind-toggle">
        <label>
          <input
            type="radio"
            name="category-type"
            checked={type === 'expense'}
            onChange={() => setType('expense')}
          />
          Expense
        </label>
        <label>
          <input
            type="radio"
            name="category-type"
            checked={type === 'income'}
            onChange={() => setType('income')}
          />
          Income
        </label>
      </fieldset>
      {type === 'expense' && (
        <>
          <label htmlFor="category-cap">Monthly cap</label>
          <input
            id="category-cap"
            inputMode="decimal"
            placeholder="No cap"
            value={capInput}
            onChange={(e) => setCapInput(e.target.value)}
          />
        </>
      )}
      <label htmlFor="category-color">Color</label>
      <div className="swatch-row">
        {PRESET_COLORS.map((preset, i) => (
          <button
            key={preset}
            type="button"
            className={preset === color ? 'swatch selected' : 'swatch'}
            style={{ '--swatch-color': preset } as React.CSSProperties}
            aria-label={`Color option ${i + 1}`}
            aria-pressed={preset === color}
            onClick={() => setColor(preset)}
          />
        ))}
      </div>
      <input
        id="category-color"
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
      />
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button type="button" className="secondary" onClick={onDone}>
          Cancel
        </button>
        <button type="submit">Save</button>
      </div>
    </form>
  );
}
