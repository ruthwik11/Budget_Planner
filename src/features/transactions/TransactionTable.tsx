import { Fragment, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Repeat, Trash2, X } from 'lucide-react';
import type { Transaction } from '@/types';
import { Checkbox } from '@/components/ui/Field';
import { Badge, Empty } from '@/components/ui/Controls';
import { CategoryGlyph } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Overlay';
import { useUserData } from '@/hooks/useData';
import { useMoney } from '@/hooks/useMoney';
import { useMediaQuery } from '@/hooks/useMisc';
import { useUI } from '@/store/ui';
import { useFinance } from '@/store/finance';
import { usePrefs } from '@/store/prefs';
import { formatDate, relativeDay } from '@/utils/dates';
import { cn } from '@/utils/cn';
import { EASE } from '@/constants/motion';

export type SortKey = 'date' | 'amount' | 'title';
export interface SortState {
  key: SortKey;
  dir: 'asc' | 'desc';
}

export function sortTxs(txs: Transaction[], s: SortState) {
  const m = s.dir === 'asc' ? 1 : -1;
  return [...txs].sort((a, b) => {
    if (s.key === 'amount') return (a.amount - b.amount) * m;
    if (s.key === 'title') return a.title.localeCompare(b.title) * m;
    return (a.date === b.date ? a.createdAt - b.createdAt : a.date.localeCompare(b.date)) * m;
  });
}

const PAGE = 25;

/**
 * Ledger table. Desktop: grouped by day with sticky-feel day headers when sorted by date.
 * Mobile: compact cards. Rows animate in with a short stagger whenever the result set changes.
 */
