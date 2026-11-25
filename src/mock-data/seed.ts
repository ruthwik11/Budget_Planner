/**
 * Configurable, deterministic demo datasets. Dates are generated relative to
 * "today" so the demo always looks current. Nothing here is a permanent
 * assumption of the app — users can switch datasets or wipe everything.
 */
import type {
  Account, AuditLog, Budget, Category, CategoryKind, Dataset, Debt, Goal, IconName, Recurring, SplitGroup, TaxProfile, Transaction, User,
} from '@/types';
import { monthlyInterest } from '@/lib/debts';
import { addDays, addMonths, startOfMonth, todayISO } from '@/utils/dates';
import { CATEGORY_PALETTE } from '@/constants/palette';
import type { CurrencyCode } from '@/utils/money';

export type DatasetId = 'personal' | 'europe-trip' | 'empty';

export const DATASETS: { id: DatasetId; name: string; description: string; currency: CurrencyCode }[] = [
  { id: 'personal', name: 'Personal finances', description: '12 months of salary, freelance, rent, groceries, goals and subscriptions.', currency: 'INR' },
  { id: 'europe-trip', name: 'Europe trip planner', description: 'The original ₹15 lakh Europe trip budget: flights, lodging, city-leg goals.', currency: 'INR' },
  { id: 'empty', name: 'Start fresh', description: 'Default categories and one account. No transactions.', currency: 'INR' },
];

