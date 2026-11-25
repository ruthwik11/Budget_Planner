import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/utils/cn';
import { EASE, SPRING } from '@/constants/motion';

/** Segmented control with a shared-layout indicator that glides between options. */
export function Segmented<T extends string>({
  value, onChange, options, size = 'md', className, label,
}: {
  value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; tone?: string }[];
  size?: 'sm' | 'md'; className?: string; label: string;
}) {
  const id = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('relative inline-flex rounded-[10px] border border-line bg-surface-2 p-[3px]', className)}
      onKeyDown={(e) => {
        const i = options.findIndex((o) => o.value === value);
        if (e.key === 'ArrowRight') onChange(options[(i + 1) % options.length].value);
        if (e.key === 'ArrowLeft') onChange(options[(i - 1 + options.length) % options.length].value);
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative z-[1] flex-1 whitespace-nowrap rounded-[7px] font-medium transition-colors duration-200',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3.5 text-sm',
              active ? 'text-fg' : 'text-fg-3 hover:text-fg-2',
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={SPRING.nav}
                className="absolute inset-0 -z-[1] rounded-[7px] border border-line-strong bg-surface-3 shadow-sm"
                style={o.tone ? { boxShadow: `inset 0 -2px 0 ${o.tone}` } : undefined}
              />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

type Tone = 'neutral' | 'pos' | 'neg' | 'warn' | 'info' | 'accent';
const tones: Record<Tone, string> = {
  neutral: 'bg-surface-3 text-fg-2 border-line',
  pos: 'bg-pos-soft text-pos border-transparent',
  neg: 'bg-neg-soft text-neg border-transparent',
  warn: 'bg-warn-soft text-warn border-transparent',
  info: 'bg-info-soft text-info border-transparent',
  accent: 'bg-accent-soft text-accent-fg border-transparent',
};
export function Badge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn('inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-[6px] border px-2 text-2xs font-medium num', tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/**
 * Progress bar that animates from its previous value (not from zero) on change.
 * Over-limit portion renders as a hatched overflow segment rather than just turning red.
 */
export function Progress({
  value, color, className, height = 6, label, animateIn = true,
}: { value: number; color?: string; className?: string; height?: number; label: string; animateIn?: boolean }) {
  const clamped = Math.max(0, Math.min(100, value));
  const over = value > 100;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('relative w-full overflow-hidden rounded-full bg-surface-3', className)}
      style={{ height }}
    >
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ background: over ? 'var(--neg)' : color ?? 'var(--accent)' }}
        initial={animateIn ? { width: 0 } : false}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 1.1, ease: EASE.outQuint, delay: animateIn ? 0.1 : 0 }}
      />
      {over && (
        <div
          className="absolute inset-0 opacity-50"
          style={{ background: 'repeating-linear-gradient(-45deg, transparent 0 3px, rgb(0 0 0 / .35) 3px 5px)' }}
        />
      )}
    </div>
  );
}

/** Circular progress (goals). Stroke draws in with the same quint ease as bars. */
export function Ring({
  value, size = 56, stroke = 5, color = 'var(--accent)', children, label,
}: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode; label: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v / 100) }}
          transition={{ duration: 1.4, ease: EASE.outQuint, delay: 0.15 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

/** Accessible dropdown menu with roving focus. */
export function Menu({
  trigger, items, align = 'end',
}: {
  trigger: (p: { onClick: () => void; 'aria-expanded': boolean; 'aria-haspopup': 'menu' }) => ReactNode;
  items: ({ label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean } | 'sep')[];
  align?: 'start' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const els = [...(ref.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])];
        const i = els.indexOf(document.activeElement as HTMLElement);
        els[(i + (e.key === 'ArrowDown' ? 1 : -1) + els.length) % els.length]?.focus();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    setTimeout(() => ref.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus(), 30);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      {trigger({ onClick: () => setOpen((v) => !v), 'aria-expanded': open, 'aria-haspopup': 'menu' })}
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.18, ease: EASE.out }}
            style={{ transformOrigin: align === 'end' ? 'top right' : 'top left' }}
            className={cn(
              'absolute top-full z-50 mt-1.5 min-w-[190px] rounded-[12px] border border-line-strong bg-surface-2 p-1 shadow-lg',
              align === 'end' ? 'right-0' : 'left-0',
            )}
          >
            {items.map((it, i) =>
              it === 'sep' ? (
                <div key={i} className="my-1 h-px bg-line" />
              ) : (
                <button
                  key={i}
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    it.onSelect();
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-sm outline-none transition-colors',
                    it.danger ? 'text-neg hover:bg-neg-soft focus:bg-neg-soft' : 'text-fg-2 hover:bg-surface-3 hover:text-fg focus:bg-surface-3 focus:text-fg',
                  )}
                >
                  {it.icon}
                  {it.label}
                </button>
              ),
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-grid h-5 min-w-5 place-items-center rounded-[5px] border border-line-strong bg-surface-3 px-1 font-mono text-[10px] text-fg-3">
      {children}
    </kbd>
  );
}

export function Empty({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icon && <div className="grid size-11 place-items-center rounded-[12px] border border-line bg-surface-2 text-fg-3">{icon}</div>}
      <div>
        <p className="font-medium">{title}</p>
        {body && <p className="mx-auto mt-1 max-w-sm text-sm text-fg-3">{body}</p>}
      </div>
      {action}
    </div>
  );
}

/** Panel = the one container primitive. Section header uses mono label + optional actions. */
export function Panel({
  title, eyebrow, actions, children, className, bodyClassName, as: As = 'section', id,
}: {
  title?: ReactNode; eyebrow?: string; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string;
  as?: 'section' | 'div' | 'article'; id?: string;
}) {
  const hid = useId();
  return (
    <As className={cn('panel flex flex-col', className)} aria-labelledby={title ? hid : undefined} id={id}>
      {(title || actions) && (
        <header className="flex min-h-[52px] flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 pt-4">
          <div className="min-w-0 flex-1 basis-[12rem]">
            {eyebrow && <div className="label-mono mb-0.5">{eyebrow}</div>}
            {title && (
              <h2 id={hid} className="text-balance text-[0.9375rem] font-medium leading-snug tracking-tight">
                {title}
              </h2>
            )}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-1">{actions}</div>}
        </header>
      )}
      <div className={cn('flex-1 px-5 pb-5 pt-3', bodyClassName)}>{children}</div>
    </As>
  );
}

/** Small change indicator: ▲ 12.4% / ▼ 3.1% — `invert` for metrics where down is good (spending). */
export function Delta({ value, invert, className, suffix = '%' }: { value: number | null; invert?: boolean; className?: string; suffix?: string }) {
  if (value === null) return <span className={cn('text-2xs text-fg-4 num', className)}>new</span>;
  const up = value > 0;
  const good = value === 0 ? null : invert ? !up : up;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium num',
        good === null ? 'text-fg-3' : good ? 'text-pos' : 'text-neg',
        className,
      )}
    >
      <svg viewBox="0 0 8 8" className={cn('size-2', !up && 'rotate-180', value === 0 && 'hidden')} aria-hidden>
        <path d="M4 1 7 6H1z" fill="currentColor" />
      </svg>
      {Math.abs(value).toFixed(1)}
      {suffix}
    </span>
  );
}
