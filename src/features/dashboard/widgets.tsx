import { useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { ArrowUpRight, CalendarClock, Flame, Lightbulb, PiggyBank, Sparkles, TrendingDown, TrendingUp, TriangleAlert, Zap } from 'lucide-react';
import type { DashboardData } from './useDashboard';
import { CashflowChart, Donut, LegendChips, RankBars } from '@/components/charts/Charts';
import { AnimatedNumber, ScrollLitText } from '@/components/animations/Motion';
import { Badge, Delta, Empty, Progress, Ring } from '@/components/ui/Controls';
import { CategoryGlyph } from '@/components/ui/Icon';
import { useMoney } from '@/hooks/useMoney';
import { useUI } from '@/store/ui';
import { usePrefs } from '@/store/prefs';
import { addDays, formatDate, monthLabel, relativeDay, todayISO } from '@/utils/dates';
import { cn } from '@/utils/cn';
import { EASE } from '@/constants/motion';

// ───────────────────────── cash flow ─────────────────────────

export function CashflowWidget({ d, tall }: { d: DashboardData; tall?: boolean }) {
  const [hidden, setHidden] = useState<string[]>([]);
  const toggle = (k: string) => setHidden((h) => (h.includes(k) ? h.filter((x) => x !== k) : [...h, k]));
  const { fmt } = useMoney();
  const actual = d.cashflow.filter((c) => !c.forecast);
  const avgNet = actual.length ? Math.round(actual.reduce((s, c) => s + c.net, 0) / actual.length) : 0;
  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <LegendChips
          items={[
            { key: 'income', label: 'Income', color: 'var(--accent)' },
            { key: 'expense', label: 'Expenses', color: 'var(--neg)' },
            { key: 'net', label: 'Net', color: 'var(--fg-2)', dashed: true },
          ]}
          hidden={hidden}
          onToggle={toggle}
        />
        <span className="text-xs text-fg-3">
          Avg. net / month <span className={cn('ml-1 font-medium num', avgNet >= 0 ? 'text-pos' : 'text-neg')}>{fmt(avgNet, { decimals: false, sign: 'always' })}</span>
        </span>
      </div>
      <CashflowChart data={d.cashflow} hidden={hidden} height={tall ? 420 : 268} />
    </div>
  );
}

// ───────────────────────── spending ─────────────────────────

export function SpendingWidget({ d, tall }: { d: DashboardData; tall?: boolean }) {
  const [active, setActive] = useState<string | null>(null);
  const { fmt, compact } = useMoney();
  const top = d.spending.slice(0, tall ? 12 : 5);
  if (!d.spending.length) return <Empty title="No spending in this period" body="Expenses you add will be broken down here by category." />;
  return (
    <div className={cn('flex flex-col items-center gap-4', tall && 'md:flex-row md:items-start md:gap-10')}>
      <Donut
        slices={d.spending.map((s) => ({ id: s.categoryId, label: s.name, value: s.amount, color: s.color }))}
        centerLabel="Spent"
        centerValue={<AnimatedNumber value={d.cur.expense} format={(n) => (tall ? fmt(n, { decimals: false }) : compact(n))} />}
        active={active}
        onActive={setActive}
        size={tall ? 280 : 196}
        thickness={tall ? 22 : 16}
      />
      <div className="w-full flex-1">
        <RankBars
          items={top.map((s) => {
            const prev = d.prevByCat.get(s.categoryId) ?? 0;
            const ch = prev ? Math.round(((s.amount - prev) / prev) * 100) : null;
            return {
              id: s.categoryId, label: s.name, value: s.amount, color: s.color,
              meta: ch === null ? 'new' : `${ch > 0 ? '+' : ''}${ch}%`,
            };
          })}
          active={active}
          onActive={setActive}
          valueFormat={(v) => fmt(v, { decimals: false })}
        />
      </div>
    </div>
  );
}

// ───────────────────────── budgets ─────────────────────────

