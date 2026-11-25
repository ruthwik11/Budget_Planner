import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import { PageHeader } from '@/components/layout/PageHeader';
import { BandHero } from '@/components/fx/BandHero';
import { Badge, Delta, Panel } from '@/components/ui/Controls';
import { Button } from '@/components/ui/Button';
import { CategoryGlyph } from '@/components/ui/Icon';
import { AnimatedNumber } from '@/components/animations/Motion';
import { ChartTooltip } from '@/components/charts/Charts';
import { useUserData } from '@/hooks/useData';
import { useMoney } from '@/hooks/useMoney';
import { useReducedMotion } from '@/hooks/useMotionPrefs';
import { useFinance } from '@/store/finance';
import { byCategory, goalProgress, totalBalance, totals } from '@/lib/finance';
import { debtBalance } from '@/lib/debts';
import { emptyScenario, monthlyNet, monthsToTarget, project, type Baseline, type Scenario } from '@/lib/simulate';
import { addDays, addMonths, monthKey, monthLabel, startOfMonth, todayISO } from '@/utils/dates';
import { sumMinor } from '@/utils/money';
import { cn } from '@/utils/cn';

const MONTHS = 24;

function Slider({ label, value, min, max, step, onChange, display, id }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; display: string; id: string }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm text-fg-2">{label}</label>
        <span className="text-sm font-medium num">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-[var(--accent)]"
        style={{ background: `linear-gradient(90deg, var(--accent) ${pct}%, var(--surface-3) ${pct}%)` }}
      />
    </div>
  );
}

