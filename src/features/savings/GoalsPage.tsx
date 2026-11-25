import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { CalendarDays, History, MoreHorizontal, Pencil, Plus, Target, Trash2, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Empty, Menu, Panel, Progress, Ring, Segmented } from '@/components/ui/Controls';
import { Button, IconButton } from '@/components/ui/Button';
import { ConfirmDialog, Dialog, Drawer } from '@/components/ui/Overlay';
import { Field, Input, MoneyInput } from '@/components/ui/Field';
import { CategoryGlyph, ICON_NAMES } from '@/components/ui/Icon';
import { AnimatedNumber, Reveal, burst, useRecoil } from '@/components/animations/Motion';
import { GrowthArea } from '@/components/charts/Charts';
import { useUserData } from '@/hooks/useData';
import { useMoney } from '@/hooks/useMoney';
import { useFinance } from '@/store/finance';
import { useUI } from '@/store/ui';
import { usePrefs } from '@/store/prefs';
import { contributionForm, goalForm, type ContributionFormValues, type GoalFormValues } from '@/schemas';
import { goalProgress } from '@/lib/finance';
import { CATEGORY_PALETTE } from '@/constants/palette';
import { minorToDecimalString, parseMoney, percent, sumMinor } from '@/utils/money';
import { formatDate, monthKey, monthLabel, todayISO } from '@/utils/dates';
import { cn } from '@/utils/cn';
import type { Goal, IconName } from '@/types';

// ───────────────────────── goal card ─────────────────────────

function GoalCard({ goal, onContribute, onEdit, onDelete, onHistory }: { goal: Goal; onContribute: () => void; onEdit: () => void; onDelete: () => void; onHistory: () => void }) {
  const { fmt } = useMoney();
  const dateFmt = usePrefs((s) => s.dateFormat);
  const p = goalProgress(goal);
  const ref = useRecoil<HTMLDivElement>(4);
  const f0 = (n: number) => fmt(n, { decimals: false });
  return (
    <article
      data-reveal
      data-goal={goal.id}
      className={cn('panel relative flex flex-col overflow-hidden p-5', p.complete && '!border-[color-mix(in_oklab,var(--pos)_35%,transparent)]')}
      style={p.complete ? { background: `radial-gradient(120% 80% at 100% 0%, color-mix(in oklab, ${goal.color} 12%, transparent), transparent 60%), var(--panel-light), var(--surface)` } : undefined}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <CategoryGlyph icon={goal.icon} color={goal.color} size={34} />
          <div className="min-w-0">
            <h3 className="line-clamp-2 font-medium leading-snug">{goal.title}</h3>
            <p className="flex items-center gap-1 text-xs text-fg-3">
              <CalendarDays size={11} />
              {goal.deadline ? `by ${formatDate(goal.deadline, dateFmt)}` : 'No deadline'}
            </p>
          </div>
        </div>
        <Menu
          trigger={(t) => (
            <IconButton label={`Actions for ${goal.title}`} size="sm" {...t}>
              <MoreHorizontal size={16} />
            </IconButton>
          )}
          items={[
            { label: 'Contribution history', icon: <History size={14} />, onSelect: onHistory },
            { label: 'Edit goal', icon: <Pencil size={14} />, onSelect: onEdit },
            'sep',
            { label: 'Delete goal', icon: <Trash2 size={14} />, onSelect: onDelete, danger: true },
          ]}
        />
      </header>

      <div className="my-6 flex items-center gap-5">
        <div ref={ref}>
          <Ring value={p.pct} size={104} stroke={8} color={goal.color} label={`${goal.title}: ${p.pct}% funded`}>
            <div className="text-center">
              <div className="text-[1.35rem] font-medium tracking-tight">
                <AnimatedNumber value={Math.round(p.pct)} format={(n) => `${n}%`} />
              </div>
              {p.complete && <div className="text-[9px] font-medium uppercase tracking-wider text-pos">funded</div>}
            </div>
          </Ring>
        </div>
        <div className="min-w-0 flex-1">
          <div className="label-mono">Saved</div>
          <div className="text-[1.6rem] font-medium tracking-[-0.03em]">
            <AnimatedNumber value={p.saved} format={f0} />
          </div>
          <div className="text-sm text-fg-3 num">of {f0(goal.target)}</div>
        </div>
      </div>

      <div className="mb-4 flex gap-1" aria-hidden>
        {[25, 50, 75, 100].map((m) => (
          <div key={m} className="flex-1">
            <div className="h-1 rounded-full transition-colors duration-700" style={{ background: p.pct >= m ? goal.color : 'var(--surface-3)' }} />
            <div className={cn('mt-1 text-[10px] num', p.pct >= m ? 'text-fg-2' : 'text-fg-4')}>{m}%</div>
          </div>
        ))}
      </div>

      <dl className="grid grid-cols-2 gap-3 border-t border-line pt-4 text-xs">
        <div>
          <dt className="text-fg-3">{p.complete ? 'Status' : 'Estimated'}</dt>
          <dd className="mt-0.5 font-medium">{p.complete ? 'Goal reached' : p.eta ? monthLabel(monthKey(p.eta), 'long', true) : 'No contributions yet'}</dd>
        </div>
        <div>
          <dt className="text-fg-3">{p.requiredMonthly !== null ? 'Needed / month' : 'Avg / month'}</dt>
          <dd className="mt-0.5 flex items-center gap-1.5 font-medium num">
            {f0(p.requiredMonthly ?? p.monthlyPace)}
            {p.onTrack !== null && <Badge tone={p.onTrack ? 'pos' : 'warn'}>{p.onTrack ? 'On track' : 'Behind'}</Badge>}
          </dd>
        </div>
      </dl>

      <div className="mt-5 flex gap-2">
        <Button variant={p.complete ? 'secondary' : 'primary'} className="flex-1" icon={<Plus size={15} />} onClick={onContribute}>
          {p.complete ? 'Add more' : 'Contribute'}
        </Button>
        <Button variant="ghost" onClick={onHistory} aria-label="History">
          <History size={15} />
        </Button>
      </div>
    </article>
  );
}

