import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { motion, Reorder, useDragControls } from 'framer-motion';
import { ArrowUpRight, GripVertical, LayoutGrid, Maximize2, RotateCcw } from 'lucide-react';
import { useDashboard, type DashboardData } from './useDashboard';
import {
  AccountsWidget, BudgetsWidget, CashflowWidget, GoalsWidget, InsightsWidget, NarrativeWidget, RecentWidget, SpendingWidget, UpcomingWidget,
} from './widgets';
import { gsap } from '@/components/animations/gsap';
import { AnimatedNumber, Reveal, SplitReveal, Ticker } from '@/components/animations/Motion';
import { Sparkline } from '@/components/charts/Charts';
import { Delta, Panel, Segmented } from '@/components/ui/Controls';
import { Button, IconButton } from '@/components/ui/Button';
import { Dialog, Drawer } from '@/components/ui/Overlay';
import { Switch } from '@/components/ui/Field';
import { CategoryGlyph } from '@/components/ui/Icon';
import { useCurrentUser } from '@/hooks/useData';
import { useMoney } from '@/hooks/useMoney';
import { reducedMotionNow } from '@/hooks/useMotionPrefs';
import { DASHBOARD_WIDGETS, usePrefs, type WidgetId } from '@/store/prefs';
import { useUI } from '@/store/ui';
import { greeting, RANGE_PRESETS, type RangePreset } from '@/utils/dates';
import { cn } from '@/utils/cn';

// 1 col on phones, 2 on tablets/laptops, 12-col editorial grid from 1280px
const SPAN: Record<WidgetId, string> = {
  cashflow: 'lg:col-span-2 xl:col-span-8',
  spending: 'lg:col-span-1 xl:col-span-4',
  narrative: 'lg:col-span-2 xl:col-span-12',
  budgets: 'lg:col-span-1 xl:col-span-4',
  goals: 'lg:col-span-1 xl:col-span-4',
  upcoming: 'lg:col-span-1 xl:col-span-4',
  recent: 'lg:col-span-2 xl:col-span-8',
  insights: 'lg:col-span-1 xl:col-span-4',
  accounts: 'lg:col-span-2 xl:col-span-12',
};
const META: Record<WidgetId, { title: string; eyebrow: string; link?: string; expandable?: boolean }> = {
  cashflow: { title: 'Income vs. expenses', eyebrow: 'Cash flow', link: '/analytics', expandable: true },
  spending: { title: 'Where it went', eyebrow: 'Spending', link: '/expenses', expandable: true },
  narrative: { title: '', eyebrow: '' },
  budgets: { title: 'Budget utilisation', eyebrow: 'Limits', link: '/budgets' },
  goals: { title: 'Savings goals', eyebrow: 'Progress', link: '/goals' },
  upcoming: { title: 'Next 30 days', eyebrow: 'Upcoming', link: '/recurring' },
  recent: { title: 'Recent activity', eyebrow: 'Ledger', link: '/transactions' },
  insights: { title: 'What stands out', eyebrow: 'Insights' },
  accounts: { title: 'Accounts', eyebrow: 'Balances', link: '/accounts' },
};

function renderWidget(id: WidgetId, d: DashboardData, tall = false): ReactNode {
  switch (id) {
    case 'cashflow': return <CashflowWidget d={d} tall={tall} />;
    case 'spending': return <SpendingWidget d={d} tall={tall} />;
    case 'budgets': return <BudgetsWidget d={d} />;
    case 'goals': return <GoalsWidget d={d} />;
    case 'upcoming': return <UpcomingWidget d={d} />;
    case 'recent': return <RecentWidget d={d} />;
    case 'insights': return <InsightsWidget d={d} />;
    case 'accounts': return <AccountsWidget d={d} />;
    case 'narrative': return <NarrativeWidget d={d} />;
  }
}

// ───────────────────────── hero ─────────────────────────

function Stat({ label, value, delta, invert, suffix, tone }: { label: string; value: ReactNode; delta: number | null; invert?: boolean; suffix?: string; tone?: string }) {
  return (
    <div data-stat className="flex min-w-0 flex-col gap-1.5 py-4 lg:px-5 lg:first:pl-0">
      <span className="label-mono">{label}</span>
      <span className={cn('truncate text-[1.35rem] font-medium tracking-[-0.03em] md:text-[1.5rem]', tone)}>{value}</span>
      <Delta value={delta} invert={invert} suffix={suffix} />
    </div>
  );
}