export function BudgetsWidget({ d }: { d: DashboardData }) {
  const { fmt } = useMoney();
  if (!d.usage.length)
    return <Empty title="No budgets yet" body="Set limits per category to get early warnings." action={<Link to="/budgets" className="text-sm text-accent-fg">Create a budget →</Link>} />;
  return (
    <ul className="flex flex-col gap-3.5">
      {d.usage.slice(0, 6).map((u, i) => {
        const c = d.catMap.get(u.budget.categoryId);
        const tone = u.status === 'over' ? 'var(--neg)' : u.status === 'warning' ? 'var(--warn)' : c?.color;
        return (
          <motion.li key={u.budget.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.05, duration: 0.5, ease: EASE.outQuint }}>
            <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <CategoryGlyph icon={c?.icon} color={c?.color} size={22} />
                <span className="truncate">{c?.name}</span>
                {u.status === 'over' && <Badge tone="neg">Over</Badge>}
              </span>
              <span className="shrink-0 text-xs text-fg-3 num">
                <span className="text-fg">{fmt(u.spent, { decimals: false })}</span> / {fmt(u.available, { decimals: false })}
              </span>
            </div>
            <Progress value={u.utilization} color={tone} label={`${c?.name} budget used`} height={5} />
          </motion.li>
        );
      })}
    </ul>
  );
}

// ───────────────────────── goals ─────────────────────────

