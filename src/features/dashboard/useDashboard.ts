import { useMemo } from 'react';
import { useUserData } from '@/hooks/useData';
import {
  accountBalances, anomalies, budgetUsage, byCategory, changePct, forecastMonth, forecastMonths, goalProgress, monthlySeries,
  totalBalance, totals, upcoming,
} from '@/lib/finance';
import { addMonths, endOfMonth, monthsBetween, previousRange, rangeForPreset, startOfMonth, todayISO, type RangePreset } from '@/utils/dates';
import { sumMinor, percent } from '@/utils/money';
import { BUDGET_WARN_AT } from '@/constants/options';

/** Everything the dashboard shows, derived from store data for one period. */
export function useDashboard(preset: RangePreset) {
  const d = useUserData();
  return useMemo(() => {
    const today = todayISO();
    const range = rangeForPreset(preset, today);
    const prev = previousRange(range);
    const cur = totals(d.txs, range);
    const before = totals(d.txs, prev);

    const balance = totalBalance(d.accts, d.txs, today);
    const balancePrevEnd = totalBalance(d.accts, d.txs, prev.to);
    const balances = accountBalances(d.accts, d.txs, today);

    // chart window: at least 6 months, ending at the selected range end
    const chartFrom = monthsBetween(range.from, range.to).length < 6 ? addMonths(startOfMonth(range.to), -5, 1) : range.from;
    const series = monthlySeries(d.txs, { from: chartFrom, to: endOfMonth(range.to) });
    // forecast from completed months only (the current month is partial), plotted after the last shown month
    const complete = series.filter((p) => p.month < today.slice(0, 7));
    const fc = forecastMonths(complete.length >= 2 ? complete : series, 3, series[series.length - 1]?.month);
    const cashflow = [
      ...series.map((p) => ({ month: p.month, income: p.income, expense: p.expense, net: p.net, forecast: false })),
      ...fc.map((f) => ({ month: f.month, income: f.income, expense: f.expense, net: f.income - f.expense, forecast: true })),
    ];
    // balance sparkline — month-end balances across the chart window
    const balanceTrend = series.map((p) => totalBalance(d.accts, d.txs, endOfMonth(p.month + '-01') > today ? today : endOfMonth(p.month + '-01')));

    const spending = byCategory(d.txs, d.cats, 'expense', range);
    const spendingPrev = byCategory(d.txs, d.cats, 'expense', prev);
    const prevByCat = new Map(spendingPrev.map((s) => [s.categoryId, s.amount]));

    const usage = d.buds
      .map((b) => budgetUsage(b, d.txs, today, BUDGET_WARN_AT))
      .sort((a, b) => b.utilization - a.utilization);
    const monthly = usage.filter((u) => u.budget.period === 'monthly');
    const budgetTotal = sumMinor(monthly.map((u) => u.available));
    const budgetSpent = sumMinor(monthly.map((u) => u.spent));

    const goals = d.gls.map((g) => ({ goal: g, p: goalProgress(g, today) }));
    const goalSaved = sumMinor(goals.map((g) => g.p.saved));
    const goalTarget = sumMinor(d.gls.map((g) => g.target));

    const forecast = forecastMonth(d.txs, d.recs, balance, today);
    const upcomingItems = upcoming(d.recs, 30, today);
    const scheduledOut = sumMinor(upcomingItems.filter((u) => u.recurring.type === 'expense' && u.date <= endOfMonth(today)).map((u) => u.recurring.amount));
    const odd = anomalies(d.txs, range);

    const top = spending[0];
    const topChange = top ? changePct(top.amount, prevByCat.get(top.categoryId) ?? 0) : null;
    const nearLimit = usage.filter((u) => u.status !== 'ok');

    return {
      range, prev, cur, before, balance, balancePrevEnd, balances, cashflow, balanceTrend, spending, prevByCat, usage,
      budgetTotal, budgetSpent, budgetPct: budgetTotal ? percent(budgetSpent, budgetTotal) : 0, goals, goalSaved, goalTarget,
      goalPct: goalTarget ? percent(goalSaved, goalTarget) : 0, forecast, upcomingItems, available: balance - scheduledOut,
      scheduledOut, odd, top, topChange, nearLimit,
      deltas: {
        income: changePct(cur.income, before.income),
        expense: changePct(cur.expense, before.expense),
        net: changePct(cur.net, before.net),
        balance: changePct(balance, balancePrevEnd),
        savingsRate: cur.savingsRate - before.savingsRate,
      },
      ...d,
    };
  }, [d, preset]);
}
export type DashboardData = ReturnType<typeof useDashboard>;
