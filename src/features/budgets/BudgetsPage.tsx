import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { gsap } from '@/components/animations/gsap';
import { reducedMotionNow } from '@/hooks/useMotionPrefs';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { Gauge, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Delta, Empty, Menu, Panel, Progress, Segmented } from '@/components/ui/Controls';
import { Button, IconButton } from '@/components/ui/Button';
import { Dialog, ConfirmDialog } from '@/components/ui/Overlay';
import { Field, MoneyInput, Select, Switch } from '@/components/ui/Field';
import { CategoryGlyph } from '@/components/ui/Icon';
import { AnimatedNumber, Reveal } from '@/components/animations/Motion';
import { MonthBars } from '@/components/charts/Charts';
import { useUserData } from '@/hooks/useData';
import { useMoney } from '@/hooks/useMoney';
import { useFinance } from '@/store/finance';
import { useUI } from '@/store/ui';
import { budgetForm, type BudgetFormValues } from '@/schemas';
import { budgetHistory, budgetUsage, changePct, periodRange, previousPeriodRef, spentIn, type BudgetUsage } from '@/lib/finance';
import { BUDGET_PERIODS, BUDGET_WARN_AT } from '@/constants/options';
import { minorToDecimalString, parseMoney, percent, sumMinor } from '@/utils/money';
import { monthLabel, todayISO } from '@/utils/dates';
import { cn } from '@/utils/cn';
import { EASE } from '@/constants/motion';
import type { Budget, BudgetPeriod } from '@/types';

// ───────────────────────── gauge ─────────────────────────

/** Semicircular utilisation gauge. Needle sweeps with a slow settle; arc colour shifts at thresholds. */
function UtilGauge({ pct }: { pct: number }) {
  const v = Math.min(120, Math.max(0, pct));
  const r = 92;
  const c = Math.PI * r;
  const color = pct > 100 ? 'var(--neg)' : pct >= BUDGET_WARN_AT ? 'var(--warn)' : 'var(--accent)';
  const angle = -90 + (Math.min(v, 100) / 100) * 180;
  const needle = useRef<SVGLineElement>(null);
  const lastAngle = useRef(-90);
  // GSAP's svgOrigin rotates around an exact SVG coordinate; the elastic settle reads like a real gauge needle.
  useLayoutEffect(() => {
    if (!needle.current) return;
    if (reducedMotionNow()) {
      gsap.set(needle.current, { rotation: angle, svgOrigin: '110 110' });
      return;
    }
    const tw = gsap.fromTo(needle.current, { rotation: lastAngle.current, svgOrigin: '110 110' }, { rotation: angle, svgOrigin: '110 110', duration: 2, delay: 0.3, ease: 'elastic.out(1, 0.45)' });
    lastAngle.current = angle;
    return () => {
      tw.kill();
    };
  }, [angle]);
  return (
    <div className="relative mx-auto w-[230px]">
      <svg viewBox="0 0 220 124" className="w-full overflow-visible" role="img" aria-label={`Monthly budgets ${pct.toFixed(0)} percent used`}>
        <path d="M 18 110 A 92 92 0 0 1 202 110" fill="none" stroke="var(--surface-3)" strokeWidth="14" strokeLinecap="round" />
        {/* threshold tick */}
        <line x1={110 + Math.cos(Math.PI * (1 - BUDGET_WARN_AT / 100)) * 78} y1={110 - Math.sin(Math.PI * (1 - BUDGET_WARN_AT / 100)) * 78} x2={110 + Math.cos(Math.PI * (1 - BUDGET_WARN_AT / 100)) * 106} y2={110 - Math.sin(Math.PI * (1 - BUDGET_WARN_AT / 100)) * 106} stroke="var(--fg-4)" strokeWidth="1.5" strokeDasharray="2 2" />
        <motion.path
          d="M 18 110 A 92 92 0 0 1 202 110"
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.min(v, 100) / 100), stroke: color }}
          transition={{ duration: 1.6, ease: EASE.outQuint, delay: 0.2 }}
        />
        <line ref={needle} x1="110" y1="110" x2="110" y2="36" stroke="var(--fg)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="110" cy="110" r="6" fill="var(--surface)" stroke="var(--fg)" strokeWidth="2" />
      </svg>
      <div className="mt-1 text-center">
        <div className="text-[2rem] font-medium tracking-[-0.04em]">
          <AnimatedNumber value={Math.round(pct * 10)} format={(n) => `${(n / 10).toFixed(1)}%`} />
        </div>
        <div className="label-mono">of monthly budgets used</div>
      </div>
    </div>
  );
}

