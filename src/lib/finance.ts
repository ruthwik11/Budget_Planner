/**
 * Pure financial calculations. No React, no store — fully unit-testable.
 * All amounts are integer minor units.
 */
import type {
  Account, Budget, BudgetPeriod, Category, DateRange, Goal, ISODate, Minor, Recurring, Transaction,
} from '@/types';
import {
  addDays, addMonths, daysBetween, endOfMonth, endOfWeek, endOfYear, fromISO, inRange, monthKey,
  monthsBetween, startOfMonth, startOfWeek, startOfYear, todayISO,
} from '@/utils/dates';
import { percent, sumMinor } from '@/utils/money';

// ───────────────────────── totals ─────────────────────────

export interface Totals {
  income: Minor;
  expense: Minor;
  net: Minor;
  savingsRate: number; // %
  count: number;
}

export function totals(txs: Transaction[], range?: DateRange): Totals {
  let income = 0;
  let expense = 0;
  let count = 0;
  for (const t of txs) {
    if (range && !inRange(t.date, range)) continue;
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') expense += t.amount;
    else continue; // transfers move money, they are not income or spending
    count++;
  }
  const net = income - expense;
  return { income, expense, net, savingsRate: income > 0 ? percent(net, income) : 0, count };
}

/** Account balance = opening + inflows − outflows, transfers included. */
export function accountBalances(accounts: Account[], txs: Transaction[], asOf = todayISO()): Map<string, Minor> {
  const m = new Map<string, Minor>(accounts.map((a) => [a.id, a.openingBalance]));
  for (const t of txs) {
    if (t.date > asOf) continue;
    if (t.type === 'income') m.set(t.accountId, (m.get(t.accountId) ?? 0) + t.amount);
    else if (t.type === 'expense') m.set(t.accountId, (m.get(t.accountId) ?? 0) - t.amount);
    else if (t.type === 'transfer') {
      m.set(t.accountId, (m.get(t.accountId) ?? 0) - t.amount);
      if (t.toAccountId) m.set(t.toAccountId, (m.get(t.toAccountId) ?? 0) + t.amount);
    }
  }
  return m;
}

export function totalBalance(accounts: Account[], txs: Transaction[], asOf?: string): Minor {
  const b = accountBalances(accounts, txs, asOf);
  return sumMinor(accounts.filter((a) => !a.archived).map((a) => b.get(a.id) ?? 0));
}

// ───────────────────────── categories ─────────────────────────

export interface CategorySlice {
  categoryId: string;
  name: string;
  color: string;
  amount: Minor;
  share: number; // %
  count: number;
}