export function GoalsWidget({ d }: { d: DashboardData }) {
  const { fmt } = useMoney();
  if (!d.goals.length) return <Empty title="No goals yet" action={<Link to="/goals" className="text-sm text-accent-fg">Set a goal →</Link>} />;
  return (
    <ul className="flex flex-col gap-1">
      {d.goals.slice(0, 4).map(({ goal, p }) => (
        <li key={goal.id}>
          <Link to="/goals" className="flex items-center gap-3 rounded-[10px] p-2 transition-colors hover:bg-surface-2">
            <Ring value={p.pct} size={42} stroke={4} color={goal.color} label={`${goal.title} ${p.pct}%`}>
              <span className="text-[10px] font-medium num">{Math.round(p.pct)}</span>
            </Ring>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{goal.title}</span>
              <span className="block text-xs text-fg-3 num">
                {fmt(p.saved, { decimals: false })} of {fmt(goal.target, { decimals: false })}
              </span>
            </span>
            {p.complete ? <Badge tone="pos">Done</Badge> : p.onTrack === false ? <Badge tone="warn">Behind</Badge> : p.eta ? <span className="text-2xs text-fg-4">{monthLabel(p.eta.slice(0, 7), 'short', true)}</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ───────────────────────── upcoming ─────────────────────────

export function UpcomingWidget({ d }: { d: DashboardData }) {
  const { fmt } = useMoney();
  const items = d.upcomingItems.slice(0, 6);
  if (!items.length) return <Empty icon={<CalendarClock size={18} />} title="Nothing scheduled" body="Recurring bills and income will appear here." />;
  return (
    <ul className="relative flex flex-col">
      <span className="absolute bottom-3 left-[15px] top-3 w-px bg-line" aria-hidden />
      {items.map((u, i) => {
        const c = d.catMap.get(u.recurring.categoryId);
        const soon = u.date <= relativeISO(3);
        return (
          <li key={u.recurring.id + u.date} className="relative flex items-center gap-3 py-2">
            <span className={cn('relative z-[1] grid size-[31px] place-items-center rounded-full border bg-surface', soon ? 'border-[var(--accent-line)]' : 'border-line')}>
              <CategoryGlyph icon={c?.icon} color={c?.color} size={22} className="!rounded-full" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{u.recurring.title}</span>
              <span className={cn('block text-xs', soon ? 'text-accent-fg' : 'text-fg-3')}>{relativeDay(u.date)}</span>
            </span>
            <span className={cn('text-sm font-medium num', u.recurring.type === 'income' ? 'text-pos' : '')}>
              {u.recurring.type === 'income' ? '+' : '−'}
              {fmt(u.recurring.amount, { decimals: false })}
            </span>
            {i === 0 && <span className="sr-only">next</span>}
          </li>
        );
      })}
    </ul>
  );
}
const relativeISO = (days: number) => addDays(todayISO(), days);

// ───────────────────────── recent ─────────────────────────

export function RecentWidget({ d }: { d: DashboardData }) {
  const { fmt } = useMoney();
  const open = useUI((s) => s.openTxDetail);
  const dateFmt = usePrefs((s) => s.dateFormat);
  const rows = d.txs.slice(0, 7);
  if (!rows.length) return <Empty title="No transactions yet" body="Press N to add your first one." />;
  return (
    <ul className="-mx-2 flex flex-col">
      {rows.map((t, i) => {
        const c = t.categoryId ? d.catMap.get(t.categoryId) : undefined;
        return (
          <motion.li key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i, duration: 0.45, ease: EASE.outQuint }}>
            <button onClick={() => open(t.id)} className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-surface-2">
              <CategoryGlyph icon={c?.icon ?? 'wallet'} color={c?.color ?? 'var(--info)'} size={32} />
              <span className="min-w-0">
                <span className="block truncate text-sm">{t.title}</span>
                <span className="block truncate text-xs text-fg-3">
                  {t.type === 'transfer' ? `${d.acctMap.get(t.accountId)?.name} → ${d.acctMap.get(t.toAccountId ?? '')?.name}` : c?.name} · {formatDate(t.date, dateFmt)}
                </span>
              </span>
              <span className={cn('text-sm font-medium num', t.type === 'income' ? 'text-pos' : t.type === 'transfer' ? 'text-fg-3' : '')}>
                {t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''}
                {fmt(t.amount)}
              </span>
            </button>
          </motion.li>
        );
      })}
    </ul>
  );
}

// ───────────────────────── insights ─────────────────────────

export function InsightsWidget({ d }: { d: DashboardData }) {
  const { fmt } = useMoney();
  const items: { icon: React.ReactNode; tone: string; title: string; body: React.ReactNode; to?: string }[] = [];
  if (d.top)
    items.push({
      icon: <Flame size={15} />, tone: 'text-warn bg-warn-soft', title: `${d.top.name} leads spending`, to: '/expenses',
      body: <>{fmt(d.top.amount, { decimals: false })}, {d.top.share}% of the period{d.topChange !== null && <> · <Delta value={d.topChange} invert /> vs before</>}</>,
    });
  const ex = d.deltas.expense;
  if (ex !== null)
    items.push({
      icon: ex > 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />, tone: ex > 0 ? 'text-neg bg-neg-soft' : 'text-pos bg-pos-soft',
      title: `Spending ${ex > 0 ? 'up' : 'down'} ${Math.abs(ex).toFixed(1)}%`, body: <>Compared with the previous period ({fmt(d.before.expense, { decimals: false })}).</>,
    });
  if (d.nearLimit.length)
    items.push({
      icon: <TriangleAlert size={15} />, tone: 'text-warn bg-warn-soft', to: '/budgets',
      title: `${d.nearLimit.length} budget${d.nearLimit.length > 1 ? 's' : ''} near or over limit`,
      body: d.nearLimit.slice(0, 3).map((u) => d.catMap.get(u.budget.categoryId)?.name).join(', '),
    });
  items.push({
    icon: <Zap size={15} />, tone: 'text-info bg-info-soft', title: `Month-end estimate ${fmt(d.forecast.endBalance, { decimals: false })}`,
    body: <>Current pace plus {fmt(d.forecast.scheduledExpense, { decimals: false })} in scheduled bills.</>,
  });
  if (d.goals.length)
    items.push({
      icon: <PiggyBank size={15} />, tone: 'text-pos bg-pos-soft', to: '/goals', title: `Goals ${d.goalPct.toFixed(0)}% funded`,
      body: <>{fmt(d.goalSaved, { decimals: false })} saved across {d.goals.length} goals.</>,
    });
  for (const a of d.odd.slice(0, 1))
    items.push({
      icon: <Sparkles size={15} />, tone: 'text-accent-fg bg-accent-soft', title: 'Unusual expense',
      body: <>“{a.tx.title}” is {a.ratio}× your typical {d.catMap.get(a.tx.categoryId ?? '')?.name?.toLowerCase()} spend.</>,
    });
  return (
    <ul className="flex flex-col gap-1">
      {items.map((it, i) => {
        const inner = (
          <>
            <span className={cn('grid size-8 shrink-0 place-items-center rounded-[9px]', it.tone)}>{it.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{it.title}</span>
              <span className="mt-0.5 block text-xs text-fg-3">{it.body}</span>
            </span>
            {it.to && <ArrowUpRight size={14} className="mt-1 shrink-0 text-fg-4" />}
          </>
        );
        return (
          <motion.li key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.06 }}>
            {it.to ? (
              <Link to={it.to} className="flex gap-3 rounded-[10px] p-2 transition-colors hover:bg-surface-2">{inner}</Link>
            ) : (
              <div className="flex gap-3 p-2">{inner}</div>
            )}
          </motion.li>
        );
      })}
      {!items.length && <Empty icon={<Lightbulb size={18} />} title="Insights appear as data grows" />}
    </ul>
  );
}

// ───────────────────────── accounts ─────────────────────────

export function AccountsWidget({ d }: { d: DashboardData }) {
  const { fmt } = useMoney();
  const list = d.accts.filter((a) => !a.archived);
  const total = Math.max(1, list.reduce((s, a) => s + Math.max(0, d.balances.get(a.id) ?? 0), 0));
  return (
    <div className="flex flex-col gap-5">
      <div className="flex h-2 gap-[3px] overflow-hidden rounded-full" aria-hidden>
        {list.map((a, i) => (
          <motion.span
            key={a.id}
            style={{ background: a.color }}
            initial={{ flexGrow: 0.0001 }}
            animate={{ flexGrow: Math.max(0.0001, Math.max(0, d.balances.get(a.id) ?? 0) / total) }}
            transition={{ duration: 1.1, delay: 0.2 + i * 0.08, ease: EASE.outQuint }}
            className="h-full basis-0 rounded-full"
          />
        ))}
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {list.map((a) => {
          const b = d.balances.get(a.id) ?? 0;
          return (
            <li key={a.id}>
              <Link to="/accounts" className="flex flex-col gap-3 rounded-[12px] border border-line bg-surface-2/50 p-4 transition-colors hover:border-line-strong hover:bg-surface-2">
                <span className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <span className="size-2 shrink-0 rounded-[3px]" style={{ background: a.color }} />
                    <span className="truncate">{a.name}</span>
                  </span>
                  <span className="label-mono !text-[10px]">{a.type}</span>
                </span>
                <span className={cn('text-[1.35rem] font-medium tracking-[-0.03em] num', b < 0 && 'text-neg')}>
                  <AnimatedNumber value={b} format={(n) => fmt(n, { decimals: false })} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ───────────────────────── narrative ─────────────────────────

/** "Month in review" — data-written prose that lights up line by line on scroll (TTM §2.3). */
export function NarrativeWidget({ d }: { d: DashboardData }) {
  const { fmt } = useMoney();
  const f = (n: number) => fmt(n, { decimals: false });
  const period = d.range.from.slice(0, 7) === d.range.to.slice(0, 7) ? monthLabel(d.range.from.slice(0, 7), 'long') : 'this period';
  const parts: string[] = [];
  parts.push(`In ${period} you earned ${f(d.cur.income)} and spent ${f(d.cur.expense)}, ${d.cur.net >= 0 ? `keeping ${d.cur.savingsRate}% of what came in` : `running ${f(-d.cur.net)} short`}.`);
  if (d.top) {
    const ch = d.topChange;
    const cmp = ch === null ? '' : Math.abs(ch) < 1 ? ', in line with the period before' : `, ${Math.abs(ch).toFixed(0)}% ${ch > 0 ? 'more' : 'less'} than the period before`;
    parts.push(`${d.top.name} took the largest share at ${f(d.top.amount)}${cmp}.`);
  }
  if (d.nearLimit.length) parts.push(`${d.nearLimit.length === 1 ? 'One budget is' : `${d.nearLimit.length} budgets are`} close to the line.`);
  else if (d.usage.length) parts.push('Every budget is comfortably inside its limit.');
  parts.push(`At this pace the month closes with ${f(d.forecast.endBalance)} across your accounts.`);
  if (d.goals.length) parts.push(`Your goals are ${d.goalPct.toFixed(0)}% funded.`);
  const today = todayISO();
  return (
    <div className="grid gap-6 xl:grid-cols-[180px_1fr] xl:gap-10">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 xl:flex-col xl:flex-nowrap xl:items-start">
        <span className="label-mono">Month in review</span>
        <span className="serif text-[2rem] italic leading-none text-fg-2">{monthLabel(today.slice(0, 7), 'long')}</span>
        <span className="mt-1 text-xs text-fg-4">Written from your data</span>
      </div>
      <ScrollLitText className="text-[1.35rem] font-normal leading-[1.4] tracking-[-0.02em] md:text-[1.7rem]">{parts.join(' ')}</ScrollLitText>
    </div>
  );
}
