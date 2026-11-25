import { useMemo } from 'react';
import { useUserData } from './useData';
import { useMoney } from './useMoney';
import { usePrefs } from '@/store/prefs';
import { useFinance } from '@/store/finance';
import { budgetUsage, goalProgress, totals, upcoming } from '@/lib/finance';
import { addMonths, endOfMonth, monthLabel, relativeDay, startOfMonth, todayISO } from '@/utils/dates';
import { BUDGET_WARN_AT } from '@/constants/options';
import type { AppNotification } from '@/types';

/**
 * Notifications are mostly *derived* from data (budget thresholds, goal milestones,
 * upcoming payments, monthly summary) with stable ids, so read/dismiss state survives
 * reloads and an alert disappears on its own once the condition clears.
 */
export function useNotifications() {
  const { txs, buds, gls, recs, catMap } = useUserData();
  const { fmt } = useMoney();
  const prefs = usePrefs((s) => s.notifications);
  const read = usePrefs((s) => s.readNotifications);
  const dismissed = usePrefs((s) => s.dismissedNotifications);
  const events = useFinance((s) => s.events);

  return useMemo(() => {
    const today = todayISO();
    const month = today.slice(0, 7);
    const list: AppNotification[] = [];
    const at = Date.now();
    const f = (m: number) => fmt(m, { decimals: false });

    for (const b of buds) {
      const u = budgetUsage(b, txs, today, BUDGET_WARN_AT);
      const name = catMap.get(b.categoryId)?.name ?? 'Budget';
      const key = `${b.id}:${u.range.from}`;
      if (u.status === 'over' && prefs.overspend)
        list.push({
          id: `over:${key}`, kind: 'overspend', severity: 'danger', at, href: '/budgets',
          title: `${name} is over budget`,
          body: `Spent ${f(u.spent)} of ${f(u.available)}: ${f(-u.remaining)} over.`,
        });
      else if (u.status === 'warning' && prefs.budget)
        list.push({
          id: `warn:${key}`, kind: 'budget-threshold', severity: 'warning', at, href: '/budgets',
          title: `${name} at ${Math.round(u.utilization)}%`,
          body: `${f(u.remaining)} left this ${b.period === 'weekly' ? 'week' : b.period === 'yearly' ? 'year' : 'month'}.`,
        });
    }
    if (prefs.goals)
      for (const g of gls) {
        const p = goalProgress(g, today);
        if (p.milestone >= 25)
          list.push({
            id: `goal:${g.id}:${p.milestone}`, kind: 'goal-milestone', severity: 'success', at, href: '/goals',
            title: p.complete ? `“${g.title}” is fully funded` : `“${g.title}” passed ${p.milestone}%`,
            body: p.complete ? `You saved ${f(p.saved)}.` : `${f(p.remaining)} to go.`,
          });
      }
    if (prefs.upcoming)
      for (const u of upcoming(recs, 3, today).filter((x) => x.recurring.type === 'expense'))
        list.push({
          id: `up:${u.recurring.id}:${u.date}`, kind: 'upcoming', severity: 'info', at, href: '/recurring',
          title: `${u.recurring.title} due ${relativeDay(u.date, today).toLowerCase()}`,
          body: `${fmt(u.recurring.amount)} scheduled.`,
        });
    if (prefs.summary) {
      const last = addMonths(startOfMonth(today), -1, 1);
      const t = totals(txs, { from: last, to: endOfMonth(last) });
      if (t.count)
        list.push({
          id: `sum:${month}`, kind: 'summary', severity: 'info', at, href: '/reports',
          title: `${monthLabel(last.slice(0, 7), 'long')} summary is ready`,
          body: `Income ${f(t.income)} · Spent ${f(t.expense)} · Saved ${t.savingsRate}%`,
        });
    }
    if (prefs.transactions) list.unshift(...events);

    const visible = list.filter((n) => !dismissed.includes(n.id));
    const unread = visible.filter((n) => !read.includes(n.id)).length;
    return { list: visible, unread, isRead: (id: string) => read.includes(id) };
  }, [txs, buds, gls, recs, catMap, fmt, prefs, read, dismissed, events]);
}