export function byCategory(
  txs: Transaction[],
  categories: Category[],
  kind: 'income' | 'expense',
  range?: DateRange,
): CategorySlice[] {
  const map = new Map<string, { amount: Minor; count: number }>();
  for (const t of txs) {
    if (t.type !== kind || !t.categoryId) continue;
    if (range && !inRange(t.date, range)) continue;
    const cur = map.get(t.categoryId) ?? { amount: 0, count: 0 };
    cur.amount += t.amount;
    cur.count++;
    map.set(t.categoryId, cur);
  }
  const total = sumMinor([...map.values()].map((v) => v.amount));
  const catById = new Map(categories.map((c) => [c.id, c]));
  return [...map.entries()]
    .map(([id, v]) => {
      const c = catById.get(id);
      return {
        categoryId: id,
        name: c?.name ?? 'Uncategorised',
        color: c?.color ?? '#8ba4a7',
        amount: v.amount,
        count: v.count,
        share: percent(v.amount, total),
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

// ───────────────────────── time series ─────────────────────────

export interface MonthPoint {
  month: string; // YYYY-MM
  income: Minor;
  expense: Minor;
  net: Minor;
  savingsRate: number;
  cumulativeNet: Minor;
}

export function monthlySeries(txs: Transaction[], range: DateRange): MonthPoint[] {
  const months = monthsBetween(range.from, range.to);
  const idx = new Map(months.map((m, i) => [m, i]));
  const rows = months.map((m) => ({ month: m, income: 0, expense: 0 }));
  for (const t of txs) {
    if (!inRange(t.date, range)) continue;
    const i = idx.get(monthKey(t.date));
    if (i === undefined) continue;
    if (t.type === 'income') rows[i].income += t.amount;
    else if (t.type === 'expense') rows[i].expense += t.amount;
  }
  let cum = 0;
  return rows.map((r) => {
    const net = r.income - r.expense;
    cum += net;
    return { ...r, net, savingsRate: r.income ? percent(net, r.income) : 0, cumulativeNet: cum };
  });
}

export interface DayPoint {
  date: ISODate;
  expense: Minor;
  income: Minor;
  cumulativeExpense: Minor;
}

export function dailySeries(txs: Transaction[], range: DateRange): DayPoint[] {
  const len = daysBetween(range.from, range.to) + 1;
  const rows: DayPoint[] = Array.from({ length: Math.max(0, len) }, (_, i) => ({
    date: addDays(range.from, i), expense: 0, income: 0, cumulativeExpense: 0,
  }));
  for (const t of txs) {
    if (!inRange(t.date, range)) continue;
    const i = daysBetween(range.from, t.date);
    if (t.type === 'expense') rows[i].expense += t.amount;
    else if (t.type === 'income') rows[i].income += t.amount;
  }
  let c = 0;
  for (const r of rows) {
    c += r.expense;
    r.cumulativeExpense = c;
  }
  return rows;
}

// ───────────────────────── budgets ─────────────────────────

export function periodRange(period: BudgetPeriod, ref: ISODate = todayISO()): DateRange {
  if (period === 'weekly') return { from: startOfWeek(ref), to: endOfWeek(ref) };
  if (period === 'yearly') return { from: startOfYear(ref), to: endOfYear(ref) };
  return { from: startOfMonth(ref), to: endOfMonth(ref) };
}

export function previousPeriodRef(period: BudgetPeriod, ref: ISODate): ISODate {
  if (period === 'weekly') return addDays(startOfWeek(ref), -1);
  if (period === 'yearly') return addDays(startOfYear(ref), -1);
  return addDays(startOfMonth(ref), -1);
}

export type BudgetStatus = 'ok' | 'warning' | 'over';

export interface BudgetUsage {
  budget: Budget;
  range: DateRange;
  spent: Minor;
  carried: Minor; // rollover from previous period (≥ 0)
  available: Minor; // limit + carried
  remaining: Minor;
  utilization: number; // %
  status: BudgetStatus;
  /** Projected spend at period end at the current daily pace. */
  projected: Minor;
}

export function spentIn(txs: Transaction[], categoryId: string, range: DateRange): Minor {
  let s = 0;
  for (const t of txs) if (t.type === 'expense' && t.categoryId === categoryId && inRange(t.date, range)) s += t.amount;
  return s;
}

export function budgetUsage(b: Budget, txs: Transaction[], ref: ISODate = todayISO(), warnAt = 80): BudgetUsage {
  const range = periodRange(b.period, ref);
  const spent = spentIn(txs, b.categoryId, range);
  let carried = 0;
  if (b.rollover) {
    // One-period rollover of unspent budget. Overspend does not roll forward as debt.
    const prev = periodRange(b.period, previousPeriodRef(b.period, ref));
    carried = Math.max(0, b.limit - spentIn(txs, b.categoryId, prev));
  }
  const available = b.limit + carried;
  const utilization = available > 0 ? percent(spent, available) : spent > 0 ? 100 : 0;
  const status: BudgetStatus = spent > available ? 'over' : utilization >= warnAt ? 'warning' : 'ok';
  const total = daysBetween(range.from, range.to) + 1;
  const elapsed = Math.min(total, Math.max(1, daysBetween(range.from, ref) + 1));
  // Recurring charges (rent, subscriptions) happen once per period: don't extrapolate them.
  let fixed = 0;
  for (const t of txs) if (t.recurringId && t.type === 'expense' && t.categoryId === b.categoryId && inRange(t.date, range)) fixed += t.amount;
  const projected = fixed + Math.round(((spent - fixed) * total) / elapsed);
  return { budget: b, range, spent, carried, available, remaining: available - spent, utilization, status, projected };
}

/** Spend vs limit for each of the last `n` months of a monthly budget. */
export function budgetHistory(b: Budget, txs: Transaction[], n = 6, ref = todayISO()) {
  return Array.from({ length: n }, (_, i) => {
    const mRef = addMonths(startOfMonth(ref), -(n - 1 - i), 1);
    const range = periodRange('monthly', mRef);
    const limit = b.period === 'monthly' ? b.limit : b.period === 'weekly' ? Math.round((b.limit * 52) / 12) : Math.round(b.limit / 12);
    return { month: monthKey(mRef), spent: spentIn(txs, b.categoryId, range), limit };
  });
}

// ───────────────────────── goals ─────────────────────────

export interface GoalProgress {
  saved: Minor;
  remaining: Minor;
  pct: number;
  complete: boolean;
  monthlyPace: Minor; // average contribution per month since creation
  requiredMonthly: Minor | null; // to hit deadline
  eta: ISODate | null;
  onTrack: boolean | null;
  milestone: 0 | 25 | 50 | 75 | 100;
}

export function goalProgress(g: Goal, today = todayISO()): GoalProgress {
  const saved = Math.max(0, sumMinor(g.contributions.map((c) => c.amount)));
  const remaining = Math.max(0, g.target - saved);
  const pct = g.target > 0 ? Math.min(100, percent(saved, g.target)) : 0;
  const complete = saved >= g.target && g.target > 0;
  const first = g.contributions.reduce<string>((m, c) => (c.date < m ? c.date : m), g.createdAt);
  const months = Math.max(1, monthsBetween(first, today).length);
  const monthlyPace = Math.round(saved / months);
  let requiredMonthly: Minor | null = null;
  let onTrack: boolean | null = null;
  if (g.deadline && !complete) {
    const left = Math.max(1, monthsBetween(today, g.deadline).length);
    requiredMonthly = Math.ceil(remaining / left);
    onTrack = monthlyPace >= requiredMonthly;
  }
  let eta: ISODate | null = null;
  if (complete) eta = today;
  else if (monthlyPace > 0) eta = addMonths(today, Math.ceil(remaining / monthlyPace));
  const milestone = (pct >= 100 ? 100 : pct >= 75 ? 75 : pct >= 50 ? 50 : pct >= 25 ? 25 : 0) as GoalProgress['milestone'];
  return { saved, remaining, pct, complete, monthlyPace, requiredMonthly, eta, onTrack, milestone };
}

// ───────────────────────── recurring ─────────────────────────

export function nextOccurrence(r: Recurring, after: ISODate): ISODate {
  // first occurrence strictly after `after`, aligned to startDate
  if (after < r.startDate) return r.startDate;
  const step = Math.max(1, r.interval);
  if (r.frequency === 'daily') {
    const n = Math.floor(daysBetween(r.startDate, after) / step) + 1;
    return addDays(r.startDate, n * step);
  }
  if (r.frequency === 'weekly') {
    const n = Math.floor(daysBetween(r.startDate, after) / (7 * step)) + 1;
    return addDays(r.startDate, n * 7 * step);
  }
  const anchor = fromISO(r.startDate).getDate();
  const monthsPer = r.frequency === 'yearly' ? 12 * step : step;
  const a = fromISO(r.startDate);
  const b = fromISO(after);
  let n = Math.floor(((b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())) / monthsPer);
  let d = addMonths(r.startDate, n * monthsPer, anchor);
  while (d <= after) {
    n++;
    d = addMonths(r.startDate, n * monthsPer, anchor);
  }
  return d;
}

/** All occurrence dates in [from, to]. */
export function occurrences(r: Recurring, from: ISODate, to: ISODate, limit = 400): ISODate[] {
  const out: ISODate[] = [];
  let d = from <= r.startDate ? r.startDate : nextOccurrence(r, addDays(from, -1));
  while (d <= to && out.length < limit) {
    if (r.endDate && d > r.endDate) break;
    out.push(d);
    d = nextOccurrence(r, d);
  }
  return out;
}

/** Occurrences that are due (≤ today) and not yet posted. */
export function dueOccurrences(r: Recurring, today = todayISO()): ISODate[] {
  if (!r.active || !r.autoPost) return [];
  const from = r.lastPosted ? addDays(r.lastPosted, 1) : r.startDate;
  return occurrences(r, from, today);
}

export interface Upcoming {
  recurring: Recurring;
  date: ISODate;
}

export function upcoming(rs: Recurring[], days = 30, today = todayISO()): Upcoming[] {
  const to = addDays(today, days);
  const out: Upcoming[] = [];
  for (const r of rs) {
    if (!r.active) continue;
    for (const d of occurrences(r, addDays(today, 1), to, 40)) out.push({ recurring: r, date: d });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Normalised monthly amount of a recurring rule. */
export function monthlyEquivalent(r: Recurring): Minor {
  const i = Math.max(1, r.interval);
  switch (r.frequency) {
    case 'daily': return Math.round((r.amount * 365) / 12 / i);
    case 'weekly': return Math.round((r.amount * 52) / 12 / i);
    case 'yearly': return Math.round(r.amount / 12 / i);
    default: return Math.round(r.amount / i);
  }
}

// ───────────────────────── forecast & insights ─────────────────────────

export interface MonthForecast {
  spentSoFar: Minor;
  projectedExpense: Minor;
  projectedIncome: Minor;
  scheduledIncome: Minor;
  scheduledExpense: Minor;
  endBalance: Minor;
}

/**
 * End-of-month projection:
 *  discretionary pace (non-recurring spend / elapsed days) × remaining days
 *  + scheduled recurring items still to come this month.
 */
export function forecastMonth(txs: Transaction[], rs: Recurring[], balanceNow: Minor, today = todayISO()): MonthForecast {
  const range = { from: startOfMonth(today), to: endOfMonth(today) };
  const sofar = { from: range.from, to: today };
  const t = totals(txs, sofar);
  const discretionary = sumMinor(
    txs.filter((x) => x.type === 'expense' && !x.recurringId && inRange(x.date, sofar)).map((x) => x.amount),
  );
  const elapsed = daysBetween(range.from, today) + 1;
  const left = daysBetween(today, range.to);
  const pace = Math.round((discretionary * left) / Math.max(1, elapsed));
  let scheduledIncome = 0;
  let scheduledExpense = 0;
  for (const r of rs) {
    if (!r.active) continue;
    const n = occurrences(r, addDays(today, 1), range.to).length;
    if (r.type === 'income') scheduledIncome += n * r.amount;
    else scheduledExpense += n * r.amount;
  }
  return {
    spentSoFar: t.expense,
    projectedExpense: t.expense + pace + scheduledExpense,
    projectedIncome: t.income + scheduledIncome,
    scheduledIncome,
    scheduledExpense,
    endBalance: balanceNow + scheduledIncome - scheduledExpense - pace,
  };
}

/** Simple linear forecast of the next `n` months using a weighted average of the last 6. */
export function forecastMonths(series: MonthPoint[], n = 3, afterMonth?: string): { month: string; income: Minor; expense: Minor }[] {
  const tail = series.slice(-6);
  if (!tail.length) return [];
  const w = tail.map((_, i) => i + 1);
  const ws = sumMinor(w);
  const inc = Math.round(sumMinor(tail.map((p, i) => p.income * w[i])) / ws);
  const exp = Math.round(sumMinor(tail.map((p, i) => p.expense * w[i])) / ws);
  const last = (afterMonth ?? tail[tail.length - 1].month) + '-01';
  return Array.from({ length: n }, (_, i) => ({ month: monthKey(addMonths(last, i + 1, 1)), income: inc, expense: exp }));
}

export interface Anomaly {
  tx: Transaction;
  ratio: number; // amount / category median
}

/** Transactions ≥ 2.5× their category's median in the trailing 90 days. */
export function anomalies(txs: Transaction[], range: DateRange): Anomaly[] {
  const from = addDays(range.from, -90);
  const byCat = new Map<string, Minor[]>();
  for (const t of txs) {
    if (t.type !== 'expense' || !t.categoryId || t.date < from || t.date > range.to || t.recurringId) continue;
    const a = byCat.get(t.categoryId) ?? [];
    a.push(t.amount);
    byCat.set(t.categoryId, a);
  }
  const med = new Map<string, number>();
  for (const [k, arr] of byCat) {
    if (arr.length < 4) continue;
    const s = [...arr].sort((a, b) => a - b);
    med.set(k, s[Math.floor(s.length / 2)]);
  }
  const out: Anomaly[] = [];
  for (const t of txs) {
    if (t.type !== 'expense' || !t.categoryId || !inRange(t.date, range) || t.recurringId) continue;
    const m = med.get(t.categoryId);
    if (m && t.amount >= m * 2.5) out.push({ tx: t, ratio: Math.round((t.amount / m) * 10) / 10 });
  }
  return out.sort((a, b) => b.ratio - a.ratio).slice(0, 5);
}

export function changePct(cur: Minor, prev: Minor): number | null {
  if (prev === 0) return cur === 0 ? 0 : null;
  return percent(cur - prev, Math.abs(prev));
}
