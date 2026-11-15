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

export function daysInMonth(month: string): number {
  const [year, m] = month.split('-').map(Number);
  return new Date(year, m, 0).getDate();
}

export function addMonths(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number);
  const total = year * 12 + (m - 1) + delta;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, '0')}`;
}

/** "November 2026" for a YYYY-MM month, in the device's language. */
export function formatMonth(month: string): string {
  return new Date(`${month}-01T00:00`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

/** "Today", "Yesterday", or "Fri, 14 Nov" (with the year when it isn't this one). */
export function formatDay(dateISO: string, today: string = todayISO()): string {
  if (dateISO === today) return 'Today';
  const yesterday = new Date(`${today}T00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  const date = new Date(`${dateISO}T00:00`);
  if (date.getTime() === yesterday.getTime()) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(dateISO.slice(0, 4) === today.slice(0, 4) ? {} : { year: 'numeric' }),
  });
}
