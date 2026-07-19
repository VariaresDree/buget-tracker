import type { ImportPreset } from '../../db/repo';
import type {
  ColumnMapping,
  DateOrder,
  DecimalStyle,
} from '../../lib/csv/normalize';
import type { Encoding } from '../../lib/csv/parse';

interface Props {
  header: string[];
  sample: string[][];
  mapping: ColumnMapping;
  dateOrder: DateOrder;
  decimal: DecimalStyle | null;
  encoding: Encoding;
  presets: ImportPreset[];
  presetName: string;
  presetSaved: boolean;
  onMappingChange: (field: keyof ColumnMapping, col: number | null) => void;
  onDateOrderChange: (order: DateOrder) => void;
  onDecimalChange: (decimal: DecimalStyle | null) => void;
  onEncodingChange: (encoding: Encoding) => void;
  onApplyPreset: (preset: ImportPreset) => void;
  onPresetNameChange: (name: string) => void;
  onSavePreset: () => void;
  onPreview: () => void;
  onCancel: () => void;
}

const FIELDS: { key: keyof ColumnMapping; label: string }[] = [
  { key: 'date', label: 'Date column' },
  { key: 'description', label: 'Description column' },
  { key: 'amount', label: 'Amount column' },
  { key: 'debit', label: 'Debit column' },
  { key: 'credit', label: 'Credit column' },
];

export default function ColumnMapper(props: Props) {
  const { header, sample, mapping } = props;
  const columnOptions = header.map((h, i) => ({ value: i, label: h || `Column ${i + 1}` }));

  return (
    <section className="import-step">
      <h2>Map columns</h2>
      <p className="muted">
        We guessed the columns from the header. Fix any that look wrong.
      </p>

      {props.presets.length > 0 && (
        <>
          <label htmlFor="apply-preset">Apply preset</label>
          <select
            id="apply-preset"
            defaultValue=""
            onChange={(e) => {
              const preset = props.presets.find((p) => String(p.id) === e.target.value);
              if (preset) props.onApplyPreset(preset);
            }}
          >
            <option value="">Choose a saved preset…</option>
            {props.presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </>
      )}

      <div className="sample-table" aria-hidden="true">
        <table>
          <thead>
            <tr>{header.map((h, i) => <th key={i}>{h || `Column ${i + 1}`}</th>)}</tr>
          </thead>
          <tbody>
            {sample.map((row, r) => (
              <tr key={r}>{row.map((cell, c) => <td key={c}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>

      {FIELDS.map(({ key, label }) => (
        <div key={key}>
          <label htmlFor={`map-${key}`}>{label}</label>
          <select
            id={`map-${key}`}
            value={mapping[key] === null ? '' : String(mapping[key])}
            onChange={(e) =>
              props.onMappingChange(key, e.target.value === '' ? null : Number(e.target.value))
            }
          >
            <option value="">— none —</option>
            {columnOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      <label htmlFor="date-format">Date format</label>
      <select
        id="date-format"
        value={props.dateOrder}
        onChange={(e) => props.onDateOrderChange(e.target.value as DateOrder)}
      >
        <option value="iso">ISO (YYYY-MM-DD)</option>
        <option value="dmy">Day/Month/Year</option>
        <option value="mdy">Month/Day/Year</option>
        <option value="ambiguous">Auto</option>
      </select>

      <label htmlFor="decimal-style">Decimal</label>
      <select
        id="decimal-style"
        value={props.decimal ?? 'auto'}
        onChange={(e) =>
          props.onDecimalChange(e.target.value === 'auto' ? null : (e.target.value as DecimalStyle))
        }
      >
        <option value="auto">Auto-detect</option>
        <option value="dot">1,234.56 (dot)</option>
        <option value="comma">1.234,56 (comma)</option>
      </select>

      <label htmlFor="encoding">Encoding</label>
      <select
        id="encoding"
        value={props.encoding}
        onChange={(e) => props.onEncodingChange(e.target.value as Encoding)}
      >
        <option value="utf-8">UTF-8</option>
        <option value="windows-1252">Windows-1252 (Latin-1)</option>
      </select>

      <div className="preset-save">
        <label htmlFor="preset-name">Preset name</label>
        <input
          id="preset-name"
          value={props.presetName}
          onChange={(e) => props.onPresetNameChange(e.target.value)}
          placeholder="e.g. BPI statements"
        />
        <button type="button" className="secondary" onClick={props.onSavePreset}>
          Save preset
        </button>
        {props.presetSaved && <span className="muted">Preset saved.</span>}
      </div>

      <div className="form-actions">
        <button type="button" className="secondary" onClick={props.onCancel}>
          Cancel
        </button>
        <button type="button" onClick={props.onPreview}>
          Preview
        </button>
      </div>
    </section>
  );
}
