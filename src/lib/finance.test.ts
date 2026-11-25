import { describe, expect, it } from 'vitest';
import type { Account, Budget, Goal, Recurring, Transaction } from '@/types';
import {
  accountBalances, budgetUsage, byCategory, dueOccurrences, forecastMonth, goalProgress, monthlyEquivalent,
  monthlySeries, nextOccurrence, occurrences, totals,
} from './finance';
import { convert, formatMoney, minorToDecimalString, parseMoney, percent } from '@/utils/money';
import { addMonths, previousRange, rangeForPreset } from '@/utils/dates';
import { escapeCell, parseCSV, toCSV } from '@/utils/csv';

const tx = (p: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36), userId: 'u', type: 'expense', title: 't', amount: 0, date: '2026-03-10',
  categoryId: 'food', accountId: 'a1', paymentMethod: 'card', tags: [], createdAt: 0, ...p,
});

describe('money', () => {
  it('parses without float error', () => {
    expect(parseMoney('0.1')).toBe(10);
    expect(parseMoney('1,23,456.78')).toBe(12345678);
    expect(parseMoney('19.99')).toBe(1999);
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('1.234')).toBeNull();
  });
  it('sums 0.1 + 0.2 exactly in minor units', () => {
    expect((parseMoney('0.1') ?? 0) + (parseMoney('0.2') ?? 0)).toBe(30);
  });
  it('formats exact decimal strings', () => {
    expect(minorToDecimalString(-123456)).toBe('-1234.56');
    expect(formatMoney(150000000, { currency: 'INR', locale: 'en-IN' })).toBe('₹15,00,000.00');
    expect(formatMoney(1999, { currency: 'USD', locale: 'en-US' })).toBe('$19.99');
  });
  it('converts with single rounding', () => {
    expect(convert(9000, 'INR', 'EUR')).toBe(100); // ₹90 → €1
    expect(convert(100, 'EUR', 'INR')).toBe(9000);
  });
  it('percent is stable', () => {
    expect(percent(1, 3)).toBe(33.3);
    expect(percent(0, 0)).toBe(0);
  });
});

describe('totals', () => {
  it('ignores transfers and computes savings rate', () => {
    const t = totals([
      tx({ type: 'income', amount: 100000 }),
      tx({ type: 'expense', amount: 25000 }),
      tx({ type: 'transfer', amount: 50000, toAccountId: 'a2', categoryId: null }),
    ]);
    expect(t).toMatchObject({ income: 100000, expense: 25000, net: 75000, savingsRate: 75, count: 2 });
  });
  it('balances include transfers', () => {
    const accts: Account[] = [
      { id: 'a1', userId: 'u', name: 'A', type: 'checking', openingBalance: 1000, color: '' },
      { id: 'a2', userId: 'u', name: 'B', type: 'savings', openingBalance: 0, color: '' },
    ];
    const b = accountBalances(accts, [tx({ type: 'transfer', amount: 400, toAccountId: 'a2', categoryId: null })], '2030-01-01');
    expect(b.get('a1')).toBe(600);
    expect(b.get('a2')).toBe(400);
  });
  it('groups by category with shares', () => {
    const s = byCategory([tx({ amount: 300 }), tx({ amount: 100, categoryId: 'fun' })], [], 'expense');
    expect(s[0]).toMatchObject({ categoryId: 'food', amount: 300, share: 75 });
  });
  it('builds monthly series with cumulative net', () => {
    const s = monthlySeries(
      [tx({ type: 'income', amount: 1000, date: '2026-01-05' }), tx({ amount: 400, date: '2026-02-05' })],
      { from: '2026-01-01', to: '2026-02-28' },
    );
    expect(s.map((p) => p.cumulativeNet)).toEqual([1000, 600]);
  });
});

