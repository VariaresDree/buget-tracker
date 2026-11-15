// Transaction search. Runs over the already-decrypted list in memory; the
// query is never stored or sent anywhere.

interface Searchable {
  amount: number; // minor units, negative for spending
  note: string;
}

/**
 * True when every word of `query` appears in the transaction's note, category,
 * account or amount (case-insensitive). An empty query matches everything.
 */
export function matchesQuery(
  tx: Searchable,
  query: string,
  accountName: string,
  categoryName: string,
): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const amount = (Math.abs(tx.amount) / 100).toFixed(2);
  const haystack = [tx.note, categoryName, accountName, amount].join(' ').toLowerCase();
  return terms.every((term) => haystack.includes(term));
}
