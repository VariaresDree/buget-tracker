// All money values are integers in minor units (centavos/cents) — never floats.

const formatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(minorUnits: number, symbol: string): string {
  const sign = minorUnits < 0 ? '-' : '';
  return `${sign}${symbol}${formatter.format(Math.abs(minorUnits) / 100)}`;
}

const AMOUNT_RE = /^-?(\d{1,3}(,\d{3})*|\d+)(\.\d{1,2})?$/;

/** "1,234.56" → 123456 minor units; returns null for invalid input. */
export function parseAmountInput(input: string): number | null {
  const trimmed = input.trim();
  if (!AMOUNT_RE.test(trimmed)) return null;
  return Math.round(parseFloat(trimmed.replace(/,/g, '')) * 100);
}
