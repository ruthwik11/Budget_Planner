/**
 * Editorial + cinematic building blocks (v2):
 *  · FilmTransition: route changes play as a short film cut. A band-coloured
 *    panel wipes up with the destination's title in display serif, then lifts.
 *  · Band: a full-bleed colour block (the swatch made architectural) over a live
 *    WebGL liquid surface.
 *  · KineticTitle: display-serif headline whose characters rise and unskew.
 *  · WordMarquee: oversized outlined words drifting with scroll velocity.
 */
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { gsap, ScrollTrigger, SplitText } from '@/components/animations/gsap';
import { reducedMotionNow, useReducedMotion } from '@/hooks/useMotionPrefs';
import { usePrefs } from '@/store/prefs';
import { PAGE_TITLES, navIndex } from '@/components/layout/nav';
import { LiquidCanvas } from './LiquidCanvas';
import { cn } from '@/utils/cn';

// ───────────────────────── film transition ─────────────────────────

/** Total time the old page has to leave (matches PageTransition's exit). */
export const FILM_COVER = 0.34;
/** Timestamp of the last film cut; titles mounted right after it delay until the curtain lifts. */
export const film = { at: 0 };

export function FilmTransition() {
  const { pathname } = useLocation();
  const root = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const enabled = usePrefs((s) => s.filmTransitions);
  const tl = useRef<gsap.core.Timeline | null>(null);

  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const el = root.current;
    if (!el || !enabled || reducedMotionNow()) return;
    const title = el.querySelector<HTMLElement>('[data-film-title]')!;
    const meta = el.querySelector<HTMLElement>('[data-film-meta]')!;
    const idx = navIndex(pathname);
    title.textContent = PAGE_TITLES[pathname] ?? '';
    meta.textContent = idx ? `${idx.n} — ${idx.group}` : '';
    film.at = performance.now();
    tl.current?.progress(1).kill();
    const split = SplitText.create(title, { type: 'chars', charsClass: 'inline-block' });
    tl.current = gsap
      .timeline({
        onComplete: () => {
          split.revert();
          gsap.set(el, { visibility: 'hidden' });
        },
      })
      .set(el, { visibility: 'visible' })
      .fromTo('[data-film-hem]', { yPercent: 100 }, { yPercent: 0, duration: FILM_COVER, ease: 'power4.in' }, 0)
      .fromTo('[data-film-panel]', { yPercent: 100 }, { yPercent: 0, duration: FILM_COVER, ease: 'power4.in' }, 0.05)
      .from(split.chars, { yPercent: 110, skewY: 8, duration: 0.5, ease: 'expo.out', stagger: 0.018 }, FILM_COVER - 0.05)
      .from(meta, { opacity: 0, y: 10, duration: 0.35 }, FILM_COVER)
      .to('[data-film-panel]', { yPercent: -100, duration: 0.55, ease: 'power4.inOut' }, '+=0.12')
      .to('[data-film-hem]', { yPercent: -100, duration: 0.55, ease: 'power4.inOut' }, '<0.06');
  }, [pathname, enabled]);

  useEffect(() => () => void tl.current?.kill(), []);

  return (
    <div ref={root} className="film" aria-hidden>
      <div data-film-hem className="film-hem" />
      <div data-film-panel className="film-panel">
        <div>
          <p data-film-meta className="label-mono mb-4 !text-band-fg-2" />
          <p data-film-title className="display-serif overflow-hidden pb-[0.08em] text-[clamp(3.5rem,11vw,10rem)]" />
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── kinetic title ─────────────────────────

export function KineticTitle({ children, className, delay: delayProp, as: Tag = 'h1' }: { children: string; className?: string; delay?: number; as?: 'h1' | 'h2' | 'p' }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reducedMotionNow()) return;
    const delay = delayProp ?? (performance.now() - film.at < 900 ? 0.78 : 0.05);
    const ctx = gsap.context(() => {
      const split = SplitText.create(el, { type: 'lines,chars', linesClass: 'split-line', aria: 'auto' });
      gsap.from(split.chars, {
        yPercent: 115, skewY: 7, opacity: 0, duration: 1.05, ease: 'expo.out', stagger: 0.022, delay,
        // the film cut covers the first ~0.8s of a navigation
        onComplete: () => split.revert(),
      });
    }, el);
    return () => ctx.revert();
  }, [children, delayProp]);
  return (
    <Tag ref={ref} className={cn('display-serif', className)}>
      {children}
    </Tag>
  );
}

// ───────────────────────── band ─────────────────────────

/** Colour block with a live liquid surface. Children sit on top in band colours. */
export function Band({ children, className, liquid = true, id }: { children: ReactNode; className?: string; liquid?: boolean; id?: string }) {
  return (
    <section id={id} className={cn('relative isolate overflow-hidden rounded-[28px] bg-band text-band-fg', className)}>
      {liquid && <LiquidCanvas className="-z-10" />}
      {/* grain + edge light so the block reads as a surface, not a flat fill */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-[0.12] mix-blend-overlay [background-image:url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E&quot;)]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] shadow-[inset_0_1px_0_rgb(255_255_255/0.18)]" />
      {children}
    </section>
  );
}

// ───────────────────────── word marquee ─────────────────────────

/** Oversized display words; alternating filled/outlined; direction and speed follow scroll velocity. */
export function WordMarquee({ words, className }: { words: string[]; className?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    if (!track.current || reduced) return;
    const ctx = gsap.context(() => {
      const loop = gsap.to(track.current, { xPercent: -50, duration: 38, ease: 'none', repeat: -1 });
      const st = ScrollTrigger.create({
        onUpdate(self) {
          const v = self.getVelocity();
          const dir = v < 0 ? -1 : 1;
          gsap.to(loop, { timeScale: dir * gsap.utils.clamp(1, 7, Math.abs(v) / 250), duration: 0.2, overwrite: true });
          gsap.to(loop, { timeScale: dir, duration: 1.2, delay: 0.2 });
        },
      });
      return () => st.kill();
    }, track);
    return () => ctx.revert();
  }, [reduced]);
  const row = (
    <div className="flex shrink-0 items-center">
      {words.map((w, i) => (
        <span key={w + i} className={cn('display-serif px-[0.35em] text-[clamp(3rem,9vw,7.5rem)] leading-none', i % 2 ? 'text-outline text-fg-3' : 'text-fg')}>
          {w}
          <span className="ml-[0.35em] inline-block translate-y-[-0.15em] text-[0.4em] text-accent-fg">✦</span>
        </span>
      ))}
    </div>
  );
  return (
    <div className={cn('overflow-hidden py-4 mask-fade-x', className)} aria-hidden>
      <div ref={track} className="flex w-max">
        {row}
        {row}
      </div>
    </div>
  );
}
