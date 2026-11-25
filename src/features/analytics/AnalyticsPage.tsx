import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import { PageHeader } from '@/components/layout/PageHeader';
import { Delta, Panel, Segmented } from '@/components/ui/Controls';
import { AnimatedNumber, Reveal } from '@/components/animations/Motion';
import { CashflowChart, ChartTooltip, Donut, MonthBars, RankBars } from '@/components/charts/Charts';
import { useUserData } from '@/hooks/useData';
import { useMoney } from '@/hooks/useMoney';
import { useReducedMotion } from '@/hooks/useMotionPrefs';
import { byCategory, changePct, dailySeries, forecastMonths, monthlySeries, totals } from '@/lib/finance';
import {
  addMonths, endOfMonth, fromISO, monthKey, monthLabel, monthsBetween, previousRange, rangeForPreset, RANGE_PRESETS, startOfMonth, todayISO,
  type RangePreset,
} from '@/utils/dates';
import { percent, sumMinor } from '@/utils/money';
import { cn } from '@/utils/cn';

const AXIS = { axisLine: false, tickLine: false, tickMargin: 10 } as const;

/** Category × month heatmap. Intensity is relative to the category's own max so small categories still show pattern. */
function Heatmap({ rows, months }: { rows: { id: string; name: string; color: string; values: number[] }[]; months: string[] }) {
  const { fmt } = useMoney();
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-[3px] text-xs">
        <thead>
          <tr>
            <th />
            {months.map((m) => <th key={m} className="label-mono pb-1 text-center !font-normal !text-[10px]">{monthLabel(m)}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => {
            const max = Math.max(1, ...r.values);
            return (
              <tr key={r.id}>
                <th scope="row" className="whitespace-nowrap pr-3 text-left font-normal text-fg-2">{r.name}</th>
                {r.values.map((v, i) => (
                  <motion.td
                    key={i}
                    initial={{ opacity: 0, scale: 0.6 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: ri * 0.03 + i * 0.015, duration: 0.35 }}
                    title={`${r.name}, ${monthLabel(months[i], 'long', true)}: ${fmt(v)}`}
                    className="h-8 rounded-[5px]"
                    style={{ background: v ? `color-mix(in oklab, ${r.color} ${Math.round(12 + (v / max) * 78)}%, var(--surface-2))` : 'var(--surface-2)' }}
                  >
                    <span className="sr-only">{fmt(v)}</span>
                  </motion.td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function AnalyticsPage() {
  const { txs, cats, catMap } = useUserData();
  const { fmt, compact } = useMoney();
  const reduced = useReducedMotion();
  const [preset, setPreset] = useState<RangePreset>('last-12');
  const today = todayISO();
  const f0 = (n: number) => fmt(n, { decimals: false });

  const a = useMemo(() => {
    const range = rangeForPreset(preset, today);
    const prev = previousRange(range);
    const cur = totals(txs, range);
    const before = totals(txs, prev);
    const months = Math.max(1, monthsBetween(range.from, range.to > today ? today : range.to).length);
    const chartFrom = monthsBetween(range.from, range.to).length < 6 ? addMonths(startOfMonth(range.to), -5, 1) : range.from;
    const series = monthlySeries(txs, { from: chartFrom, to: endOfMonth(range.to) });
    const complete = series.filter((p) => p.month < monthKey(today));
    const fc = forecastMonths(complete.length >= 2 ? complete : series, 3, series[series.length - 1]?.month);
    const cashflow = [
      ...series.map((p) => ({ month: p.month, income: p.income, expense: p.expense, net: p.net, forecast: false })),
      ...fc.map((f) => ({ month: f.month, income: f.income, expense: f.expense, net: f.income - f.expense, forecast: true })),
    ];
    const rate = series.map((p) => ({ month: p.month, rate: p.savingsRate }));
    // cumulative spending: this month vs last month, by day-of-month
    const thisM = { from: startOfMonth(today), to: endOfMonth(today) };
    const lastM = { from: addMonths(startOfMonth(today), -1, 1), to: endOfMonth(addMonths(startOfMonth(today), -1, 1)) };
    const dThis = dailySeries(txs, thisM);
    const dLast = dailySeries(txs, lastM);
    const dayOfMonth = fromISO(today).getDate();
    const pace = Array.from({ length: 31 }, (_, i) => ({
      day: i + 1,
      thisMonth: i < dayOfMonth && dThis[i] ? dThis[i].cumulativeExpense : null,
      lastMonth: dLast[i]?.cumulativeExpense ?? null,
    }));
    // annual: this year vs last year by calendar month
    const y = Number(today.slice(0, 4));
    const annual = Array.from({ length: 12 }, (_, m) => {
      const mm = String(m + 1).padStart(2, '0');
      const tCur = totals(txs, { from: `${y}-${mm}-01`, to: endOfMonth(`${y}-${mm}-01`) });
      const tPrev = totals(txs, { from: `${y - 1}-${mm}-01`, to: endOfMonth(`${y - 1}-${mm}-01`) });
      return { month: `${y}-${mm}`, thisYear: tCur.expense, lastYear: tPrev.expense };
    });
    const expSlices = byCategory(txs, cats, 'expense', range);
    const incSlices = byCategory(txs, cats, 'income', range);
    const hmMonths = monthsBetween(addMonths(startOfMonth(today), -11, 1), today);
    const heat = expSlices.slice(0, 9).map((s) => ({
      id: s.categoryId, name: s.name, color: s.color,
      values: hmMonths.map((m) => sumMinor(txs.filter((t) => t.type === 'expense' && t.categoryId === s.categoryId && monthKey(t.date) === m).map((t) => t.amount))),
    }));
    const wd = Array.from({ length: 7 }, (_, i) => ({ day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i], amount: 0, count: 0 }));
    txs.forEach((t) => {
      if (t.type !== 'expense' || t.recurringId || t.date < range.from || t.date > range.to) return;
      const i = (fromISO(t.date).getDay() + 6) % 7;
      wd[i].amount += t.amount;
      wd[i].count++;
    });
    const largest = txs.filter((t) => t.type === 'expense' && t.date >= range.from && t.date <= range.to).sort((x, z) => z.amount - x.amount).slice(0, 8);
    const best = [...series].filter((p) => p.income).sort((x, z) => z.savingsRate - x.savingsRate)[0];
    return { range, cur, before, months, cashflow, rate, pace, annual, expSlices, incSlices, heat, hmMonths, wd, largest, best, fc, y };
  }, [txs, cats, preset, today]);

  const [activeExp, setActiveExp] = useState<string | null>(null);
  const [activeInc, setActiveInc] = useState<string | null>(null);
  const wdMax = Math.max(1, ...a.wd.map((w) => w.amount));
  const fcNet = a.fc.reduce((s, f) => s + f.income - f.expense, 0);

  return (
    <>
      <PageHeader
        eyebrow="Understand"
        title="Analytics"
        description="Trends, comparisons and forecasts, all computed from your transactions."
        actions={<Segmented<RangePreset> label="Range" size="sm" value={preset} onChange={setPreset} options={RANGE_PRESETS.map((p) => ({ value: p.id, label: p.short }))} />}
      />
      <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-line bg-line lg:grid-cols-5">
        {[
          { l: 'Savings rate', v: Math.round(a.cur.savingsRate * 10), f: (n: number) => `${(n / 10).toFixed(1)}%`, d: a.before.income ? Math.round((a.cur.savingsRate - a.before.savingsRate) * 10) / 10 : null, s: ' pts' },
          { l: 'Avg income / mo', v: Math.round(a.cur.income / a.months), f: f0, d: changePct(a.cur.income, a.before.income) },
          { l: 'Avg spend / mo', v: Math.round(a.cur.expense / a.months), f: f0, d: changePct(a.cur.expense, a.before.expense), inv: true },
          { l: 'Net saved', v: a.cur.net, f: f0, d: changePct(a.cur.net, a.before.net) },
          { l: 'Next 3 mo forecast', v: fcNet, f: (n: number) => fmt(n, { decimals: false, sign: 'always' }) },
        ].map((x, i) => (
          <div key={x.l} className={cn('bg-surface px-4 py-4', i === 4 && 'col-span-2 lg:col-span-1')}>
            <div className="label-mono">{x.l}</div>
            <div className="mt-1 text-xl font-medium tracking-tight"><AnimatedNumber value={x.v} format={x.f} /></div>
            {'d' in x && x.d !== undefined && <Delta value={x.d} invert={x.inv} suffix={x.s} />}
          </div>
        ))}
      </div>

      <Reveal className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div data-reveal className="lg:col-span-12">
          <Panel eyebrow="Cash flow + forecast" title="Income, expenses and net, with a 3-month projection">
            <CashflowChart data={a.cashflow} height={320} />
            <p className="mt-2 text-xs text-fg-4">Forecast is a recency-weighted average of completed months (hatched bars). It’s a guide, not a guarantee.</p>
          </Panel>
        </div>

        <div data-reveal className="lg:col-span-6">
          <Panel className="h-full" eyebrow="Pace" title="Cumulative spending: this month vs last" actions={<span className="flex gap-3 text-xs text-fg-3"><span className="flex items-center gap-1.5"><span className="h-[3px] w-3 rounded bg-accent" />This</span><span className="flex items-center gap-1.5"><span className="h-[3px] w-3 rounded bg-fg-4" />Last</span></span>}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={a.pace} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" {...AXIS} interval={4} />
                <YAxis {...AXIS} width={58} tickFormatter={(v: number) => compact(v)} />
                <Tooltip animationDuration={200} content={(p) => <ChartTooltip {...(p as TooltipProps<number, string>)} valueFormat={(v) => f0(v)} labelFormat={(l) => `Day ${l}`} />} />
                <Line type="monotone" dataKey="lastMonth" name="Last month" stroke="var(--fg-4)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={!reduced} animationDuration={1200} connectNulls />
                <Line type="monotone" dataKey="thisMonth" name="This month" stroke="var(--accent)" strokeWidth={2.2} dot={false} isAnimationActive={!reduced} animationDuration={1500} activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>
        </div>
        <div data-reveal className="lg:col-span-6">
          <Panel className="h-full" eyebrow="Discipline" title="Savings rate by month" actions={a.best && <span className="text-xs text-fg-3">Best: {monthLabel(a.best.month, 'short', true)} · <span className="text-pos num">{a.best.savingsRate}%</span></span>}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={a.rate} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" {...AXIS} tickFormatter={(m: string) => monthLabel(m)} minTickGap={10} />
                <YAxis {...AXIS} width={40} tickFormatter={(v: number) => `${v}%`} />
                <ReferenceLine y={20} stroke="var(--pos)" strokeDasharray="3 4" strokeOpacity={0.5} label={{ value: '20% TARGET', position: 'insideTopRight', fill: 'var(--fg-4)', fontSize: 9.5, fontFamily: 'var(--font-mono)' }} />
                <ReferenceLine y={0} stroke="var(--line-strong)" />
                <Tooltip animationDuration={200} content={(p) => <ChartTooltip {...(p as TooltipProps<number, string>)} valueFormat={(v) => `${v}%`} labelFormat={(m) => monthLabel(m, 'long', true)} />} />
                <Line type="monotone" dataKey="rate" name="Savings rate" stroke="var(--pos)" strokeWidth={2} dot={{ r: 3, fill: 'var(--surface)', strokeWidth: 1.5 }} isAnimationActive={!reduced} animationDuration={1400} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>
        </div>

        <div data-reveal className="lg:col-span-6">
          <Panel className="h-full" eyebrow="Spending breakdown" title="Expenses by category">
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
              <Donut slices={a.expSlices.map((s) => ({ id: s.categoryId, label: s.name, value: s.amount, color: s.color }))} centerLabel="Spent" centerValue={compact(a.cur.expense)} active={activeExp} onActive={setActiveExp} size={190} />
              <div className="w-full flex-1"><RankBars items={a.expSlices.slice(0, 6).map((s) => ({ id: s.categoryId, label: s.name, value: s.amount, color: s.color, meta: `${s.share}%` }))} active={activeExp} onActive={setActiveExp} valueFormat={f0} /></div>
            </div>
          </Panel>
        </div>
        <div data-reveal className="lg:col-span-6">
          <Panel className="h-full" eyebrow="Income breakdown" title="Income by source">
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
              <Donut slices={a.incSlices.map((s) => ({ id: s.categoryId, label: s.name, value: s.amount, color: s.color }))} centerLabel="Earned" centerValue={compact(a.cur.income)} active={activeInc} onActive={setActiveInc} size={190} />
              <div className="w-full flex-1"><RankBars items={a.incSlices.map((s) => ({ id: s.categoryId, label: s.name, value: s.amount, color: s.color, meta: `${s.share}%` }))} active={activeInc} onActive={setActiveInc} valueFormat={f0} /></div>
            </div>
          </Panel>
        </div>

        <div data-reveal className="lg:col-span-12">
          <Panel eyebrow="Category comparison" title="Spending intensity by category, last 12 months">
            <Heatmap rows={a.heat} months={a.hmMonths} />
          </Panel>
        </div>

        <div data-reveal className="lg:col-span-7">
          <Panel className="h-full" eyebrow="Annual comparison" title={`${a.y} vs ${a.y - 1}: monthly spending`}>
            <MonthBars data={a.annual} keys={[{ key: 'lastYear', name: String(a.y - 1), color: 'var(--surface-3)' }, { key: 'thisYear', name: String(a.y), color: 'var(--neg)' }]} height={250} />
          </Panel>
        </div>
        <div data-reveal className="lg:col-span-5">
          <Panel className="h-full" eyebrow="Patterns" title="Discretionary spend by weekday">
            <div className="flex h-[200px] items-end gap-2.5">
              {a.wd.map((w, i) => (
                <div key={w.day} className="flex h-full flex-1 flex-col items-center justify-end gap-2" title={`${w.day}: ${f0(w.amount)} over ${w.count} purchases`}>
                  <span className="text-[10px] text-fg-4 num">{compact(w.amount)}</span>
                  <motion.div
                    className={cn('w-full rounded-t-[6px]', w.amount === wdMax ? 'bg-accent' : 'bg-surface-3')}
                    initial={{ height: 0 }}
                    whileInView={{ height: `${(w.amount / wdMax) * 78}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.9, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                  />
                  <span className="label-mono !text-[10px]">{w.day}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-fg-3">Excludes recurring bills. The highlighted day is where most discretionary spending happens.</p>
          </Panel>
        </div>

        <div data-reveal className="lg:col-span-12">
          <Panel eyebrow="Highest expenses" title="Largest single purchases in range">
            <RankBars
              items={a.largest.map((t) => {
                const c = t.categoryId ? catMap.get(t.categoryId) : undefined;
                return { id: t.id, label: t.title, value: t.amount, color: c?.color ?? 'var(--fg-3)', meta: `${c?.name ?? ''} · ${percent(t.amount, a.cur.expense)}%` };
              })}
              valueFormat={(v) => fmt(v)}
            />
          </Panel>
        </div>
      </Reveal>
    </>
  );
}
