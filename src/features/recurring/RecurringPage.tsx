import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, FastForward, MoreHorizontal, Pause, Pencil, Play, Plus, Repeat, Send, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Empty, Menu, Panel, Segmented } from '@/components/ui/Controls';
import { Button, IconButton } from '@/components/ui/Button';
import { ConfirmDialog, Dialog } from '@/components/ui/Overlay';
import { Field, Input, MoneyInput, Select, Switch } from '@/components/ui/Field';
import { CategoryGlyph } from '@/components/ui/Icon';
import { AnimatedNumber, Reveal } from '@/components/animations/Motion';
import { useUserData } from '@/hooks/useData';
import { useMoney } from '@/hooks/useMoney';
import { useFinance } from '@/store/finance';
import { useUI } from '@/store/ui';
import { usePrefs } from '@/store/prefs';
import { recurringForm, type RecurringFormValues } from '@/schemas';
import { monthlyEquivalent, nextOccurrence, upcoming } from '@/lib/finance';
import { FREQUENCIES, PAYMENT_METHODS } from '@/constants/options';
import { minorToDecimalString, parseMoney, sumMinor } from '@/utils/money';
import { addDays, formatDate, fromISO, relativeDay, todayISO } from '@/utils/dates';
import { cn } from '@/utils/cn';
import type { Recurring } from '@/types';

