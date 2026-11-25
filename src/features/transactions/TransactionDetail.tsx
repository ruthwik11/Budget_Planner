import { useState } from 'react';
import { Copy, Pencil, Repeat, Trash2 } from 'lucide-react';
import { Drawer, ConfirmDialog } from '@/components/ui/Overlay';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Controls';
import { CategoryGlyph } from '@/components/ui/Icon';
import { useUI } from '@/store/ui';
import { useFinance } from '@/store/finance';
import { useUserData } from '@/hooks/useData';
import { useMoney } from '@/hooks/useMoney';
import { usePrefs } from '@/store/prefs';
import { formatDate, todayISO } from '@/utils/dates';
import { PAYMENT_METHODS } from '@/constants/options';
import { AnimatedNumber } from '@/components/animations/Motion';

export function TransactionDetail() {
  const id = useUI((s) => s.txDetail);
  const openDetail = useUI((s) => s.openTxDetail);
  const openEditor = useUI((s) => s.openTxEditor);
  const toast = useUI((s) => s.toast);
  const del = useFinance((s) => s.deleteTransactions);
  const restore = useFinance((s) => s.restoreTransactions);
  const recurring = useFinance((s) => s.recurring);
  const { txs, catMap, acctMap } = useUserData();
  const { fmt } = useMoney();
  const dateFmt = usePrefs((s) => s.dateFormat);
  const [confirm, setConfirm] = useState(false);
  const tx = txs.find((t) => t.id === id) ?? null;
  const cat = tx?.categoryId ? catMap.get(tx.categoryId) : undefined;
  const rec = tx?.recurringId ? recurring.find((r) => r.id === tx.recurringId) : undefined;
  const sign = tx?.type === 'income' ? 1 : tx?.type === 'expense' ? -1 : 0;
  const similar = tx ? txs.filter((t) => t.id !== tx.id && t.categoryId && t.categoryId === tx.categoryId).slice(0, 4) : [];

  const rows: [string, React.ReactNode][] = tx
    ? [
        ['Date', formatDate(tx.date, dateFmt)],
        ['Type', <Badge key="t" tone={tx.type === 'income' ? 'pos' : tx.type === 'expense' ? 'neg' : 'info'}>{tx.type}</Badge>],
        ['Category', cat?.name ?? '—'],
        [tx.type === 'transfer' ? 'From' : 'Account', acctMap.get(tx.accountId)?.name ?? '—'],
        ...(tx.type === 'transfer' ? ([['To', acctMap.get(tx.toAccountId ?? '')?.name ?? '—']] as [string, React.ReactNode][]) : []),
        ['Method', PAYMENT_METHODS.find((m) => m.id === tx.paymentMethod)?.label ?? tx.paymentMethod],
        ['Tags', tx.tags.length ? <span key="tg" className="flex flex-wrap justify-end gap-1">{tx.tags.map((t) => <Badge key={t}>#{t}</Badge>)}</span> : '—'],
      ]
    : [];

  return (
    <>
      <Drawer
        open={!!tx}
        onClose={() => openDetail(null)}
        title={tx?.title ?? ''}
        description={tx ? `Added ${new Date(tx.createdAt).toLocaleDateString()}` : undefined}
        footer={
          tx && (
            <>
              <Button variant="secondary" icon={<Pencil size={14} />} onClick={() => { openDetail(null); openEditor({ editing: tx }); }}>
                Edit
              </Button>
              <Button
                variant="ghost"
                icon={<Copy size={14} />}
                onClick={() => {
                  openDetail(null);
                  openEditor({ draft: { ...tx, id: undefined, date: todayISO() } });
                }}
              >
                Duplicate
              </Button>
              <Button variant="danger" className="ml-auto" icon={<Trash2 size={14} />} onClick={() => setConfirm(true)}>
                Delete
              </Button>
            </>
          )
        }
      >
        {tx && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <CategoryGlyph icon={cat?.icon ?? (tx.type === 'transfer' ? 'wallet' : 'tag')} color={cat?.color ?? 'var(--info)'} size={48} />
              <div>
                <div className="label-mono">{tx.type === 'transfer' ? 'Moved' : tx.type === 'income' ? 'Received' : 'Spent'}</div>
                <div className={`text-[2rem] font-medium tracking-tight ${sign > 0 ? 'text-pos' : ''}`}>
                  <AnimatedNumber value={tx.amount} duration={1} format={(n) => (sign > 0 ? '+' : sign < 0 ? '−' : '') + fmt(n)} />
                </div>
              </div>
            </div>
            <dl className="divide-y divide-line rounded-[12px] border border-line">
              {rows.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                  <dt className="text-fg-3">{k}</dt>
                  <dd className="text-right">{v}</dd>
                </div>
              ))}
            </dl>
            {rec && (
              <div className="flex items-center gap-3 rounded-[12px] border border-line bg-surface-2 px-4 py-3 text-sm">
                <Repeat size={16} className="text-accent-fg" />
                <span className="text-fg-2">Posted by schedule “{rec.title}” ({rec.frequency})</span>
              </div>
            )}
            {tx.notes && (
              <div>
                <div className="label-mono mb-1.5">Notes</div>
                <p className="whitespace-pre-wrap rounded-[12px] border border-line bg-surface-2 p-4 text-sm text-fg-2">{tx.notes}</p>
              </div>
            )}
            {similar.length > 0 && (
              <div>
                <div className="label-mono mb-2">Recent in {cat?.name}</div>
                <ul className="flex flex-col">
                  {similar.map((s) => (
                    <li key={s.id}>
                      <button onClick={() => openDetail(s.id)} className="flex w-full items-center justify-between rounded-[8px] px-2 py-2 text-sm hover:bg-surface-2">
                        <span className="truncate text-fg-2">{s.title}</span>
                        <span className="num text-fg-3">{fmt(s.amount)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Drawer>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Delete transaction?"
        body={<>“{tx?.title}” will be removed. You can undo right after.</>}
        onConfirm={() => {
          if (!tx) return;
          const snapshot = tx;
          del([tx.id]);
          openDetail(null);
          toast({ tone: 'info', title: 'Transaction deleted', action: { label: 'Undo', run: () => restore([snapshot]) } });
        }}
      />
    </>
  );
}