// ───────────────────────── dialogs ─────────────────────────

function GoalDialog({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: Goal | null }) {
  const { symbol, toDisplay, fromDisplay } = useMoney();
  const add = useFinance((s) => s.addGoal);
  const update = useFinance((s) => s.updateGoal);
  const toast = useUI((s) => s.toast);
  const { register, handleSubmit, reset, control, watch, formState } = useForm<GoalFormValues>({ resolver: zodResolver(goalForm) });
  useEffect(() => {
    if (open)
      reset({
        title: editing?.title ?? '', target: editing ? minorToDecimalString(toDisplay(editing.target)) : '', initial: '',
        deadline: editing?.deadline ?? '', color: editing?.color ?? CATEGORY_PALETTE[1], icon: editing?.icon ?? 'target',
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);
  const color = watch('color');
  const submit = handleSubmit((v) => {
    const base = { title: v.title, target: fromDisplay(parseMoney(v.target)!), deadline: v.deadline || null, color: v.color, icon: v.icon as IconName };
    if (editing) {
      update(editing.id, base);
      toast({ tone: 'success', title: 'Goal updated' });
    } else {
      const init = v.initial ? parseMoney(v.initial) ?? 0 : 0;
      add({ ...base, contributions: init > 0 ? [{ id: `init_${Date.now()}`, date: todayISO(), amount: fromDisplay(init), note: 'Starting balance' }] : [] });
      toast({ tone: 'success', title: 'Goal created', body: v.title });
    }
    onClose();
  });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? 'Edit goal' : 'New savings goal'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="goal-form">{editing ? 'Save' : 'Create goal'}</Button>
        </>
      }
    >
      <form id="goal-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="Name" error={formState.errors.title?.message}>
          {(p) => <Input {...p} {...register('title')} placeholder="e.g. Emergency fund" data-autofocus maxLength={80} />}
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Target" error={formState.errors.target?.message}>
            {(p) => <MoneyInput {...p} {...register('target')} symbol={symbol} placeholder="0.00" />}
          </Field>
          {!editing ? (
            <Field label="Already saved" optional error={formState.errors.initial?.message}>
              {(p) => <MoneyInput {...p} {...register('initial')} symbol={symbol} placeholder="0.00" />}
            </Field>
          ) : (
            <Field label="Deadline" optional>
              {(p) => <Input {...p} type="date" {...register('deadline')} />}
            </Field>
          )}
        </div>
        {!editing && (
          <Field label="Deadline" optional hint="Used to compute the monthly amount needed.">
            {(p) => <Input {...p} type="date" min={todayISO()} {...register('deadline')} />}
          </Field>
        )}
        <Controller
          control={control}
          name="color"
          render={({ field }) => (
            <fieldset>
              <legend className="mb-2 text-xs font-medium text-fg-2">Colour</legend>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_PALETTE.map((c) => (
                  <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={field.value === c} onClick={() => field.onChange(c)} className={cn('size-7 rounded-full transition-transform', field.value === c ? 'scale-110 ring-2 ring-fg ring-offset-2 ring-offset-surface' : 'hover:scale-110')} style={{ background: c }} />
                ))}
              </div>
            </fieldset>
          )}
        />
        <Controller
          control={control}
          name="icon"
          render={({ field }) => (
            <fieldset>
              <legend className="mb-2 text-xs font-medium text-fg-2">Icon</legend>
              <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
                {ICON_NAMES.map((ic) => (
                  <button key={ic} type="button" aria-label={ic} aria-pressed={field.value === ic} onClick={() => field.onChange(ic)} className={cn('grid place-items-center rounded-[9px] p-1 transition-all', field.value === ic ? 'bg-surface-3 ring-1 ring-line-strong' : 'opacity-60 hover:opacity-100')}>
                    <CategoryGlyph icon={ic} color={color} size={26} />
                  </button>
                ))}
              </div>
            </fieldset>
          )}
        />
      </form>
    </Dialog>
  );
}