export function TransactionTable({
  txs, sort, onSort, selectable = true, emptyTitle = 'No transactions match', resetKey,
}: { txs: Transaction[]; sort: SortState; onSort: (s: SortState) => void; selectable?: boolean; emptyTitle?: string; resetKey?: string }) {
  const { catMap, acctMap } = useUserData();
  const { fmt } = useMoney();
  const dateFmt = usePrefs((s) => s.dateFormat);
  const openDetail = useUI((s) => s.openTxDetail);
  const toast = useUI((s) => s.toast);
  const del = useFinance((s) => s.deleteTransactions);
  const restore = useFinance((s) => s.restoreTransactions);
  const mobile = useMediaQuery('(max-width: 1023px)');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    setPage(0);
    setSelected(new Set());
  }, [resetKey]);

  const pages = Math.max(1, Math.ceil(txs.length / PAGE));
  const safePage = Math.min(page, pages - 1);
  const rows = useMemo(() => txs.slice(safePage * PAGE, safePage * PAGE + PAGE), [txs, safePage]);
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someOnPage = rows.some((r) => selected.has(r.id));
  const groupByDay = sort.key === 'date';

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const bulkDelete = () => {
    const snapshot = txs.filter((t) => selected.has(t.id));
    del([...selected]);
    setSelected(new Set());
    toast({ tone: 'info', title: `Deleted ${snapshot.length} transaction${snapshot.length > 1 ? 's' : ''}`, action: { label: 'Undo', run: () => restore(snapshot) } });
  };

  const SortHead = ({ k, label, className }: { k: SortKey; label: string; className?: string }) => {
    const active = sort.key === k;
    const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <th scope="col" className={cn('px-3 py-2.5 font-normal', className)} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button
          className={cn('inline-flex items-center gap-1 label-mono transition-colors hover:!text-fg', active && '!text-fg-2')}
          onClick={() => onSort({ key: k, dir: active && sort.dir === 'desc' ? 'asc' : 'desc' })}
        >
          {label}
          <Icon size={11} />
        </button>
      </th>
    );
  };

  if (!txs.length) return <Empty title={emptyTitle} body="Try widening the date range or clearing filters." />;

  const amountCell = (t: Transaction) => (
    <span className={cn('font-medium num', t.type === 'income' ? 'text-pos' : t.type === 'transfer' ? 'text-fg-3' : 'text-fg')}>
      {t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''}
      {fmt(t.amount)}
    </span>
  );

  let lastDay = '';
  return (
    <div className="relative">
      {mobile ? (
        <ul className="flex flex-col">
          {rows.map((t, i) => {
            const c = t.categoryId ? catMap.get(t.categoryId) : undefined;
            const showDay = groupByDay && t.date !== lastDay;
            lastDay = t.date;
            return (
              <Fragment key={t.id}>
                {showDay && <li className="label-mono px-1 pb-1 pt-4 first:pt-0">{relativeDay(t.date)}</li>}
                <motion.li initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.025, duration: 0.35 }}>
                  <div className="flex items-center gap-3 rounded-[12px] px-1 py-2.5 active:bg-surface-2">
                    {selectable && <Checkbox checked={selected.has(t.id)} onChange={() => toggle(t.id)} label={`Select ${t.title}`} />}
                    <button onClick={() => openDetail(t.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <CategoryGlyph icon={c?.icon ?? 'wallet'} color={c?.color ?? 'var(--info)'} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{t.title}</span>
                        <span className="block truncate text-xs text-fg-3">{t.type === 'transfer' ? 'Transfer' : c?.name} · {acctMap.get(t.accountId)?.name}</span>
                      </span>
                      <span className="text-sm">{amountCell(t)}</span>
                    </button>
                  </div>
                </motion.li>
              </Fragment>
            );
          })}
        </ul>
      ) : (
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left">
                {selectable && (
                  <th scope="col" className="w-10 py-2.5 pl-5 pr-1">
                    <Checkbox
                      checked={allOnPage}
                      indeterminate={!allOnPage && someOnPage}
                      onChange={(v) =>
                        setSelected((s) => {
                          const n = new Set(s);
                          rows.forEach((r) => (v ? n.add(r.id) : n.delete(r.id)));
                          return n;
                        })
                      }
                      label="Select all on this page"
                    />
                  </th>
                )}
                <SortHead k="title" label="Description" className={selectable ? '' : 'pl-5'} />
                <th scope="col" className="px-3 py-2.5"><span className="label-mono">Category</span></th>
                <th scope="col" className="px-3 py-2.5"><span className="label-mono">Account</span></th>
                <SortHead k="date" label="Date" />
                <SortHead k="amount" label="Amount" className="pr-5 text-right" />
              </tr>
            </thead>
            <tbody>
              {rows.map((t, i) => {
                const c = t.categoryId ? catMap.get(t.categoryId) : undefined;
                const showDay = groupByDay && t.date !== lastDay;
                lastDay = t.date;
                const sel = selected.has(t.id);
                return (
                  <Fragment key={t.id}>
                    {showDay && (
                      <tr aria-hidden>
                        <td colSpan={selectable ? 6 : 5} className="border-t border-line bg-surface-2/40 px-5 py-1.5">
                          <span className="label-mono">{relativeDay(t.date)}</span>
                        </td>
                      </tr>
                    )}
                    <motion.tr
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i, 14) * 0.022, duration: 0.4, ease: EASE.outQuint }}
                      onClick={() => openDetail(t.id)}
                      className={cn('group cursor-pointer transition-colors', sel ? 'bg-accent-soft' : 'hover:bg-surface-2')}
                    >
                      {selectable && (
                        <td className="border-t border-line py-2.5 pl-5 pr-1">
                          <Checkbox checked={sel} onChange={() => toggle(t.id)} label={`Select ${t.title}`} />
                        </td>
                      )}
                      <td className={cn('max-w-[340px] border-t border-line px-3 py-2.5', !selectable && 'pl-5')}>
                        <div className="flex items-center gap-3">
                          <CategoryGlyph icon={c?.icon ?? 'wallet'} color={c?.color ?? 'var(--info)'} size={30} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate">{t.title}</span>
                              {t.recurringId && <Repeat size={12} className="shrink-0 text-fg-4" aria-label="Recurring" />}
                            </div>
                            {t.tags.length > 0 && <div className="truncate text-2xs text-fg-4">{t.tags.map((g) => `#${g}`).join(' ')}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="border-t border-line px-3 py-2.5 text-fg-2">
                        {t.type === 'transfer' ? <Badge tone="info">Transfer</Badge> : c?.name ?? '—'}
                      </td>
                      <td className="border-t border-line px-3 py-2.5 text-fg-3">
                        {acctMap.get(t.accountId)?.name}
                        {t.toAccountId && <span className="text-fg-4"> → {acctMap.get(t.toAccountId)?.name}</span>}
                      </td>
                      <td className="whitespace-nowrap border-t border-line px-3 py-2.5 text-fg-3 num">{formatDate(t.date, dateFmt)}</td>
                      <td className="whitespace-nowrap border-t border-line py-2.5 pl-3 pr-5 text-right">{amountCell(t)}</td>
                    </motion.tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-fg-3">
        <span className="num">
          {safePage * PAGE + 1}–{Math.min(txs.length, (safePage + 1) * PAGE)} of {txs.length}
        </span>
        <div className="flex items-center gap-1">
          <button aria-label="Previous page" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="grid size-8 place-items-center rounded-[8px] border border-line hover:bg-surface-2 disabled:opacity-30">
            <ChevronLeft size={15} />
          </button>
          <span className="px-2 num">
            {safePage + 1} / {pages}
          </span>
          <button aria-label="Next page" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)} className="grid size-8 place-items-center rounded-[8px] border border-line hover:bg-surface-2 disabled:opacity-30">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* floating bulk action bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0, x: '-50%' }}
            animate={{ y: 0, opacity: 1, x: '-50%' }}
            exit={{ y: 80, opacity: 0, x: '-50%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="fixed bottom-[calc(80px+env(safe-area-inset-bottom))] left-1/2 z-50 flex items-center gap-2 rounded-[14px] border border-line-strong bg-surface-2/95 py-1.5 pl-4 pr-1.5 shadow-lg backdrop-blur-md md:bottom-6 md:left-[calc(50%+116px)]"
            role="region"
            aria-label="Bulk actions"
          >
            <span className="text-sm num">
              <span className="font-medium">{selected.size}</span> selected
            </span>
            <span className="mx-1 h-5 w-px bg-line" />
            <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => setConfirm(true)}>
              Delete
            </Button>
            <button aria-label="Clear selection" onClick={() => setSelected(new Set())} className="grid size-8 place-items-center rounded-[8px] text-fg-3 hover:bg-surface-3 hover:text-fg">
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Delete ${selected.size} transaction${selected.size > 1 ? 's' : ''}?`}
        body="They’ll be removed from every report and balance. You can undo right after."
        onConfirm={bulkDelete}
      />
    </div>
  );
}
