import { z } from 'zod';
import { parseMoney } from '@/utils/money';

/** Strips control characters and trims. React escapes on render; this keeps stored data clean. */
const cleanText = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(/[\u0000-\u001F\u007F]/g, ' ').trim())
    .pipe(z.string().max(max));

/** A real calendar date in YYYY-MM-DD (rejects 2026-13-01, 2026-02-30…). */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((s) => {
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return y >= 1900 && y <= 2200 && dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }, 'Not a real date');

/** Form amount field: a string the user typed → positive minor units. */
export const moneyInput = z
  .string()
  .min(1, 'Enter an amount')
  .refine((v) => parseMoney(v) !== null, 'Enter a valid amount (max 2 decimals)')
  .refine((v) => (parseMoney(v) ?? 0) > 0, 'Amount must be greater than zero')
  .refine((v) => (parseMoney(v) ?? 0) <= 1e13, 'Amount is too large');

// ───────────────────────── forms ─────────────────────────

export const transactionForm = z
  .object({
    type: z.enum(['income', 'expense', 'transfer']),
    title: cleanText(120).pipe(z.string().min(1, 'Add a description')),
    amount: moneyInput,
    date: isoDate,
    categoryId: z.string().optional(),
    accountId: z.string().min(1, 'Choose an account'),
    toAccountId: z.string().optional(),
    paymentMethod: z.enum(['card', 'upi', 'bank', 'cash', 'wallet', 'other']),
    tags: z.string().max(200).optional(),
    notes: cleanText(500).optional(),
    repeat: z.enum(['none', 'daily', 'weekly', 'monthly', 'yearly']),
  })
  .superRefine((v, ctx) => {
    if (v.type !== 'transfer' && !v.categoryId) ctx.addIssue({ code: 'custom', path: ['categoryId'], message: 'Pick a category' });
    if (v.type === 'transfer') {
      if (!v.toAccountId) ctx.addIssue({ code: 'custom', path: ['toAccountId'], message: 'Choose a destination' });
      else if (v.toAccountId === v.accountId) ctx.addIssue({ code: 'custom', path: ['toAccountId'], message: 'Must differ from source' });
      if (v.repeat !== 'none') ctx.addIssue({ code: 'custom', path: ['repeat'], message: 'Transfers can’t repeat yet' });
    }
  });
export type TransactionFormValues = z.input<typeof transactionForm>;

export const goalForm = z.object({
  title: cleanText(80).pipe(z.string().min(1, 'Name your goal')),
  target: moneyInput,
  initial: z.string().refine((v) => v === '' || (parseMoney(v) ?? -1) >= 0, 'Invalid amount').optional(),
  deadline: z.union([isoDate, z.literal('')]),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  icon: z.string(),
});
export type GoalFormValues = z.input<typeof goalForm>;

export const contributionForm = z.object({
  amount: moneyInput,
  direction: z.enum(['add', 'withdraw']),
  date: isoDate,
  note: cleanText(120).optional(),
});
export type ContributionFormValues = z.input<typeof contributionForm>;

export const budgetForm = z.object({
  categoryId: z.string().min(1, 'Pick a category'),
  period: z.enum(['weekly', 'monthly', 'yearly']),
  limit: moneyInput,
  rollover: z.boolean(),
});
export type BudgetFormValues = z.input<typeof budgetForm>;

export const recurringForm = z.object({
  type: z.enum(['income', 'expense']),
  title: cleanText(120).pipe(z.string().min(1, 'Add a name')),
  amount: moneyInput,
  categoryId: z.string().min(1, 'Pick a category'),
  accountId: z.string().min(1, 'Choose an account'),
  paymentMethod: z.enum(['card', 'upi', 'bank', 'cash', 'wallet', 'other']),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  interval: z.coerce.number().int().min(1).max(52),
  startDate: isoDate,
  endDate: z.union([isoDate, z.literal('')]),
  autoPost: z.boolean(),
});
export type RecurringFormValues = z.input<typeof recurringForm>;