function ContributeDialog({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const { symbol, fromDisplay, fmt } = useMoney();
  const contribute = useFinance((s) => s.contribute);
  const toast = useUI((s) => s.toast);
  const { register, handleSubmit, reset, control, formState } = useForm<ContributionFormValues>({ resolver: zodResolver(contributionForm) });
  useEffect(() => {
    if (goal) reset({ amount: '', direction: 'add', date: todayISO(), note: '' });
  }, [goal, reset]);
  const submit = handleSubmit((v) => {
    if (!goal) return;
    const before = goalProgress(goal);
    const amt = fromDisplay(parseMoney(v.amount)!);
    if (v.direction === 'withdraw' && amt > before.saved) {
      toast({ tone: 'warning', title: 'Not enough saved', body: `Only ${fmt(before.saved)} is in this goal.` });
      return;
    }
    contribute(goal.id, { amount: v.direction === 'add' ? amt : -amt, date: v.date, note: v.note || undefined });
    const after = goalProgress({ ...goal, contributions: [...goal.contributions, { id: 'x', date: v.date, amount: v.direction === 'add' ? amt : -amt }] });
    onClose();
    if (after.milestone > before.milestone) {
      // celebrate from the goal's ring once the dialog is gone
      setTimeout(() => {
        const el = document.querySelector<HTMLElement>(`[data-goal="${goal.id}"] [role="img"]`);
        if (el) burst(el, [goal.color, '#ffebaf', '#4c9db0']);
      }, 380);
      toast({ tone: 'success', title: after.complete ? `“${goal.title}” is fully funded!` : `Milestone: ${after.milestone}% of “${goal.title}”`, body: after.complete ? 'Goal reached.' : `${fmt(after.remaining, { decimals: false })} to go.` });
    } else toast({ tone: 'success', title: v.direction === 'add' ? 'Contribution added' : 'Withdrawal recorded', body: `${fmt(amt)} · ${goal.title}` });
  });
  return (
    <Dialog
      open={!!goal}
      onClose={onClose}
      size="sm"
      title={goal?.title ?? ''}
      description="Move money in or out of this goal."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="ctb-form">Save</Button>
        </>
      }
    >
      <form id="ctb-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Controller control={control} name="direction" render={({ field }) => (
          <Segmented label="Direction" value={field.value} onChange={field.onChange} className="w-full" options={[{ value: 'add', label: 'Add', tone: 'var(--pos)' }, { value: 'withdraw', label: 'Withdraw', tone: 'var(--neg)' }]} />
        )} />
        <Field label="Amount" error={formState.errors.amount?.message}>
          {(p) => <MoneyInput {...p} {...register('amount')} symbol={symbol} large placeholder="0.00" data-autofocus />}
        </Field>
        <Field label="Date">{(p) => <Input {...p} type="date" {...register('date')} />}</Field>
        <Field label="Note" optional>{(p) => <Input {...p} {...register('note')} maxLength={120} />}</Field>
      </form>
    </Dialog>
  );
}