// ───────────────────────── budget card ─────────────────────────

function BudgetCard({ u, onEdit, onDelete }: { u: BudgetUsage; onEdit: () => void; onDelete: () => void }) {
  const { catMap, txs } = useUserData();
  const { fmt } = useMoney();
  const c = catMap.get(u.budget.categoryId);
  const f0 = (n: number) => fmt(n, { decimals: false });
  const tone = u.status === 'over' ? 'var(--neg)' : u.status === 'warning' ? 'var(--warn)' : c?.color;
  const prevSpent = spentIn(txs, u.budget.categoryId, periodRange(u.budget.period, previousPeriodRef(u.budget.period, todayISO())));
  const projectedPct = u.available ? Math.min(140, percent(u.projected, u.available)) : 0;
  const hist = useMemo(() => budgetHistory(u.budget, txs, 6), [u.budget, txs]);
  const histMax = Math.max(1, ...hist.map((h) => Math.max(h.spent, h.limit)));

  return (
    <article
      data-reveal
      className={cn('panel flex flex-col gap-4 p-5 transition-[border-color,box-shadow] duration-500', u.status === 'over' && '!border-[color-mix(in_oklab,var(--neg)_40%,transparent)]')}
      style={u.status === 'over' ? { boxShadow: '0 0 0 1px color-mix(in oklab, var(--neg) 18%, transparent), var(--shadow-sm)' } : undefined}
    >
      <header className="flex items-start gap-3">
        <CategoryGlyph icon={c?.icon} color={c?.color} size={36} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium">{c?.name ?? 'Category'}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge>{u.budget.period}</Badge>
            {u.budget.rollover && (
              <Badge tone="info">
                <RefreshCw size={10} /> rollover
              </Badge>
            )}
            <AnimatePresence>
              {u.status !== 'ok' && (
                <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}>
                  <Badge tone={u.status === 'over' ? 'neg' : 'warn'} dot>
                    {u.status === 'over' ? 'Over budget' : 'Near limit'}
                  </Badge>
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
        <Menu
          trigger={(p) => (
            <IconButton label={`Actions for ${c?.name} budget`} size="sm" {...p}>
              <MoreHorizontal size={16} />
            </IconButton>
          )}
          items={[
            { label: 'Edit budget', icon: <Pencil size={14} />, onSelect: onEdit },
            'sep',
            { label: 'Delete budget', icon: <Trash2 size={14} />, onSelect: onDelete, danger: true },
          ]}
        />
      </header>

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[1.5rem] font-medium tracking-[-0.03em]">
            <AnimatedNumber value={u.spent} format={f0} />
          </span>
          <span className="text-sm text-fg-3 num">of {f0(u.available)}</span>
        </div>
        <div className="relative mt-2.5">
          <Progress value={u.utilization} color={tone} label={`${c?.name} ${u.utilization}% used`} height={8} />
          {projectedPct > 0 && projectedPct <= 140 && (
            <motion.span
              className="absolute -top-1 h-4 w-[2px] rounded-full bg-fg-2"
              style={{ left: `${Math.min(100, projectedPct)}%` }}
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: 0.8, scaleY: 1 }}
              transition={{ delay: 1.2 }}
              title={`Projected ${f0(u.projected)}`}
            />
          )}
        </div>
        <div className="mt-2 flex justify-between text-xs">
          <span className={cn('num', u.remaining < 0 ? 'text-neg' : 'text-fg-2')}>
            {u.remaining < 0 ? `${f0(-u.remaining)} over` : `${f0(u.remaining)} left`}
          </span>
          <span className="text-fg-4 num">projected {f0(u.projected)}</span>
        </div>
        {u.carried > 0 && <p className="mt-1 text-2xs text-info num">+{f0(u.carried)} rolled over from last period</p>}
      </div>

      <footer className="mt-auto flex items-end justify-between gap-4 border-t border-line pt-3">
        <div>
          <div className="label-mono whitespace-nowrap">vs last {u.budget.period === 'weekly' ? 'week' : u.budget.period === 'yearly' ? 'year' : 'month'}</div>
          <div className="mt-0.5 flex items-center gap-2 text-xs">
            <span className="text-fg-3 num">{f0(prevSpent)}</span>
            <Delta value={changePct(u.spent, prevSpent)} invert />
          </div>
        </div>
        <div className="flex h-8 items-end gap-[3px]" aria-label="Last 6 months: spend versus limit" role="img">
          {hist.map((h, i) => (
            <div key={h.month} className="relative flex h-full w-2.5 items-end" title={`${h.month}: ${f0(h.spent)} / ${f0(h.limit)}`}>
              <span className="absolute inset-x-0 border-t border-dashed border-fg-4" style={{ bottom: `${(h.limit / histMax) * 100}%` }} />
              <motion.span
                className="w-full rounded-[2px]"
                style={{ background: h.spent > h.limit ? 'var(--neg)' : c?.color ?? 'var(--accent)', opacity: i === hist.length - 1 ? 1 : 0.55 }}
                initial={{ height: 0 }}
                animate={{ height: `${(h.spent / histMax) * 100}%` }}
                transition={{ duration: 0.8, delay: 0.3 + i * 0.05, ease: EASE.outQuint }}
              />
            </div>
          ))}
        </div>
      </footer>
    </article>
  );
}

