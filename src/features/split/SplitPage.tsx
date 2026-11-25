import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { ArrowRight, Check, MoreHorizontal, Plus, Trash2, Users, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { BandHero } from '@/components/fx/BandHero';
import { useTilt } from '@/components/fx/Interactions';
import { Badge, Empty, Menu, Panel, Segmented } from '@/components/ui/Controls';
import { Button, IconButton } from '@/components/ui/Button';
import { ConfirmDialog, Dialog } from '@/components/ui/Overlay';
import { Checkbox, Field, Input, MoneyInput, Select } from '@/components/ui/Field';
import { CategoryGlyph } from '@/components/ui/Icon';
import { AnimatedNumber, burst } from '@/components/animations/Motion';
import { useMoney } from '@/hooks/useMoney';
import { useFinance } from '@/store/finance';
import { useUI } from '@/store/ui';
import { usePrefs } from '@/store/prefs';
import { groupForm, type GroupFormValues } from '@/schemas';
import { groupBalances, groupTotal, myShare, sharesOf, simplify, validateSplit } from '@/lib/split';
import { CATEGORY_PALETTE } from '@/constants/palette';
import { EASE } from '@/constants/motion';
import { parseMoney, sumMinor } from '@/utils/money';
import { formatDate, todayISO } from '@/utils/dates';
import { cn } from '@/utils/cn';
import type { IconName, SplitGroup, SplitMode } from '@/types';

const initials = (n: string) => n.split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase();
const GROUP_ICONS: IconName[] = ['users', 'home', 'mountain', 'plane', 'utensils', 'gift', 'globe', 'ticket'];

function Avatars({ g, size = 26 }: { g: SplitGroup; size?: number }) {
  return (
    <span className="flex -space-x-2">
      {g.members.slice(0, 5).map((m, i) => (
        <span key={m.id} title={m.name} className="grid place-items-center rounded-full border-2 border-surface text-[10px] font-semibold text-accent-ink" style={{ width: size, height: size, background: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length] }}>
          {initials(m.name)}
        </span>
      ))}
      {g.members.length > 5 && <span className="grid place-items-center rounded-full border-2 border-surface bg-surface-3 text-[10px]" style={{ width: size, height: size }}>+{g.members.length - 5}</span>}
    </span>
  );
}

