// Import dedupe key. The hash is over stable, non-secret fields so the same
// statement row imported twice collides; it is not a security primitive.

function normalizeDescription(description: string): string {
  return description.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** SHA-256 hex of accountId | date | amount | normalized description. */
export async function computeImportHash(
  accountId: number,
  date: string,
  amount: number,
  description: string,
): Promise<string> {
  const key = `${accountId}|${date}|${amount}|${normalizeDescription(description)}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
