import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, Landmark, MoreHorizontal, Pencil, Plus, ReceiptText, Trash2, X } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import { PageHeader } from '@/components/layout/PageHeader';
import { BandHero } from '@/components/fx/BandHero';
import { useTilt } from '@/components/fx/Interactions';
import { Badge, Empty, Menu, Panel, Progress, Segmented } from '@/components/ui/Controls';
import { Button, IconButton } from '@/components/ui/Button';
import { ConfirmDialog, Dialog, Drawer } from '@/components/ui/Overlay';
import { Field, Input, MoneyInput, Select } from '@/components/ui/Field';
import { AnimatedNumber, Reveal } from '@/components/animations/Motion';
import { ChartTooltip } from '@/components/charts/Charts';
import { useUserData } from '@/hooks/useData';
import { useMoney } from '@/hooks/useMoney';
import { useReducedMotion } from '@/hooks/useMotionPrefs';
import { useFinance } from '@/store/finance';
import { useUI } from '@/store/ui';
import { usePrefs } from '@/store/prefs';
import { debtForm, type DebtFormValues } from '@/schemas';
import { amortize, debtBalance, dti, planPayoff, splitPayment, type Strategy } from '@/lib/debts';
import { totals } from '@/lib/finance';
import { ACCOUNT_COLORS } from '@/constants/palette';
import { minorToDecimalString, parseMoney, percent, sumMinor } from '@/utils/money';
import { addMonths, formatDate, fromISO, monthLabel, monthKey, startOfMonth, todayISO, addDays } from '@/utils/dates';
import { cn } from '@/utils/cn';
import type { Debt, DebtKind } from '@/types';

const KINDS: { id: DebtKind; label: string }[] = [
  { id: 'home', label: 'Home loan' },
  { id: 'vehicle', label: 'Vehicle loan' },
  { id: 'education', label: 'Education loan' },
  { id: 'personal', label: 'Personal loan / EMI' },
  { id: 'credit-card', label: 'Credit card' },
  { id: 'other', label: 'Other' },
];

const nextDue = (d: Debt, today = todayISO()) => {
  const day = fromISO(today).getDate();
  const thisMonth = addDays(startOfMonth(today), d.dueDay - 1);
  return day <= d.dueDay ? thisMonth : addMonths(thisMonth, 1, d.dueDay);
};
const pctStr = (bps: number) => `${(bps / 100).toFixed(bps % 100 ? 2 : 0)}%`;

// ───────────────────────── dialogs ─────────────────────────

