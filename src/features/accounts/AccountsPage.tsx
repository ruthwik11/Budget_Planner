import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { ArrowLeftRight, Archive, MoreHorizontal, Pencil, Plus, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Empty, Menu, Panel } from '@/components/ui/Controls';
import { Button, IconButton } from '@/components/ui/Button';
import { ConfirmDialog, Dialog } from '@/components/ui/Overlay';
import { Field, Input, MoneyInput, Select } from '@/components/ui/Field';
import { AnimatedNumber, Reveal, useRecoil } from '@/components/animations/Motion';
import { GrowthArea } from '@/components/charts/Charts';
import { TransactionTable, sortTxs, type SortState } from '@/features/transactions/TransactionTable';
import { useUserData } from '@/hooks/useData';
import { useMoney } from '@/hooks/useMoney';
import { useFinance } from '@/store/finance';
import { useUI } from '@/store/ui';
import { accountForm, type AccountFormValues } from '@/schemas';
import { accountBalances, totals } from '@/lib/finance';
import { ACCOUNT_COLORS } from '@/constants/palette';
import { ACCOUNT_TYPES } from '@/constants/options';
import { minorToDecimalString, parseMoney, sumMinor } from '@/utils/money';
import { addMonths, endOfMonth, monthsBetween, rangeForPreset, startOfMonth, todayISO } from '@/utils/dates';
import { cn } from '@/utils/cn';
import type { Account } from '@/types';