function Hero({ d }: { d: DashboardData }) {
  const { fmt } = useMoney();
  const root = useRef<HTMLDivElement>(null);
  const openDetail = useUI((s) => s.openTxDetail);
  const f0 = (n: number) => fmt(n, { decimals: false });
  const monthBudgetSpent = d.budgetSpent;

  // Orchestrated entrance (GSAP timeline): panel wipes open from the baseline,
  // figures rise in sequence, outlook column follows, ticker fades last.
  useLayoutEffect(() => {
    if (reducedMotionNow() || !root.current) return;
    const ctx = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: 'expo.out' } })
        .from('[data-hero-panel]', { clipPath: 'inset(100% 0% 0% 0% round 18px)', duration: 1.2, ease: 'power4.inOut', clearProps: 'clipPath' })
        .from('[data-hero-label]', { opacity: 0, y: 10, duration: 0.6 }, '-=0.55')
        .from('[data-hero-figure]', { yPercent: 60, opacity: 0, duration: 1.1 }, '<0.05')
        .from('[data-stat]', { y: 18, opacity: 0, duration: 0.9, stagger: 0.08, clearProps: 'transform,opacity' }, '-=0.8')
        .from('[data-outlook] > *', { x: 16, opacity: 0, duration: 0.9, stagger: 0.07, clearProps: 'transform,opacity' }, '-=0.9')
        .from('[data-ticker]', { opacity: 0, duration: 0.8, ease: 'power1.out' }, '-=0.5');
    }, root);
    return () => ctx.revert();
  }, []);

  const spentPct = d.forecast.projectedExpense ? Math.min(100, (d.forecast.spentSoFar / d.forecast.projectedExpense) * 100) : 0;

  return (
    <div ref={root} className="mb-4">
      <section
        data-hero-panel
        aria-label="Financial overview"
        className="panel relative overflow-hidden !rounded-[18px]"
        style={{ background: 'var(--glow), var(--panel-light), var(--surface)' }}
      >
        {/* ledger hairlines — subtle depth behind the figure */}
        <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:repeating-linear-gradient(180deg,transparent_0_47px,var(--grid)_47px_48px)] [mask-image:linear-gradient(90deg,#000,transparent_65%)]" aria-hidden />
        <div className="relative grid xl:grid-cols-[1.55fr_1fr]">
          <div className="px-5 pb-2 pt-6 md:px-8 md:pt-8">
            <div data-hero-label className="flex items-center gap-2">
              <span className="label-mono">Total balance</span>
              <span className="text-2xs text-fg-4">· {d.accts.filter((a) => !a.archived).length} accounts</span>
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3">
              <div className="overflow-hidden pb-1">
                <div data-hero-figure className="text-[2.75rem] font-medium leading-[0.95] tracking-[-0.05em] xs:text-[3.4rem] md:text-[4.4rem]">
                  <AnimatedNumber value={d.balance} format={f0} duration={2} delay={0.5} />
                </div>
              </div>
              <div className="mb-2 flex items-center gap-3">
                <Sparkline values={d.balanceTrend} width={110} height={34} />
                <div className="flex flex-col">
                  <Delta value={d.deltas.balance} />
                  <span className="text-2xs text-fg-4">vs. previous period end</span>
                </div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 border-t border-line lg:grid-cols-4 lg:divide-x lg:divide-line">
              <Stat label="Income" value={<AnimatedNumber value={d.cur.income} format={f0} delay={0.7} />} delta={d.deltas.income} />
              <Stat label="Expenses" value={<AnimatedNumber value={d.cur.expense} format={f0} delay={0.8} />} delta={d.deltas.expense} invert />
              <Stat
                label="Net cash flow"
                value={<AnimatedNumber value={d.cur.net} format={(n) => fmt(n, { decimals: false, sign: 'always' })} delay={0.9} />}
                delta={d.deltas.net}
                tone={d.cur.net >= 0 ? 'text-pos' : 'text-neg'}
              />
              <Stat
                label="Savings rate"
                value={<AnimatedNumber value={Math.round(d.cur.savingsRate * 10)} format={(n) => `${(n / 10).toFixed(1)}%`} delay={1} />}
                delta={d.before.income ? Math.round(d.deltas.savingsRate * 10) / 10 : null}
                suffix=" pts"
              />
            </div>
          </div>

          <aside data-outlook className="grid grid-cols-1 gap-5 border-t border-line bg-sunken/30 px-5 py-6 md:px-8 lg:grid-cols-2 xl:flex xl:flex-col xl:border-l xl:border-t-0 xl:py-8">
            <div>
              <div className="label-mono">Projected month end</div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-[1.6rem] font-medium tracking-[-0.03em]">
                  <AnimatedNumber value={d.forecast.endBalance} format={f0} delay={1} />
                </span>
                <span className="text-xs text-fg-3">balance</span>
              </div>
            </div>
            <div>
              <div className="mb-2 flex justify-between text-xs">
                <span className="text-fg-3">Spent this month</span>
                <span className="num">
                  {f0(d.forecast.spentSoFar)} <span className="text-fg-4">/ ~{f0(d.forecast.projectedExpense)}</span>
                </span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-surface-3">
                <div className="absolute inset-0 opacity-70" style={{ background: 'repeating-linear-gradient(-45deg, transparent 0 3px, var(--line-strong) 3px 5px)' }} />
                <motion.div className="absolute inset-y-0 left-0 rounded-full bg-neg" initial={{ width: 0 }} animate={{ width: `${spentPct}%` }} transition={{ duration: 1.3, delay: 1, ease: [0.22, 1, 0.36, 1] }} />
              </div>
              <p className="mt-1.5 text-2xs text-fg-4">Hatched: projected at current pace + scheduled bills</p>
            </div>
            <dl className="grid grid-cols-2 gap-4 lg:col-span-2 lg:grid-cols-4 xl:grid-cols-2">
              <div>
                <dt className="label-mono">Available</dt>
                <dd className="mt-1 text-base font-medium num">{f0(d.available)}</dd>
                <dd className="text-2xs text-fg-4">after {f0(d.scheduledOut)} bills</dd>
              </div>
              <div>
                <dt className="label-mono">Budgets used</dt>
                <dd className={cn('mt-1 text-base font-medium num', d.budgetPct > 100 ? 'text-neg' : d.budgetPct > 80 ? 'text-warn' : '')}>{d.budgetPct.toFixed(1)}%</dd>
                <dd className="text-2xs text-fg-4 num">{f0(monthBudgetSpent)} of {f0(d.budgetTotal)}</dd>
              </div>
              <div>
                <dt className="label-mono">Total saved</dt>
                <dd className="mt-1 text-base font-medium num">{f0(d.goalSaved)}</dd>
                <dd className="text-2xs text-fg-4">{d.goalPct.toFixed(0)}% of goals</dd>
              </div>
              <div>
                <dt className="label-mono">Transactions</dt>
                <dd className="mt-1 text-base font-medium num">{d.cur.count}</dd>
                <dd className="text-2xs text-fg-4">in period</dd>
              </div>
            </dl>
          </aside>
        </div>

        {d.txs.length > 0 && (
          <div data-ticker className="relative border-t border-line py-2.5">
            <Ticker speed={60}>
              {d.txs.slice(0, 14).map((t) => {
                const c = t.categoryId ? d.catMap.get(t.categoryId) : undefined;
                return (
                  <button key={t.id} onClick={() => openDetail(t.id)} className="mx-2 flex items-center gap-2 rounded-full px-2 py-0.5 text-xs text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg">
                    <CategoryGlyph icon={c?.icon ?? 'wallet'} color={c?.color ?? 'var(--info)'} size={18} className="!rounded-[5px]" />
                    <span className="max-w-[180px] truncate">{t.title}</span>
                    <span className={cn('num', t.type === 'income' ? 'text-pos' : 'text-fg-2')}>
                      {t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '⇄ '}
                      {f0(t.amount)}
                    </span>
                    <span className="text-fg-4">/</span>
                  </button>
                );
              })}
            </Ticker>
          </div>
        )}
      </section>
    </div>
  );
}

