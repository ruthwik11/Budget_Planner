import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Search, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Empty, Panel, Segmented } from '@/components/ui/Controls';
import { Button, IconButton } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Overlay';
import { Input, Select } from '@/components/ui/Field';
import { CategoryGlyph } from '@/components/ui/Icon';
import { useMoney } from '@/hooks/useMoney';
import { useDebounced } from '@/hooks/useMisc';
import { useFinance } from '@/store/finance';
import { useUI } from '@/store/ui';
import { usePrefs } from '@/store/prefs';
import { exportTransactionsCSV } from '@/features/transactions/csvIO';
import { formatDate } from '@/utils/dates';
import { cn } from '@/utils/cn';
import type { Transaction, TxType } from '@/types';
import { DemoNotice, useAllData } from './shared';

const PAGE = 30;

export default function AdminTransactions() {
  const { transactions, users, userMap, catMap, acctMap } = useAllData();
  const { fmt, base } = useMoney();
  const dateFmt = usePrefs((s) => s.dateFormat);
  const del = useFinance((s) => s.adminDeleteTransaction);
  const toast = useUI((s) => s.toast);
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 180);
  const [user, setUser] = useState('all');
  const [type, setType] = useState<'all' | TxType>('all');
  const [page, setPage] = useState(0);
  const [deleting, setDeleting] = useState<Transaction | null>(null);

  const list = useMemo(() => {
    const s = dq.trim().toLowerCase();
    return transactions
      .filter((t) => (user === 'all' || t.userId === user) && (type === 'all' || t.type === type))
      .filter((t) => !s || t.title.toLowerCase().includes(s) || (t.categoryId && catMap.get(t.categoryId)?.name.toLowerCase().includes(s)))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, user, type, dq, catMap]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const p = Math.min(page, pages - 1);
  const rows = list.slice(p * PAGE, p * PAGE + PAGE);

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="All transactions"
        description="Every transaction across profiles."
        actions={<Button variant="secondary" icon={<Download size={15} />} onClick={() => { exportTransactionsCSV(list, catMap, acctMap, base, 'system'); toast({ tone: 'success', title: 'System CSV exported', body: `${list.length} rows` }); }}>Export CSV</Button>}
      />
      <DemoNotice />
      <Panel bodyClassName="pt-4">
        <div className="mb-3 flex flex-col gap-3 lg:flex-row">
          <div className="flex-1"><Input leading={<Search size={15} />} value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search title or category" aria-label="Search" /></div>
          <Select value={user} onChange={(e) => { setUser(e.target.value); setPage(0); }} aria-label="Filter by user" className="lg:w-56">
            <option value="all">All profiles</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
          <Segmented label="Type" size="sm" value={type} onChange={(v) => { setType(v); setPage(0); }} options={[{ value: 'all', label: 'All' }, { value: 'expense', label: 'Expenses' }, { value: 'income', label: 'Income' }, { value: 'transfer', label: 'Transfers' }]} />
        </div>
        {rows.length === 0 ? <Empty title="No transactions" /> : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead><tr className="text-left">{['Owner', 'Description', 'Category', 'Date', 'Amount', ''].map((h, i) => <th key={i} className={cn('py-2.5 font-normal', i === 0 ? 'pl-5' : 'px-3', i === 4 && 'text-right')}><span className="label-mono">{h}</span></th>)}</tr></thead>
              <tbody>
                {rows.map((t) => {
                  const c = t.categoryId ? catMap.get(t.categoryId) : undefined;
                  return (
                    <tr key={t.id} className="group border-t border-line hover:bg-surface-2">
                      <td className="py-2.5 pl-5 text-fg-2">{userMap.get(t.userId)?.name ?? 'Unknown'}</td>
                      <td className="max-w-[280px] px-3"><span className="flex items-center gap-2.5"><CategoryGlyph icon={c?.icon ?? 'wallet'} color={c?.color ?? 'var(--info)'} size={26} /><span className="truncate">{t.title}</span></span></td>
                      <td className="px-3 text-fg-3">{t.type === 'transfer' ? <Badge tone="info">transfer</Badge> : c?.name}</td>
                      <td className="whitespace-nowrap px-3 text-fg-3 num">{formatDate(t.date, dateFmt)}</td>
                      <td className={cn('whitespace-nowrap px-3 text-right font-medium num', t.type === 'income' && 'text-pos')}>{t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''}{fmt(t.amount)}</td>
                      <td className="pr-5 text-right"><IconButton label={`Delete ${t.title}`} size="sm" tone="danger" className="opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => setDeleting(t)}><Trash2 size={14} /></IconButton></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 flex items-center justify-between text-xs text-fg-3">
          <span className="num">{list.length} transactions</span>
          <span className="flex items-center gap-1">
            <button aria-label="Previous page" disabled={p === 0} onClick={() => setPage(p - 1)} className="grid size-8 place-items-center rounded-[8px] border border-line disabled:opacity-30"><ChevronLeft size={15} /></button>
            <span className="px-2 num">{p + 1} / {pages}</span>
            <button aria-label="Next page" disabled={p >= pages - 1} onClick={() => setPage(p + 1)} className="grid size-8 place-items-center rounded-[8px] border border-line disabled:opacity-30"><ChevronRight size={15} /></button>
          </span>
        </div>
      </Panel>
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} title="Delete transaction?" body={<>“{deleting?.title}” will be removed from {deleting && userMap.get(deleting.userId)?.name}’s ledger. This is logged in the audit trail.</>} onConfirm={() => { if (deleting) { del(deleting.id); toast({ tone: 'info', title: 'Transaction removed' }); } }} />
    </>
  );
}
