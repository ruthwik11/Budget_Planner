/**
 * Cadence motion primitives.
 * GSAP → orchestrated timelines, counters, SplitText, ScrollTrigger, velocity-driven loops.
 * Framer Motion → React presence/layout (see components/ui + layout).
 * Every GSAP effect runs inside gsap.context() scoped to its element and is reverted on unmount.
 */
import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from 'react';
import { gsap, ScrollTrigger, SplitText } from './gsap';
import { reducedMotionNow, useReducedMotion } from '@/hooks/useMotionPrefs';
import { cn } from '@/utils/cn';

// ───────────────────────── AnimatedNumber ─────────────────────────

/**
 * Counts from the previous value to the new one with expo.out (TTM's "settle").
 * Writes textContent directly (no React re-render per frame). Always lands on the
 * exact formatted value. Screen readers get the final value via aria-label.
 */
export function AnimatedNumber({
  value, format, className, duration = 1.6, delay = 0, from,
}: { value: number; format: (n: number) => string; className?: string; duration?: number; delay?: number; from?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef<number | null>(from ?? null);
  const fmtRef = useRef(format);
  fmtRef.current = format;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const start = prev.current ?? 0;
    prev.current = value;
    if (reducedMotionNow() || start === value) {
      el.textContent = fmtRef.current(value);
      return;
    }
    const o = { v: start };
    el.textContent = fmtRef.current(Math.round(start));
    const tw = gsap.to(o, {
      v: value,
      duration,
      delay,
      ease: 'expo.out',
      onUpdate: () => (el.textContent = fmtRef.current(Math.round(o.v))),
      onComplete: () => (el.textContent = fmtRef.current(value)),
    });
    return () => {
      tw.kill();
      el.textContent = fmtRef.current(value);
    };
  }, [value, duration, delay]);

  // keep text in sync if only the formatter changed (currency switch)
  useEffect(() => {
    if (ref.current && !gsap.isTweening(ref.current)) ref.current.textContent = format(value);
  }, [format, value]);

  return (
    <span ref={ref} className={cn('num whitespace-nowrap', className)} aria-label={format(value)}>
      {format(value)}
    </span>
  );
}

// ───────────────────────── SplitReveal ─────────────────────────

/**
 * Words (or chars) rise from beneath a clipped line with a slight rotation,
 * power3.out ~0.9s — the TTM word reveal, tightened for UI pacing.
 */
export function SplitReveal({
  children, as: Tag = 'span', type = 'words', delay = 0, stagger = 0.06, className, trigger = 'mount', style,
}: {
  children: ReactNode; as?: ElementType; type?: 'words' | 'chars' | 'lines'; delay?: number; stagger?: number;
  className?: string; trigger?: 'mount' | 'scroll'; style?: CSSProperties;
}) {
  const ref = useRef<HTMLElement>(null);
  const text = typeof children === 'string' ? children : '';
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reducedMotionNow()) return;
    const ctx = gsap.context(() => {
      const split = SplitText.create(el, {
        type: type === 'lines' ? 'lines' : `lines,${type}`,
        linesClass: 'split-line',
        autoSplit: type === 'lines',
        aria: 'auto',
      });
      const targets = type === 'lines' ? split.lines : type === 'chars' ? split.chars : split.words;
      gsap.set(el, { visibility: 'visible' });
      gsap.from(targets, {
        yPercent: 115,
        rotate: type === 'chars' ? 0 : 3,
        opacity: 0,
        duration: 0.9,
        ease: 'power3.out',
        stagger,
        delay,
        scrollTrigger: trigger === 'scroll' ? { trigger: el, start: 'top 90%', once: true } : undefined,
        onComplete: () => {
          // like TTM's .transformNone: drop compositor layers once settled
          gsap.set(targets, { clearProps: 'transform,opacity' });
        },
      });
    }, el);
    return () => ctx.revert();
  }, [text, type, delay, stagger, trigger]);
  return (
    <Tag ref={ref} className={className} style={style}>
      {children}
    </Tag>
  );
}