// ───────────────────────── customize ─────────────────────────

function CustomizeItem({ id }: { id: WidgetId }) {
  const controls = useDragControls();
  const hidden = usePrefs((s) => s.dashboardHidden);
  const set = usePrefs((s) => s.set);
  const label = DASHBOARD_WIDGETS.find((w) => w.id === id)!.label;
  const on = !hidden.includes(id);
  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={controls}
      className="flex items-center gap-3 rounded-[12px] border border-line bg-surface-2 px-3 py-2.5"
      whileDrag={{ scale: 1.03, boxShadow: 'var(--shadow-lg)', zIndex: 5 }}
    >
      <button aria-label={`Drag to reorder ${label}`} onPointerDown={(e) => controls.start(e)} className="cursor-grab touch-none text-fg-4 active:cursor-grabbing">
        <GripVertical size={16} />
      </button>
      <span className={cn('flex-1 text-sm', !on && 'text-fg-4')}>{label}</span>
      <Switch checked={on} onChange={(v) => set({ dashboardHidden: v ? hidden.filter((x) => x !== id) : [...hidden, id] })} label={`Show ${label}`} />
    </Reorder.Item>
  );
}

// ───────────────────────── page ─────────────────────────

export default function DashboardPage() {
  const user = useCurrentUser();
  const preset = usePrefs((s) => s.dashboardRange);
  const order = usePrefs((s) => s.dashboardOrder);
  const hidden = usePrefs((s) => s.dashboardHidden);
  const setPrefs = usePrefs((s) => s.set);
  const reset = usePrefs((s) => s.resetDashboard);
  const d = useDashboard(preset);
  const [customize, setCustomize] = useState(false);
  const [expanded, setExpanded] = useState<WidgetId | null>(null);
  const first = user?.name.split(' ')[0] ?? '';
  const visible = order.filter((id) => !hidden.includes(id));

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 md:mb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="label-mono mb-2">{new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="text-[1.9rem] font-medium leading-[1.05] tracking-[-0.04em] md:text-[2.5rem]">
            <SplitReveal>{`${greeting()},`}</SplitReveal>{' '}
            <SplitReveal delay={0.18} className="serif italic text-fg-2">
              {first}
            </SplitReveal>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="max-w-full overflow-x-auto scrollbar-none">
            <Segmented<RangePreset>
              label="Date range"
              size="sm"
              value={preset}
              onChange={(v) => setPrefs({ dashboardRange: v })}
              options={RANGE_PRESETS.map((p) => ({ value: p.id, label: <span title={p.label}>{p.short}</span> }))}
            />
          </div>
          <IconButton label="Customize dashboard" onClick={() => setCustomize(true)} className="border border-line">
            <LayoutGrid size={16} />
          </IconButton>
        </div>
      </div>

      <Hero d={d} />

      <Reveal className="grid grid-flow-dense grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-12" stagger={0.08}>
        {visible.map((id) => {
          const m = META[id];
          if (id === 'narrative')
            return (
              <section key={id} data-reveal className={cn('panel px-5 py-8 md:px-8 md:py-12', SPAN[id])} aria-label="Month in review">
                {renderWidget(id, d)}
              </section>
            );
          return (
            <motion.div key={id} layout="position" data-reveal className={cn(SPAN[id], 'min-w-0')}>
              <Panel
                className="h-full"
                eyebrow={m.eyebrow}
                title={m.title}
                actions={
                  <>
                    {m.expandable && (
                      <IconButton label={`Expand ${m.title}`} size="sm" onClick={() => setExpanded(id)}>
                        <Maximize2 size={14} />
                      </IconButton>
                    )}
                    {m.link && (
                      <Link to={m.link} aria-label={`Open ${m.eyebrow}`} className="grid size-7 place-items-center rounded-[8px] text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg">
                        <ArrowUpRight size={15} />
                      </Link>
                    )}
                  </>
                }
              >
                {renderWidget(id, d)}
              </Panel>
            </motion.div>
          );
        })}
      </Reveal>

      <Dialog open={!!expanded} onClose={() => setExpanded(null)} size="lg" title={expanded ? META[expanded].title : ''} description={expanded ? META[expanded].eyebrow : undefined}>
        {expanded && renderWidget(expanded, d, true)}
      </Dialog>

      <Drawer
        open={customize}
        onClose={() => setCustomize(false)}
        title="Customize dashboard"
        description="Drag to reorder. Toggle to show or hide."
        footer={
          <Button variant="ghost" icon={<RotateCcw size={14} />} onClick={reset}>
            Reset layout
          </Button>
        }
      >
        <Reorder.Group axis="y" values={order} onReorder={(v) => setPrefs({ dashboardOrder: v })} className="flex flex-col gap-2">
          {order.map((id) => (
            <CustomizeItem key={id} id={id} />
          ))}
        </Reorder.Group>
      </Drawer>
    </>
  );
}