function RecurringDialog({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: Recurring | null }) {
  const { cats, accts } = useUserData();
  const { symbol, toDisplay, fromDisplay } = useMoney();
  const add = useFinance((s) => s.addRecurring);
  const update = useFinance((s) => s.updateRecurring);
  const toast = useUI((s) => s.toast);
  const { register, handleSubmit, reset, control, watch, setValue, formState } = useForm<RecurringFormValues>({ resolver: zodResolver(recurringForm) });
  useEffect(() => {
    if (!open) return;
    reset({
      type: editing?.type ?? 'expense', title: editing?.title ?? '', amount: editing ? minorToDecimalString(toDisplay(editing.amount)) : '',
      categoryId: editing?.categoryId ?? '', accountId: editing?.accountId ?? accts[0]?.id ?? '', paymentMethod: editing?.paymentMethod ?? 'bank',
      frequency: editing?.frequency ?? 'monthly', interval: editing?.interval ?? 1, startDate: editing?.startDate ?? todayISO(),
      endDate: editing?.endDate ?? '', autoPost: editing?.autoPost ?? true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);
  const type = watch('type');
  const e = formState.errors;
  const submit = handleSubmit((v) => {
    const payload = {
      type: v.type, title: v.title, amount: fromDisplay(parseMoney(v.amount)!), categoryId: v.categoryId, accountId: v.accountId,
      paymentMethod: v.paymentMethod, frequency: v.frequency, interval: Number(v.interval), startDate: v.startDate, endDate: v.endDate || null,
      autoPost: v.autoPost, active: editing?.active ?? true,
    };
    if (editing) {
      update(editing.id, payload);
      toast({ tone: 'success', title: 'Schedule updated' });
    } else {
      add(payload);
      toast({ tone: 'success', title: 'Schedule created', body: v.autoPost ? 'Any past-due occurrences were posted.' : undefined });
    }
    onClose();
  });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? 'Edit schedule' : 'New recurring transaction'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="rec-form">{editing ? 'Save' : 'Create schedule'}</Button>
        </>
      }
    >
      <form id="rec-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Controller control={control} name="type" render={({ field }) => (
          <Segmented label="Type" value={field.value} onChange={(v) => { field.onChange(v); setValue('categoryId', ''); }} className="w-full" options={[{ value: 'expense', label: 'Expense', tone: 'var(--neg)' }, { value: 'income', label: 'Income', tone: 'var(--pos)' }]} />
        )} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name" error={e.title?.message}>{(p) => <Input {...p} {...register('title')} placeholder="e.g. Rent" data-autofocus />}</Field>
          <Field label="Amount" error={e.amount?.message}>{(p) => <MoneyInput {...p} {...register('amount')} symbol={symbol} placeholder="0.00" />}</Field>
          <Field label="Category" error={e.categoryId?.message}>
            {(p) => (
              <Select {...p} {...register('categoryId')}>
                <option value="">Choose…</option>
                {cats.filter((c) => c.kind === type && !c.archived).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Account" error={e.accountId?.message}>
            {(p) => <Select {...p} {...register('accountId')}>{accts.filter((a) => !a.archived).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>}
          </Field>
          <Field label="Repeats">
            {(p) => <Select {...p} {...register('frequency')}>{FREQUENCIES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</Select>}
          </Field>
          <Field label="Every" hint={`Every N ${FREQUENCIES.find((f) => f.id === watch('frequency'))?.every}(s)`} error={e.interval?.message}>
            {(p) => <Input {...p} type="number" min={1} max={52} {...register('interval')} />}
          </Field>
          <Field label="Starts" error={e.startDate?.message}>{(p) => <Input {...p} type="date" {...register('startDate')} />}</Field>
          <Field label="Ends" optional>{(p) => <Input {...p} type="date" {...register('endDate')} />}</Field>
          <Field label="Payment method">
            {(p) => <Select {...p} {...register('paymentMethod')}>{PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</Select>}
          </Field>
        </div>
        <Controller control={control} name="autoPost" render={({ field }) => (
          <label className="flex items-center justify-between gap-4 rounded-[10px] border border-line bg-surface-2/50 p-3">
            <span>
              <span className="block text-sm">Post automatically</span>
              <span className="block text-xs text-fg-3">Due occurrences become transactions when you open the app.</span>
            </span>
            <Switch checked={!!field.value} onChange={field.onChange} label="Post automatically" />
          </label>
        )} />
      </form>
    </Dialog>
  );
}

/** 5-week calendar strip showing every scheduled occurrence. */
function ScheduleStrip({ items }: { items: ReturnType<typeof upcoming> }) {
  const { fmt } = useMoney();
  const today = todayISO();
  const days = Array.from({ length: 35 }, (_, i) => addDays(today, i));
  const byDay = new Map<string, typeof items>();
  items.forEach((u) => byDay.set(u.date, [...(byDay.get(u.date) ?? []), u]));
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
        <div key={i} className="label-mono text-center !text-[10px]">{d}</div>
      ))}
      {Array.from({ length: (fromISO(today).getDay() + 6) % 7 }, (_, i) => <div key={`pad${i}`} />)}
      {days.map((d, i) => {
        const list = byDay.get(d) ?? [];
        const out = sumMinor(list.filter((u) => u.recurring.type === 'expense').map((u) => u.recurring.amount));
        const inn = sumMinor(list.filter((u) => u.recurring.type === 'income').map((u) => u.recurring.amount));
        return (
          <motion.div
            key={d}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.012, duration: 0.3 }}
            title={list.map((u) => `${u.recurring.title}: ${fmt(u.recurring.amount)}`).join('\n') || undefined}
            className={cn(
              'flex aspect-square flex-col justify-between rounded-[8px] border p-1.5 text-[10px] sm:aspect-[1.15]',
              d === today ? 'border-[var(--accent-line)] bg-accent-soft' : list.length ? 'border-line-strong bg-surface-2' : 'border-line',
            )}
          >
            <span className={cn('num', d === today ? 'text-accent-fg' : 'text-fg-4')}>{fromISO(d).getDate()}</span>
            <span className="flex flex-col items-end gap-0.5">
              {inn > 0 && <span className="hidden truncate text-pos num sm:block">+{fmt(inn, { decimals: false })}</span>}
              {out > 0 && <span className="hidden truncate text-fg-2 num sm:block">−{fmt(out, { decimals: false })}</span>}
              {list.length > 0 && <span className="flex gap-0.5 sm:hidden">{list.slice(0, 3).map((u, k) => <span key={k} className={cn('size-1.5 rounded-full', u.recurring.type === 'income' ? 'bg-pos' : 'bg-fg-2')} />)}</span>}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

export default function RecurringPage() {
  const { recs, catMap, acctMap } = useUserData();
  const { fmt } = useMoney();
  const dateFmt = usePrefs((s) => s.dateFormat);
  const update = useFinance((s) => s.updateRecurring);
  const del = useFinance((s) => s.deleteRecurring);
  const postNow = useFinance((s) => s.postRecurringNow);
  const skip = useFinance((s) => s.skipRecurring);
  const toast = useUI((s) => s.toast);
  const [filter, setFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [editing, setEditing] = useState<Recurring | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Recurring | null>(null);

  const items = useMemo(() => upcoming(recs, 34), [recs]);
  const active = recs.filter((r) => r.active);
  const monthlyOut = sumMinor(active.filter((r) => r.type === 'expense').map(monthlyEquivalent));
  const monthlyIn = sumMinor(active.filter((r) => r.type === 'income').map(monthlyEquivalent));
  const list = recs.filter((r) => filter === 'all' || r.type === filter).sort((a, b) => Number(b.active) - Number(a.active) || b.amount - a.amount);
  const f0 = (n: number) => fmt(n, { decimals: false });
  const freqLabel = (r: Recurring) => {
    const f = FREQUENCIES.find((x) => x.id === r.frequency)!;
    return r.interval > 1 ? `Every ${r.interval} ${f.every}s` : f.label;
  };

  return (
    <>
      <PageHeader
        eyebrow="Plan"
        title="Recurring"
        description="Salaries, rent, subscriptions. Schedules post themselves when due, and you can post early, skip, or pause any of them."
        actions={<Button variant="primary" icon={<Plus size={15} />} onClick={() => { setEditing(null); setOpen(true); }}>New schedule</Button>}
      />
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[14px] border border-line bg-line sm:grid-cols-3 lg:col-span-12">
          {[
            { l: 'Fixed income / mo', v: monthlyIn, c: 'text-pos' },
            { l: 'Fixed costs / mo', v: monthlyOut, c: '' },
            { l: 'Committed net / mo', v: monthlyIn - monthlyOut, c: monthlyIn - monthlyOut >= 0 ? 'text-pos' : 'text-neg' },
          ].map((x) => (
            <div key={x.l} className="bg-surface px-4 py-4 md:px-5">
              <div className="label-mono">{x.l}</div>
              <div className={cn('mt-1 text-lg font-medium tracking-tight md:text-xl', x.c)}>
                <AnimatedNumber value={x.v} format={f0} />
              </div>
            </div>
          ))}
        </div>
        <Panel className="lg:col-span-7" eyebrow="Next 5 weeks" title="Schedule">
          <ScheduleStrip items={items} />
        </Panel>
        <Panel className="lg:col-span-5" eyebrow="Upcoming" title="Payment preview">
          {items.length === 0 ? (
            <Empty icon={<CalendarClock size={18} />} title="Nothing in the next 5 weeks" />
          ) : (
            <ul className="-mx-2 flex max-h-[340px] flex-col overflow-y-auto" data-lenis-prevent>
              {items.slice(0, 14).map((u) => {
                const c = catMap.get(u.recurring.categoryId);
                return (
                  <li key={u.recurring.id + u.date} className="flex items-center gap-3 rounded-[10px] px-2 py-2 hover:bg-surface-2">
                    <CategoryGlyph icon={c?.icon} color={c?.color} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{u.recurring.title}</span>
                      <span className="block text-xs text-fg-3">{relativeDay(u.date)}</span>
                    </span>
                    <span className={cn('text-sm font-medium num', u.recurring.type === 'income' && 'text-pos')}>
                      {u.recurring.type === 'income' ? '+' : '−'}{fmt(u.recurring.amount)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        eyebrow="Schedules"
        title={`${active.length} active of ${recs.length}`}
        actions={<Segmented label="Filter" size="sm" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'expense', label: 'Costs' }, { value: 'income', label: 'Income' }]} />}
      >
        {list.length === 0 ? (
          <Empty icon={<Repeat size={18} />} title="No schedules" body="Create one here, or set ‘Repeat’ when adding a transaction." />
        ) : (
          <Reveal key={filter} as="ul" className="-mx-2 flex flex-col">
            <AnimatePresence initial={false}>
              {list.map((r) => {
                const c = catMap.get(r.categoryId);
                const next = r.active ? nextOccurrence(r, r.lastPosted ?? addDays(r.startDate, -1)) : null;
                return (
                  <motion.li key={r.id} layout data-reveal exit={{ opacity: 0, height: 0 }} className={cn('grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 rounded-[12px] px-2 py-3 xl:grid-cols-[auto_1.4fr_1fr_1fr_auto_auto]', !r.active && 'opacity-50')}>
                    <CategoryGlyph icon={c?.icon} color={c?.color} size={36} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{r.title}</span>
                        {!r.active && <Badge>Paused</Badge>}
                        {!r.autoPost && r.active && <Badge tone="info">Manual</Badge>}
                      </div>
                      <div className="truncate text-xs text-fg-3">{c?.name} · {acctMap.get(r.accountId)?.name}</div>
                    </div>
                    <div className="hidden text-sm text-fg-2 xl:block">
                      {freqLabel(r)}
                      <div className="text-xs text-fg-4">since {formatDate(r.startDate, dateFmt)}</div>
                    </div>
                    <div className="hidden text-sm xl:block">
                      {next ? <>Next <span className="text-fg-2">{relativeDay(next)}</span></> : <span className="text-fg-4">—</span>}
                      <div className="text-xs text-fg-4 num">≈ {f0(monthlyEquivalent(r))}/mo</div>
                    </div>
                    <span className={cn('text-right font-medium num', r.type === 'income' && 'text-pos')}>
                      {r.type === 'income' ? '+' : '−'}{fmt(r.amount)}
                    </span>
                    <Menu
                      trigger={(p) => <IconButton label={`Actions for ${r.title}`} size="sm" {...p}><MoreHorizontal size={16} /></IconButton>}
                      items={[
                        { label: 'Post next now', icon: <Send size={14} />, onSelect: () => { postNow(r.id); toast({ tone: 'success', title: 'Posted', body: r.title }); } },
                        { label: 'Skip next', icon: <FastForward size={14} />, onSelect: () => { skip(r.id); toast({ tone: 'info', title: 'Next occurrence skipped' }); } },
                        { label: r.active ? 'Pause' : 'Resume', icon: r.active ? <Pause size={14} /> : <Play size={14} />, onSelect: () => update(r.id, { active: !r.active }) },
                        { label: 'Edit', icon: <Pencil size={14} />, onSelect: () => { setEditing(r); setOpen(true); } },
                        'sep',
                        { label: 'Delete', icon: <Trash2 size={14} />, onSelect: () => setDeleting(r), danger: true },
                      ]}
                    />
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </Reveal>
        )}
      </Panel>
      <RecurringDialog open={open} onClose={() => setOpen(false)} editing={editing} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete schedule?"
        body={<>“{deleting?.title}” stops repeating. Transactions it already posted stay in your ledger.</>}
        onConfirm={() => { if (deleting) del(deleting.id); toast({ tone: 'info', title: 'Schedule deleted' }); }}
      />
    </>
  );
}