/** Mulberry32 — tiny deterministic PRNG so demos are stable across reloads. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let counter = 0;
const id = (p: string) => `${p}_${(++counter).toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
const rupees = (n: number) => Math.round(n * 100);

type CatSpec = [name: string, kind: CategoryKind, icon: IconName];

const PERSONAL_CATS: CatSpec[] = [
  ['Housing', 'expense', 'home'],
  ['Groceries', 'expense', 'shopping-bag'],
  ['Dining out', 'expense', 'utensils'],
  ['Transport', 'expense', 'car'],
  ['Utilities', 'expense', 'zap'],
  ['Health', 'expense', 'heart-pulse'],
  ['Entertainment', 'expense', 'film'],
  ['Shopping', 'expense', 'shirt'],
  ['Subscriptions', 'expense', 'wifi'],
  ['Travel', 'expense', 'plane'],
  ['Education', 'expense', 'graduation-cap'],
  ['Gifts', 'expense', 'gift'],
  ['Salary', 'income', 'briefcase'],
  ['Freelance', 'income', 'laptop'],
  ['Business', 'income', 'building'],
  ['Investments', 'income', 'trending-up'],
  ['Other income', 'income', 'coins'],
];

const TRIP_CATS: CatSpec[] = [
  ['Lodge', 'expense', 'hotel'],
  ['Food', 'expense', 'utensils'],
  ['Cabs & Rail', 'expense', 'train'],
  ['Entertainment', 'expense', 'ticket'],
  ['Flights', 'expense', 'plane'],
  ['Sightseeing', 'expense', 'landmark'],
  ['Shopping', 'expense', 'shopping-bag'],
  ['Visa & Insurance', 'expense', 'shield'],
  ['Other', 'expense', 'coins'],
  ['Trip Fund', 'income', 'piggy-bank'],
  ['Savings Deposit', 'income', 'wallet'],
  ['Sponsorship', 'income', 'gift'],
];

function makeCategories(userId: string, specs: CatSpec[]): Category[] {
  let e = 0;
  let i = 0;
  return specs.map(([name, kind, icon]) => ({
    id: id('cat'),
    userId,
    name,
    kind,
    icon,
    color: kind === 'expense' ? CATEGORY_PALETTE[e++ % CATEGORY_PALETTE.length] : CATEGORY_PALETTE[(i++ * 3 + 4) % CATEGORY_PALETTE.length],
  }));
}

export function defaultCategoriesFor(userId: string): Category[] {
  return makeCategories(userId, PERSONAL_CATS);
}

const DEMO_USERS = (today: string): User[] => [
  { id: 'usr_alex', name: 'Alex Morgan', username: 'alex', role: 'user', status: 'active', createdAt: addMonths(today, -14) },
  { id: 'usr_sarah', name: 'Sarah Connor', username: 'sarah', role: 'user', status: 'active', createdAt: addMonths(today, -9) },
  { id: 'usr_admin', name: 'System Admin', username: 'admin', role: 'admin', status: 'active', createdAt: addMonths(today, -18) },
];

const POLICY_DEFAULTS = {
  Housing: rupees(30000), Groceries: rupees(15000), 'Dining out': rupees(14000), Transport: rupees(10000),
  Utilities: rupees(5000), Entertainment: rupees(6000), Shopping: rupees(12000), Subscriptions: rupees(2500),
};

// ───────────────────────── personal ─────────────────────────

function personalFor(user: User, scale: number, seed: number) {
  const today = todayISO();
  const r = rng(seed);
  const cats = makeCategories(user.id, PERSONAL_CATS);
  const c = (n: string) => cats.find((x) => x.name === n)!.id;
  const accounts: Account[] = [
    { id: id('acc'), userId: user.id, name: 'HDFC Salary', type: 'checking', openingBalance: rupees(84000 * scale), color: '#4c9db0' },
    { id: id('acc'), userId: user.id, name: 'Emergency Fund', type: 'savings', openingBalance: rupees(210000 * scale), color: '#5fbfb0' },
    { id: id('acc'), userId: user.id, name: 'Amex Platinum', type: 'credit', openingBalance: 0, color: '#9a7aa8' },
    { id: id('acc'), userId: user.id, name: 'Cash', type: 'cash', openingBalance: rupees(4500), color: '#e0a93b' },
  ];
  const [checking, savings, credit, cash] = accounts;
  const startMonth = addMonths(startOfMonth(today), -11, 1);

  const recurring: Recurring[] = [
    { title: 'Monthly salary', type: 'income', amount: 142000, cat: 'Salary', acc: checking, day: 1, pm: 'bank' },
    { title: 'Apartment rent', type: 'expense', amount: 28000, cat: 'Housing', acc: checking, day: 3, pm: 'bank' },
    { title: 'Electricity & water', type: 'expense', amount: 3200, cat: 'Utilities', acc: checking, day: 12, pm: 'upi' },
    { title: 'Fibre broadband', type: 'expense', amount: 999, cat: 'Subscriptions', acc: credit, day: 8, pm: 'card' },
    { title: 'Spotify Family', type: 'expense', amount: 179, cat: 'Subscriptions', acc: credit, day: 14, pm: 'card' },
    { title: 'Netflix', type: 'expense', amount: 649, cat: 'Subscriptions', acc: credit, day: 21, pm: 'card' },
    { title: 'Gym membership', type: 'expense', amount: 2500, cat: 'Health', acc: credit, day: 5, pm: 'card' },
  ].map((x) => ({
    id: id('rec'), userId: user.id, type: x.type as 'income' | 'expense', title: x.title, amount: rupees(x.amount * scale),
    categoryId: c(x.cat), accountId: x.acc.id, paymentMethod: x.pm as Recurring['paymentMethod'], frequency: 'monthly' as const,
    interval: 1, startDate: addDays(startMonth, x.day - 1), endDate: null, lastPosted: null, autoPost: true, active: true,
  }));
  recurring.push({
    id: id('rec'), userId: user.id, type: 'expense', title: 'Health insurance premium', amount: rupees(18500 * scale),
    categoryId: c('Health'), accountId: checking.id, paymentMethod: 'bank', frequency: 'yearly', interval: 1,
    startDate: addDays(addMonths(startMonth, 7, 1), 9), endDate: null, lastPosted: null, autoPost: true, active: true,
  });
  recurring.push({
    id: id('rec'), userId: user.id, type: 'income', title: 'Index fund dividend', amount: rupees(2400 * scale),
    categoryId: c('Investments'), accountId: savings.id, paymentMethod: 'bank', frequency: 'monthly', interval: 3,
    startDate: addDays(startMonth, 24), endDate: null, lastPosted: null, autoPost: true, active: true,
  });

  const txs: Transaction[] = [];
  const push = (p: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'tags' | 'paymentMethod'> & Partial<Transaction>) => {
    if (p.date > today) return;
    txs.push({ id: id('tx'), userId: user.id, createdAt: Date.now(), tags: [], paymentMethod: 'card', ...p });
  };

  const variable: [string, string[], number, number, number][] = [
    // category, titles, perMonth, min, max
    ['Groceries', ['BigBasket order', 'Nature’s Basket', 'DMart run', 'Farmers market', 'Zepto top-up'], 6, 650, 3200],
    ['Dining out', ['Toit Brewpub', 'Third Wave Coffee', 'Swiggy dinner', 'Meghana Foods', 'Sunday brunch'], 7, 280, 2600],
    ['Transport', ['Uber', 'Metro card recharge', 'Fuel — Shell', 'Rapido', 'Parking'], 6, 120, 2400],
    ['Entertainment', ['PVR IMAX', 'BookMyShow — concert', 'Steam', 'Board game café'], 2, 400, 3200],
    ['Shopping', ['Uniqlo', 'Amazon', 'IKEA', 'Decathlon', 'Myntra'], 2, 900, 6500],
    ['Health', ['Apollo Pharmacy', 'Dental check-up', 'Practo consult'], 1, 300, 2800],
    ['Education', ['O’Reilly subscription', 'Udemy course', 'Books — Blossom'], 1, 450, 3400],
  ];

  let cardDue = 0;
  for (let m = 0; m < 12; m++) {
    const mStart = addMonths(startMonth, m, 1);
    const seasonal = 1 + 0.18 * Math.sin((m / 12) * Math.PI * 2 + seed);
    let cardSpend = 0;
    let cashSpend = 0;
    for (const [cat, titles, per, min, max] of variable) {
      const n = Math.max(0, Math.round(per * (0.7 + r() * 0.6)));
      for (let k = 0; k < n; k++) {
        const amt = rupees(Math.round((min + r() * (max - min)) * seasonal * scale));
        const pmRoll = r();
        // cash only for small purchases
        const acc = pmRoll < 0.6 ? credit : pmRoll < 0.9 || amt > rupees(1500) ? checking : cash;
        const date = addDays(mStart, Math.floor(r() * 28));
        if (date > today) continue;
        if (acc === credit) cardSpend += amt;
        if (acc === cash) cashSpend += amt;
        push({
          type: 'expense', title: titles[Math.floor(r() * titles.length)], amount: amt, date, categoryId: c(cat), accountId: acc.id,
          paymentMethod: acc === cash ? 'cash' : acc === credit ? 'card' : 'upi',
          tags: cat === 'Dining out' && r() < 0.3 ? ['social'] : [],
        });
      }
    }
    // freelance — lumpy
    if (r() < 0.7) {
      push({
        type: 'income', title: ['Brand identity — Kiln Studio', 'Landing page — Northfold', 'Motion audit — Parcel', 'Workshop fee'][Math.floor(r() * 4)],
        amount: rupees(Math.round((18000 + r() * 42000) * scale)), date: addDays(mStart, 10 + Math.floor(r() * 15)),
        categoryId: c('Freelance'), accountId: checking.id, paymentMethod: 'bank', tags: ['client'],
      });
    }
    // monthly savings transfer
    push({
      type: 'transfer', title: 'Auto-save to Emergency Fund', amount: rupees(Math.round(25000 * scale)), date: addDays(mStart, 2),
      categoryId: null, accountId: checking.id, toAccountId: savings.id, paymentMethod: 'bank',
    });
    // pay last month's card statement in full (subscriptions ~₹3.8k/mo are billed to the card too)
    if (cardDue > 0)
      push({
        type: 'transfer', title: 'Amex statement payment', amount: cardDue + rupees(Math.round(3827 * scale)), date: addDays(mStart, 17),
        categoryId: null, accountId: checking.id, toAccountId: credit.id, paymentMethod: 'bank',
      });
    cardDue = cardSpend;
    // ATM top-up roughly covering cash spending
    if (cashSpend > 0)
      push({
        type: 'transfer', title: 'ATM withdrawal', amount: Math.ceil(cashSpend / 50000) * 50000, date: addDays(mStart, 1),
        categoryId: null, accountId: checking.id, toAccountId: cash.id, paymentMethod: 'cash',
      });
  }
  // a travel splurge + business income + anomaly
  push({ type: 'expense', title: 'Goa flights + villa', amount: rupees(Math.round(38500 * scale)), date: addDays(addMonths(startMonth, 5, 1), 8), categoryId: c('Travel'), accountId: credit.id, tags: ['holiday'] });
  push({ type: 'income', title: 'Etsy print shop payout', amount: rupees(Math.round(12400 * scale)), date: addDays(addMonths(startMonth, 9, 1), 20), categoryId: c('Business'), accountId: checking.id, paymentMethod: 'bank' });
  push({ type: 'expense', title: 'MacBook repair — logic board', amount: rupees(Math.round(21800 * scale)), date: addDays(today, -3), categoryId: c('Shopping'), accountId: credit.id, tags: ['unplanned'] });
  push({ type: 'expense', title: 'Anniversary dinner — Farmlore', amount: rupees(Math.round(9200 * scale)), date: addDays(today, -6), categoryId: c('Dining out'), accountId: credit.id, tags: ['social'] });

  const budgets: Budget[] = Object.entries(POLICY_DEFAULTS).map(([name, limit]) => ({
    id: id('bud'), userId: user.id, categoryId: c(name), period: 'monthly' as const, limit: Math.round(limit * scale),
    rollover: name === 'Groceries' || name === 'Shopping',
  }));
  budgets.push({ id: id('bud'), userId: user.id, categoryId: c('Travel'), period: 'yearly', limit: rupees(60000 * scale), rollover: false });
  budgets.push({ id: id('bud'), userId: user.id, categoryId: c('Health'), period: 'monthly', limit: rupees(6000 * scale), rollover: false });
  budgets.push({ id: id('bud'), userId: user.id, categoryId: c('Dining out'), period: 'weekly', limit: rupees(3500 * scale), rollover: false });

  const goalSpec: [string, number, number, IconName, string, number][] = [
    ['Emergency cushion — 6 months', 600000, 9, 'shield', '#7fa779', 410000],
    ['Kyoto in autumn', 240000, 11, 'mountain', '#d9734e', 96000],
    ['New camera kit', 145000, 4, 'sparkles', '#2f6f7e', 138500],
    ['Down payment fund', 2500000, 36, 'home', '#e0a93b', 520000],
  ];
  const goals: Goal[] = goalSpec.map(([title, target, monthsOut, icon, color, saved]) => {
    const n = 8;
    const contribs = Array.from({ length: n }, (_, i) => ({
      id: id('ctb'), date: addDays(addMonths(startMonth, i + 3, 1), 4), amount: rupees(Math.round((saved / n) * scale)),
    })).filter((x) => x.date <= today);
    return {
      id: id('goal'), userId: user.id, title, target: rupees(target * scale), deadline: addMonths(today, monthsOut), icon, color,
      contributions: contribs, createdAt: addMonths(startMonth, 3, 1),
    };
  });

  return { cats, accounts, recurring, txs, budgets, goals };
}

// ───────────────────────── europe trip (legacy dataset) ─────────────────────────

function europeFor(user: User, scale: number) {
  const today = todayISO();
  const m0 = startOfMonth(today);
  const cats = makeCategories(user.id, TRIP_CATS);
  const c = (n: string) => cats.find((x) => x.name === n)!.id;
  const accounts: Account[] = [
    { id: id('acc'), userId: user.id, name: 'Trip Fund', type: 'savings', openingBalance: 0, color: '#4c9db0' },
    { id: id('acc'), userId: user.id, name: 'Forex Card', type: 'cash', openingBalance: 0, color: '#e0a93b' },
  ];
  const [fund, forex] = accounts;
  const rows: [string, number, string, number][] = [
    ['International return flights (India ⇄ Paris/Rome)', 280000, 'Flights', 1],
    ['Schengen visa — VFS application & biometrics', 18000, 'Visa & Insurance', 2],
    ['Overseas travel & medical insurance', 14000, 'Visa & Insurance', 3],
    ['Paris hotel — 5 nights near the Eiffel Tower', 140000, 'Lodge', 4],
    ['Swiss Alps chalet, Interlaken — 4 nights', 160000, 'Lodge', 5],
    ['Eurail 10-day continuous pass', 85000, 'Cabs & Rail', 6],
    ['Seine river cruise & Lido dinner show', 35000, 'Entertainment', 7],
    ['Eiffel Tower summit & Louvre entry', 22000, 'Sightseeing', 8],
    ['French dining & cafés in Paris', 45000, 'Food', 9],
    ['Colosseum & Vatican Museums tour', 28000, 'Sightseeing', 10],
    ['Trattoria & gelato tasting tour', 32000, 'Food', 11],
    ['Airport transfers & city taxis', 28000, 'Cabs & Rail', 12],
    ['Galeries Lafayette souvenirs', 55000, 'Shopping', 13],
  ];
  const txs: Transaction[] = [
    { id: id('tx'), userId: user.id, type: 'income', title: 'Europe trip master budget', amount: rupees(1500000 * scale), date: m0, categoryId: c('Trip Fund'), accountId: fund.id, paymentMethod: 'bank', tags: ['europe'], createdAt: Date.now() },
    { id: id('tx'), userId: user.id, type: 'transfer', title: 'Load forex card', amount: rupees(300000 * scale), date: addDays(m0, 1), categoryId: null, accountId: fund.id, toAccountId: forex.id, paymentMethod: 'bank', tags: ['europe'], createdAt: Date.now() },
    ...rows
      .map(([title, amt, cat, day]) => ({
        id: id('tx'), userId: user.id, type: 'expense' as const, title, amount: rupees(amt * scale), date: addDays(m0, day),
        categoryId: c(cat), accountId: ['Food', 'Cabs & Rail', 'Shopping'].includes(cat) ? forex.id : fund.id,
        paymentMethod: 'card' as const, tags: ['europe'], createdAt: Date.now(),
      }))
      .filter((t) => t.date <= today),
  ];
  const limits: Record<string, number> = {
    Lodge: 400000, Flights: 300000, Food: 250000, 'Cabs & Rail': 150000, Entertainment: 150000, Sightseeing: 100000,
    'Visa & Insurance': 50000, Shopping: 100000, Other: 100000,
  };
  const budgets: Budget[] = Object.entries(limits).map(([n, l]) => ({
    id: id('bud'), userId: user.id, categoryId: c(n), period: 'monthly', limit: rupees(l * scale), rollover: false,
  }));
  const goalRows: [string, number, number, string][] = [
    ['Paris & France leg', 450000, 380000, '#4c9db0'],
    ['Swiss Alps & Zurich leg', 400000, 320000, '#e0a93b'],
    ['Italy — Rome & Venice leg', 350000, 280000, '#d9734e'],
    ['Netherlands — Amsterdam leg', 300000, 220000, '#2f6f7e'],
  ];
  const goals: Goal[] = goalRows.map(([title, target, saved, color], i) => ({
    id: id('goal'), userId: user.id, title, target: rupees(target * scale), deadline: addMonths(today, 2 + i), color,
    icon: 'globe', createdAt: addMonths(m0, -3),
    contributions: [
      { id: id('ctb'), date: addMonths(m0, -2), amount: rupees(Math.round(saved * 0.6 * scale)) },
      { id: id('ctb'), date: addMonths(m0, -1), amount: rupees(Math.round(saved * 0.4 * scale)) },
    ],
  }));
  return { cats, accounts, recurring: [] as Recurring[], txs, budgets, goals };
}

// ───────────────────────── v2 modules: debts, split groups, tax ─────────────────────────

function extrasFor(user: User, scale: number, which: DatasetId): { debts: Debt[]; groups: SplitGroup[]; tax: TaxProfile } {
  const today = todayISO();
  const mkDebt = (name: string, lender: string, kind: Debt['kind'], original: number, opening: number, apr: number, payment: number, dueDay: number, color: string, monthsPaid: number): Debt => {
    let bal = rupees(opening * scale);
    const pay = rupees(payment * scale);
    const start = addMonths(startOfMonth(today), -monthsPaid, 1);
    const payments = Array.from({ length: monthsPaid }, (_, i) => {
      const date = addDays(addMonths(start, i + 1, 1), dueDay - 1);
      const interest = Math.min(pay, monthlyInterest(bal, apr));
      const principal = Math.min(bal, pay - interest);
      bal -= principal;
      return { id: id('dp'), date, amount: pay, interest, principal };
    }).filter((p) => p.date <= today);
    return {
      id: id('debt'), userId: user.id, name, lender, kind, original: rupees(original * scale), opening: rupees(opening * scale), aprBps: apr,
      payment: pay, dueDay, startDate: start, color, payments,
    };
  };
  const debts =
    which === 'europe-trip'
      ? [mkDebt('Travel personal loan', 'Bajaj Finserv', 'personal', 300000, 300000, 1450, 14200, 7, '#d9734e', 2)]
      : [
          mkDebt('Car loan · Nexon EV', 'HDFC Bank', 'vehicle', 900000, 620000, 925, 18700, 5, '#4c9db0', 6),
          mkDebt('Education loan', 'SBI', 'education', 600000, 310000, 850, 7400, 10, '#7fa779', 6),
          mkDebt('Credit card revolve', 'Amex', 'credit-card', 52000, 52000, 4200, 3500, 18, '#d9734e', 3),
          mkDebt('Phone EMI · Pixel', 'Bajaj Finserv', 'personal', 64000, 38000, 1600, 5600, 2, '#9a7aa8', 4),
        ];
  const me = { id: 'me', name: user.name.split(' ')[0] };
  const d = (n: number) => addDays(today, -n);
  const R = (n: number) => rupees(Math.round(n * scale));
  const groups: SplitGroup[] =
    which === 'europe-trip'
      ? [{
          id: id('grp'), userId: user.id, name: 'Europe crew', icon: 'globe', color: '#4c9db0', createdAt: d(40),
          members: [me, { id: 'm1', name: 'Riya' }, { id: 'm2', name: 'Kabir' }],
          expenses: [
            { id: id('se'), title: 'Interlaken chalet deposit', amount: R(48000), date: d(30), paidBy: 'me', mode: 'equal', shares: {} },
            { id: id('se'), title: 'Seine cruise tickets', amount: R(14400), date: d(20), paidBy: 'm1', mode: 'equal', shares: {} },
          ],
          settlements: [],
        }]
      : [
          {
            id: id('grp'), userId: user.id, name: 'Goa long weekend', icon: 'mountain', color: '#e0a93b', createdAt: d(160),
            members: [me, { id: 'm1', name: 'Riya' }, { id: 'm2', name: 'Kabir' }, { id: 'm3', name: 'Ananya' }],
            expenses: [
              { id: id('se'), title: 'Villa in Assagao', amount: R(36000), date: d(150), paidBy: 'me', mode: 'equal', shares: {} },
              { id: id('se'), title: 'Seafood dinner at Fisherman’s Wharf', amount: R(8400), date: d(149), paidBy: 'm1', mode: 'equal', shares: {} },
              { id: id('se'), title: 'Scooter rentals', amount: R(3600), date: d(149), paidBy: 'm2', mode: 'equal', shares: {} },
              { id: id('se'), title: 'Cabs to the airport', amount: R(2400), date: d(147), paidBy: 'm3', mode: 'percent', shares: { me: 2500, m1: 2500, m2: 2500, m3: 2500 } },
            ],
            settlements: [{ id: id('st'), date: d(140), from: 'm2', to: 'me', amount: R(6000) }],
          },
          {
            id: id('grp'), userId: user.id, name: 'Flat 4B · utilities', icon: 'home', color: '#4c9db0', createdAt: d(60),
            members: [me, { id: 'm4', name: 'Dev' }],
            expenses: [
              { id: id('se'), title: 'Electricity · October', amount: R(3200), date: d(35), paidBy: 'me', mode: 'equal', shares: {} },
              { id: id('se'), title: 'Wi-Fi + Netflix', amount: R(1648), date: d(20), paidBy: 'm4', mode: 'equal', shares: {} },
              { id: id('se'), title: 'Deep cleaning', amount: R(2500), date: d(9), paidBy: 'me', mode: 'exact', shares: { me: R(1000), m4: R(1500) } },
            ],
            settlements: [],
          },
        ];
  const tax: TaxProfile = {
    userId: user.id, grossOverride: null, sec80C: R(110000), sec80D: R(18500), sec80CCD1B: 0,
    homeLoanInterest: 0, hraExemption: 0, otherDeductions: 0,
  };
  return { debts, groups, tax };
}

/** Module demo data for workspaces saved before debts/split/tax existed. */
export function backfillExtras(users: User[], which: DatasetId) {
  const out = { debts: [] as Debt[], splitGroups: [] as SplitGroup[], taxProfiles: [] as TaxProfile[] };
  if (which === 'empty') return out;
  users.filter((u) => u.role === 'user' && u.id.startsWith('usr_')).forEach((u) => {
    const x = extrasFor(u, u.id === 'usr_alex' ? 1 : 0.72, which);
    out.debts.push(...x.debts);
    out.splitGroups.push(...x.groups);
    out.taxProfiles.push(x.tax);
  });
  return out;
}

