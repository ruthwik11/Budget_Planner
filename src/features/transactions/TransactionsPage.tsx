import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, FileUp, Plus, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel, Segmented } from '@/components/ui/Controls';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { AnimatedNumber } from '@/components/animations/Motion';
import { TransactionTable, sortTxs, type SortState } from './TransactionTable';
import { ImportDialog } from './ImportDialog';
import { exportTransactionsCSV } from './csvIO';
import { useUserData } from '@/hooks/useData';
import { useMoney } from '@/hooks/useMoney';
import { useDebounced } from '@/hooks/useMisc';
import { useUI } from '@/store/ui';
import { totals } from '@/lib/finance';
import { cn } from '@/utils/cn';
import type { TxType } from '@/types';

type TypeFilter = 'all' | TxType;

export default function TransactionsPage() {
  const { txs, cats, accts, catMap, acctMap } = useUserData();
  const { fmt, base } = useMoney();
  const openTx = useUI((s) => s.openTxEditor);
  const toast = useUI((s) => s.toast);
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 180);
  const [type, setType] = useState<TypeFilter>('all');
  const [cat, setCat] = useState('all');
  const [acct, setAcct] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<SortState>({ key: 'date', dir: 'desc' });
  const [showFilters, setShowFilters] = useState(false);
  const [importing, setImporting] = useState(false);

  const filtered = useMemo(() => {
    const s = dq.trim().toLowerCase();
    const out = txs.filter((t) => {
      if (type !== 'all' && t.type !== type) return false;
      if (cat !== 'all' && t.categoryId !== cat) return false;
      if (acct !== 'all' && t.accountId !== acct && t.toAccountId !== acct) return false;
      if (from && t.date < from) return false;
      if (to && t.date > to) return false;
      if (s) {
        const hay = `${t.title} ${t.notes ?? ''} ${t.tags.join(' ')} ${t.categoryId ? catMap.get(t.categoryId)?.name ?? '' : ''}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
    return sortTxs(out, sort);
  }, [txs, dq, type, cat, acct, from, to, sort, catMap]);

  const sum = useMemo(() => totals(filtered), [filtered]);
  const activeFilters = [cat !== 'all', acct !== 'all', !!from, !!to].filter(Boolean).length;
  const resetKey = [dq, type, cat, acct, from, to, sort.key, sort.dir].join('|');
  const clear = () => {
    setQ('');
    setType('all');
    setCat('all');
    setAcct('all');
    setFrom('');
    setTo('');
  };

  return (
    <>
      <PageHeader
        eyebrow="Ledger"
        title="Transactions"
        description="Every movement of money across your accounts. Click a row for details; select rows for bulk actions."
        actions={
          <>
            <Button variant="ghost" icon={<FileUp size={15} />} onClick={() => setImporting(true)}>
              Import
            </Button>
            <Button
              variant="secondary"
              icon={<Download size={15} />}
              onClick={() => {
                exportTransactionsCSV(filtered, catMap, acctMap, base);
                toast({ tone: 'success', title: 'CSV exported', body: `${filtered.length} rows` });
              }}
            >
              Export CSV
            </Button>
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => openTx()}>
              Add
            </Button>
          </>
        }
      />

      {/* summary of the filtered set */}
      <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-line bg-line lg:grid-cols-4">
        {[
          { l: 'Results', v: filtered.length, f: (n: number) => String(n) },
          { l: 'Money in', v: sum.income, f: (n: number) => fmt(n, { decimals: false }), c: 'text-pos' },
          { l: 'Money out', v: sum.expense, f: (n: number) => fmt(n, { decimals: false }) },
          { l: 'Net', v: sum.net, f: (n: number) => fmt(n, { decimals: false, sign: 'always' }), c: sum.net >= 0 ? 'text-pos' : 'text-neg' },
        ].map((x) => (
          <div key={x.l} className="bg-surface px-4 py-3.5">
            <div className="label-mono">{x.l}</div>
            <div className={cn('mt-1 text-lg font-medium tracking-tight', x.c)}>
              <AnimatedNumber value={x.v} format={x.f} duration={0.9} />
            </div>
          </div>
        ))}
      </div>

      <Panel bodyClassName="pt-4">
        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex-1">
            <Input
              leading={<Search size={15} />}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, notes, tags, category…"
              aria-label="Search transactions"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            <Segmented<TypeFilter>
              label="Type"
              size="sm"
              value={type}
              onChange={setType}
              options={[
                { value: 'all', label: 'All' },
                { value: 'expense', label: 'Expenses' },
                { value: 'income', label: 'Income' },
                { value: 'transfer', label: 'Transfers' },
              ]}
            />
            <Button
              size="sm"
              variant={showFilters || activeFilters ? 'secondary' : 'ghost'}
              icon={<SlidersHorizontal size={14} />}
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
            >
              Filters{activeFilters ? ` · ${activeFilters}` : ''}
            </Button>
            {(activeFilters > 0 || q || type !== 'all') && (
              <Button size="sm" variant="ghost" icon={<RotateCcw size={13} />} onClick={clear}>
                Reset
              </Button>
            )}
          </div>
        </div>
        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
              <div className="mb-4 grid grid-cols-1 gap-3 rounded-[12px] border border-line bg-surface-2/50 p-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="flex flex-col gap-1 text-xs text-fg-3">
                  Category
                  <Select value={cat} onChange={(e) => setCat(e.target.value)}>
                    <option value="all">All categories</option>
                    {cats.filter((c) => !c.archived).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.kind})
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-fg-3">
                  Account
                  <Select value={acct} onChange={(e) => setAcct(e.target.value)}>
                    <option value="all">All accounts</option>
                    {accts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-fg-3">
                  From
                  <Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-xs text-fg-3">
                  To
                  <Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
                </label>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <TransactionTable txs={filtered} sort={sort} onSort={setSort} resetKey={resetKey} />
      </Panel>
      <ImportDialog open={importing} onClose={() => setImporting(false)} />
    </>
  );
}
