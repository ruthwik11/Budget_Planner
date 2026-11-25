import { describe, expect, it } from 'vitest';
import type { Debt, SplitGroup } from '@/types';
import { amortize, debtBalance, emi, monthlyInterest, planPayoff, splitPayment } from './debts';
import { groupBalances, sharesOf, simplify, validateSplit } from './split';
import { breakEvenDeductions, computeTax, emptyTaxProfile } from './tax';
import { emptyScenario, monthsToTarget, project } from './simulate';

const R = (rupees: number) => rupees * 100;
const debt = (p: Partial<Debt>): Debt => ({
  id: 'd', userId: 'u', name: 'Loan', lender: 'Bank', kind: 'personal', original: R(100000), opening: R(100000), aprBps: 1200,
  payment: R(10000), dueDay: 5, startDate: '2026-01-01', color: '#4c9db0', payments: [], ...p,
});

describe('debts', () => {
  it('computes monthly interest and a standard EMI', () => {
    expect(monthlyInterest(R(100000), 1200)).toBe(R(1000)); // 12% → 1%/month
    expect(emi(R(100000), 1200, 12)).toBe(888488); // ₹8,884.88
  });
  it('amortizes to zero and reports interest', () => {
    const p = amortize(R(100000), 1200, emi(R(100000), 1200, 12), '2026-01-01');
    expect(p.months).toBe(12);
    expect(p.rows[11].balance).toBe(0);
    expect(p.totalInterest).toBeGreaterThan(R(6600));
    expect(p.totalInterest).toBeLessThan(R(6640));
  });
  it('flags payments that never cover interest', () => {
    expect(amortize(R(100000), 1200, R(900)).months).toBeNull();
  });
  it('splits a payment into interest then principal', () => {
    const d = debt({});
    expect(splitPayment(d, R(10000))).toEqual({ interest: R(1000), principal: R(9000) });
    expect(debtBalance({ ...d, payments: [{ id: 'p', date: '2026-02-05', amount: R(10000), interest: R(1000), principal: R(9000) }] })).toBe(R(91000));
  });
  it('avalanche pays less interest than snowball, and extra money shortens payoff', () => {
    const ds = [
      debt({ id: 'card', opening: R(40000), aprBps: 4200, payment: R(2000) }),
      debt({ id: 'car', opening: R(300000), aprBps: 925, payment: R(9000) }),
      debt({ id: 'small', opening: R(15000), aprBps: 1000, payment: R(1000) }),
    ];
    const ava = planPayoff(ds, R(5000), 'avalanche', '2026-01-01');
    const snow = planPayoff(ds, R(5000), 'snowball', '2026-01-01');
    const min = planPayoff(ds, 0, 'minimum', '2026-01-01');
    expect(ava.order[0]).toBe('card');
    expect(snow.order[0]).toBe('small');
    expect(ava.totalInterest).toBeLessThanOrEqual(snow.totalInterest);
    expect(ava.months!).toBeLessThan(min.months!);
    expect(ava.timeline[ava.timeline.length - 1]).toBe(0);
  });
});

describe('split', () => {
  const g: SplitGroup = {
    id: 'g', userId: 'u', name: 'Trip', icon: 'users', color: '#4c9db0', createdAt: '2026-01-01',
    members: [{ id: 'me', name: 'You' }, { id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    expenses: [
      { id: 'e1', title: 'Villa', amount: R(300) + 1, date: '2026-01-02', paidBy: 'me', mode: 'equal', shares: {} },
      { id: 'e2', title: 'Dinner', amount: R(90), date: '2026-01-03', paidBy: 'a', mode: 'percent', shares: { me: 5000, a: 2500, b: 2500 } },
    ],
    settlements: [],
  };
  it('equal shares sum exactly, remainder to first member', () => {
    const s = sharesOf(g.expenses[0], ['me', 'a', 'b']);
    expect(s).toEqual({ me: 10001, a: 10000, b: 10000 });
  });
  it('percent shares sum exactly', () => {
    expect(sharesOf(g.expenses[1], ['me', 'a', 'b'])).toEqual({ me: 4500, a: 2250, b: 2250 });
  });
  it('balances net to zero and simplify settles them', () => {
    const net = groupBalances(g);
    expect(Object.values(net).reduce((a, b) => a + b, 0)).toBe(0);
    const t = simplify(net);
    const after = { ...net };
    t.forEach((x) => {
      after[x.from] += x.amount;
      after[x.to] -= x.amount;
    });
    expect(Object.values(after).every((v) => v === 0)).toBe(true);
    expect(t.length).toBeLessThanOrEqual(2);
  });
  it('validates exact and percent splits', () => {
    expect(validateSplit({ amount: 100, mode: 'exact', shares: { a: 60, b: 30 } })).not.toBeNull();
    expect(validateSplit({ amount: 100, mode: 'percent', shares: { a: 5000, b: 5000 } })).toBeNull();
  });
});

describe('tax (FY 2025-26)', () => {
  const p = emptyTaxProfile('u');
  it('₹12.75L salary pays zero under the new regime', () => {
    expect(computeTax('new', R(1275000), p).total).toBe(0);
  });
  it('applies marginal relief just above ₹12L taxable', () => {
    // gross 13L → taxable 12.25L → tax capped at ₹25,000 + 4% cess
    expect(computeTax('new', R(1300000), p).total).toBe(R(26000));
  });
  it('old regime with full 80C', () => {
    // 10L − 50k std − 1.5L 80C = 8L taxable → 12,500 + 60,000 = 72,500 + cess 2,900
    expect(computeTax('old', R(1000000), { ...p, sec80C: R(200000) }).total).toBe(R(75400));
  });
  it('new regime at ₹20L', () => {
    // taxable 19.25L: 20k + 40k + 60k + 65k = 1,85,000 + cess 7,400
    expect(computeTax('new', R(2000000), p).total).toBe(R(192400));
  });
  it('break-even returns 0 when old is already cheaper', () => {
    const rich = { ...p, sec80C: R(150000), sec80D: R(50000), sec80CCD1B: R(50000), homeLoanInterest: R(200000), hraExemption: R(300000) };
    expect(breakEvenDeductions(R(2000000), rich)).toBe(0);
  });
});

describe('simulator', () => {
  it('cuts and raises move the scenario above baseline', () => {
    const b = { balance: R(100000), income: R(100000), expenses: { food: R(30000), rent: R(40000) }, debtPayments: 0 };
    const pts = project(b, { ...emptyScenario, cuts: { food: 50 }, incomeChangePct: 10 }, 12, '2026-01-15');
    expect(pts[0].baseline).toBe(R(130000));
    expect(pts[0].scenario).toBe(R(155000));
    expect(pts[11].month).toBe('2027-01');
  });
  it('months to target', () => {
    expect(monthsToTarget(R(100), R(30))).toBe(4);
    expect(monthsToTarget(R(100), 0)).toBeNull();
  });
});

describe('simulator income pause', () => {
  it('zeroes main income during the pause only', () => {
    const b = { balance: 0, income: 100, expenses: { x: 40 }, debtPayments: 0 };
    const pts = project(b, { ...emptyScenario, incomePause: { from: 1, months: 2 } }, 4, '2026-01-15');
    expect(pts.map((p) => p.scenario)).toEqual([60, 20, -20, 40]);
  });
});