// ───────────────────────── Reveal (scroll / mount stagger) ─────────────────────────

/**
 * Staggers children marked [data-reveal] into view as they enter the viewport.
 * Uses IntersectionObserver (not ScrollTrigger positions) so reveals can never
 * go stale when charts resize the page, a route transition is still running, or
 * smooth scrolling owns the scroll position. Items entering together share one
 * staggered tween.
 */
export function Reveal({
  children, className, as: Tag = 'div', y = 24, stagger = 0.07, delay = 0, id,
}: { children: ReactNode; className?: string; as?: ElementType; y?: number; stagger?: number; delay?: number; id?: string }) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reducedMotionNow() || typeof IntersectionObserver === 'undefined') return;
    const items = gsap.utils.toArray<HTMLElement>('[data-reveal]', el);
    if (!items.length) return;
    const ctx = gsap.context(() => gsap.set(items, { y, opacity: 0 }), el);
    const pending = new Set(items);
    const io = new IntersectionObserver(
      (entries) => {
        const batch = entries.filter((e) => e.isIntersecting && pending.has(e.target as HTMLElement)).map((e) => e.target as HTMLElement);
        if (!batch.length) return;
        batch.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top || a.getBoundingClientRect().left - b.getBoundingClientRect().left);
        batch.forEach((t) => {
          pending.delete(t);
          io.unobserve(t);
        });
        gsap.to(batch, { y: 0, opacity: 1, duration: 0.85, ease: 'expo.out', stagger, delay, overwrite: true, clearProps: 'transform,opacity' });
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0 },
    );
    items.forEach((t) => io.observe(t));
    return () => {
      io.disconnect();
      gsap.killTweensOf(items);
      ctx.revert();
    };
  }, [y, stagger, delay]);
  return (
    <Tag ref={ref} className={className} id={id}>
      {children}
    </Tag>
  );
}

// ───────────────────────── ScrollLitText ─────────────────────────

/**
 * Lines brighten from dim → full as you scroll through them (TTM §2.3).
 * Each line's colour is scrubbed independently so reading position is visible.
 */
export function ScrollLitText({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    const ctx = gsap.context(() => {
      SplitText.create(el, {
        type: 'lines',
        linesClass: 'lit-line',
        autoSplit: true,
        aria: 'auto',
        onSplit(self) {
          return gsap.fromTo(
            self.lines,
            { opacity: 0.22 },
            {
              opacity: 1,
              ease: 'none',
              stagger: 0.5,
              scrollTrigger: { trigger: el, start: 'top 85%', end: 'bottom 55%', scrub: 0.6 },
            },
          );
        },
      });
    }, el);
    return () => ctx.revert();
  }, [reduced]);
  return (
    <p ref={ref} className={className}>
      {children}
    </p>
  );
}

// ───────────────────────── Ticker (velocity-aware marquee) ─────────────────────────

/**
 * Infinite marquee whose speed and direction follow scroll velocity (TTM §2.6).
 * Hover slows it to near-stop so items can be read.
 */