// ───────────────────────── form ─────────────────────────

function BudgetDialog({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: Budget | null }) {
  const { cats } = useUserData();
  const { symbol, toDisplay, fromDisplay } = useMoney();
  const upsert = useFinance((s) => s.upsertBudget);
  const toast = useUI((s) => s.toast);
  const expenseCats = cats.filter((c) => c.kind === 'expense' && !c.archived);
  const { register, handleSubmit, control, reset, formState } = useForm<BudgetFormValues>({ resolver: zodResolver(budgetForm) });
  useEffect(() => {
    if (open)
      reset({
        categoryId: editing?.categoryId ?? expenseCats[0]?.id ?? '',
        period: editing?.period ?? 'monthly',
        limit: editing ? minorToDecimalString(toDisplay(editing.limit)) : '',
        rollover: editing?.rollover ?? false,
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);
  const submit = handleSubmit((v) => {
    upsert({ id: editing?.id, categoryId: v.categoryId, period: v.period, limit: fromDisplay(parseMoney(v.limit)!), rollover: v.rollover });
    toast({ tone: 'success', title: editing ? 'Budget updated' : 'Budget created' });
    onClose();
  });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? 'Edit budget' : 'New budget'}
      description="One budget per category and period. Creating a duplicate updates the existing one."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="budget-form">{editing ? 'Save' : 'Create budget'}</Button>
        </>
      }
    >
      <form id="budget-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="Category" error={formState.errors.categoryId?.message}>
          {(p) => (
            <Select {...p} {...register('categoryId')}>
              {expenseCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          )}
        </Field>
        <Controller
          control={control}
          name="period"
          render={({ field }) => (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-fg-2">Period</span>
              <Segmented<BudgetPeriod> label="Period" value={field.value} onChange={field.onChange} options={BUDGET_PERIODS.map((p) => ({ value: p.id, label: p.label }))} className="w-full" />
            </div>
          )}
        />
        <Field label="Limit" error={formState.errors.limit?.message}>
          {(p) => <MoneyInput {...p} {...register('limit')} symbol={symbol} placeholder="0.00" data-autofocus />}
        </Field>
        <Controller
          control={control}
          name="rollover"
          render={({ field }) => (
            <label className="flex items-center justify-between gap-4 rounded-[10px] border border-line bg-surface-2/50 p-3">
              <span>
                <span className="block text-sm">Roll over unspent amount</span>
                <span className="block text-xs text-fg-3">Leftover from the previous period is added to this one.</span>
              </span>
              <Switch checked={!!field.value} onChange={field.onChange} label="Roll over unspent amount" />
            </label>
          )}
        />
      </form>
    </Dialog>
  );
}

// ───────────────────────── page ─────────────────────────

export default function BudgetsPage() {
  const { buds, txs, catMap } = useUserData();
  const { fmt } = useMoney();
  const del = useFinance((s) => s.deleteBudget);
  const toast = useUI((s) => s.toast);
  const [period, setPeriod] = useState<'all' | BudgetPeriod>('all');
  const [editing, setEditing] = useState<Budget | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Budget | null>(null);
  const today = todayISO();

  const usage = useMemo(() => buds.map((b) => budgetUsage(b, txs, today, BUDGET_WARN_AT)).sort((a, b) => b.utilization - a.utilization), [buds, txs, today]);
  const shown = usage.filter((u) => period === 'all' || u.budget.period === period);
  const monthly = usage.filter((u) => u.budget.period === 'monthly');
  const totalAvail = sumMinor(monthly.map((u) => u.available));
  const totalSpent = sumMinor(monthly.map((u) => u.spent));
  const over = usage.filter((u) => u.status === 'over').length;
  const warn = usage.filter((u) => u.status === 'warning').length;

  const history = useMemo(() => {
    const per = monthly.map((u) => budgetHistory(u.budget, txs, 6));
    return (per[0] ?? []).map((_, i) => ({ month: per[0][i].month, spent: sumMinor(per.map((p) => p[i].spent)), limit: sumMinor(per.map((p) => p[i].limit)) }));
  }, [monthly, txs]);
  const f0 = (n: number) => fmt(n, { decimals: false });

  return (
    <>
      <PageHeader
        eyebrow="Plan"
        title="Budgets"
        description={`Spending limits for ${monthLabel(today.slice(0, 7), 'long', true)}. The tick on each bar marks where you’ll land at your current pace.`}
        actions={<Button variant="primary" icon={<Plus size={15} />} onClick={() => { setEditing(null); setOpen(true); }}>New budget</Button>}
      />

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel className="lg:col-span-4" eyebrow="This month" title="Overall utilisation">
          <UtilGauge pct={totalAvail ? percent(totalSpent, totalAvail) : 0} />
          <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
            <div><dt className="label-mono">Budgeted</dt><dd className="mt-1 text-sm font-medium num">{f0(totalAvail)}</dd></div>
            <div><dt className="label-mono">Spent</dt><dd className="mt-1 text-sm font-medium num">{f0(totalSpent)}</dd></div>
            <div><dt className="label-mono">Left</dt><dd className={cn('mt-1 text-sm font-medium num', totalAvail - totalSpent < 0 && 'text-neg')}>{f0(totalAvail - totalSpent)}</dd></div>
          </dl>
        </Panel>
        <Panel className="lg:col-span-8" eyebrow="History" title="Budget performance, last 6 months" actions={
          <div className="flex gap-2">{over > 0 && <Badge tone="neg" dot>{over} over</Badge>}{warn > 0 && <Badge tone="warn" dot>{warn} near limit</Badge>}</div>
        }>
          {history.length ? (
            <MonthBars data={history} keys={[{ key: 'limit', name: 'Budgeted', color: 'var(--surface-3)' }, { key: 'spent', name: 'Spent', color: 'var(--accent)' }]} height={250} />
          ) : (
            <Empty icon={<Gauge size={18} />} title="No monthly budgets yet" />
          )}
        </Panel>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <Segmented
          label="Period filter"
          size="sm"
          value={period}
          onChange={setPeriod}
          options={[{ value: 'all', label: `All · ${usage.length}` }, ...BUDGET_PERIODS.map((p) => ({ value: p.id, label: p.label }))]}
        />
      </div>

      {shown.length === 0 ? (
        <Panel>
          <Empty icon={<Gauge size={18} />} title="No budgets for this period" body="Budgets warn you at 80% and flag overspending." action={<Button variant="primary" size="sm" onClick={() => { setEditing(null); setOpen(true); }}>Create budget</Button>} />
        </Panel>
      ) : (
        <Reveal key={period} className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3" stagger={0.06}>
          {shown.map((u) => (
            <BudgetCard key={u.budget.id} u={u} onEdit={() => { setEditing(u.budget); setOpen(true); }} onDelete={() => setDeleting(u.budget)} />
          ))}
        </Reveal>
      )}

      <BudgetDialog open={open} onClose={() => setOpen(false)} editing={editing} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete budget?"
        body={<>The {deleting?.period} budget for {deleting && catMap.get(deleting.categoryId)?.name} will be removed. Transactions are not affected.</>}
        onConfirm={() => {
          if (deleting) del(deleting.id);
          toast({ tone: 'info', title: 'Budget deleted' });
        }}
      />
    </>
  );
}
