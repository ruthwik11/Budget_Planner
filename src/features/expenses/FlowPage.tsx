import { useMemo, useState } from 'react';
import { Plus, Repeat } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Delta, Empty, Panel, Segmented } from '@/components/ui/Controls';
import { Button } from '@/components/ui/Button';
import { CategoryGlyph } from '@/components/ui/Icon';
import { AnimatedNumber, Reveal } from '@/components/animations/Motion';
import { Donut, MonthBars, RankBars } from '@/components/charts/Charts';
import { TransactionTable, sortTxs, type SortState } from '@/features/transactions/TransactionTable';
import { CategoryManager } from './CategoryManager';
import { useUserData } from '@/hooks/useData';
import { useMoney } from '@/hooks/useMoney';
import { useUI } from '@/store/ui';
import { byCategory, changePct, monthlyEquivalent, monthlySeries } from '@/lib/finance';
import { PAYMENT_METHODS } from '@/constants/options';
import { addMonths, endOfMonth, inRange, monthKey, monthsBetween, previousRange, rangeForPreset, RANGE_PRESETS, startOfMonth, todayISO, type RangePreset } from '@/utils/dates';
import { percent, sumMinor } from '@/utils/money';
import { cn } from '@/utils/cn';
import type { CategoryKind } from '@/types';

