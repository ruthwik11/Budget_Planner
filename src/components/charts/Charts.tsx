import { useId, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
  type TooltipProps,
} from 'recharts';
import { useMoney } from '@/hooks/useMoney';
import { useReducedMotion } from '@/hooks/useMotionPrefs';
import { monthLabel } from '@/utils/dates';
import { cn } from '@/utils/cn';
import { EASE } from '@/constants/motion';

/** Shared Recharts props so every chart moves and reads the same way. */
function useChartAnim() {
  const reduced = useReducedMotion();
  return { isAnimationActive: !reduced, animationDuration: 1100, animationEasing: 'ease-out' as const };
}

const AXIS = { axisLine: false, tickLine: false, tickMargin: 10 } as const;

// ───────────────────────── tooltip ─────────────────────────

export function ChartTooltip({
  active, payload, label, labelFormat, valueFormat, hideZero,
}: TooltipProps<number, string> & { labelFormat?: (l: string) => string; valueFormat: (v: number) => string; hideZero?: boolean }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => !hideZero || p.value);
  return (
    <div className="min-w-[170px] rounded-[12px] border border-line-strong bg-surface-2/95 px-3 py-2.5 shadow-lg backdrop-blur-md">
      <div className="label-mono mb-1.5">{labelFormat ? labelFormat(String(label)) : label}</div>
      <div className="flex flex-col gap-1">
        {rows.map((p) => (
          <div key={String(p.dataKey)} className="flex items-center justify-between gap-5 text-xs">
            <span className="flex items-center gap-2 text-fg-2">
              <span className="size-2 rounded-[2px]" style={{ background: (p.payload?.[`${p.dataKey}Color`] as string) ?? p.color }} />
              {p.name}
            </span>
            <span className="num font-medium text-fg">{valueFormat(Number(p.value))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Toggleable legend chips — clicking filters series out of the chart. */
export function LegendChips({
  items, hidden, onToggle,
}: { items: { key: string; label: string; color: string; dashed?: boolean }[]; hidden: string[]; onToggle: (k: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Chart series">
      {items.map((it) => {
        const off = hidden.includes(it.key);
        return (
          <button
            key={it.key}
            type="button"
            aria-pressed={!off}
            onClick={() => onToggle(it.key)}
            className={cn(
              'flex h-7 items-center gap-1.5 rounded-[7px] px-2 text-xs transition-all duration-200',
              off ? 'text-fg-4 line-through decoration-fg-4/60' : 'text-fg-2 hover:bg-surface-2',
            )}
          >
            <span
              className="h-[3px] w-3 rounded-full transition-opacity"
              style={{
                background: it.dashed ? `repeating-linear-gradient(90deg, ${it.color} 0 3px, transparent 3px 5px)` : it.color,
                opacity: off ? 0.3 : 1,
              }}
            />
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

// ───────────────────────── cash flow ─────────────────────────

export interface CashflowDatum {
  month: string;
  income: number;
  expense: number;
  net: number;
  forecast?: boolean;
}

/**
 * Income as a lit area, expenses as solid bars, net as a dashed line.
 * Forecast months render as hollow bars to the right of a "today" reference line.
 */
export function CashflowChart({ data, height = 280, hidden = [] }: { data: CashflowDatum[]; height?: number; hidden?: string[] }) {
  const { compact, fmt } = useMoney();
  const anim = useChartAnim();
  const gid = useId().replace(/:/g, '');
  const rows = data;
  const firstForecast = rows.find((r) => r.forecast)?.month;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap="28%">
        <defs>
          <linearGradient id={`inc-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
          </linearGradient>
          <pattern id={`hatch-${gid}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="5" height="5" fill="transparent" />
            <line x1="0" y1="0" x2="0" y2="5" stroke="var(--neg)" strokeWidth="1.4" strokeOpacity="0.55" />
          </pattern>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="0" />
        <XAxis dataKey="month" {...AXIS} tickFormatter={(m: string) => monthLabel(m)} interval="preserveStartEnd" minTickGap={8} />
        <YAxis {...AXIS} width={58} tickFormatter={(v: number) => compact(Math.round(v))} />
        <Tooltip
          cursor={{ fill: 'var(--line)', radius: 6 }}
          animationDuration={220}
          animationEasing="ease-out"
          content={(p) => (
            <ChartTooltip
              {...(p as TooltipProps<number, string>)}
              valueFormat={(v) => fmt(Math.round(v), { decimals: false })}
              labelFormat={(m) => `${monthLabel(m, 'long', true)}${rows.find((r) => r.month === m)?.forecast ? ' · forecast' : ''}`}
            />
          )}
        />
        {firstForecast && (
          <ReferenceLine x={firstForecast} stroke="var(--line-strong)" strokeDasharray="3 4" label={{ value: 'FORECAST', position: 'insideTopLeft', fill: 'var(--fg-4)', fontSize: 9.5, fontFamily: 'var(--font-mono)' }} />
        )}
        {!hidden.includes('income') && (
          <Area type="monotone" dataKey="income" name="Income" stroke="var(--accent)" strokeWidth={2} fill={`url(#inc-${gid})`} {...anim} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)', fill: 'var(--accent)' }} />
        )}
        {!hidden.includes('expense') && (
          <Bar dataKey="expense" name="Expenses" radius={[5, 5, 2, 2]} maxBarSize={26} {...anim} animationDuration={900}>
            {rows.map((r) => (
              <Cell key={r.month} fill={r.forecast ? `url(#hatch-${gid})` : 'var(--neg)'} fillOpacity={r.forecast ? 1 : 0.82} stroke={r.forecast ? 'var(--neg)' : 'none'} strokeOpacity={0.5} />
            ))}
          </Bar>
        )}
        {!hidden.includes('net') && (
          <Line type="monotone" dataKey="net" name="Net" stroke="var(--fg-2)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} {...anim} animationDuration={1400} />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ───────────────────────── area (savings growth / balance) ─────────────────────────

export function GrowthArea({
  data, dataKey, height = 200, color = 'var(--accent)', xKey = 'month', xFormat = (m: string) => monthLabel(m), name = 'Value',
}: { data: Record<string, number | string>[]; dataKey: string; height?: number; color?: string; xKey?: string; xFormat?: (s: string) => string; name?: string }) {
  const { compact, fmt } = useMoney();
  const anim = useChartAnim();
  const gid = useId().replace(/:/g, '');
  const rows = data;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={rows} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id={`g-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={xKey} {...AXIS} tickFormatter={xFormat} minTickGap={16} />
        <YAxis {...AXIS} width={58} tickFormatter={(v: number) => compact(Math.round(v))} />
        <Tooltip
          cursor={{ stroke: 'var(--line-strong)', strokeDasharray: '3 3' }}
          animationDuration={200}
          content={(p) => <ChartTooltip {...(p as TooltipProps<number, string>)} valueFormat={(v) => fmt(Math.round(v))} labelFormat={xFormat} />}
        />
        <Area type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={2} fill={`url(#g-${gid})`} dot={false} {...anim} activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)', fill: color }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ───────────────────────── bars ─────────────────────────

export function MonthBars({
  data, keys, height = 220, stacked,
}: { data: Record<string, number | string>[]; keys: { key: string; name: string; color: string }[]; height?: number; stacked?: boolean }) {
  const { compact, fmt } = useMoney();
  const anim = useChartAnim();
  const rows = data;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barGap={3} barCategoryGap="24%">
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" {...AXIS} tickFormatter={(m: string) => monthLabel(m)} minTickGap={6} />
        <YAxis {...AXIS} width={58} tickFormatter={(v: number) => compact(Math.round(v))} />
        <Tooltip
          cursor={{ fill: 'var(--line)', radius: 6 }}
          animationDuration={200}
          content={(p) => <ChartTooltip {...(p as TooltipProps<number, string>)} hideZero valueFormat={(v) => fmt(Math.round(v), { decimals: false })} labelFormat={(m) => monthLabel(m, 'long', true)} />}
        />
        {keys.map((k, i) => (
          <Bar
            key={k.key}
            dataKey={k.key}
            name={k.name}
            stackId={stacked ? 's' : undefined}
            fill={k.color}
            radius={stacked ? (i === keys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]) : [4, 4, 1, 1]}
            maxBarSize={stacked ? 30 : 18}
            {...anim}
            animationBegin={i * 90}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ───────────────────────── donut (custom SVG) ─────────────────────────

export interface DonutSlice {
  id: string;
  label: string;
  value: number; // minor
  color: string;
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

/**
 * Hand-built donut: each segment is a stroked arc that draws in sequence
 * (pathLength), with gaps between segments. Hover/focus lifts the segment and
 * swaps the centre readout. Fully keyboard accessible via the paired legend.
 */
export function Donut({
  slices, size = 220, thickness = 18, centerLabel, centerValue, active, onActive,
}: {
  slices: DonutSlice[]; size?: number; thickness?: number; centerLabel: string; centerValue: ReactNode;
  active?: string | null; onActive?: (id: string | null) => void;
}) {
  const [hoverLocal, setHoverLocal] = useState<string | null>(null);
  const hover = active !== undefined ? active : hoverLocal;
  const setHover = onActive ?? setHoverLocal;
  const reduced = useReducedMotion();
  const { fmt, compact } = useMoney();
  // small rings get compact figures so the centre readout never collides with the arc
  const centerFmt = (v: number) => (size < 230 ? compact(v) : fmt(v, { decimals: false }));
  const total = slices.reduce((s, x) => s + x.value, 0);
  const cx = size / 2;
  const r = (size - thickness) / 2 - 4;
  const gap = slices.length > 1 ? 0.035 : 0;
  let a = -Math.PI / 2;
  const segs = slices.map((s, i) => {
    const sweep = total ? (s.value / total) * Math.PI * 2 : 0;
    const seg = { ...s, a0: a + gap / 2, a1: a + Math.max(sweep - gap / 2, gap / 2 + 0.001), i, mid: a + sweep / 2 };
    a += sweep;
    return seg;
  });
  const hovered = segs.find((s) => s.id === hover);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={`${centerLabel} breakdown`}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={thickness} opacity={0.6} />
        {segs.map((s) => {
          const lift = hover === s.id ? 5 : 0;
          return (
            <motion.path
              key={s.id}
              d={arcPath(cx, cx, r, s.a0, s.a1)}
              fill="none"
              stroke={s.color}
              strokeWidth={hover === s.id ? thickness + 4 : thickness}
              strokeLinecap="butt"
              initial={reduced ? false : { pathLength: 0, opacity: 0 }}
              animate={{
                pathLength: 1,
                opacity: hover && hover !== s.id ? 0.28 : 1,
                x: Math.cos(s.mid) * lift,
                y: Math.sin(s.mid) * lift,
              }}
              transition={{
                pathLength: { duration: 0.9, ease: EASE.outQuint, delay: 0.25 + s.i * 0.08 },
                opacity: { duration: 0.25 },
                x: { type: 'spring', stiffness: 400, damping: 28 },
                y: { type: 'spring', stiffness: 400, damping: 28 },
                strokeWidth: { duration: 0.2 },
              }}
              onPointerEnter={() => setHover(s.id)}
              onPointerLeave={() => setHover(null)}
              style={{ cursor: 'pointer' }}
            />
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={hovered?.id ?? 'total'}
            initial={{ opacity: 0, y: 6, filter: 'blur(3px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -6, filter: 'blur(3px)' }}
            transition={{ duration: 0.2 }}
            className="flex max-w-[70%] flex-col items-center"
          >
            <span className="label-mono truncate">{hovered ? hovered.label : centerLabel}</span>
            <span className="mt-1 text-xl font-medium tracking-tight num">
              {hovered ? centerFmt(hovered.value) : centerValue}
            </span>
            {hovered && <span className="mt-0.5 text-xs text-fg-3 num">{total ? ((hovered.value / total) * 100).toFixed(1) : 0}%</span>}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Ranked horizontal bars (category list) that pair with the donut. */
export function RankBars({
  items, active, onActive, max, valueFormat,
}: {
  items: { id: string; label: string; value: number; color: string; meta?: ReactNode; icon?: ReactNode }[];
  active?: string | null; onActive?: (id: string | null) => void; max?: number; valueFormat: (v: number) => string;
}) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="flex flex-col">
      {items.map((it, idx) => (
        <li key={it.id}>
          <button
            type="button"
            onPointerEnter={() => onActive?.(it.id)}
            onPointerLeave={() => onActive?.(null)}
            onFocus={() => onActive?.(it.id)}
            onBlur={() => onActive?.(null)}
            className={cn(
              'group grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[9px] px-2 py-2 text-left transition-colors',
              active === it.id ? 'bg-surface-2' : 'hover:bg-surface-2',
              active && active !== it.id && 'opacity-55',
            )}
          >
            {it.icon ?? <span className="size-2.5 rounded-[3px]" style={{ background: it.color }} />}
            <span className="min-w-0">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm">{it.label}</span>
                {it.meta && <span className="shrink-0 text-2xs text-fg-4 num">{it.meta}</span>}
              </span>
              <span className="mt-1.5 block h-[3px] overflow-hidden rounded-full bg-surface-3">
                <motion.span
                  className="block h-full rounded-full"
                  style={{ background: it.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(it.value / top) * 100}%` }}
                  transition={{ duration: 1, ease: EASE.outQuint, delay: 0.2 + idx * 0.05 }}
                />
              </span>
            </span>
            <span className="text-sm font-medium num">{valueFormat(it.value)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Tiny inline trend line for KPI tiles. Draws itself in. */
export function Sparkline({ values, color = 'var(--accent)', width = 96, height = 28 }: { values: number[]; color?: string; width?: number; height?: number }) {
  const reduced = useReducedMotion();
  if (values.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, height - 3 - ((v - min) / span) * (height - 6)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} aria-hidden className="overflow-visible">
      <motion.path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.3, ease: EASE.inOut, delay: 0.4 }}
      />
      <motion.circle cx={last[0]} cy={last[1]} r={2.5} fill={color} initial={reduced ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.5, type: 'spring', stiffness: 500, damping: 20 }} />
    </svg>
  );
}