function HistoryDrawer({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const { fmt } = useMoney();
  const remove = useFinance((s) => s.removeContribution);
  const dateFmt = usePrefs((s) => s.dateFormat);
  const list = goal ? [...goal.contributions].sort((a, b) => b.date.localeCompare(a.date)) : [];
  return (
    <Drawer open={!!goal} onClose={onClose} title={goal?.title ?? ''} description={`${list.length} contributions`}>
      {list.length === 0 ? (
        <Empty title="No contributions yet" />
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {list.map((c) => (
            <li key={c.id} className="group flex items-center gap-3 py-3">
              <span className={cn('size-2 rounded-full', c.amount >= 0 ? 'bg-pos' : 'bg-neg')} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm">{c.note || (c.amount >= 0 ? 'Contribution' : 'Withdrawal')}</span>
                <span className="block text-xs text-fg-3">{formatDate(c.date, dateFmt)}</span>
              </span>
              <span className={cn('text-sm font-medium num', c.amount >= 0 ? 'text-pos' : 'text-neg')}>{fmt(c.amount, { sign: 'always' })}</span>
              {goal && (
                <IconButton label="Remove contribution" size="sm" tone="danger" className="opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => remove(goal.id, c.id)}>
                  <X size={13} />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}

// ───────────────────────── page ─────────────────────────

export default function GoalsPage() {
  const { gls } = useUserData();
  const { fmt } = useMoney();
  const del = useFinance((s) => s.deleteGoal);
  const toast = useUI((s) => s.toast);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [contrib, setContrib] = useState<Goal | null>(null);
  const [history, setHistory] = useState<Goal | null>(null);
  const [deleting, setDeleting] = useState<Goal | null>(null);
  const totalRef = useRef<HTMLDivElement>(null);

  const saved = sumMinor(gls.map((g) => goalProgress(g).saved));
  const target = sumMinor(gls.map((g) => g.target));
  const done = gls.filter((g) => goalProgress(g).complete).length;
  const growth = useMemo(() => {
    const all = gls.flatMap((g) => g.contributions).sort((a, b) => a.date.localeCompare(b.date));
    const byMonth = new Map<string, number>();
    let run = 0;
    for (const c of all) {
      run += c.amount;
      byMonth.set(monthKey(c.date), run);
    }
    return [...byMonth.entries()].map(([month, total]) => ({ month, total }));
  }, [gls]);
  const live = (g: Goal | null) => (g ? gls.find((x) => x.id === g.id) ?? null : null);

  return (
    <>
      <PageHeader
        eyebrow="Plan"
        title="Savings goals"
        description="Set a target, contribute over time, and see when you’ll get there at your current pace."
        actions={<Button variant="primary" icon={<Plus size={15} />} onClick={() => { setEditing(null); setFormOpen(true); }}>New goal</Button>}
      />
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel className="lg:col-span-4" eyebrow="All goals" title="Total saved">
          <div ref={totalRef} className="text-[2.6rem] font-medium leading-none tracking-[-0.045em]">
            <AnimatedNumber value={saved} format={(n) => fmt(n, { decimals: false })} />
          </div>
          <p className="mt-2 text-sm text-fg-3 num">of {fmt(target, { decimals: false })} across {gls.length} goals</p>
          <Progress value={target ? percent(saved, target) : 0} label="All goals funded" className="mt-5" height={8} />
          <div className="mt-2 flex justify-between text-xs text-fg-3 num">
            <span>{target ? percent(saved, target).toFixed(1) : 0}% funded</span>
            <span>{done} complete</span>
          </div>
        </Panel>
        <Panel className="lg:col-span-8" eyebrow="Growth" title="Savings over time">
          {growth.length > 1 ? <GrowthArea data={growth} dataKey="total" name="Saved" height={210} color="var(--pos)" /> : <Empty title="Contribute to see growth" />}
        </Panel>
      </div>

      {gls.length === 0 ? (
        <Panel>
          <Empty icon={<Target size={18} />} title="No goals yet" body="Saving for a trip, a cushion, a down payment? Make it a goal." action={<Button variant="primary" size="sm" onClick={() => setFormOpen(true)}>Create a goal</Button>} />
        </Panel>
      ) : (
        <Reveal className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3" stagger={0.07}>
          {gls.map((g) => (
            <motion.div key={g.id} layout="position" className="contents">
              <GoalCard goal={g} onContribute={() => setContrib(g)} onEdit={() => { setEditing(g); setFormOpen(true); }} onDelete={() => setDeleting(g)} onHistory={() => setHistory(g)} />
            </motion.div>
          ))}
        </Reveal>
      )}

      <GoalDialog open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
      <ContributeDialog goal={live(contrib)} onClose={() => setContrib(null)} />
      <HistoryDrawer goal={live(history)} onClose={() => setHistory(null)} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete goal?"
        body={<>“{deleting?.title}” and its contribution history will be removed.</>}
        onConfirm={() => {
          if (deleting) del(deleting.id);
          toast({ tone: 'info', title: 'Goal deleted' });
        }}
      />
    </>
  );
}
