// Dates are local-timezone YYYY-MM-DD strings; months are YYYY-MM.

export function todayISO(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export function monthOf(dateISO: string): string {
  return dateISO.slice(0, 7);
}