export function Ticker({ children, speed = 40, className }: { children: ReactNode; speed?: number; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    if (!track.current || reduced) return;
    const ctx = gsap.context(() => {
      const tl = gsap.to(track.current, { xPercent: -50, duration: speed, ease: 'none', repeat: -1 });
      let dir = 1;
      const st = ScrollTrigger.create({
        onUpdate(self) {
          const v = self.getVelocity();
          if (Math.abs(v) < 20) return;
          dir = v > 0 ? 1 : -1;
          const boost = gsap.utils.clamp(1, 6, Math.abs(v) / 300);
          gsap.to(tl, { timeScale: dir * boost, duration: 0.25, overwrite: true });
          gsap.to(tl, { timeScale: dir, duration: 1, delay: 0.25, overwrite: false });
        },
      });
      const el = wrap.current!;
      const slow = () => gsap.to(tl, { timeScale: 0.08 * dir, duration: 0.6, overwrite: true });
      const resume = () => gsap.to(tl, { timeScale: dir, duration: 0.8, overwrite: true });
      el.addEventListener('mouseenter', slow);
      el.addEventListener('mouseleave', resume);
      return () => {
        st.kill();
        el.removeEventListener('mouseenter', slow);
        el.removeEventListener('mouseleave', resume);
      };
    }, wrap);
    return () => ctx.revert();
  }, [speed, reduced]);
  return (
    <div ref={wrap} className={cn('overflow-hidden mask-fade-x', className)}>
      <div ref={track} className="flex w-max">
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── Recoil (pointer-reactive press) ─────────────────────────

/**
 * Element recoils away from where the pointer entered, then springs home (TTM §2.7).
 * Fast hit (0.22s power2.out) + slow elastic settle.
 */
export function useRecoil<T extends HTMLElement>(strength = 6) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onEnter = (e: PointerEvent) => {
      if (reducedMotionNow() || e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      const ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
      gsap
        .timeline({ overwrite: true })
        .to(el, { x: -nx * strength, y: -ny * strength, rotation: nx * ny * -2, duration: 0.22, ease: 'power2.out' })
        .to(el, { x: 0, y: 0, rotation: 0, duration: 1, ease: 'elastic.out(1, 0.4)' });
    };
    el.addEventListener('pointerenter', onEnter);
    return () => {
      el.removeEventListener('pointerenter', onEnter);
      gsap.killTweensOf(el);
    };
  }, [strength]);
  return ref;
}

/** Magnetic pull towards the cursor while hovering; springs back on leave. */
export function useMagnetic<T extends HTMLElement>(strength = 0.25) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
    const move = (e: PointerEvent) => {
      if (reducedMotionNow() || e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * strength);
      yTo((e.clientY - (r.top + r.height / 2)) * strength);
    };
    const leave = () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)' });
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
      gsap.killTweensOf(el);
    };
  }, [strength]);
  return ref;
}

// ───────────────────────── Parallax ─────────────────────────

export function Parallax({ children, speed = 0.15, className }: { children: ReactNode; speed?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reducedMotionNow()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { yPercent: -speed * 50 },
        { yPercent: speed * 50, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 1 } },
      );
    }, el);
    return () => ctx.revert();
  }, [speed]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

// ───────────────────────── Burst (milestone celebration) ─────────────────────────

/** Fires a short radial burst of particles from an element. No DOM left behind. */
export function burst(origin: HTMLElement, colors = ['#ffebaf', '#4c9db0', '#e0a93b', '#5fbfb0', '#d9734e']) {
  if (reducedMotionNow()) return;
  const r = origin.getBoundingClientRect();
  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  Object.assign(layer.style, { position: 'fixed', left: `${r.left + r.width / 2}px`, top: `${r.top + r.height / 2}px`, zIndex: '100', pointerEvents: 'none' });
  document.body.appendChild(layer);
  const n = 26;
  const parts = Array.from({ length: n }, (_, i) => {
    const p = document.createElement('span');
    const s = 4 + Math.random() * 5;
    Object.assign(p.style, {
      position: 'absolute', width: `${s}px`, height: `${s * (Math.random() < 0.5 ? 1 : 2.4)}px`,
      background: colors[i % colors.length], borderRadius: Math.random() < 0.4 ? '50%' : '1px',
    });
    layer.appendChild(p);
    return p;
  });
  const tl = gsap.timeline({ onComplete: () => layer.remove() });
  parts.forEach((p, i) => {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    const d = 60 + Math.random() * 90;
    tl.fromTo(
      p,
      { x: 0, y: 0, scale: 0, rotation: 0 },
      { x: Math.cos(a) * d, y: Math.sin(a) * d - 30, scale: 1, rotation: Math.random() * 540, duration: 0.7, ease: 'expo.out' },
      0,
    ).to(p, { y: `+=${50 + Math.random() * 40}`, opacity: 0, duration: 0.8, ease: 'power1.in' }, 0.55);
  });
}
