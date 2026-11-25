import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, FileText, Printer, Sheet } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel, Segmented } from '@/components/ui/Controls';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { Wordmark } from '@/components/layout/Wordmark';
import { exportTransactionsCSV } from '@/features/transactions/csvIO';
import { useCurrentUser, useUserData } from '@/hooks/useData';
import { useMoney } from '@/hooks/useMoney';
import { useUI } from '@/store/ui';
import { budgetUsage, byCategory, changePct, monthlySeries, totals } from '@/lib/finance';
import { addMonths, endOfMonth, endOfYear, inRange, monthKey, monthLabel, monthsBetween, previousRange, startOfMonth, startOfYear, todayISO } from '@/utils/dates';
import { minorToDecimalString, percent } from '@/utils/money';
import { toCSV } from '@/utils/csv';
import { downloadFile } from '@/utils/download';
import { cn } from '@/utils/cn';
import { EASE } from '@/constants/motion';

type Kind = 'monthly' | 'annual';
type Focus = 'full' | 'income' | 'expense' | 'category' | 'budget';

/** Print with the light "paper" theme regardless of the current theme, then restore. */
function printReport() {
  const html = document.documentElement;
  const prev = html.dataset.theme;
  html.dataset.theme = 'light';
  const restore = () => {
    html.dataset.theme = prev;
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  setTimeout(() => window.print(), 60);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid border-t border-line pt-5">
      <h3 className="label-mono mb-3">{title}</h3>
      {children}
    </section>
  );
}

