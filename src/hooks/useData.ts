import { useMemo } from 'react';
import { useFinance } from '@/store/finance';
import type { Category } from '@/types';

/** The signed-in user (or null). */
export function useCurrentUser() {
  const id = useFinance((s) => s.sessionUserId);
  const users = useFinance((s) => s.users);
  return useMemo(() => users.find((u) => u.id === id) ?? null, [users, id]);
}

/** All records of the signed-in user. Each array is memoised on its source slice. */
export function useUserData() {
  const userId = useFinance((s) => s.sessionUserId) ?? '';
  const transactions = useFinance((s) => s.transactions);
  const categories = useFinance((s) => s.categories);
  const accounts = useFinance((s) => s.accounts);
  const budgets = useFinance((s) => s.budgets);
  const goals = useFinance((s) => s.goals);
  const recurring = useFinance((s) => s.recurring);

  const txs = useMemo(
    () =>
      transactions
        .filter((t) => t.userId === userId)
        .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : b.date.localeCompare(a.date))),
    [transactions, userId],
  );
  const cats = useMemo(() => categories.filter((c) => c.userId === userId), [categories, userId]);
  const accts = useMemo(() => accounts.filter((a) => a.userId === userId), [accounts, userId]);
  const buds = useMemo(() => budgets.filter((b) => b.userId === userId), [budgets, userId]);
  const gls = useMemo(() => goals.filter((g) => g.userId === userId), [goals, userId]);
  const recs = useMemo(() => recurring.filter((r) => r.userId === userId), [recurring, userId]);
  const catMap = useMemo(() => new Map<string, Category>(cats.map((c) => [c.id, c])), [cats]);
  const acctMap = useMemo(() => new Map(accts.map((a) => [a.id, a])), [accts]);

  return { userId, txs, cats, accts, buds, gls, recs, catMap, acctMap };
}