// ───────────────────────── public ─────────────────────────

export function buildDataset(which: DatasetId): Dataset {
  counter = 0;
  const today = todayISO();
  const users = DEMO_USERS(today);
  const out: Dataset = {
    users, accounts: [], categories: [], transactions: [], budgets: [], goals: [], recurring: [],
    audit: [] as AuditLog[], policy: { defaults: POLICY_DEFAULTS }, debts: [], splitGroups: [], taxProfiles: [],
  };
  const parts = users
    .filter((u) => u.role === 'user')
    .map((u, i) => {
      if (which === 'europe-trip') return europeFor(u, i === 0 ? 1 : 0.8);
      if (which === 'empty') {
        const cats = makeCategories(u.id, PERSONAL_CATS);
        return {
          cats, txs: [], budgets: [], goals: [], recurring: [],
          accounts: [{ id: id('acc'), userId: u.id, name: 'Main account', type: 'checking' as const, openingBalance: 0, color: '#4c9db0' }],
        };
      }
      return personalFor(u, i === 0 ? 1 : 0.72, 7 + i * 13);
    });
  for (const p of parts) {
    out.categories.push(...p.cats);
    out.accounts.push(...p.accounts);
    out.transactions.push(...p.txs);
    out.budgets.push(...p.budgets);
    out.goals.push(...p.goals);
    out.recurring.push(...p.recurring);
  }
  if (which !== 'empty')
    users.filter((u) => u.role === 'user').forEach((u, i) => {
      const x = extrasFor(u, i === 0 ? 1 : 0.72, which);
      out.debts.push(...x.debts);
      out.splitGroups.push(...x.groups);
      out.taxProfiles.push(x.tax);
    });
  out.audit.push({ id: id('log'), at: Date.now(), action: 'Dataset loaded', actor: 'System', details: `Loaded “${DATASETS.find((d) => d.id === which)?.name}” demo data.` });
  return out;
}
