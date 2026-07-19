import { formatMoney } from '../../lib/money';
import type { PreviewRow } from './useImport';

interface Props {
  rows: PreviewRow[];
  symbol: string;
  includedCount: number;
  onToggle: (index: number) => void;
  onImport: () => void;
  onBack: () => void;
}

export default function ImportPreview({
  rows,
  symbol,
  includedCount,
  onToggle,
  onImport,
  onBack,
}: Props) {
  const skipped = rows.filter((r) => !r.valid).length;
  const duplicates = rows.filter((r) => r.valid && r.isDuplicate).length;
  const noun = includedCount === 1 ? 'transaction' : 'transactions';

  return (
    <section className="import-step">
      <h2>Review import</h2>
      <p className="muted">
        {rows.length} rows · {duplicates} duplicate{duplicates === 1 ? '' : 's'} ·{' '}
        {skipped} skipped
      </p>

      <ul className="card-list import-rows">
        {rows.map((row, i) => (
          <li key={i} className={!row.valid ? 'invalid' : row.isDuplicate ? 'duplicate' : undefined}>
            <div className="row-main">
              <strong>{row.description || <span className="muted">(no description)</span>}</strong>
              <span className="muted">
                {row.valid ? row.date : row.error}
                {row.valid && row.isDuplicate && ' · Duplicate'}
                {!row.valid && ' · Skipped'}
              </span>
            </div>
            <div className="row-side">
              <span className={row.amount >= 0 ? 'amount income' : 'amount'}>
                {row.valid ? formatMoney(row.amount, symbol) : '—'}
              </span>
              {row.valid && (
                <input
                  type="checkbox"
                  aria-label={`Include ${row.description || 'row ' + (i + 1)}`}
                  checked={row.include}
                  onChange={() => onToggle(i)}
                />
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="form-actions">
        <button type="button" className="secondary" onClick={onBack}>
          Back
        </button>
        <button type="button" disabled={includedCount === 0} onClick={onImport}>
          Import {includedCount} {noun}
        </button>
      </div>
    </section>
  );
}
