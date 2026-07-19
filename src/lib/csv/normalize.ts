// Pure heuristics that turn varied bank/e-wallet CSV shapes into normalized,
// minor-unit transactions. No I/O, no crypto — 100% local, deterministic.

export interface ColumnMapping {
  date: number | null;
  description: number | null;
  amount: number | null; // single signed column
  debit: number | null; // money-out column (positive magnitudes)
  credit: number | null; // money-in column (positive magnitudes)
}

export type DateOrder = 'iso' | 'dmy' | 'mdy' | 'ambiguous';
export type DecimalStyle = 'dot' | 'comma';

export interface NormalizedRow {
  date: string; // ISO YYYY-MM-DD (best-effort raw when invalid)
  description: string;
  amount: number; // signed minor units; negative = expense
  valid: boolean;
  error?: string;
}

const HEADER_SYNONYMS: { field: keyof ColumnMapping; terms: string[] }[] = [
  // Priority order matters: "Transaction Date" must resolve to date, not description.
  { field: 'date', terms: ['date', 'posted', 'value date'] },
  { field: 'debit', terms: ['debit', 'withdrawal', 'withdraw', 'money out', 'paid out'] },
  { field: 'credit', terms: ['credit', 'deposit', 'money in', 'paid in'] },
  { field: 'amount', terms: ['amount', 'value'] },
  {
    field: 'description',
    terms: ['description', 'details', 'particulars', 'narrative', 'memo', 'payee', 'reference', 'transaction'],
  },
];

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** First row that reads as a header (no digits, ≥2 cells) with data below it. */
export function detectHeaderRow(rows: string[][]): number {
  const hasDigit = (cell: string) => /\d/.test(cell);
  const isHeaderLike = (row: string[]) =>
    row.filter((c) => c.trim() !== '').length >= 2 && !row.some(hasDigit);
  const isDataLike = (row: string[]) => row.some(hasDigit);

  for (let i = 0; i < rows.length - 1; i++) {
    if (isHeaderLike(rows[i]) && isDataLike(rows[i + 1])) return i;
  }
  return 0;
}

/** Best-guess column roles from header text; unknown columns stay null. */
export function guessMapping(header: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    date: null, description: null, amount: null, debit: null, credit: null,
  };
  const normalized = header.map((h) => h.trim().toLowerCase());

  for (let col = 0; col < normalized.length; col++) {
    for (const { field, terms } of HEADER_SYNONYMS) {
      if (mapping[field] !== null) continue;
      if (terms.some((t) => normalized[col].includes(t))) {
        mapping[field] = col;
        break;
      }
    }
  }
  return mapping;
}

/** Decide day/month order by scanning a column; day>12 or month>12 disambiguates. */
export function detectDateOrder(values: string[]): DateOrder {
  const nonEmpty = values.map((v) => v.trim()).filter(Boolean);
  if (nonEmpty.length > 0 && nonEmpty.every((v) => /^\d{4}-\d{2}-\d{2}$/.test(v))) {
    return 'iso';
  }
  let sawDmy = false;
  let sawMdy = false;
  for (const v of nonEmpty) {
    const m = v.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-]\d{2,4}$/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a > 12 && b <= 12) sawDmy = true;
    else if (b > 12 && a <= 12) sawMdy = true;
  }
  if (sawDmy && !sawMdy) return 'dmy';
  if (sawMdy && !sawDmy) return 'mdy';
  return 'ambiguous';
}

