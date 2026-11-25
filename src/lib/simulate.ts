/**
 * What-if projection. Starts from the user's recent monthly averages and
 * projects month-end balances for a baseline and a scenario side by side.
 */
import type { Minor } from '@/types';
import { addMonths, monthKey, startOfMonth, todayISO } from '@/utils/dates';

export interface Baseline {
  balance: Minor;
  income: Minor; // average monthly income
  expenses: Record<string, Minor>; // average monthly spend per category id
  debtPayments: Minor; // monthly EMIs not already counted as expenses
}

export interface Scenario {
  incomeChangePct: number; // e.g. +10 for a raise (applies from `incomeFromMonth`)
  incomeFromMonth: number; // 0-based month offset
  cuts: Record<string, number>; // category id → % cut (0–100)
  extraMonthlySpend: Minor; // a new recurring cost (e.g. car EMI)
  oneOff: { amount: Minor; month: number } | null; // a big purchase
  sideIncome: Minor; // extra monthly income
  incomePause: { from: number; months: number } | null; // e.g. a job gap: main income is zero for these months
}

export const emptyScenario: Scenario = { incomeChangePct: 0, incomeFromMonth: 0, cuts: {}, extraMonthlySpend: 0, oneOff: null, sideIncome: 0, incomePause: null };

export interface ProjectionPoint {
  month: string;
  baseline: Minor;
  scenario: Minor;
}

export function monthlyNet(b: Baseline, s: Scenario | null, monthIndex: number): Minor {
  const spend = Object.entries(b.expenses).reduce((sum, [cat, amt]) => sum + Math.round(amt * (1 - (s ? (s.cuts[cat] ?? 0) / 100 : 0))), 0);
  if (!s) return b.income - spend - b.debtPayments;
  const paused = !!s.incomePause && monthIndex >= s.incomePause.from && monthIndex < s.incomePause.from + s.incomePause.months;
  const main = paused ? 0 : b.income + (monthIndex >= s.incomeFromMonth ? Math.round((b.income * s.incomeChangePct) / 100) : 0);
  const income = main + s.sideIncome;
  const oneOff = s.oneOff && s.oneOff.month === monthIndex ? s.oneOff.amount : 0;
  return income - spend - b.debtPayments - s.extraMonthlySpend - oneOff;
}

export function project(b: Baseline, s: Scenario, months = 24, today = todayISO()): ProjectionPoint[] {
  const out: ProjectionPoint[] = [];
  let base = b.balance;
  let scen = b.balance;
  for (let i = 0; i < months; i++) {
    base += monthlyNet(b, null, i);
    scen += monthlyNet(b, s, i);
    out.push({ month: monthKey(addMonths(startOfMonth(today), i + 1, 1)), baseline: base, scenario: scen });
  }
  return out;
}

/** Months until a cumulative saving target is reached at a given monthly net (null if never). */
export function monthsToTarget(remaining: Minor, perMonth: Minor): number | null {
  if (remaining <= 0) return 0;
  if (perMonth <= 0) return null;
  return Math.ceil(remaining / perMonth);
}