function GroupCard({ g, active, onSelect }: { g: SplitGroup; active: boolean; onSelect: () => void }) {
  const { fmt } = useMoney();
  const tilt = useTilt<HTMLButtonElement>(5);
  const net = groupBalances(g).me ?? 0;
  return (
    <button ref={tilt} onClick={onSelect} aria-pressed={active} data-cursor="Open" className={cn('panel relative w-full shrink-0 snap-start p-5 text-left transition-[border-color] sm:w-[300px]', active && '!border-[var(--accent-line)]')}>
      {active && <motion.span layoutId="group-active" className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-accent" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
      <div className="flex items-center gap-3">
        <CategoryGlyph icon={g.icon} color={g.color} size={36} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{g.name}</div>
          <div className="text-xs text-fg-3">{g.members.length} people · {g.expenses.length} expenses</div>
        </div>
      </div>
      <div className="mt-5 flex items-end justify-between">
        <Avatars g={g} />
        <div className="text-right">
          <div className="label-mono">{net > 0 ? 'you’re owed' : net < 0 ? 'you owe' : 'settled'}</div>
          <div className={cn('display-serif text-[1.9rem]', net > 0 ? 'text-pos' : net < 0 ? 'text-neg' : 'text-fg-3')}>{fmt(Math.abs(net), { decimals: false })}</div>
        </div>
      </div>
    </button>
  );
}

function ExpenseDialog({ g, open, onClose }: { g: SplitGroup; open: boolean; onClose: () => void }) {
  const { symbol, fromDisplay, fmt } = useMoney();
  const add = useFinance((s) => s.addSplitExpense);
  const toast = useUI((s) => s.toast);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [paidBy, setPaidBy] = useState('me');
  const [mode, setMode] = useState<SplitMode>('equal');
  const [who, setWho] = useState<string[]>([]);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setTitle(''); setAmount(''); setDate(todayISO()); setPaidBy('me'); setMode('equal');
      setWho(g.members.map((m) => m.id)); setVals({}); setErr(null);
    }
  }, [open, g]);
  const total = parseMoney(amount);
  const shares = (): Record<string, number> => {
    if (mode === 'equal') return Object.fromEntries(who.map((id) => [id, 1]));
    if (mode === 'exact') return Object.fromEntries(who.map((id) => [id, fromDisplay(parseMoney(vals[id] ?? '') ?? 0)]));
    return Object.fromEntries(who.map((id) => [id, Math.round(Number(vals[id] || 0) * 100)]));
  };
  const preview = total && total > 0 ? sharesOf({ id: 'x', title, amount: fromDisplay(total), date, paidBy, mode, shares: shares() }, g.members.map((m) => m.id)) : null;
  const submit = () => {
    if (!title.trim()) return setErr('Add a description');
    if (!total || total <= 0) return setErr('Enter an amount');
    if (!who.length) return setErr('Choose at least one person');
    const s = shares();
    const amt = fromDisplay(total);
    const v = mode === 'equal' ? null : validateSplit({ amount: amt, mode, shares: s });
    if (v) return setErr(v);
    add(g.id, { title: title.trim().slice(0, 80), amount: amt, date, paidBy, mode, shares: mode === 'equal' ? Object.fromEntries(who.map((id) => [id, 1])) : s });
    toast({ tone: 'success', title: 'Expense split', body: `${title} · ${fmt(amt)}` });
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} title={`Add to ${g.name}`} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit}>Split it</Button></>}>
      <div className="flex flex-col gap-4">
        <Field label="Amount">{(p) => <MoneyInput {...p} value={amount} onChange={(e) => { setAmount(e.target.value); setErr(null); }} symbol={symbol} large placeholder="0.00" data-autofocus />}</Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Description">{(p) => <Input {...p} value={title} onChange={(e) => { setTitle(e.target.value); setErr(null); }} maxLength={80} placeholder="e.g. Dinner" />}</Field>
          <Field label="Paid by">{(p) => <Select {...p} value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>{g.members.map((m) => <option key={m.id} value={m.id}>{m.id === 'me' ? `${m.name} (you)` : m.name}</option>)}</Select>}</Field>
        </div>
        <Field label="Date">{(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        <Segmented label="Split" value={mode} onChange={(v) => { setMode(v); setErr(null); }} className="w-full" options={[{ value: 'equal', label: 'Equally' }, { value: 'exact', label: 'Exact amounts' }, { value: 'percent', label: 'Percentages' }]} />
        <ul className="flex flex-col divide-y divide-line rounded-[12px] border border-line">
          {g.members.map((m) => {
            const on = who.includes(m.id);
            return (
              <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                <Checkbox checked={on} onChange={(v) => setWho(v ? [...who, m.id] : who.filter((x) => x !== m.id))} label={`Include ${m.name}`} />
                <span className="flex-1 text-sm">{m.id === 'me' ? `${m.name} (you)` : m.name}</span>
                {on && mode !== 'equal' && (
                  <div className="w-32">
                    {mode === 'exact'
                      ? <MoneyInput symbol={symbol} value={vals[m.id] ?? ''} onChange={(e) => setVals({ ...vals, [m.id]: e.target.value })} aria-label={`${m.name}'s amount`} placeholder="0" />
                      : <Input value={vals[m.id] ?? ''} onChange={(e) => setVals({ ...vals, [m.id]: e.target.value })} inputMode="decimal" aria-label={`${m.name}'s percent`} placeholder="%" />}
                  </div>
                )}
                {on && preview && <span className="w-24 text-right text-sm text-fg-2 num">{fmt(preview[m.id] ?? 0)}</span>}
              </li>
            );
          })}
        </ul>
        <AnimatePresence>{err && <motion.p role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-sm text-neg">{err}</motion.p>}</AnimatePresence>
      </div>
    </Dialog>
  );
}

function GroupDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const add = useFinance((s) => s.addGroup);
  const me = useFinance((s) => s.users.find((u) => u.id === s.sessionUserId));
  const [icon, setIcon] = useState<IconName>('users');
  const [color, setColor] = useState<string>(CATEGORY_PALETTE[0]);
  const { register, handleSubmit, reset, formState } = useForm<GroupFormValues>({ resolver: zodResolver(groupForm) });
  useEffect(() => { if (open) { reset({ name: '', members: '' }); setIcon('users'); setColor(CATEGORY_PALETTE[0]); } }, [open, reset]);
  const submit = handleSubmit((v) => {
    const names = [...new Set(v.members.split(',').map((x) => x.trim()).filter(Boolean))].slice(0, 29);
    const g = add({ name: v.name, icon, color, members: [{ id: 'me', name: me?.name.split(' ')[0] ?? 'You' }, ...names.map((n, i) => ({ id: `m${i + 1}`, name: n.slice(0, 40) }))] });
    onCreated(g.id);
    onClose();
  });
  return (
    <Dialog open={open} onClose={onClose} size="sm" title="New group" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="grp-form">Create</Button></>}>
      <form id="grp-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="Group name" error={formState.errors.name?.message}>{(p) => <Input {...p} {...register('name')} placeholder="e.g. Flatmates" data-autofocus />}</Field>
        <Field label="Who else is in it?" hint="Names separated by commas. You’re added automatically." error={formState.errors.members?.message}>{(p) => <Input {...p} {...register('members')} placeholder="Riya, Kabir, Ananya" />}</Field>
        <div className="flex flex-wrap gap-1.5">{GROUP_ICONS.map((ic) => <button key={ic} type="button" aria-label={ic} aria-pressed={icon === ic} onClick={() => setIcon(ic)} className={cn('rounded-[9px] p-1', icon === ic ? 'bg-surface-3 ring-1 ring-line-strong' : 'opacity-60 hover:opacity-100')}><CategoryGlyph icon={ic} color={color} size={28} /></button>)}</div>
        <div className="flex gap-2">{CATEGORY_PALETTE.slice(0, 8).map((c) => <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} className={cn('size-7 rounded-full', color === c && 'ring-2 ring-fg ring-offset-2 ring-offset-surface')} style={{ background: c }} />)}</div>
      </form>
    </Dialog>
  );
}

