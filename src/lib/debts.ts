/**
 * Debt math. Interest is simple monthly accrual on the outstanding balance
 * (APR / 12), the convention Indian lenders use for reducing-balance EMIs.
 * All amounts are integer minor units; rates are basis points.
 */
import type { Debt, ISODate, Minor } from '@/types';
import { addMonths, todayISO } from '@/utils/dates';
import { sumMinor } from '@/utils/money';

export const monthlyInterest = (balance: Minor, aprBps: number): Minor => Math.round((balance * aprBps) / 10000 / 12);

/** Outstanding balance after all recorded payments. */
export function debtBalance(d: Debt): Minor {
  return Math.max(0, d.opening - sumMinor(d.payments.map((p) => p.principal)));
}

/** Split a payment into interest (on the current balance) and principal. */
export function splitPayment(d: Debt, amount: Minor): { interest: Minor; principal: Minor } {
  const bal = debtBalance(d);
  const interest = Math.min(amount, monthlyInterest(bal, d.aprBps));
  const principal = Math.min(bal, amount - interest);
  return { interest, principal };
}

/** Standard EMI for a principal, APR and tenure. */
export function emi(principal: Minor, aprBps: number, months: number): Minor {
  const r = aprBps / 10000 / 12;
  if (r === 0) return Math.ceil(principal / months);
  const f = Math.pow(1 + r, months);
  return Math.ceil((principal * r * f) / (f - 1));
}

export interface AmortRow {
  month: number;
  date: ISODate;
  interest: Minor;
  principal: Minor;
  balance: Minor;
}

export interface Payoff {
  months: number | null; // null → payment never covers interest
  totalInterest: Minor;
  payoffDate: ISODate | null;
  rows: AmortRow[];
}

/** Month-by-month schedule for one debt at a fixed monthly payment (+ optional extra). */
export function amortize(balance: Minor, aprBps: number, payment: Minor, start = todayISO(), extra = 0, cap = 600): Payoff {
  const rows: AmortRow[] = [];
  let bal = balance;
  let totalInterest = 0;
  const pay = payment + extra;
  if (bal <= 0) return { months: 0, totalInterest: 0, payoffDate: start, rows };
  if (pay <= monthlyInterest(bal, aprBps)) return { months: null, totalInterest: 0, payoffDate: null, rows };
  for (let m = 1; m <= cap && bal > 0; m++) {
    const interest = monthlyInterest(bal, aprBps);
    const principal = Math.min(bal, pay - interest);
    bal -= principal;
    totalInterest += interest;
    rows.push({ month: m, date: addMonths(start, m), interest, principal, balance: bal });
  }
  return { months: bal > 0 ? null : rows.length, totalInterest, payoffDate: bal > 0 ? null : rows[rows.length - 1].date, rows };
}

export type Strategy = 'avalanche' | 'snowball' | 'minimum';

export interface PlanResult {
  strategy: Strategy;
  months: number | null;
  totalInterest: Minor;
  debtFreeDate: ISODate | null;
  /** total outstanding at the end of each month (index 0 = today) */
  timeline: Minor[];
  /** month each debt is cleared, by id */
  clearedAt: Record<string, number>;
  order: string[];
}

/**
 * Multi-debt payoff plan. Every month: accrue interest, pay each minimum,
 * then pour `extra` plus any freed-up minimums into the target debt
 * (avalanche: highest rate first; snowball: smallest balance first).
 */
export function planPayoff(debts: Debt[], extra: Minor, strategy: Strategy, start = todayISO(), cap = 600): PlanResult {
  const live = debts.map((d) => ({ id: d.id, bal: debtBalance(d), apr: d.aprBps, min: d.payment })).filter((d) => d.bal > 0);
  const order = [...live]
    .sort((a, b) => (strategy === 'snowball' ? a.bal - b.bal : b.apr - a.apr || a.bal - b.bal))
    .map((d) => d.id);
  const timeline: Minor[] = [sumMinor(live.map((d) => d.bal))];
  const clearedAt: Record<string, number> = {};
  let totalInterest = 0;
  let month = 0;
  const budget = sumMinor(live.map((d) => d.min)) + (strategy === 'minimum' ? 0 : extra);
  while (live.some((d) => d.bal > 0) && month < cap) {
    month++;
    let pool = budget;
    for (const d of live) {
      if (d.bal <= 0) continue;
      const i = monthlyInterest(d.bal, d.apr);
      d.bal += i;
      totalInterest += i;
    }
    // minimums first
    for (const d of live) {
      if (d.bal <= 0) continue;
      const p = Math.min(d.bal, d.min, pool);
      d.bal -= p;
      pool -= p;
    }
    // then everything left goes to targets in order
    if (strategy !== 'minimum') {
      for (const id of order) {
        if (pool <= 0) break;
        const d = live.find((x) => x.id === id)!;
        if (d.bal <= 0) continue;
        const p = Math.min(d.bal, pool);
        d.bal -= p;
        pool -= p;
      }
    }
    for (const d of live) if (d.bal <= 0 && clearedAt[d.id] === undefined) clearedAt[d.id] = month;
    timeline.push(sumMinor(live.map((d) => Math.max(0, d.bal))));
    // stalled: payments don't cover interest
    if (month > 1 && timeline[month] >= timeline[month - 1] && timeline[month] > 0) {
      return { strategy, months: null, totalInterest, debtFreeDate: null, timeline, clearedAt, order };
    }
  }
  const done = !live.some((d) => d.bal > 0);
  return { strategy, months: done ? month : null, totalInterest, debtFreeDate: done ? addMonths(start, month) : null, timeline, clearedAt, order };
}

/** Debt-to-income ratio (%) from monthly payments vs monthly income. */
export const dti = (monthlyPayments: Minor, monthlyIncome: Minor) => (monthlyIncome > 0 ? Math.round((monthlyPayments * 1000) / monthlyIncome) / 10 : 0);