describe('budgets', () => {
  const b: Budget = { id: 'b', userId: 'u', categoryId: 'food', period: 'monthly', limit: 10000, rollover: true };
  it('applies one-period rollover of unspent budget', () => {
    const u = budgetUsage(b, [tx({ amount: 4000, date: '2026-02-10' }), tx({ amount: 9000, date: '2026-03-05' })], '2026-03-15');
    expect(u.carried).toBe(6000);
    expect(u.available).toBe(16000);
    expect(u.status).toBe('ok');
  });
  it('flags overspend', () => {
    const u = budgetUsage({ ...b, rollover: false }, [tx({ amount: 12000, date: '2026-03-05' })], '2026-03-15');
    expect(u.status).toBe('over');
    expect(u.remaining).toBe(-2000);
  });
});

describe('goals', () => {
  it('computes progress and milestone', () => {
    const g: Goal = {
      id: 'g', userId: 'u', title: 'x', target: 100000, deadline: '2026-12-31', color: '', icon: 'target', createdAt: '2026-01-01',
      contributions: [{ id: 'c', date: '2026-01-01', amount: 60000 }],
    };
    const p = goalProgress(g, '2026-03-15');
    expect(p.pct).toBe(60);
    expect(p.milestone).toBe(50);
    expect(p.remaining).toBe(40000);
    expect(p.eta).not.toBeNull();
  });
});

describe('recurring', () => {
  const r: Recurring = {
    id: 'r', userId: 'u', type: 'expense', title: 'Rent', amount: 2000000, categoryId: 'home', accountId: 'a1',
    paymentMethod: 'bank', frequency: 'monthly', interval: 1, startDate: '2026-01-31', endDate: null, lastPosted: null,
    autoPost: true, active: true,
  };
  it('clamps month-end dates and keeps the anchor day', () => {
    expect(occurrences(r, '2026-01-01', '2026-04-30')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });
  it('finds the next occurrence', () => {
    expect(nextOccurrence({ ...r, startDate: '2026-01-15' }, '2026-03-15')).toBe('2026-04-15');
    expect(nextOccurrence({ ...r, frequency: 'weekly', startDate: '2026-03-02' }, '2026-03-02')).toBe('2026-03-09');
  });
  it('only returns unposted due dates', () => {
    expect(dueOccurrences({ ...r, lastPosted: '2026-02-28' }, '2026-04-01')).toEqual(['2026-03-31']);
  });
  it('normalises to monthly', () => {
    expect(monthlyEquivalent({ ...r, frequency: 'yearly', amount: 120000 })).toBe(10000);
    expect(monthlyEquivalent({ ...r, frequency: 'weekly', amount: 1200 })).toBe(5200);
  });
  it('forecast adds scheduled items', () => {
    const f = forecastMonth([], [{ ...r, startDate: '2026-03-25' }], 5000000, '2026-03-10');
    expect(f.scheduledExpense).toBe(2000000);
    expect(f.endBalance).toBe(3000000);
  });
});

describe('dates', () => {
  it('previous range is month aligned', () => {
    expect(previousRange({ from: '2026-03-01', to: '2026-03-31' })).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(rangeForPreset('last-3', '2026-03-10')).toEqual({ from: '2026-01-01', to: '2026-03-31' });
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
  });
});

describe('csv', () => {
  it('neutralises formula injection and round-trips', () => {
    expect(escapeCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(escapeCell('-500')).toBe('-500');
    const csv = toCSV(['a', 'b'], [['x, y', 'he said "hi"']]);
    expect(parseCSV(csv)).toEqual([['a', 'b'], ['x, y', 'he said "hi"']]);
  });
});

describe('schemas', () => {
  it('rejects impossible calendar dates', async () => {
    const { csvRowSchema } = await import('@/schemas');
    const row = { type: 'expense', title: 'x', category: 'Food', amount: '10' };
    expect(csvRowSchema.safeParse({ ...row, date: '2026-13-01' }).success).toBe(false);
    expect(csvRowSchema.safeParse({ ...row, date: '2026-02-30' }).success).toBe(false);
    expect(csvRowSchema.safeParse({ ...row, date: '2028-02-29' }).success).toBe(true);
  });
});