export default function SplitPage() {
  const userId = useFinance((s) => s.sessionUserId);
  const all = useFinance((s) => s.splitGroups);
  const groups = useMemo(() => all.filter((g) => g.userId === userId), [all, userId]);
  const settle = useFinance((s) => s.settle);
  const delExpense = useFinance((s) => s.deleteSplitExpense);
  const delGroup = useFinance((s) => s.deleteGroup);
  const toast = useUI((s) => s.toast);
  const dateFmt = usePrefs((s) => s.dateFormat);
  const { fmt } = useMoney();
  const [selId, setSelId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newGroup, setNewGroup] = useState(false);
  const [deleting, setDeleting] = useState<SplitGroup | null>(null);
  const g = groups.find((x) => x.id === selId) ?? groups[0];
  const f0 = (n: number) => fmt(n, { decimals: false });

  const nets = groups.map((x) => groupBalances(x).me ?? 0);
  const owedToMe = sumMinor(nets.filter((n) => n > 0));
  const iOwe = -sumMinor(nets.filter((n) => n < 0));
  const net = owedToMe - iOwe;
  const bal = g ? groupBalances(g) : {};
  const transfers = g ? simplify(bal) : [];
  const name = (id: string) => (id === 'me' ? 'You' : g?.members.find((m) => m.id === id)?.name ?? '?');
  const maxAbs = Math.max(1, ...Object.values(bal).map(Math.abs));

  return (
    <>
      <PageHeader
        title="Split"
        description="Trips, flats, dinners. Log who paid, split it any way, and settle up in the fewest transfers."
        actions={<Button variant="primary" icon={<Plus size={15} />} onClick={() => setNewGroup(true)}>New group</Button>}
      />
      {groups.length === 0 ? (
        <Panel><Empty icon={<Users size={18} />} title="No groups yet" body="Create one for a trip or your flat, then add shared expenses." action={<Button size="sm" variant="primary" onClick={() => setNewGroup(true)}>New group</Button>} /></Panel>
      ) : (
        <>
          <BandHero
            eyebrow={net > 0 ? 'Overall, you’re owed' : net < 0 ? 'Overall, you owe' : 'Overall'}
            figure={net === 0 ? 'All square' : <AnimatedNumber value={Math.abs(net)} format={f0} />}
            caption={`Across ${groups.length} group${groups.length > 1 ? 's' : ''}. ${f0(owedToMe)} is coming back to you and ${f0(iOwe)} is yours to pay.`}
            stats={[
              { label: 'Spent together', value: f0(sumMinor(groups.map(groupTotal))) },
              { label: 'Your share', value: f0(sumMinor(groups.map(myShare))), hint: 'what you actually consumed' },
              { label: 'Owed to you', value: f0(owedToMe) },
              { label: 'You owe', value: f0(iOwe) },
            ]}
          />
          <LayoutGroup>
            <div className="-mx-4 mb-6 flex snap-x gap-4 overflow-x-auto px-4 pb-2 scrollbar-none md:mx-0 md:px-0">
              {groups.map((x) => <GroupCard key={x.id} g={x} active={x.id === g?.id} onSelect={() => setSelId(x.id)} />)}
            </div>
          </LayoutGroup>
          {g && (
            <AnimatePresence mode="wait">
              <motion.div key={g.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.45, ease: EASE.outQuint }} className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                <Panel className="xl:col-span-5" eyebrow={g.name} title="Settle up" actions={
                  <Menu trigger={(p) => <IconButton label="Group actions" size="sm" {...p}><MoreHorizontal size={16} /></IconButton>} items={[{ label: 'Delete group', icon: <Trash2 size={14} />, onSelect: () => setDeleting(g), danger: true }]} />
                }>
                  {transfers.length === 0 ? (
                    <div className="flex items-center gap-3 rounded-[12px] bg-pos-soft p-4 text-sm text-pos"><Check size={16} /> Everyone’s square.</div>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {transfers.map((t, i) => (
                        <motion.li key={`${t.from}-${t.to}`} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className="flex items-center gap-3 rounded-[12px] border border-line bg-surface-2/60 p-3">
                          <span className={cn('text-sm', t.from === 'me' && 'font-medium')}>{name(t.from)}</span>
                          <ArrowRight size={14} className="text-fg-4" />
                          <span className={cn('flex-1 text-sm', t.to === 'me' && 'font-medium')}>{name(t.to)}</span>
                          <span className="font-medium num">{fmt(t.amount)}</span>
                          <Button size="sm" variant="secondary" data-cursor="Settle" onClick={(e) => {
                            settle(g.id, { date: todayISO(), from: t.from, to: t.to, amount: t.amount });
                            burst(e.currentTarget as HTMLElement);
                            toast({ tone: 'success', title: 'Settled', body: `${name(t.from)} paid ${name(t.to)} ${fmt(t.amount)}` });
                          }}>Settle</Button>
                        </motion.li>
                      ))}
                    </ul>
                  )}
                  <h3 className="label-mono mb-3 mt-7">Balances</h3>
                  <ul className="flex flex-col gap-2.5">
                    {g.members.map((m) => {
                      const v = bal[m.id] ?? 0;
                      const w = (Math.abs(v) / maxAbs) * 50;
                      return (
                        <li key={m.id} className="grid grid-cols-[80px_1fr_90px] items-center gap-3 text-sm">
                          <span className="truncate">{m.id === 'me' ? 'You' : m.name}</span>
                          <span className="relative h-2 rounded-full bg-surface-3">
                            <span className="absolute left-1/2 top-[-3px] h-[14px] w-px bg-line-strong" />
                            <motion.span className={cn('absolute top-0 h-2 rounded-full', v >= 0 ? 'bg-pos' : 'bg-neg')} style={v >= 0 ? { left: '50%' } : { right: '50%' }} initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={{ duration: 0.9, ease: EASE.outQuint }} />
                          </span>
                          <span className={cn('text-right num', v > 0 ? 'text-pos' : v < 0 ? 'text-neg' : 'text-fg-3')}>{v > 0 ? '+' : v < 0 ? '−' : ''}{f0(Math.abs(v))}</span>
                        </li>
                      );
                    })}
                  </ul>
                </Panel>
                <Panel className="xl:col-span-7" eyebrow={`${fmt(groupTotal(g), { decimals: false })} total`} title="Expenses" actions={<Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setAdding(true)}>Add expense</Button>}>
                  {g.expenses.length === 0 && g.settlements.length === 0 ? <Empty title="Nothing logged yet" /> : (
                    <ul className="-mx-2 flex flex-col">
                      {[
                        ...g.expenses.map((e) => ({ kind: 'e' as const, date: e.date, e })),
                        ...g.settlements.map((s) => ({ kind: 's' as const, date: s.date, s })),
                      ].sort((a, b) => b.date.localeCompare(a.date)).map((row, i) =>
                        row.kind === 'e' ? (
                          <motion.li key={row.e.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }} className="group flex items-center gap-3 rounded-[10px] px-2 py-2.5 hover:bg-surface-2">
                            <span className="display-serif w-12 text-center text-lg leading-none text-fg-3">{formatDate(row.e.date, dateFmt).slice(0, 6)}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm">{row.e.title}</span>
                              <span className="block text-xs text-fg-3">{name(row.e.paidBy)} paid · {row.e.mode === 'equal' ? `split ${Object.keys(row.e.shares).length || g.members.length} ways` : row.e.mode === 'exact' ? 'exact split' : 'by percentage'}</span>
                            </span>
                            <span className="text-right">
                              <span className="block text-sm font-medium num">{fmt(row.e.amount)}</span>
                              <span className="block text-xs text-fg-3 num">you: {fmt(sharesOf(row.e, g.members.map((m) => m.id)).me ?? 0)}</span>
                            </span>
                            <IconButton label="Delete expense" size="sm" tone="danger" className="opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => delExpense(g.id, row.e.id)}><X size={13} /></IconButton>
                          </motion.li>
                        ) : (
                          <li key={row.s.id} className="flex items-center gap-3 px-2 py-2 text-xs text-fg-3">
                            <span className="w-12" /><Badge tone="pos">settled</Badge>{name(row.s.from)} paid {name(row.s.to)} <span className="num">{fmt(row.s.amount)}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  )}
                </Panel>
              </motion.div>
            </AnimatePresence>
          )}
        </>
      )}
      {g && <ExpenseDialog g={g} open={adding} onClose={() => setAdding(false)} />}
      <GroupDialog open={newGroup} onClose={() => setNewGroup(false)} onCreated={setSelId} />
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} title={`Delete “${deleting?.name}”?`} body="All its expenses and settlements are removed." onConfirm={() => { if (deleting) { delGroup(deleting.id); setSelId(null); toast({ tone: 'info', title: 'Group deleted' }); } }} />
    </>
  );
}