function AccountDialog({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: Account | null }) {
  const { symbol, toDisplay, fromDisplay } = useMoney();
  const add = useFinance((s) => s.addAccount);
  const update = useFinance((s) => s.updateAccount);
  const toast = useUI((s) => s.toast);
  const { register, handleSubmit, reset, control, formState } = useForm<AccountFormValues>({ resolver: zodResolver(accountForm) });
  useEffect(() => {
    if (open) reset({ name: editing?.name ?? '', type: editing?.type ?? 'checking', opening: editing ? minorToDecimalString(toDisplay(editing.openingBalance)) : '', color: editing?.color ?? ACCOUNT_COLORS[1] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);
  const submit = handleSubmit((v) => {
    const payload = { name: v.name, type: v.type, openingBalance: v.opening ? fromDisplay(parseMoney(v.opening)!) : 0, color: v.color };
    if (editing) update(editing.id, payload);
    else add(payload);
    toast({ tone: 'success', title: editing ? 'Account updated' : 'Account added', body: v.name });
    onClose();
  });
  return (
    <Dialog open={open} onClose={onClose} size="sm" title={editing ? 'Edit account' : 'New account'} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="acct-form">Save</Button></>}>
      <form id="acct-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="Name" error={formState.errors.name?.message}>{(p) => <Input {...p} {...register('name')} placeholder="e.g. Savings" data-autofocus />}</Field>
        <Field label="Type">{(p) => <Select {...p} {...register('type')}>{ACCOUNT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</Select>}</Field>
        <Field label="Opening balance" optional hint="Negative for debt, e.g. -1200" error={formState.errors.opening?.message}>{(p) => <MoneyInput {...p} {...register('opening')} symbol={symbol} placeholder="0.00" />}</Field>
        <Controller control={control} name="color" render={({ field }) => (
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-fg-2">Colour</legend>
            <div className="flex gap-2">
              {ACCOUNT_COLORS.map((c) => <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={field.value === c} onClick={() => field.onChange(c)} className={cn('size-7 rounded-full transition-transform', field.value === c ? 'scale-110 ring-2 ring-fg ring-offset-2 ring-offset-surface' : 'hover:scale-110')} style={{ background: c }} />)}
            </div>
          </fieldset>
        )} />
      </form>
    </Dialog>
  );
}

function AccountCard({ a, balance, flow, active, onSelect, onEdit, onArchive }: { a: Account; balance: number; flow: number; active: boolean; onSelect: () => void; onEdit: () => void; onArchive: () => void }) {
  const { fmt } = useMoney();
  const ref = useRecoil<HTMLDivElement>(5);
  return (
    <div data-reveal ref={ref}>
      <div
        role="button"
        tabIndex={0}
        aria-pressed={active}
        onClick={onSelect}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect()}
        className={cn('panel relative flex cursor-pointer flex-col gap-6 overflow-hidden p-5 text-left transition-[border-color,transform] duration-300', active ? '!border-line-strong' : 'hover:!border-line-strong')}
      >
        {active && <motion.span layoutId="acct-active" className="absolute inset-x-0 top-0 h-[3px]" style={{ background: a.color }} transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-[3px]" style={{ background: a.color }} />
              <span className="font-medium">{a.name}</span>
            </div>
            <span className="label-mono mt-1 block">{ACCOUNT_TYPES.find((t) => t.id === a.type)?.label}</span>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <Menu trigger={(p) => <IconButton label={`Actions for ${a.name}`} size="sm" {...p}><MoreHorizontal size={16} /></IconButton>} items={[{ label: 'Edit', icon: <Pencil size={14} />, onSelect: onEdit }, 'sep', { label: 'Archive / delete', icon: <Archive size={14} />, onSelect: onArchive, danger: true }]} />
          </div>
        </div>
        <div>
          <div className={cn('text-[1.75rem] font-medium tracking-[-0.035em]', balance < 0 && 'text-neg')}>
            <AnimatedNumber value={balance} format={(n) => fmt(n, { decimals: false })} />
          </div>
          <div className="mt-1 text-xs text-fg-3">
            This month <span className={cn('num', flow >= 0 ? 'text-pos' : 'text-neg')}>{fmt(flow, { decimals: false, sign: 'always' })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AccountsPage() {
  const { accts, txs } = useUserData();
  const { fmt } = useMoney();
  const openTx = useUI((s) => s.openTxEditor);
  const toast = useUI((s) => s.toast);
  const remove = useFinance((s) => s.deleteAccount);
  const updateAcct = useFinance((s) => s.updateAccount);
  const [sel, setSel] = useState<string | null>(null);
  const [editing, setEditing] = useState<Account | null>(null);
  const [open, setOpen] = useState(false);
  const [archiving, setArchiving] = useState<Account | null>(null);
  const [sort, setSort] = useState<SortState>({ key: 'date', dir: 'desc' });
  const today = todayISO();
  const live = accts.filter((a) => !a.archived);
  const archived = accts.filter((a) => a.archived);
  const selected = live.find((a) => a.id === sel) ?? live[0];
  const balances = useMemo(() => accountBalances(accts, txs, today), [accts, txs, today]);
  const month = rangeForPreset('this-month', today);
  const flowOf = (id: string) =>
    sumMinor(
      txs.filter((t) => t.date >= month.from && t.date <= today).map((t) =>
        t.type === 'income' && t.accountId === id ? t.amount : t.type === 'expense' && t.accountId === id ? -t.amount : t.type === 'transfer' ? (t.toAccountId === id ? t.amount : t.accountId === id ? -t.amount : 0) : 0,
      ),
    );
  const history = useMemo(() => {
    if (!selected) return [];
    const months = monthsBetween(addMonths(startOfMonth(today), -11, 1), today);
    return months.map((m) => {
      const end = endOfMonth(m + '-01');
      return { month: m, balance: accountBalances([selected], txs, end > today ? today : end).get(selected.id) ?? 0 };
    });
  }, [selected, txs, today]);
  const acctTxs = useMemo(() => (selected ? sortTxs(txs.filter((t) => t.accountId === selected.id || t.toAccountId === selected.id), sort) : []), [txs, selected, sort]);
  const net = sumMinor(live.map((a) => balances.get(a.id) ?? 0));
  const tot = selected ? totals(acctTxs, month) : null;

  return (
    <>
      <PageHeader
        eyebrow="Ledger"
        title="Accounts"
        description="Bank accounts, cards, cash and investments. Transfers move money between them without counting as income or spending."
        actions={
          <>
            <Button variant="secondary" icon={<ArrowLeftRight size={15} />} onClick={() => openTx({ draft: { type: 'transfer' } })}>Transfer</Button>
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => { setEditing(null); setOpen(true); }}>Add account</Button>
          </>
        }
      />
      <div className="mb-5 flex items-baseline gap-3">
        <span className="label-mono">Net position</span>
        <span className="text-xl font-medium tracking-tight"><AnimatedNumber value={net} format={(n) => fmt(n, { decimals: false })} /></span>
      </div>
      <Reveal className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {live.map((a) => (
          <AccountCard key={a.id} a={a} balance={balances.get(a.id) ?? 0} flow={flowOf(a.id)} active={selected?.id === a.id} onSelect={() => setSel(a.id)} onEdit={() => { setEditing(a); setOpen(true); }} onArchive={() => setArchiving(a)} />
        ))}
      </Reveal>
      {selected ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <Panel className="lg:col-span-12" eyebrow={selected.name} title="Balance, last 12 months" actions={tot && <span className="text-xs text-fg-3">This month: in <span className="text-pos num">{fmt(tot.income, { decimals: false })}</span> · out <span className="num">{fmt(tot.expense, { decimals: false })}</span></span>}>
            <GrowthArea key={selected.id} data={history} dataKey="balance" name="Balance" color={selected.color} height={230} />
          </Panel>
          <Panel className="lg:col-span-12" eyebrow="Activity" title={`${acctTxs.length} transactions`}>
            <TransactionTable txs={acctTxs} sort={sort} onSort={setSort} selectable={false} resetKey={selected.id} />
          </Panel>
        </div>
      ) : (
        <Panel><Empty icon={<Wallet size={18} />} title="No accounts" action={<Button size="sm" variant="primary" onClick={() => setOpen(true)}>Add account</Button>} /></Panel>
      )}
      {archived.length > 0 && (
        <div className="mt-6">
          <div className="label-mono mb-2">Archived</div>
          <div className="flex flex-wrap gap-2">
            {archived.map((a) => (
              <button key={a.id} onClick={() => { updateAcct(a.id, { archived: false }); toast({ tone: 'success', title: `${a.name} restored` }); }} className="rounded-[9px] border border-line px-3 py-1.5 text-sm text-fg-3 hover:border-line-strong hover:text-fg">
                {a.name} <Badge className="ml-1">restore</Badge>
              </button>
            ))}
          </div>
        </div>
      )}
      <AccountDialog open={open} onClose={() => setOpen(false)} editing={editing} />
      <ConfirmDialog
        open={!!archiving}
        onClose={() => setArchiving(null)}
        title={`Remove ${archiving?.name}?`}
        confirmLabel="Remove"
        body="Accounts with transactions are archived (hidden, history kept). Empty accounts are deleted."
        onConfirm={() => {
          if (!archiving) return;
          const r = remove(archiving.id);
          toast({ tone: 'info', title: r === 'archived' ? 'Account archived' : 'Account deleted' });
        }}
      />
    </>
  );
}
