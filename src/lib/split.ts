/**
 * Split-expense math. Every share is computed in integer minor units and the
 * shares of an expense always sum exactly to its amount (leftover paise go to
 * the first members in order, so nothing is lost to rounding).
 */
import type { Minor, SplitExpense, SplitGroup } from '@/types';

/** member id → amount owed for one expense. */
export function sharesOf(e: SplitExpense, memberIds: string[]): Record<string, Minor> {
  const ids = Object.keys(e.shares).length ? Object.keys(e.shares).filter((k) => memberIds.includes(k)) : memberIds;
  const out: Record<string, Minor> = {};
  if (!ids.length) return out;
  if (e.mode === 'exact') {
    ids.forEach((id) => (out[id] = e.shares[id] ?? 0));
    return out;
  }
  if (e.mode === 'percent') {
    let given = 0;
    ids.forEach((id) => {
      out[id] = Math.floor((e.amount * (e.shares[id] ?? 0)) / 10000);
      given += out[id];
    });
    // distribute rounding remainder
    let rest = e.amount - given;
    for (let i = 0; rest > 0; i = (i + 1) % ids.length, rest--) out[ids[i]]++;
    return out;
  }
  const base = Math.floor(e.amount / ids.length);
  let rest = e.amount - base * ids.length;
  ids.forEach((id) => {
    out[id] = base + (rest > 0 ? 1 : 0);
    if (rest > 0) rest--;
  });
  return out;
}

/** Is an expense's split internally consistent? */
export function validateSplit(e: Pick<SplitExpense, 'amount' | 'mode' | 'shares'>): string | null {
  const vals = Object.values(e.shares);
  if (!vals.length) return 'Choose at least one person';
  if (e.mode === 'exact' && vals.reduce((a, b) => a + b, 0) !== e.amount) return 'Exact amounts must add up to the total';
  if (e.mode === 'percent' && vals.reduce((a, b) => a + b, 0) !== 10000) return 'Percentages must add up to 100%';
  return null;
}

/** Net balance per member: positive → is owed money, negative → owes money. */
export function groupBalances(g: SplitGroup): Record<string, Minor> {
  const ids = g.members.map((m) => m.id);
  const net: Record<string, Minor> = Object.fromEntries(ids.map((id) => [id, 0]));
  for (const e of g.expenses) {
    net[e.paidBy] = (net[e.paidBy] ?? 0) + e.amount;
    for (const [id, owed] of Object.entries(sharesOf(e, ids))) net[id] = (net[id] ?? 0) - owed;
  }
  for (const s of g.settlements) {
    net[s.from] = (net[s.from] ?? 0) + s.amount;
    net[s.to] = (net[s.to] ?? 0) - s.amount;
  }
  return net;
}

export interface Transfer {
  from: string;
  to: string;
  amount: Minor;
}

/** Fewest transfers that settle everyone (greedy largest-debtor → largest-creditor). */
export function simplify(net: Record<string, Minor>): Transfer[] {
  const debtors = Object.entries(net).filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
  const creditors = Object.entries(net).filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
  const out: Transfer[] = [];
  debtors.sort((a, b) => b.v - a.v);
  creditors.sort((a, b) => b.v - a.v);
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i].v, creditors[j].v);
    if (amt > 0) out.push({ from: debtors[i].id, to: creditors[j].id, amount: amt });
    debtors[i].v -= amt;
    creditors[j].v -= amt;
    if (debtors[i].v === 0) i++;
    if (creditors[j].v === 0) j++;
  }
  return out;
}

export const groupTotal = (g: SplitGroup) => g.expenses.reduce((s, e) => s + e.amount, 0);

/** What the signed-in user ('me') personally consumed across a group. */
export function myShare(g: SplitGroup): Minor {
  const ids = g.members.map((m) => m.id);
  return g.expenses.reduce((s, e) => s + (sharesOf(e, ids).me ?? 0), 0);
}