export const categoryForm = z.object({
  name: cleanText(40).pipe(z.string().min(1, 'Name the category')),
  kind: z.enum(['income', 'expense']),
  icon: z.string(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
});
export type CategoryFormValues = z.input<typeof categoryForm>;

export const accountForm = z.object({
  name: cleanText(40).pipe(z.string().min(1, 'Name the account')),
  type: z.enum(['checking', 'savings', 'credit', 'cash', 'investment']),
  opening: z.string().refine((v) => v === '' || parseMoney(v) !== null, 'Invalid amount'),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
});
export type AccountFormValues = z.input<typeof accountForm>;

export const userForm = z.object({
  name: cleanText(60).pipe(z.string().min(2, 'Enter a full name')),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_.-]{3,24}$/, '3–24 chars: letters, numbers, . _ -'),
  role: z.enum(['user', 'admin']),
});
export type UserFormValues = z.input<typeof userForm>;

export const profileForm = z.object({
  name: cleanText(60).pipe(z.string().min(2, 'Enter your name')),
});

// ───────────────────────── persisted / imported data ─────────────────────────

const minor = z.number().int().safe();
const idStr = z.string().min(1).max(64);

const userSchema = z.object({
  id: idStr, name: cleanText(60), username: z.string().max(24), role: z.enum(['user', 'admin']),
  status: z.enum(['active', 'suspended']), createdAt: isoDate,
});
const categorySchema = z.object({
  id: idStr, userId: idStr, name: cleanText(40), kind: z.enum(['income', 'expense']), icon: z.string().max(32),
  color: z.string().regex(/^#[0-9a-f]{6}$/i), archived: z.boolean().optional(),
});
const accountSchema = z.object({
  id: idStr, userId: idStr, name: cleanText(40), type: z.enum(['checking', 'savings', 'credit', 'cash', 'investment']),
  openingBalance: minor, color: z.string().regex(/^#[0-9a-f]{6}$/i), archived: z.boolean().optional(),
});
const txSchema = z.object({
  id: idStr, userId: idStr, type: z.enum(['income', 'expense', 'transfer']), title: cleanText(120), amount: minor.nonnegative(),
  date: isoDate, categoryId: idStr.nullable(), accountId: idStr, toAccountId: idStr.optional(),
  paymentMethod: z.enum(['card', 'upi', 'bank', 'cash', 'wallet', 'other']), tags: z.array(cleanText(24)).max(12),
  notes: cleanText(500).optional(), recurringId: idStr.optional(), createdAt: z.number(),
});
const budgetSchema = z.object({
  id: idStr, userId: idStr, categoryId: idStr, period: z.enum(['weekly', 'monthly', 'yearly']), limit: minor.nonnegative(), rollover: z.boolean(),
});
const goalSchema = z.object({
  id: idStr, userId: idStr, title: cleanText(80), target: minor.positive(), deadline: isoDate.nullable(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i), icon: z.string().max(32), createdAt: isoDate,
  contributions: z.array(z.object({ id: idStr, date: isoDate, amount: minor, note: cleanText(120).optional() })).max(2000),
});
const recurringSchema = z.object({
  id: idStr, userId: idStr, type: z.enum(['income', 'expense']), title: cleanText(120), amount: minor.positive(),
  categoryId: idStr, accountId: idStr, paymentMethod: z.enum(['card', 'upi', 'bank', 'cash', 'wallet', 'other']),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']), interval: z.number().int().min(1).max(52),
  startDate: isoDate, endDate: isoDate.nullable(), lastPosted: isoDate.nullable(), autoPost: z.boolean(), active: z.boolean(),
});

const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
const debtSchema = z.object({
  id: idStr, userId: idStr, name: cleanText(60), lender: cleanText(60),
  kind: z.enum(['home', 'vehicle', 'education', 'personal', 'credit-card', 'other']),
  original: minor.nonnegative(), opening: minor.nonnegative(), aprBps: z.number().int().min(0).max(10000),
  payment: minor.positive(), dueDay: z.number().int().min(1).max(28), startDate: isoDate, color: hex,
  payments: z.array(z.object({ id: idStr, date: isoDate, amount: minor.nonnegative(), interest: minor.nonnegative(), principal: minor.nonnegative() })).max(2000),
});
const splitGroupSchema = z.object({
  id: idStr, userId: idStr, name: cleanText(60), icon: z.string().max(32), color: hex, createdAt: isoDate,
  members: z.array(z.object({ id: idStr, name: cleanText(40) })).min(1).max(30),
  expenses: z.array(z.object({
    id: idStr, title: cleanText(80), amount: minor.positive(), date: isoDate, paidBy: idStr,
    mode: z.enum(['equal', 'exact', 'percent']), shares: z.record(idStr, z.number().int().nonnegative()),
  })).max(5000),
  settlements: z.array(z.object({ id: idStr, date: isoDate, from: idStr, to: idStr, amount: minor.positive() })).max(5000),
});
const taxProfileSchema = z.object({
  userId: idStr, grossOverride: minor.nonnegative().nullable(), sec80C: minor.nonnegative(), sec80D: minor.nonnegative(),
  sec80CCD1B: minor.nonnegative(), homeLoanInterest: minor.nonnegative(), hraExemption: minor.nonnegative(), otherDeductions: minor.nonnegative(),
});

export const datasetSchema = z.object({
  users: z.array(userSchema).max(500),
  accounts: z.array(accountSchema).max(2000),
  categories: z.array(categorySchema).max(5000),
  transactions: z.array(txSchema).max(100_000),
  budgets: z.array(budgetSchema).max(5000),
  goals: z.array(goalSchema).max(1000),
  recurring: z.array(recurringSchema).max(2000),
  audit: z.array(z.object({ id: idStr, at: z.number(), action: cleanText(80), actor: cleanText(80), details: cleanText(400) })).max(5000),
  policy: z.object({ defaults: z.record(z.string().max(40), minor.nonnegative()) }),
  // added in v2: older saved workspaces simply start with none
  debts: z.array(debtSchema).max(500).default([]),
  splitGroups: z.array(splitGroupSchema).max(200).default([]),
  taxProfiles: z.array(taxProfileSchema).max(500).default([]),
});

export const backupSchema = z.object({
  app: z.literal('cadence'),
  version: z.literal(1),
  exportedAt: z.string(),
  baseCurrency: z.enum(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD']),
  data: datasetSchema,
});
export type Backup = z.infer<typeof backupSchema>;

/** One row of a transaction CSV import (headers matched case-insensitively). */
export const csvRowSchema = z.object({
  date: isoDate,
  type: z.enum(['income', 'expense']),
  title: cleanText(120).pipe(z.string().min(1)),
  category: cleanText(40).pipe(z.string().min(1)),
  amount: z.string().refine((v) => (parseMoney(v) ?? 0) > 0, 'Invalid amount'),
});

// ───────────────────────── v2 module forms ─────────────────────────

export const debtForm = z.object({
  name: cleanText(60).pipe(z.string().min(1, 'Name this debt')),
  lender: cleanText(60),
  kind: z.enum(['home', 'vehicle', 'education', 'personal', 'credit-card', 'other']),
  balance: moneyInput,
  original: z.string().refine((v) => v === '' || (parseMoney(v) ?? -1) >= 0, 'Invalid amount'),
  apr: z.string().refine((v) => /^\d{1,2}(\.\d{1,2})?$/.test(v.trim()) && Number(v) <= 60, 'Rate between 0 and 60%'),
  payment: moneyInput,
  dueDay: z.coerce.number().int().min(1, '1–28').max(28, '1–28'),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
});
export type DebtFormValues = z.input<typeof debtForm>;

export const groupForm = z.object({
  name: cleanText(60).pipe(z.string().min(1, 'Name the group')),
  members: z.string().refine((v) => v.split(',').map((x) => x.trim()).filter(Boolean).length >= 1, 'Add at least one other person'),
});
export type GroupFormValues = z.input<typeof groupForm>;
