import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import Lenis from 'lenis';
import { motion } from 'framer-motion';
import { useLocation } from 'react-router';
import { gsap, ScrollTrigger } from './gsap';
import { useReducedMotion, reducedMotionNow } from '@/hooks/useMotionPrefs';
import { usePrefs } from '@/store/prefs';
import { EASE } from '@/constants/motion';
import { Wordmark } from '@/components/layout/Wordmark';

// ───────────────────────── Curtain intro ─────────────────────────

/**
 * Original take on TTM's intro (§2.1): an ink panel carrying the wordmark, trailed by
 * three thin hems in category colours, each with a curved SVG lower edge. The stack
 * wipes upward on a steep in-out curve, revealing the app beneath. The curve flattens
 * during the wipe so the hem appears to "snap taut".
 */
export function CurtainIntro({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  done.current = onDone;

  useLayoutEffect(() => {
    if (reducedMotionNow()) {
      done.current();
      return;
    }
    const ctx = gsap.context(() => {
      const layers = gsap.utils.toArray<HTMLElement>('[data-layer]');
      const curves = gsap.utils.toArray<SVGPathElement>('[data-curve]');
      const tl = gsap.timeline({ onComplete: () => done.current() });
      tl.from('[data-mark]', { yPercent: 120, duration: 0.8, ease: 'power3.out' })
        .from('[data-tag]', { opacity: 0, y: 8, duration: 0.5, ease: 'power2.out' }, '-=0.45')
        .to('[data-mark], [data-tag]', { yPercent: -60, opacity: 0, duration: 0.45, ease: 'power2.in' }, '+=0.35')
        // ink panel (last in DOM) leaves first; the hems trail it like a striped edge
        .to(layers, { yPercent: -100, duration: 1.05, ease: 'power4.inOut', stagger: { each: 0.075, from: 'end' } }, '-=0.15')
        .to(curves, { attr: { d: 'M0 0 H1440 V0 Q720 0 0 0 Z' }, duration: 0.9, ease: 'power2.inOut', stagger: { each: 0.075, from: 'end' } }, '<0.1');
    }, root);
    return () => ctx.revert();
  }, []);

  // Front-to-back: ink panel is on top, coloured hems trail beneath it.
  const hems = ['#2f6f7e', '#e0a93b', '#ffebaf'];
  return (
    <div ref={root} className="pointer-events-none fixed inset-0 z-[200]" aria-hidden>
      {hems.map((c, i) => (
        <div key={c} data-layer className="absolute inset-0" style={{ zIndex: i, background: c, top: 0, bottom: `-${(3 - i) * 14}px` }}>
          <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="absolute left-0 top-full h-[9vh] w-full">
            <path data-curve d="M0 0 H1440 V0 Q720 120 0 0 Z" fill={c} />
          </svg>
        </div>
      ))}
      <div data-layer className="absolute inset-0 z-10 grid place-items-center bg-[#4c9db0]" style={{ ['--accent' as string]: '#ffebaf', ['--accent-ink' as string]: '#4c9db0' }}>
        <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="absolute left-0 top-full h-[9vh] w-full">
          <path data-curve d="M0 0 H1440 V0 Q720 120 0 0 Z" fill="#4c9db0" />
        </svg>
        <div className="flex flex-col items-center gap-4 overflow-hidden text-[#ffebaf]">
          <div className="overflow-hidden pb-1">
            <div data-mark>
              <Wordmark size={56} />
            </div>
          </div>
          <p data-tag className="label-mono !text-[#ffebaf]/80">
            money, in rhythm
          </p>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── Smooth scroll ─────────────────────────

/** Lenis with TTM's tuning (1.2s, expo-out), driven by GSAP's ticker so ScrollTrigger stays in sync. */
export function SmoothScroll() {
  const enabled = usePrefs((s) => s.smoothScroll);
  const reduced = useReducedMotion();
  const { pathname } = useLocation();
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (!enabled || reduced) return;
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      syncTouch: false,
    });
    lenisRef.current = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [enabled, reduced]);

  useEffect(() => {
    if (lenisRef.current) lenisRef.current.scrollTo(0, { immediate: true });
    else window.scrollTo(0, 0);
    // layouts change per route; recompute trigger positions after paint
    const t = setTimeout(() => ScrollTrigger.refresh(), 120);
    return () => clearTimeout(t);
  }, [pathname]);

  return null;
}

// ───────────────────────── Page transition ─────────────────────────

/** Route content enters by rising 14px out of a soft blur; exit is quicker and quieter. */
export function PageTransition({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  if (reduced) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, filter: 'blur(5px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.5, ease: EASE.outQuint } }}
      exit={{ opacity: 0, y: -6, filter: 'blur(3px)', transition: { duration: 0.18, ease: EASE.inOut } }}
      onAnimationComplete={() => ScrollTrigger.refresh()}
    >
      {children}
    </motion.div>
  );
}