export function FlowPage({ kind }: { kind: CategoryKind }) {
  const { txs, cats, recs, catMap } = useUserData();
  const { fmt, compact } = useMoney();
  const openTx = useUI((s) => s.openTxEditor);
  const [preset, setPreset] = useState<RangePreset>('last-6');
  const [active, setActive] = useState<string | null>(null);
  const [sort, setSort] = useState<SortState>({ key: 'date', dir: 'desc' });
  const isInc = kind === 'income';
  const today = todayISO();
  const f0 = (n: number) => fmt(n, { decimals: false });

  const d = useMemo(() => {
    const range = rangeForPreset(preset, today);
    const prev = previousRange(range);
    const scoped = txs.filter((t) => t.type === kind);
    const inRangeTx = scoped.filter((t) => inRange(t.date, range));
    const total = sumMinor(inRangeTx.map((t) => t.amount));
    const prevTotal = sumMinor(scoped.filter((t) => inRange(t.date, prev)).map((t) => t.amount));
    const slices = byCategory(txs, cats, kind, range);
    const prevSlices = new Map(byCategory(txs, cats, kind, prev).map((s) => [s.categoryId, s.amount]));
    const months = monthsBetween(range.from, range.to).length;
    // stacked monthly bars: top 4 categories + "other", over ≥ 6 months
    const chartFrom = months < 6 ? addMonths(startOfMonth(range.to), -5, 1) : range.from;
    const chartRange = { from: chartFrom, to: endOfMonth(range.to) };
    const topIds = byCategory(txs, cats, kind, chartRange).slice(0, 4).map((s) => s.categoryId);
    const bars = monthsBetween(chartRange.from, chartRange.to).map((m) => {
      const row: Record<string, number | string> = { month: m };
      topIds.forEach((id) => (row[id] = 0));
      row.other = 0;
      return row;
    });
    const idx = new Map(bars.map((b, i) => [b.month as string, i]));
    for (const t of scoped) {
      if (!inRange(t.date, chartRange)) continue;
      const i = idx.get(monthKey(t.date));
      if (i === undefined) continue;
      const k = t.categoryId && topIds.includes(t.categoryId) ? t.categoryId : 'other';
      bars[i][k] = (bars[i][k] as number) + t.amount;
    }
    const series = monthlySeries(txs, chartRange);
    const methods = PAYMENT_METHODS.map((m) => ({ ...m, amount: sumMinor(inRangeTx.filter((t) => t.paymentMethod === m.id).map((t) => t.amount)) })).filter((m) => m.amount > 0).sort((a, b) => b.amount - a.amount);
    // one-off purchases only: repeating bills (rent, subscriptions) would otherwise fill every slot
    const largest = inRangeTx.filter((t) => !t.recurringId).sort((a, b) => b.amount - a.amount).slice(0, 5);
    const usage = new Map<string, number>();
    scoped.forEach((t) => t.categoryId && usage.set(t.categoryId, (usage.get(t.categoryId) ?? 0) + 1));
    return {
      range, total, prevTotal, slices, prevSlices, months, bars, topIds, series, methods, largest, usage, count: inRangeTx.length,
      avg: Math.round(total / Math.max(1, Math.min(months, monthsBetween(range.from, today).length))),
      list: sortTxs(inRangeTx, sort),
    };
  }, [txs, cats, kind, preset, today, sort]);

  const recurringHere = recs.filter((r) => r.type === kind && r.active);
  const fixedMonthly = sumMinor(recurringHere.map(monthlyEquivalent));

  return (
    <>
      <PageHeader
        eyebrow="Understand"
        title={isInc ? 'Income' : 'Expenses'}
        description={isInc ? 'Where your money comes from: salary, freelance, business and investments.' : 'Where your money goes, by category, month and payment method.'}
        actions={
          <>
            <Segmented<RangePreset> label="Range" size="sm" value={preset} onChange={setPreset} options={RANGE_PRESETS.filter((p) => p.id !== 'this-month').map((p) => ({ value: p.id, label: p.short }))} />
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => openTx({ draft: { type: kind } })}>{isInc ? 'Add income' : 'Add expense'}</Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-line bg-line lg:grid-cols-4">
        {[
          { l: `Total ${isInc ? 'income' : 'spent'}`, v: d.total, delta: changePct(d.total, d.prevTotal) },
          { l: 'Monthly average', v: d.avg },
          { l: `Fixed ${isInc ? 'income' : 'costs'} / mo`, v: fixedMonthly },
          { l: 'Transactions', v: d.count, raw: true },
        ].map((x) => (
          <div key={x.l} className="bg-surface px-4 py-4 md:px-5">
            <div className="label-mono">{x.l}</div>
            <div className={cn('mt-1 flex items-baseline gap-2 text-xl font-medium tracking-tight', isInc && x.l.startsWith('Total') && 'text-pos')}>
              <AnimatedNumber value={x.v} format={x.raw ? (n) => String(n) : f0} />
              {'delta' in x && <Delta value={x.delta ?? null} invert={!isInc} />}
            </div>
          </div>
        ))}
      </div>

      <Reveal className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div data-reveal className="lg:col-span-8">
          <Panel className="h-full" eyebrow="Monthly" title={`${isInc ? 'Income' : 'Spending'} by month`}>
            <MonthBars
              stacked
              data={d.bars}
              keys={[
                ...d.topIds.map((id) => ({ key: id, name: catMap.get(id)?.name ?? '—', color: catMap.get(id)?.color ?? 'var(--fg-3)' })),
                { key: 'other', name: 'Other', color: 'var(--surface-3)' },
              ]}
              height={290}
            />
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-fg-3">
              {d.topIds.map((id) => (
                <span key={id} className="flex items-center gap-1.5"><span className="size-2 rounded-[2px]" style={{ background: catMap.get(id)?.color }} />{catMap.get(id)?.name}</span>
              ))}
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-[2px] bg-surface-3" />Other</span>
            </div>
          </Panel>
        </div>
        <div data-reveal className="lg:col-span-4">
          <Panel className="h-full" eyebrow="Breakdown" title={isInc ? 'Income sources' : 'By category'}>
            {d.slices.length ? (
              <div className="flex flex-col items-center gap-4">
                <Donut slices={d.slices.map((s) => ({ id: s.categoryId, label: s.name, value: s.amount, color: s.color }))} centerLabel="Total" centerValue={compact(d.total)} active={active} onActive={setActive} size={200} />
                <div className="w-full">
                  <RankBars items={d.slices.slice(0, 6).map((s) => ({ id: s.categoryId, label: s.name, value: s.amount, color: s.color, meta: `${s.share}%` }))} active={active} onActive={setActive} valueFormat={f0} />
                </div>
              </div>
            ) : (
              <Empty title="Nothing in this range" />
            )}
          </Panel>
        </div>

        <div data-reveal className="lg:col-span-8">
          <Panel className="h-full" eyebrow="Comparison" title="Category vs. previous period">
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="px-5 py-2 font-normal"><span className="label-mono">Category</span></th>
                    <th className="px-3 py-2 text-right font-normal"><span className="label-mono">This period</span></th>
                    <th className="px-3 py-2 text-right font-normal"><span className="label-mono">Previous</span></th>
                    <th className="px-3 py-2 text-right font-normal"><span className="label-mono">Change</span></th>
                    <th className="w-[22%] px-5 py-2 font-normal"><span className="label-mono">Share</span></th>
                  </tr>
                </thead>
                <tbody>
                  {d.slices.map((s) => {
                    const p = d.prevSlices.get(s.categoryId) ?? 0;
                    const c = catMap.get(s.categoryId);
                    return (
                      <tr key={s.categoryId} className="border-t border-line">
                        <td className="px-5 py-2.5"><span className="flex items-center gap-2.5"><CategoryGlyph icon={c?.icon} color={s.color} size={24} />{s.name}</span></td>
                        <td className="px-3 py-2.5 text-right font-medium num">{f0(s.amount)}</td>
                        <td className="px-3 py-2.5 text-right text-fg-3 num">{f0(p)}</td>
                        <td className="px-3 py-2.5 text-right"><Delta value={changePct(s.amount, p)} invert={!isInc} /></td>
                        <td className="px-5 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full" style={{ width: `${s.share}%`, background: s.color }} /></div>
                            <span className="w-10 text-right text-xs text-fg-3 num">{s.share}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
        <div data-reveal className="lg:col-span-4">
          <Panel className="h-full" eyebrow="Categories" title="Manage categories">
            <CategoryManager kind={kind} usage={d.usage} />
          </Panel>
        </div>

        <div data-reveal className="lg:col-span-4">
          <Panel className="h-full" eyebrow={isInc ? 'Deposited via' : 'Paid with'} title="Payment methods">
            {d.methods.length ? (
              <ul className="flex flex-col gap-3">
                {d.methods.map((m) => (
                  <li key={m.id}>
                    <div className="mb-1 flex justify-between text-sm"><span>{m.label}</span><span className="num">{f0(m.amount)} <span className="text-fg-4">· {percent(m.amount, d.total)}%</span></span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-fg-2" style={{ width: `${percent(m.amount, d.total)}%` }} /></div>
                  </li>
                ))}
              </ul>
            ) : <Empty title="No data" />}
          </Panel>
        </div>
        <div data-reveal className="lg:col-span-4">
          <Panel className="h-full" eyebrow="Largest" title={`Biggest ${isInc ? 'deposits' : 'expenses'}`}>
            <ol className="flex flex-col gap-2.5">
              {d.largest.map((t, i) => (
                <li key={t.id} className="flex items-center gap-3 text-sm">
                  <span className="w-4 font-mono text-xs text-fg-4">{i + 1}</span>
                  <span className="flex-1 truncate">{t.title}</span>
                  <span className="font-medium num">{f0(t.amount)}</span>
                </li>
              ))}
              {!d.largest.length && <Empty title="No data" />}
            </ol>
          </Panel>
        </div>
        <div data-reveal className="lg:col-span-4">
          <Panel className="h-full" eyebrow="Recurring" title={`Fixed ${isInc ? 'income' : 'costs'}`}>
            {recurringHere.length ? (
              <ul className="flex flex-col gap-2.5">
                {recurringHere.slice(0, 6).map((r) => (
                  <li key={r.id} className="flex items-center gap-3 text-sm">
                    <Repeat size={13} className="text-fg-4" />
                    <span className="flex-1 truncate">{r.title}</span>
                    <span className="text-xs text-fg-4">{r.frequency}</span>
                    <span className="font-medium num">{f0(r.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : <Empty title="No recurring items" />}
          </Panel>
        </div>

        <div data-reveal className="lg:col-span-12">
          <Panel eyebrow="History" title={`${isInc ? 'Income' : 'Expense'} history`}>
            <TransactionTable txs={d.list} sort={sort} onSort={setSort} resetKey={preset + kind} />
          </Panel>
        </div>
      </Reveal>
    </>
  );
}
