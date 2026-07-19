// Pure recurrence math over ISO dates (no crypto, no Dexie).

import { daysInMonth } from './dates';

export type Frequency = 'daily' | 'weekly' | 'monthly';

export interface RecurrenceSpec {
  startDate: string;
  nextRunDate: string;
  freq: Frequency;
  interval: number;
  endDate?: string | null;
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + n));
  return date.toISOString().slice(0, 10);
}

function addMonthsClamped(iso: string, n: number, anchorDay: number): string {
  const [y, m] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const day = Math.min(anchorDay, daysInMonth(`${year}-${String(month).padStart(2, '0')}`));
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * The next occurrence after `dateISO`. For monthly, `anchorDay` (the rule's
 * original day-of-month) is preserved across short months — e.g. a 31st anchor
 * clamps to Feb 28 but returns to Mar 31, rather than drifting.
 */
export function nextOccurrence(
  dateISO: string,
  freq: Frequency,
  interval: number,
  anchorDay?: number,
): string {
  switch (freq) {
    case 'daily':
      return addDays(dateISO, interval);
    case 'weekly':
      return addDays(dateISO, interval * 7);
    case 'monthly':
      return addMonthsClamped(dateISO, interval, anchorDay ?? Number(dateISO.slice(8, 10)));
  }
}

export interface CatchUpResult {
  dates: string[]; // occurrences due on or before today
  nextRunDate: string; // first occurrence strictly after today
  deactivate: boolean; // rule ran past its endDate
}

/**
 * All occurrences due from `nextRunDate` through `today` (inclusive), plus the
 * advanced nextRunDate. Idempotent: once nextRunDate passes today, re-running
 * yields no dates.
 */
export function computeCatchUp(spec: RecurrenceSpec, today: string): CatchUpResult {
  const anchorDay = Number(spec.startDate.slice(8, 10));
  const dates: string[] = [];
  let next = spec.nextRunDate;

  while (next <= today && (!spec.endDate || next <= spec.endDate)) {
    dates.push(next);
    next = nextOccurrence(next, spec.freq, spec.interval, anchorDay);
  }

  const deactivate = spec.endDate ? next > spec.endDate : false;
  return { dates, nextRunDate: next, deactivate };
}
