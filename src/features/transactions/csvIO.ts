import type { Account, Category, Transaction } from '@/types';
import { toCSV, parseCSV } from '@/utils/csv';
import { minorToDecimalString, parseMoney } from '@/utils/money';
import { csvRowSchema } from '@/schemas';
import { downloadFile } from '@/utils/download';
import { todayISO } from '@/utils/dates';

/** Export amounts as exact decimals in the base currency (no float formatting). */
export function exportTransactionsCSV(
  txs: Transaction[], catMap: Map<string, Category>, acctMap: Map<string, Account>, currency: string, name = 'transactions',
) {
  const csv = toCSV(
    ['date', 'type', 'title', 'category', 'account', 'to_account', 'amount', 'currency', 'payment_method', 'tags', 'notes'],
    txs.map((t) => [
      t.date, t.type, t.title, t.categoryId ? catMap.get(t.categoryId)?.name ?? '' : '', acctMap.get(t.accountId)?.name ?? '',
      t.toAccountId ? acctMap.get(t.toAccountId)?.name ?? '' : '', minorToDecimalString(t.amount), currency, t.paymentMethod,
      t.tags.join(' '), t.notes ?? '',
    ]),
  );
  downloadFile(`cadence-${name}-${todayISO()}.csv`, csv, 'text/csv;charset=utf-8');
}

export interface ImportPreview {
  valid: { date: string; type: 'income' | 'expense'; title: string; category: string; amount: number; account?: string }[];
  errors: { line: number; message: string }[];
  newCategories: string[];
}

/** Parse + validate a CSV file. Nothing is written until the user confirms the preview. */
export function previewImport(text: string, cats: Category[]): ImportPreview {
  const rows = parseCSV(text);
  if (rows.length < 2) return { valid: [], errors: [{ line: 1, message: 'The file has no data rows.' }], newCategories: [] };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (k: string) => header.indexOf(k);
  const need = ['date', 'type', 'title', 'category', 'amount'];
  const missing = need.filter((k) => idx(k) < 0);
  if (missing.length) return { valid: [], errors: [{ line: 1, message: `Missing column(s): ${missing.join(', ')}` }], newCategories: [] };
  const out: ImportPreview = { valid: [], errors: [], newCategories: [] };
  const known = new Set(cats.map((c) => `${c.kind}:${c.name.toLowerCase()}`));
  const newCats = new Set<string>();
  rows.slice(1).forEach((r, i) => {
    const obj = Object.fromEntries(need.map((k) => [k, (r[idx(k)] ?? '').trim()]));
    obj.type = obj.type.toLowerCase();
    const parsed = csvRowSchema.safeParse(obj);
    if (!parsed.success) {
      out.errors.push({ line: i + 2, message: parsed.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ') });
      return;
    }
    const v = parsed.data;
    if (!known.has(`${v.type}:${v.category.toLowerCase()}`)) newCats.add(`${v.type}:${v.category}`);
    out.valid.push({ ...v, amount: parseMoney(v.amount)!, account: idx('account') >= 0 ? r[idx('account')]?.trim() : undefined });
  });
  out.newCategories = [...newCats];
  return out;
}

export const CSV_TEMPLATE = toCSV(
  ['date', 'type', 'title', 'category', 'amount', 'account'],
  [
    [todayISO(), 'expense', 'Groceries', 'Groceries', '1240.50', ''],
    [todayISO(), 'income', 'Consulting invoice', 'Freelance', '25000', ''],
  ],
);
