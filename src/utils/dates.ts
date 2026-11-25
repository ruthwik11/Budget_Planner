import type { DateRange, ISODate } from '@/types';

/** All dates are local calendar dates (YYYY-MM-DD). No timezone drift. */

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export const todayISO = () => toISO(new Date());

export function addDays(s: ISODate, n: number): ISODate {
  const d = fromISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Adds months, clamping the day (Jan 31 + 1 month → Feb 28/29). */
export function addMonths(s: ISODate, n: number, anchorDay?: number): ISODate {
  const d = fromISO(s);
  const day = anchorDay ?? d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, last));
  return toISO(target);
}

export const startOfMonth = (s: ISODate): ISODate => s.slice(0, 8) + '01';
export function endOfMonth(s: ISODate): ISODate {
  const d = fromISO(s);
  return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
export const startOfYear = (s: ISODate): ISODate => s.slice(0, 4) + '-01-01';
export const endOfYear = (s: ISODate): ISODate => s.slice(0, 4) + '-12-31';

/** ISO week starts Monday. */
export function startOfWeek(s: ISODate): ISODate {
  const d = fromISO(s);
  const dow = (d.getDay() + 6) % 7;
  return addDays(s, -dow);
}
export const endOfWeek = (s: ISODate) => addDays(startOfWeek(s), 6);

export const monthKey = (s: ISODate) => s.slice(0, 7);

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86_400_000);
}

export const inRange = (d: ISODate, r: DateRange) => d >= r.from && d <= r.to;

export function monthsBetween(from: ISODate, to: ISODate): string[] {
  const out: string[] = [];
  let cur = startOfMonth(from);
  while (cur <= to) {
    out.push(monthKey(cur));
    cur = addMonths(cur, 1, 1);
  }
  return out;
}

export function monthLabel(key: string, style: 'short' | 'long' = 'short', withYear = false): string {
  const d = fromISO(key + '-01');
  return d.toLocaleString('en-US', { month: style, ...(withYear ? { year: style === 'short' ? '2-digit' : 'numeric' } : {}) });
}

export type DateFormat = 'DD MMM YYYY' | 'MMM DD, YYYY' | 'YYYY-MM-DD' | 'DD/MM/YYYY';

export function formatDate(s: ISODate, fmt: DateFormat = 'DD MMM YYYY'): string {
  const d = fromISO(s);
  const mon = d.toLocaleString('en-US', { month: 'short' });
  switch (fmt) {
    case 'YYYY-MM-DD':
      return s;
    case 'DD/MM/YYYY':
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    case 'MMM DD, YYYY':
      return `${mon} ${d.getDate()}, ${d.getFullYear()}`;
    default:
      return `${pad(d.getDate())} ${mon} ${d.getFullYear()}`;
  }
}

export function relativeDay(s: ISODate, today = todayISO()): string {
  const diff = daysBetween(today, s);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  if (diff < -1 && diff > -7) return `${-diff} days ago`;
  return formatDate(s, 'DD MMM YYYY');
}

export type RangePreset = 'this-month' | 'last-month' | 'last-3' | 'last-6' | 'ytd' | 'last-12' | 'this-year' | 'custom';

export const RANGE_PRESETS: { id: RangePreset; label: string; short: string }[] = [
  { id: 'this-month', label: 'This month', short: 'MTD' },
  { id: 'last-month', label: 'Last month', short: '1M' },
  { id: 'last-3', label: 'Last 3 months', short: '3M' },
  { id: 'last-6', label: 'Last 6 months', short: '6M' },
  { id: 'ytd', label: 'Year to date', short: 'YTD' },
  { id: 'last-12', label: 'Last 12 months', short: '12M' },
];

export function rangeForPreset(p: RangePreset, today = todayISO()): DateRange {
  switch (p) {
    case 'last-month': {
      const s = addMonths(startOfMonth(today), -1, 1);
      return { from: s, to: endOfMonth(s) };
    }
    case 'last-3':
      return { from: addMonths(startOfMonth(today), -2, 1), to: endOfMonth(today) };
    case 'last-6':
      return { from: addMonths(startOfMonth(today), -5, 1), to: endOfMonth(today) };
    case 'ytd':
      return { from: startOfYear(today), to: today };
    case 'this-year':
      return { from: startOfYear(today), to: endOfYear(today) };
    case 'last-12':
      return { from: addMonths(startOfMonth(today), -11, 1), to: endOfMonth(today) };
    case 'this-month':
    default:
      return { from: startOfMonth(today), to: endOfMonth(today) };
  }
}

/** The equally long period immediately before `r`. Month-aligned ranges stay month-aligned. */
export function previousRange(r: DateRange): DateRange {
  const monthAligned = r.from.endsWith('-01') && (r.to === endOfMonth(r.to));
  if (monthAligned) {
    const months = monthsBetween(r.from, r.to).length;
    const from = addMonths(r.from, -months, 1);
    return { from, to: endOfMonth(addMonths(r.from, -1, 1)) };
  }
  const len = daysBetween(r.from, r.to);
  const to = addDays(r.from, -1);
  return { from: addDays(to, -len), to };
}

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return 'Working late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