export default function WhatIfPage() {
  const { txs, cats, accts, gls, catMap } = useUserData();
  const userId = useFinance((s) => s.sessionUserId);
  const debts = useFinance((s) => s.debts);
  const { fmt, compact, toDisplay, fromDisplay } = useMoney();
  const reduced = useReducedMotion();
  const today = todayISO();
  const f0 = (n: number) => fmt(n, { decimals: false });
  const [s, setS] = useState<Scenario>(emptyScenario);
  const [preset, setPreset] = useState<string | null>(null);

  // baseline: average of the last 6 complete months
  const base: Baseline = useMemo(() => {
    const range = { from: addMonths(startOfMonth(today), -6, 1), to: addDays(startOfMonth(today), -1) };
    const t = totals(txs, range);
    const exp: Record<string, number> = {};
    byCategory(txs, cats, 'expense', range).forEach((c) => {
      if (c.name !== 'Debt payments') exp[c.categoryId] = Math.round(c.amount / 6);
    });
    const myDebts = debts.filter((d) => d.userId === userId && debtBalance(d) > 0);
    return { balance: totalBalance(accts, txs, today), income: Math.round(t.income / 6), expenses: exp, debtPayments: sumMinor(myDebts.map((d) => d.payment)) };
  }, [txs, cats, accts, debts, userId, today]);

  const topCats = Object.entries(base.expenses).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const pts = useMemo(() => project(base, s, MONTHS, today), [base, s, today]);
  const end = pts[pts.length - 1];
  const netBase = monthlyNet(base, null, MONTHS - 1);
  const netScen = monthlyNet(base, s, MONTHS - 1);
  const diff = end.scenario - end.baseline;
  const set = (p: Partial<Scenario>) => {
    setPreset(null);
    setS({ ...s, ...p });
  };
  const catIdByName = (n: string) => cats.find((c) => c.name === n)?.id;

  const PRESETS: { id: string; label: string; apply: () => Scenario }[] = [
    { id: 'raise', label: '15% raise in 3 months', apply: () => ({ ...emptyScenario, incomeChangePct: 15, incomeFromMonth: 3 }) },
    { id: 'frugal', label: 'Cut dining & shopping by 40%', apply: () => ({ ...emptyScenario, cuts: Object.fromEntries(['Dining out', 'Shopping', 'Entertainment'].map((n) => [catIdByName(n) ?? n, 40])) }) },
    { id: 'car', label: 'Buy a car next spring', apply: () => ({ ...emptyScenario, oneOff: { amount: fromDisplay(250000_00), month: 4 }, extraMonthlySpend: fromDisplay(16500_00) }) },
    { id: 'side', label: 'Freelance ₹20k a month', apply: () => ({ ...emptyScenario, sideIncome: fromDisplay(20000_00) }) },
    { id: 'gap', label: '3-month job gap', apply: () => ({ ...emptyScenario, incomePause: { from: 1, months: 3 } }) },
  ];

  // goals funded in deadline order from each month's surplus
  const goalPlan = (net: number) => {
    let cum = 0;
    return [...gls]
      .map((g) => ({ g, rem: goalProgress(g, today).remaining }))
      .filter((x) => x.rem > 0)
      .sort((a, b) => (a.g.deadline ?? '9999').localeCompare(b.g.deadline ?? '9999'))
      .map((x) => {
        cum += x.rem;
        const m = monthsToTarget(cum, net);
        return { ...x, months: m };
      });
  };
  const gBase = goalPlan(netBase);
  const gScen = goalPlan(netScen);
  const chartData = pts;

  return (
    <>
      <PageHeader
        title="What-if"
        description="Play out a decision before you make it. Start from your real six-month averages, change something, and watch the next two years redraw."
        actions={<Button variant="ghost" icon={<RotateCcw size={14} />} onClick={() => { setS(emptyScenario); setPreset(null); }}>Reset</Button>}
      />
      <BandHero
        eyebrow={`Balance in ${MONTHS} months · ${monthLabel(end.month, 'long', true)}`}
        figure={<AnimatedNumber value={end.scenario} format={f0} duration={0.9} />}
        caption={diff === 0 ? 'Same as your current path. Move a slider or pick a scenario below.' : <>That’s <b>{f0(Math.abs(diff))}</b> {diff > 0 ? 'more' : 'less'} than if nothing changes ({f0(end.baseline)}).</>}
        stats={[
          { label: 'Net / month now', value: f0(netBase), hint: '6-month average incl. EMIs' },
          { label: 'Net / month then', value: <span className={netScen < netBase ? 'opacity-90' : ''}>{f0(netScen)}</span> },
          { label: 'Avg income', value: f0(base.income) },
          { label: 'Avg spending', value: f0(sumMinor(Object.values(base.expenses)) + base.debtPayments) },
        ]}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <motion.button
            key={p.id}
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              setS(p.apply());
              setPreset(p.id);
            }}
            aria-pressed={preset === p.id}
            data-cursor="Try"
            className={cn('rounded-full border px-4 py-2 text-sm transition-colors', preset === p.id ? 'border-transparent bg-accent text-accent-ink' : 'border-line-strong text-fg-2 hover:border-[var(--accent-line)] hover:text-fg')}
          >
            {p.label}
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel className="xl:col-span-4 xl:self-start" eyebrow="Levers" title="Change the inputs">
          <div className="flex flex-col gap-5">
            <Slider id="inc" label="Income change" min={-50} max={50} step={1} value={s.incomeChangePct} onChange={(v) => set({ incomeChangePct: v })} display={`${s.incomeChangePct > 0 ? '+' : ''}${s.incomeChangePct}%`} />
            <Slider id="from" label="…starting in month" min={0} max={MONTHS - 1} step={1} value={s.incomeFromMonth} onChange={(v) => set({ incomeFromMonth: v })} display={s.incomeFromMonth === 0 ? 'now' : monthLabel(monthKey(addMonths(startOfMonth(today), s.incomeFromMonth + 1, 1)), 'short', true)} />
            <Slider id="side" label="Side income / month" min={0} max={toDisplay(10000000)} step={100000} value={toDisplay(s.sideIncome)} onChange={(v) => set({ sideIncome: fromDisplay(v) })} display={f0(s.sideIncome)} />
            <Slider id="cost" label="New monthly cost (EMI, rent…)" min={0} max={toDisplay(10000000)} step={50000} value={toDisplay(s.extraMonthlySpend)} onChange={(v) => set({ extraMonthlySpend: fromDisplay(v) })} display={f0(s.extraMonthlySpend)} />
            <Slider id="oneoff" label="One big purchase" min={0} max={toDisplay(100000000)} step={1000000} value={toDisplay(s.oneOff?.amount ?? 0)} onChange={(v) => set({ oneOff: v ? { amount: fromDisplay(v), month: s.oneOff?.month ?? 3 } : null })} display={f0(s.oneOff?.amount ?? 0)} />
            {s.oneOff && <Slider id="oneoffm" label="…in month" min={0} max={MONTHS - 1} step={1} value={s.oneOff.month} onChange={(v) => set({ oneOff: { ...s.oneOff!, month: v } })} display={monthLabel(monthKey(addMonths(startOfMonth(today), s.oneOff.month + 1, 1)), 'short', true)} />}
            <div className="border-t border-line pt-4">
              <div className="label-mono mb-3">Trim spending</div>
              <div className="flex flex-col gap-4">
                {topCats.map(([id, amt]) => {
                  const c = catMap.get(id);
                  const cut = s.cuts[id] ?? 0;
                  return (
                    <div key={id} className="flex items-center gap-3">
                      <CategoryGlyph icon={c?.icon} color={c?.color} size={26} />
                      <div className="flex-1">
                        <Slider id={`cut-${id}`} label={`${c?.name ?? 'Category'} · ${f0(amt)}/mo`} min={0} max={100} step={5} value={cut} onChange={(v) => set({ cuts: { ...s.cuts, [id]: v } })} display={cut ? `−${cut}%` : '—'} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Panel>
        <div className="flex flex-col gap-4 xl:col-span-8">
          <Panel eyebrow="Projection" title="Your balance, next 24 months" actions={<span className="flex gap-3 text-xs text-fg-3"><span className="flex items-center gap-1.5"><span className="h-[3px] w-3 rounded bg-accent" />Scenario</span><span className="flex items-center gap-1.5"><span className="h-[3px] w-3 rounded bg-fg-4" />No change</span></span>}>
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart data={chartData} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="wi-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tickMargin={10} tickFormatter={(m: string) => monthLabel(m, 'short', true)} minTickGap={20} />
                <YAxis axisLine={false} tickLine={false} width={60} tickFormatter={(v: number) => compact(v)} />
                <Tooltip animationDuration={150} content={(p) => <ChartTooltip {...(p as TooltipProps<number, string>)} valueFormat={(v) => f0(v)} labelFormat={(m) => monthLabel(m, 'long', true)} />} />
                {s.oneOff && <ReferenceLine x={chartData[s.oneOff.month]?.month} stroke="var(--neg)" strokeDasharray="3 4" label={{ value: 'PURCHASE', position: 'insideTopLeft', fill: 'var(--neg)', fontSize: 9.5, fontFamily: 'var(--font-mono)' }} />}
                <ReferenceLine y={0} stroke="var(--line-strong)" />
                <Line type="monotone" dataKey="baseline" name="No change" stroke="var(--fg-4)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={!reduced} animationDuration={600} />
                <Area type="monotone" dataKey="scenario" name="Scenario" stroke="var(--accent)" strokeWidth={2.5} fill="url(#wi-fill)" dot={false} isAnimationActive={!reduced} animationDuration={600} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
            {s.incomePause && <p className="mt-2 text-xs text-fg-3">Main income is zero for {s.incomePause.months} months from {monthLabel(chartData[s.incomePause.from]?.month ?? end.month, 'short', true)}; bills continue.</p>}
          </Panel>
          <Panel eyebrow="Goals" title="When your goals get funded" actions={<Badge>funded in deadline order from monthly surplus</Badge>}>
            {gBase.length === 0 ? <p className="text-sm text-fg-3">All goals are already funded.</p> : (
              <ul className="flex flex-col divide-y divide-line">
                {gBase.map((x, i) => {
                  const sc = gScen[i];
                  const when = (m: number | null) => (m === null ? 'never at this rate' : monthLabel(monthKey(addMonths(startOfMonth(today), m, 1)), 'short', true));
                  const delta = x.months !== null && sc.months !== null ? x.months - sc.months : null;
                  return (
                    <li key={x.g.id} className="flex items-center gap-4 py-3">
                      <CategoryGlyph icon={x.g.icon} color={x.g.color} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{x.g.title}</div>
                        <div className="text-xs text-fg-3 num">{f0(x.rem)} to go</div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="text-fg-3 line-through decoration-fg-4/50">{when(x.months)}</div>
                        <div className="font-medium">{when(sc.months)}</div>
                      </div>
                      <div className="w-20 text-right">{delta === null ? null : delta === 0 ? <span className="text-xs text-fg-4">same</span> : <Delta value={-delta} invert suffix=" mo" />}</div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