function DebtDialog({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: Debt | null }) {
  const { symbol, toDisplay, fromDisplay, fmt } = useMoney();
  const add = useFinance((s) => s.addDebt);
  const update = useFinance((s) => s.updateDebt);
  const toast = useUI((s) => s.toast);
  const { register, handleSubmit, reset, control, watch, formState } = useForm<DebtFormValues>({ resolver: zodResolver(debtForm) });
  useEffect(() => {
    if (!open) return;
    reset({
      name: editing?.name ?? '', lender: editing?.lender ?? '', kind: editing?.kind ?? 'personal',
      balance: editing ? minorToDecimalString(toDisplay(debtBalance(editing))) : '',
      original: editing ? minorToDecimalString(toDisplay(editing.original)) : '',
      apr: editing ? (editing.aprBps / 100).toString() : '', payment: editing ? minorToDecimalString(toDisplay(editing.payment)) : '',
      dueDay: editing?.dueDay ?? 5, color: editing?.color ?? ACCOUNT_COLORS[0],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);
  const w = watch();
  const preview = useMemo(() => {
    const bal = parseMoney(w.balance ?? '');
    const pay = parseMoney(w.payment ?? '');
    const apr = Number(w.apr);
    if (!bal || !pay || !Number.isFinite(apr)) return null;
    return amortize(fromDisplay(bal), Math.round(apr * 100), fromDisplay(pay));
  }, [w.balance, w.payment, w.apr, fromDisplay]);
  const e = formState.errors;
  const submit = handleSubmit((v) => {
    const balance = fromDisplay(parseMoney(v.balance)!);
    const original = v.original ? fromDisplay(parseMoney(v.original)!) : balance;
    const base = {
      name: v.name, lender: v.lender, kind: v.kind, aprBps: Math.round(Number(v.apr) * 100), payment: fromDisplay(parseMoney(v.payment)!),
      dueDay: Number(v.dueDay), color: v.color, original: Math.max(original, balance),
    };
    if (editing) {
      // re-base the opening balance so the outstanding amount equals what the user typed
      const paid = sumMinor(editing.payments.map((p) => p.principal));
      update(editing.id, { ...base, opening: balance + paid });
      toast({ tone: 'success', title: 'Debt updated' });
    } else {
      add({ ...base, opening: balance, startDate: todayISO() });
      toast({ tone: 'success', title: 'Debt added', body: v.name });
    }
    onClose();
  });
  return (
    <Dialog open={open} onClose={onClose} title={editing ? 'Edit debt' : 'Add a debt'} description="Loans, EMIs and revolving card balances." footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="debt-form">Save</Button></>}>
      <form id="debt-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name" error={e.name?.message}>{(p) => <Input {...p} {...register('name')} placeholder="e.g. Car loan" data-autofocus />}</Field>
          <Field label="Lender" optional>{(p) => <Input {...p} {...register('lender')} placeholder="e.g. HDFC Bank" />}</Field>
          <Field label="Type">{(p) => <Select {...p} {...register('kind')}>{KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</Select>}</Field>
          <Field label="Interest rate (APR %)" error={e.apr?.message}>{(p) => <Input {...p} {...register('apr')} inputMode="decimal" placeholder="9.25" />}</Field>
          <Field label="Outstanding balance" error={e.balance?.message}>{(p) => <MoneyInput {...p} {...register('balance')} symbol={symbol} placeholder="0.00" />}</Field>
          <Field label="Originally borrowed" optional error={e.original?.message}>{(p) => <MoneyInput {...p} {...register('original')} symbol={symbol} placeholder="same as balance" />}</Field>
          <Field label="Monthly EMI / minimum" error={e.payment?.message}>{(p) => <MoneyInput {...p} {...register('payment')} symbol={symbol} placeholder="0.00" />}</Field>
          <Field label="Due day of month" error={e.dueDay?.message}>{(p) => <Input {...p} type="number" min={1} max={28} {...register('dueDay')} />}</Field>
        </div>
        <Controller control={control} name="color" render={({ field }) => (
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-fg-2">Colour</legend>
            <div className="flex gap-2">{ACCOUNT_COLORS.map((c) => <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={field.value === c} onClick={() => field.onChange(c)} className={cn('size-7 rounded-full transition-transform', field.value === c ? 'scale-110 ring-2 ring-fg ring-offset-2 ring-offset-surface' : 'hover:scale-110')} style={{ background: c }} />)}</div>
          </fieldset>
        )} />
        <AnimatePresence>
          {preview && (
            <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className={cn('rounded-[10px] px-3 py-2.5 text-sm', preview.months === null ? 'bg-neg-soft text-neg' : 'bg-accent-soft text-fg-2')}>
              {preview.months === null
                ? 'This payment doesn’t cover the monthly interest, so the balance would never go down.'
                : <>Paid off in <b className="num">{preview.months}</b> months ({monthLabel(monthKey(preview.payoffDate!), 'long', true)}), paying <b className="num">{fmt(preview.totalInterest, { decimals: false })}</b> in interest.</>}
            </motion.p>
          )}
        </AnimatePresence>
      </form>
    </Dialog>
  );
}

function PayDialog({ debt, onClose }: { debt: Debt | null; onClose: () => void }) {
  const { symbol, fromDisplay, toDisplay, fmt } = useMoney();
  const { accts } = useUserData();
  const pay = useFinance((s) => s.payDebt);
  const toast = useUI((s) => s.toast);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [acct, setAcct] = useState('');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (debt) {
      setAmount(minorToDecimalString(toDisplay(Math.min(debt.payment, debtBalance(debt) + splitPayment(debt, debt.payment).interest))));
      setDate(todayISO());
      setAcct(accts.find((a) => a.type === 'checking' && !a.archived)?.id ?? '');
      setErr(null);
    }
  }, [debt, accts, toDisplay]);
  const amt = parseMoney(amount);
  const parts = debt && amt && amt > 0 ? splitPayment(debt, fromDisplay(amt)) : null;
  const submit = () => {
    if (!debt) return;
    if (!amt || amt <= 0) return setErr('Enter an amount');
    const r = pay(debt.id, { amount: fromDisplay(amt), date, accountId: acct || undefined });
    toast({ tone: 'success', title: 'Payment recorded', body: `${fmt(r.principal, { decimals: false })} off the balance, ${fmt(r.interest, { decimals: false })} interest.` });
    onClose();
  };
  return (
    <Dialog open={!!debt} onClose={onClose} size="sm" title={`Pay · ${debt?.name ?? ''}`} description="We split it into interest and principal for you." footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit}>Record payment</Button></>}>
      <div className="flex flex-col gap-4">
        <Field label="Amount" error={err ?? undefined}>{(p) => <MoneyInput {...p} value={amount} onChange={(e) => { setAmount(e.target.value); setErr(null); }} symbol={symbol} large data-autofocus />}</Field>
        {parts && (
          <div className="flex h-2 overflow-hidden rounded-full bg-surface-3" aria-label="Interest versus principal" role="img">
            <motion.span className="h-full bg-warn" animate={{ width: `${percent(parts.interest, parts.interest + parts.principal)}%` }} />
            <motion.span className="h-full bg-accent" animate={{ width: `${percent(parts.principal, parts.interest + parts.principal)}%` }} />
          </div>
        )}
        {parts && <p className="-mt-2 text-xs text-fg-3 num"><span className="text-warn">■</span> interest {fmt(parts.interest)} · <span className="text-accent-fg">■</span> principal {fmt(parts.principal)}</p>}
        <Field label="Date">{(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        <Field label="Paid from" hint="Also adds the payment to your ledger as a “Debt payments” expense.">
          {(p) => (
            <Select {...p} value={acct} onChange={(e) => setAcct(e.target.value)}>
              <option value="">Don’t add to ledger</option>
              {accts.filter((a) => !a.archived).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          )}
        </Field>
      </div>
    </Dialog>
  );
}

function ScheduleDrawer({ debt, onClose }: { debt: Debt | null; onClose: () => void }) {
  const { fmt } = useMoney();
  const dateFmt = usePrefs((s) => s.dateFormat);
  const remove = useFinance((s) => s.removeDebtPayment);
  const sched = debt ? amortize(debtBalance(debt), debt.aprBps, debt.payment, nextDue(debt)) : null;
  return (
    <Drawer open={!!debt} onClose={onClose} title={debt?.name ?? ''} description={debt ? `${debt.lender || 'Lender'} · ${pctStr(debt.aprBps)} APR` : undefined}>
      {debt && sched && (
        <div className="flex flex-col gap-6">
          <section>
            <h3 className="label-mono mb-2">Next 12 payments</h3>
            {sched.months === null ? (
              <p className="text-sm text-neg">The EMI doesn’t cover interest; raise it to start reducing the balance.</p>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-fg-4"><th className="py-1 font-normal">Month</th><th className="py-1 text-right font-normal">Interest</th><th className="py-1 text-right font-normal">Principal</th><th className="py-1 text-right font-normal">Left</th></tr></thead>
                <tbody>
                  {sched.rows.slice(0, 12).map((r) => (
                    <tr key={r.month} className="border-t border-line">
                      <td className="py-1.5">{monthLabel(monthKey(r.date), 'short', true)}</td>
                      <td className="py-1.5 text-right text-warn num">{fmt(r.interest, { decimals: false })}</td>
                      <td className="py-1.5 text-right num">{fmt(r.principal, { decimals: false })}</td>
                      <td className="py-1.5 text-right text-fg-3 num">{fmt(r.balance, { decimals: false })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <section>
            <h3 className="label-mono mb-2">Payment history</h3>
            {debt.payments.length === 0 ? <p className="text-sm text-fg-3">No payments recorded yet.</p> : (
              <ul className="divide-y divide-line">
                {[...debt.payments].reverse().map((p) => (
                  <li key={p.id} className="group flex items-center gap-3 py-2.5 text-sm">
                    <span className="flex-1">{formatDate(p.date, dateFmt)}</span>
                    <span className="text-xs text-fg-4 num">{fmt(p.interest, { decimals: false })} int.</span>
                    <span className="font-medium num">{fmt(p.amount, { decimals: false })}</span>
                    <IconButton label="Remove payment" size="sm" tone="danger" className="opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => remove(debt.id, p.id)}><X size={13} /></IconButton>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Drawer>
  );
}

// ───────────────────────── card ─────────────────────────

function DebtCard({ d, onPay, onEdit, onDelete, onSchedule, clearedIn }: { d: Debt; onPay: () => void; onEdit: () => void; onDelete: () => void; onSchedule: () => void; clearedIn?: number }) {
  const { fmt } = useMoney();
  const dateFmt = usePrefs((s) => s.dateFormat);
  const tilt = useTilt<HTMLDivElement>(4);
  const bal = debtBalance(d);
  const paidPct = d.original ? percent(d.original - bal, d.original) : 0;
  const sched = amortize(bal, d.aprBps, d.payment);
  const due = nextDue(d);
  return (
    <div data-reveal ref={tilt}>
      <article className="panel flex h-full flex-col p-5" data-cursor="Debt">
        <header className="flex items-start gap-3">
          <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-medium">{d.name}</h3>
            <p className="truncate text-xs text-fg-3">{d.lender || KINDS.find((k) => k.id === d.kind)?.label} · {pctStr(d.aprBps)} APR</p>
          </div>
          {bal === 0 ? <Badge tone="pos">Cleared</Badge> : d.kind === 'credit-card' && d.aprBps >= 2400 ? <Badge tone="neg">High interest</Badge> : null}
          <Menu trigger={(p) => <IconButton label={`Actions for ${d.name}`} size="sm" {...p}><MoreHorizontal size={16} /></IconButton>} items={[
            { label: 'Schedule & history', icon: <ReceiptText size={14} />, onSelect: onSchedule },
            { label: 'Edit', icon: <Pencil size={14} />, onSelect: onEdit },
            'sep',
            { label: 'Delete', icon: <Trash2 size={14} />, onSelect: onDelete, danger: true },
          ]} />
        </header>
        <div className="mt-6">
          <div className="label-mono">Outstanding</div>
          <div className="display-serif mt-1 text-[2.6rem] text-fg"><AnimatedNumber value={bal} format={(n) => fmt(n, { decimals: false })} /></div>
          <Progress value={paidPct} color={d.color} label={`${paidPct}% repaid`} className="mt-3" height={6} />
          <div className="mt-1.5 flex justify-between text-xs text-fg-3 num"><span>{paidPct}% repaid</span><span>of {fmt(d.original, { decimals: false })}</span></div>
        </div>
        <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4 text-xs">
          <div><dt className="text-fg-3">EMI</dt><dd className="mt-0.5 font-medium num">{fmt(d.payment, { decimals: false })}</dd></div>
          <div><dt className="text-fg-3">Next due</dt><dd className="mt-0.5 font-medium">{formatDate(due, dateFmt).replace(/ \d{4}$/, '')}</dd></div>
          <div><dt className="text-fg-3">Paid off</dt><dd className={cn('mt-0.5 font-medium', sched.months === null && 'text-neg')}>{bal === 0 ? 'Done' : sched.months === null ? 'Never' : monthLabel(monthKey(sched.payoffDate!), 'short', true)}</dd></div>
        </dl>
        {clearedIn !== undefined && bal > 0 && <p className="mt-3 text-xs text-accent-fg">With your plan: cleared in {clearedIn} months</p>}
        <Button variant="primary" className="mt-5" icon={<Plus size={15} />} onClick={onPay} disabled={bal === 0} data-cursor="Pay">Record payment</Button>
      </article>
    </div>
  );
}

// ───────────────────────── page ─────────────────────────

export default function DebtsPage() {
  const { txs } = useUserData();
  const userId = useFinance((s) => s.sessionUserId);
  const allDebts = useFinance((s) => s.debts);
  const debts = useMemo(() => allDebts.filter((d) => d.userId === userId), [allDebts, userId]);
  const del = useFinance((s) => s.deleteDebt);
  const toast = useUI((s) => s.toast);
  const { fmt, compact, symbol, toDisplay, fromDisplay } = useMoney();
  const reduced = useReducedMotion();
  const [strategy, setStrategy] = useState<Exclude<Strategy, 'minimum'>>('avalanche');
  const [extra, setExtra] = useState(5000_00);
  const [editing, setEditing] = useState<Debt | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [paying, setPaying] = useState<Debt | null>(null);
  const [schedule, setSchedule] = useState<Debt | null>(null);
  const [deleting, setDeleting] = useState<Debt | null>(null);
  const today = todayISO();
  const f0 = (n: number) => fmt(n, { decimals: false });

  const live = debts.filter((d) => debtBalance(d) > 0);
  const owed = sumMinor(live.map(debtBalance));
  const emis = sumMinor(live.map((d) => d.payment));
  const plan = useMemo(() => planPayoff(debts, extra, strategy, today), [debts, extra, strategy, today]);
  const base = useMemo(() => planPayoff(debts, 0, 'minimum', today), [debts, today]);
  const other = useMemo(() => planPayoff(debts, extra, strategy === 'avalanche' ? 'snowball' : 'avalanche', today), [debts, extra, strategy, today]);
  const income3 = totals(txs, { from: addMonths(startOfMonth(today), -3, 1), to: addDays(startOfMonth(today), -1) }).income;
  const ratio = dti(emis, Math.round(income3 / 3));
  const chart = useMemo(() => {
    const n = Math.max(plan.timeline.length, base.timeline.length);
    return Array.from({ length: Math.min(n, 121) }, (_, i) => ({
      month: monthKey(addMonths(startOfMonth(today), i, 1)),
      plan: plan.timeline[i] ?? 0,
      minimum: base.timeline[i] ?? 0,
    }));
  }, [plan, base, today]);
  const interestSaved = base.totalInterest - plan.totalInterest;
  const monthsSaved = base.months !== null && plan.months !== null ? base.months - plan.months : null;
  const maxExtra = Math.max(50000_00, Math.ceil(emis / 100000) * 100000);

  return (
    <>
      <PageHeader
        title="Debts & EMIs"
        description="Every loan and card balance in one place, with a payoff plan that shows exactly when you’ll be debt-free."
        actions={<Button variant="primary" icon={<Plus size={15} />} onClick={() => { setEditing(null); setFormOpen(true); }}>Add debt</Button>}
      />
      {debts.length === 0 ? (
        <Panel><Empty icon={<Landmark size={18} />} title="No debts tracked" body="Add a loan, EMI or credit-card balance to see your payoff plan." action={<Button size="sm" variant="primary" onClick={() => setFormOpen(true)}>Add debt</Button>} /></Panel>
      ) : (
        <>
          <BandHero
            eyebrow={owed === 0 ? 'All clear' : 'Debt-free by'}
            figure={owed === 0 ? 'Debt-free.' : plan.debtFreeDate ? monthLabel(monthKey(plan.debtFreeDate), 'long', true) : 'Not yet'}
            caption={owed === 0 ? 'Every balance is paid off.' : plan.months !== null
              ? <>That’s {plan.months} months with {f0(extra)} extra each month on the {strategy} plan, saving {f0(interestSaved)} in interest{monthsSaved ? ` and ${monthsSaved} months` : ''} versus paying minimums.</>
              : 'At current payments some balances never shrink. Raise an EMI or add extra.'}
            stats={[
              { label: 'Total owed', value: <AnimatedNumber value={owed} format={f0} /> },
              { label: 'Monthly EMIs', value: <AnimatedNumber value={emis} format={f0} /> },
              { label: 'Interest left', value: <AnimatedNumber value={plan.totalInterest} format={f0} />, hint: 'on this plan' },
              { label: 'Debt-to-income', value: `${ratio}%`, hint: ratio > 40 ? 'above the 40% comfort line' : 'within the 40% comfort line' },
            ]}
          />

          <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Panel className="xl:col-span-5" eyebrow="Strategy" title="Build your payoff plan">
              <div className="flex flex-col gap-5">
                <Segmented label="Strategy" value={strategy} onChange={setStrategy} className="w-full" options={[{ value: 'avalanche', label: 'Avalanche' }, { value: 'snowball', label: 'Snowball' }]} />
                <p className="-mt-2 text-xs text-fg-3">
                  {strategy === 'avalanche' ? 'Highest interest rate first. Mathematically the cheapest.' : 'Smallest balance first. Quick wins that keep you motivated.'}
                </p>
                <div>
                  <div className="mb-2 flex items-baseline justify-between">
                    <label htmlFor="extra" className="text-sm">Extra each month</label>
                    <span className="display-serif text-[1.8rem] text-fg num">{fmt(extra, { decimals: false })}</span>
                  </div>
                  <input
                    id="extra"
                    type="range"
                    min={0}
                    max={toDisplay(maxExtra)}
                    step={50000}
                    value={toDisplay(extra)}
                    onChange={(e) => setExtra(fromDisplay(Number(e.target.value)))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-[var(--accent)]"
                    aria-valuetext={`${symbol}${(toDisplay(extra) / 100).toFixed(0)} per month`}
                  />
                </div>
                <dl className="grid grid-cols-2 gap-3">
                  <div className="rounded-[12px] bg-surface-2 p-3"><dt className="label-mono">Interest saved</dt><dd className="mt-1 text-lg font-medium text-pos num"><AnimatedNumber value={Math.max(0, interestSaved)} format={f0} duration={0.8} /></dd></div>
                  <div className="rounded-[12px] bg-surface-2 p-3"><dt className="label-mono">Time saved</dt><dd className="mt-1 text-lg font-medium num">{monthsSaved === null ? '—' : `${monthsSaved} mo`}</dd></div>
                </dl>
                <p className="text-xs text-fg-3">
                  {strategy === 'avalanche' ? 'Snowball' : 'Avalanche'} with the same extra would cost <span className="num text-fg-2">{f0(other.totalInterest)}</span> in interest
                  {other.months !== null && plan.months !== null ? ` and finish ${other.months === plan.months ? 'the same month' : `${Math.abs(other.months - plan.months)} months ${other.months > plan.months ? 'later' : 'sooner'}`}` : ''}.
                </p>
                <ol className="flex flex-col gap-1.5">
                  {plan.order.map((id, i) => {
                    const d = debts.find((x) => x.id === id)!;
                    return (
                      <li key={id} className="flex items-center gap-3 text-sm">
                        <span className="display-serif w-6 text-xl text-fg-3">{i + 1}</span>
                        <span className="size-2 rounded-full" style={{ background: d.color }} />
                        <span className="flex-1 truncate">{d.name}</span>
                        <span className="text-xs text-fg-3 num">{plan.clearedAt[id] !== undefined ? `month ${plan.clearedAt[id]}` : '—'}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </Panel>
            <Panel className="xl:col-span-7" eyebrow="Trajectory" title="Total owed over time" actions={<span className="flex gap-3 text-xs text-fg-3"><span className="flex items-center gap-1.5"><span className="h-[3px] w-3 rounded bg-accent" />Your plan</span><span className="flex items-center gap-1.5"><span className="h-[3px] w-3 rounded bg-fg-4" />Minimums</span></span>}>
              <ResponsiveContainer width="100%" height={330}>
                <LineChart data={chart} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tickMargin={10} tickFormatter={(m: string) => monthLabel(m, 'short', true)} minTickGap={24} />
                  <YAxis axisLine={false} tickLine={false} width={58} tickFormatter={(v: number) => compact(v)} />
                  <Tooltip animationDuration={200} content={(p) => <ChartTooltip {...(p as TooltipProps<number, string>)} valueFormat={(v) => f0(v)} labelFormat={(m) => monthLabel(m, 'long', true)} />} />
                  <Line type="monotone" dataKey="minimum" name="Minimums only" stroke="var(--fg-4)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={!reduced} animationDuration={1200} />
                  <Line type="monotone" dataKey="plan" name="Your plan" stroke="var(--accent)" strokeWidth={2.5} dot={false} isAnimationActive={!reduced} animationDuration={1500} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </Panel>
          </div>

          <Reveal className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {debts.map((d) => (
              <DebtCard key={d.id} d={d} clearedIn={plan.clearedAt[d.id]} onPay={() => setPaying(d)} onEdit={() => { setEditing(d); setFormOpen(true); }} onDelete={() => setDeleting(d)} onSchedule={() => setSchedule(d)} />
            ))}
          </Reveal>
          <p className="mt-6 flex items-center gap-2 text-xs text-fg-4"><CalendarClock size={13} /> Interest is estimated monthly on the reducing balance. Your lender’s statement is the source of truth.</p>
        </>
      )}
      <DebtDialog open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
      <PayDialog debt={paying} onClose={() => setPaying(null)} />
      <ScheduleDrawer debt={schedule ? debts.find((d) => d.id === schedule.id) ?? null : null} onClose={() => setSchedule(null)} />
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} title={`Delete ${deleting?.name}?`} body="Its payment history goes too. Ledger transactions you already logged stay." onConfirm={() => { if (deleting) { del(deleting.id); toast({ tone: 'info', title: 'Debt deleted' }); } }} />
    </>
  );
}