export default function ReportsPage() {
  const user = useCurrentUser();
  const { txs, cats, buds, catMap, acctMap } = useUserData();
  const { fmt, base, currency } = useMoney();
  const toast = useUI((s) => s.toast);
  const today = todayISO();
  const [kind, setKind] = useState<Kind>('monthly');
  const [focus, setFocus] = useState<Focus>('full');
  const monthOptions = monthsBetween(addMonths(startOfMonth(today), -23, 1), today).reverse();
  const yearOptions = [...new Set(txs.map((t) => t.date.slice(0, 4)))].sort().reverse();
  const [month, setMonth] = useState(monthKey(addMonths(startOfMonth(today), -1, 1)));
  const [year, setYear] = useState(today.slice(0, 4));

  const r = useMemo(() => {
    const range = kind === 'monthly' ? { from: `${month}-01`, to: endOfMonth(`${month}-01`) } : { from: startOfYear(`${year}-01-01`), to: endOfYear(`${year}-01-01`) };
    const prev = previousRange(range);
    const t = totals(txs, range);
    const p = totals(txs, prev);
    const exp = byCategory(txs, cats, 'expense', range);
    const inc = byCategory(txs, cats, 'income', range);
    const prevExp = new Map(byCategory(txs, cats, 'expense', prev).map((s) => [s.categoryId, s.amount]));
    const budgetRef = kind === 'monthly' ? range.to : `${year}-12-31` > today ? today : `${year}-12-31`;
    const bud = buds.filter((b) => (kind === 'monthly' ? b.period === 'monthly' : true)).map((b) => budgetUsage(b, txs, budgetRef));
    const months = kind === 'annual' ? monthlySeries(txs, range) : [];
    const top = txs.filter((x) => x.type === 'expense' && inRange(x.date, range)).sort((a, b) => b.amount - a.amount).slice(0, 10);
    const inRangeTx = txs.filter((x) => inRange(x.date, range));
    return { range, prev, t, p, exp, inc, prevExp, bud, months, top, inRangeTx };
  }, [kind, month, year, txs, cats, buds, today]);

  const title = kind === 'monthly' ? monthLabel(month, 'long', true) : year;
  const f = (n: number) => fmt(n);
  const show = (s: Focus) => focus === 'full' || focus === s;

  const exportCSV = () => {
    const rows: unknown[][] = [
      ['Summary', 'Income', '', minorToDecimalString(r.t.income)],
      ['Summary', 'Expenses', '', minorToDecimalString(r.t.expense)],
      ['Summary', 'Net', '', minorToDecimalString(r.t.net)],
      ['Summary', 'Savings rate %', '', r.t.savingsRate],
      ...r.inc.map((s) => ['Income by source', s.name, s.share, minorToDecimalString(s.amount)]),
      ...r.exp.map((s) => ['Expenses by category', s.name, s.share, minorToDecimalString(s.amount)]),
      ...r.bud.map((u) => ['Budget', `${catMap.get(u.budget.categoryId)?.name} (${u.budget.period})`, u.utilization, `${minorToDecimalString(u.spent)} / ${minorToDecimalString(u.available)}`]),
      ...r.months.map((m) => ['Month', m.month, m.savingsRate, `${minorToDecimalString(m.income)} / ${minorToDecimalString(m.expense)}`]),
    ];
    downloadFile(`cadence-report-${kind}-${kind === 'monthly' ? month : year}.csv`, toCSV(['section', 'item', 'percent', `amount (${base})`], rows), 'text/csv;charset=utf-8');
    toast({ tone: 'success', title: 'Report exported as CSV' });
  };

  const Row = ({ label, value, sub, strong, tone }: { label: React.ReactNode; value: string; sub?: React.ReactNode; strong?: boolean; tone?: string }) => (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-line py-1.5 text-sm last:border-0">
      <span className={cn('min-w-0 break-words', strong ? 'font-medium' : 'text-fg-2')}>{label}</span>
      <span className="flex shrink-0 flex-wrap items-baseline justify-end gap-x-3">
        {sub && <span className="text-xs text-fg-4 num">{sub}</span>}
        <span className={cn('num', strong && 'font-medium', tone)}>{value}</span>
      </span>
    </div>
  );

  return (
    <>
      <div className="no-print">
        <PageHeader
          eyebrow="Understand"
          title="Reports"
          description="Monthly and annual statements you can export as CSV or save as PDF."
          actions={
            <>
              <Button variant="ghost" icon={<Sheet size={15} />} onClick={() => { exportTransactionsCSV(r.inRangeTx, catMap, acctMap, base, `transactions-${kind === 'monthly' ? month : year}`); toast({ tone: 'success', title: 'Transactions exported', body: `${r.inRangeTx.length} rows` }); }}>
                Transactions CSV
              </Button>
              <Button variant="secondary" icon={<Download size={15} />} onClick={exportCSV}>Report CSV</Button>
              <Button variant="primary" icon={<Printer size={15} />} onClick={printReport}>PDF / Print</Button>
            </>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="no-print flex flex-col gap-4">
          <Panel eyebrow="Report" title="Configure">
            <div className="flex flex-col gap-4">
              <Segmented<Kind> label="Report type" value={kind} onChange={setKind} className="w-full" options={[{ value: 'monthly', label: 'Monthly' }, { value: 'annual', label: 'Annual' }]} />
              {kind === 'monthly' ? (
                <label className="flex flex-col gap-1.5 text-xs text-fg-2">
                  Month
                  <Select value={month} onChange={(e) => setMonth(e.target.value)}>
                    {monthOptions.map((m) => <option key={m} value={m}>{monthLabel(m, 'long', true)}</option>)}
                  </Select>
                </label>
              ) : (
                <label className="flex flex-col gap-1.5 text-xs text-fg-2">
                  Year
                  <Select value={year} onChange={(e) => setYear(e.target.value)}>
                    {(yearOptions.length ? yearOptions : [today.slice(0, 4)]).map((y) => <option key={y} value={y}>{y}</option>)}
                  </Select>
                </label>
              )}
              <fieldset className="flex flex-col gap-1">
                <legend className="mb-1.5 text-xs text-fg-2">Focus</legend>
                {([
                  ['full', 'Full statement'],
                  ['income', 'Income report'],
                  ['expense', 'Expense report'],
                  ['category', 'Category report'],
                  ['budget', 'Budget performance'],
                ] as [Focus, string][]).map(([id, l]) => (
                  <button key={id} onClick={() => setFocus(id)} aria-pressed={focus === id} className={cn('relative flex items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-sm transition-colors', focus === id ? 'text-fg' : 'text-fg-3 hover:text-fg-2')}>
                    {focus === id && <motion.span layoutId="report-focus" className="absolute inset-0 rounded-[8px] bg-surface-2" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                    <FileText size={14} className="relative" />
                    <span className="relative">{l}</span>
                  </button>
                ))}
              </fieldset>
            </div>
          </Panel>
        </aside>

        {/* the document */}
        <AnimatePresence mode="wait">
          <motion.article
            key={`${kind}-${month}-${year}-${focus}`}
            initial={{ opacity: 0, y: 16, rotateX: 4 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.5, ease: EASE.outQuint }}
            style={{ transformPerspective: 1200 }}
            className="panel mx-auto w-full max-w-[860px] !rounded-[6px] px-6 py-8 md:px-12 md:py-12"
            aria-label={`${title} report`}
          >
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Wordmark size={16} />
                <h2 className="mt-6 text-[2rem] font-medium leading-none tracking-[-0.04em] md:text-[2.6rem]">{title}</h2>
                <p className="serif mt-1 text-lg italic text-fg-3">
                  {focus === 'full' ? `${kind === 'monthly' ? 'Monthly' : 'Annual'} financial statement` : { income: 'Income report', expense: 'Expense report', category: 'Category report', budget: 'Budget performance' }[focus]}
                </p>
              </div>
              <dl className="text-right text-xs text-fg-3">
                <div>{user?.name}</div>
                <div className="num">{r.range.from} → {r.range.to}</div>
                <div>Generated {new Date().toLocaleDateString()}</div>
                <div>Shown in {currency}</div>
              </dl>
            </header>

            <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-line bg-line lg:grid-cols-4">
              {[
                { l: 'Income', v: r.t.income, d: changePct(r.t.income, r.p.income) },
                { l: 'Expenses', v: r.t.expense, d: changePct(r.t.expense, r.p.expense) },
                { l: 'Net', v: r.t.net, d: changePct(r.t.net, r.p.net) },
                { l: 'Savings rate', v: null, d: null, s: `${r.t.savingsRate}%` },
              ].map((x) => (
                <div key={x.l} className="bg-surface p-4">
                  <div className="label-mono">{x.l}</div>
                  <div className="mt-1 text-lg font-medium tracking-tight num">{x.s ?? fmt(x.v!, { decimals: false })}</div>
                  {x.d !== null && <div className="text-2xs text-fg-4 num">{x.d >= 0 ? '+' : ''}{x.d.toFixed(1)}% vs prior</div>}
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-7">
              {show('income') && (
                <Section title="Income by source">
                  {r.inc.length ? r.inc.map((s) => <Row key={s.categoryId} label={s.name} value={f(s.amount)} sub={`${s.share}%`} />) : <p className="text-sm text-fg-3">No income recorded.</p>}
                  <Row strong label="Total income" value={f(r.t.income)} tone="text-pos" />
                </Section>
              )}
              {(show('expense') || show('category')) && (
                <Section title={focus === 'category' ? 'Category report: this period vs prior' : 'Expenses by category'}>
                  {r.exp.length ? (
                    r.exp.map((s) => {
                      const prev = r.prevExp.get(s.categoryId) ?? 0;
                      const ch = changePct(s.amount, prev);
                      return (
                        <Row
                          key={s.categoryId}
                          label={<span className="flex items-center gap-2"><span className="size-2 rounded-[2px]" style={{ background: s.color }} />{s.name}</span>}
                          value={f(s.amount)}
                          sub={focus === 'category' ? `${f(prev)} · ${ch === null ? 'new' : `${ch >= 0 ? '+' : ''}${ch.toFixed(0)}%`}` : `${s.share}% · ${s.count} txns`}
                        />
                      );
                    })
                  ) : (
                    <p className="text-sm text-fg-3">No expenses recorded.</p>
                  )}
                  <Row strong label="Total expenses" value={f(r.t.expense)} />
                </Section>
              )}
              {show('budget') && (
                <Section title="Budget performance">
                  {r.bud.length ? (
                    r.bud.map((u) => (
                      <Row
                        key={u.budget.id}
                        label={`${catMap.get(u.budget.categoryId)?.name} · ${u.budget.period}`}
                        value={`${fmt(u.spent, { decimals: false })} / ${fmt(u.available, { decimals: false })}`}
                        sub={<span className={u.status === 'over' ? 'text-neg' : u.status === 'warning' ? 'text-warn' : ''}>{u.utilization}%</span>}
                      />
                    ))
                  ) : (
                    <p className="text-sm text-fg-3">No budgets configured.</p>
                  )}
                  {kind === 'annual' && <p className="mt-2 text-2xs text-fg-4">Budget figures reflect each budget’s period containing {r.range.to > today ? 'today' : r.range.to}.</p>}
                </Section>
              )}
              {kind === 'annual' && focus === 'full' && (
                <Section title="Month by month">
                  <div className="-mx-2 overflow-x-auto">
                    <table className="w-full min-w-[480px] text-sm">
                      <thead><tr className="text-left text-fg-4"><th className="px-2 py-1 font-normal">Month</th><th className="px-2 py-1 text-right font-normal">Income</th><th className="px-2 py-1 text-right font-normal">Expenses</th><th className="px-2 py-1 text-right font-normal">Net</th><th className="px-2 py-1 text-right font-normal">Rate</th></tr></thead>
                      <tbody>
                        {r.months.map((m) => (
                          <tr key={m.month} className="border-t border-dashed border-line">
                            <td className="px-2 py-1.5">{monthLabel(m.month, 'long')}</td>
                            <td className="px-2 py-1.5 text-right num">{fmt(m.income, { decimals: false })}</td>
                            <td className="px-2 py-1.5 text-right num">{fmt(m.expense, { decimals: false })}</td>
                            <td className={cn('px-2 py-1.5 text-right num', m.net < 0 && 'text-neg')}>{fmt(m.net, { decimals: false })}</td>
                            <td className="px-2 py-1.5 text-right text-fg-3 num">{m.savingsRate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              )}
              {(focus === 'full' || focus === 'expense') && r.top.length > 0 && (
                <Section title="Largest expenses">
                  {r.top.map((x) => <Row key={x.id} label={x.title} value={f(x.amount)} sub={`${x.date} · ${percent(x.amount, r.t.expense)}%`} />)}
                </Section>
              )}
            </div>
            <footer className="mt-10 border-t border-line pt-4 text-2xs text-fg-4">
              Generated by Cadence from data stored in this browser. Amounts converted to {currency} at fixed demo rates where applicable.
            </footer>
          </motion.article>
        </AnimatePresence>
      </div>
    </>
  );
}