function toISO(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const y = year < 100 ? 2000 + year : year;
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Parse one date cell into ISO; ISO input is accepted regardless of `order`. */
export function parseCsvDate(value: string, order: DateOrder): string | null {
  const s = value.trim();
  if (s === '') return null;

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return toISO(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  // Named month: "01 Jul 2026" or "Jul 1, 2026".
  const dmyNamed = s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\.?\s*,?\s*(\d{2,4})$/);
  const mdyNamed = s.match(/^([A-Za-z]{3,})\.?\s+(\d{1,2})\s*,?\s*(\d{2,4})$/);
  if (dmyNamed || mdyNamed) {
    const day = Number((dmyNamed ?? mdyNamed)![dmyNamed ? 1 : 2]);
    const name = (dmyNamed ?? mdyNamed)![dmyNamed ? 2 : 1].slice(0, 3).toLowerCase();
    const year = Number((dmyNamed ?? mdyNamed)![3]);
    const month = MONTHS[name];
    return month ? toISO(year, month, day) : null;
  }

  const parts = s.match(/^(\d{1,4})[/.\-](\d{1,2})[/.\-](\d{1,4})$/);
  if (!parts) return null;
  const p = [parts[1], parts[2], parts[3]];
  if (p[0].length === 4) return toISO(Number(p[0]), Number(p[1]), Number(p[2]));

  const year = Number(p[2]);
  if (order === 'mdy') return toISO(year, Number(p[0]), Number(p[1]));
  return toISO(year, Number(p[1]), Number(p[0])); // dmy default for ambiguous/iso
}

/** Parse a bank amount cell into signed minor units; negative = money out. */
export function parseCsvAmount(value: string, decimal?: DecimalStyle): number | null {
  const raw = value.trim();
  if (raw === '') return null;

  let negative = false;
  if (/\(.*\)/.test(raw)) negative = true;
  if (/-/.test(raw)) negative = true;
  if (/\bdr\b/i.test(raw)) negative = true;
  if (/\bcr\b/i.test(raw)) negative = false;

  // Keep only digits and separators; drop currency symbols, letters, spaces, signs.
  const s = raw.replace(/[^\d.,]/g, '');
  if (!/\d/.test(s)) return null;

  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  const lastGroupLen = (sep: string) => s.slice(s.lastIndexOf(sep) + 1).length;
  const count = (sep: string) => s.split(sep).length - 1;

  let decSep: '.' | ',' | null = null;
  if (decimal === 'comma') decSep = ',';
  else if (decimal === 'dot') decSep = '.';
  else if (hasDot && hasComma) {
    decSep = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
  } else if (hasComma) {
    decSep = count(',') === 1 && lastGroupLen(',') !== 3 ? ',' : null;
  } else if (hasDot) {
    decSep = count('.') === 1 && lastGroupLen('.') !== 3 ? '.' : null;
  }

  let numeric: string;
  if (decSep) {
    const thousands = decSep === '.' ? ',' : '.';
    numeric = s.split(thousands).join('').replace(decSep, '.');
  } else {
    numeric = s.replace(/[.,]/g, '');
  }

  const parsed = Number.parseFloat(numeric);
  if (Number.isNaN(parsed)) return null;
  const minor = Math.round(parsed * 100);
  return negative ? -minor : minor;
}

export interface NormalizeOptions {
  dateOrder: DateOrder;
  decimal?: DecimalStyle;
}

function cellAmount(
  row: string[],
  mapping: ColumnMapping,
  decimal?: DecimalStyle,
): number | null {
  if (mapping.amount !== null) return parseCsvAmount(row[mapping.amount] ?? '', decimal);

  const debit = mapping.debit !== null ? parseCsvAmount(row[mapping.debit] ?? '', decimal) : null;
  const credit = mapping.credit !== null ? parseCsvAmount(row[mapping.credit] ?? '', decimal) : null;
  if (debit === null && credit === null) return null;
  return (credit ? Math.abs(credit) : 0) - (debit ? Math.abs(debit) : 0);
}

/** Turn raw data rows into normalized transactions, flagging unparseable rows. */
export function normalizeRows(
  rows: string[][],
  mapping: ColumnMapping,
  opts: NormalizeOptions,
): NormalizedRow[] {
  return rows.map((row) => {
    const dateCell = mapping.date !== null ? (row[mapping.date] ?? '') : '';
    const description = mapping.description !== null ? (row[mapping.description] ?? '').trim() : '';
    const date = parseCsvDate(dateCell, opts.dateOrder);
    const amount = cellAmount(row, mapping, opts.decimal);
    const valid = date !== null && amount !== null;

    const result: NormalizedRow = {
      date: date ?? dateCell.trim(),
      description,
      amount: amount ?? 0,
      valid,
    };
    if (!valid) {
      result.error = date === null ? 'Unrecognized date' : 'Unrecognized amount';
    }
    return result;
  });
}
