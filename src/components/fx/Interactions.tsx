/**
 * App-grade interaction layer:
 *  · <Cursor/>: a dot that tracks exactly and a ring that trails on a spring;
 *    it swells over interactive elements and shows `data-cursor` labels.
 *  · useSpotlight(): one document listener feeding --mx/--my to the hovered panel.
 *  · useTilt(): pointer-driven 3D tilt with an elastic return.
 * All of it is disabled for touch pointers and reduced motion.
 */
import { useEffect, useRef } from 'react';
import { gsap } from '@/components/animations/gsap';
import { reducedMotionNow, useReducedMotion } from '@/hooks/useMotionPrefs';

const INTERACTIVE = 'a, button, [role="button"], [role="tab"], [role="radio"], [role="switch"], [role="menuitem"], input, select, textarea, label, [data-cursor]';

export function Cursor() {
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !matchMedia('(pointer: fine)').matches) return;
    const r = ring.current!;
    const d = dot.current!;
    const rx = gsap.quickTo(r, 'x', { duration: 0.45, ease: 'power3.out' });
    const ry = gsap.quickTo(r, 'y', { duration: 0.45, ease: 'power3.out' });
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      gsap.set(d, { x: e.clientX, y: e.clientY });
      rx(e.clientX);
      ry(e.clientY);
      r.classList.add('is-visible');
      d.classList.add('is-visible');
      const el = (e.target as Element | null)?.closest?.(INTERACTIVE) as HTMLElement | null;
      const hovering = !!el && !el.matches('input, textarea, select');
      r.classList.toggle('is-hover', hovering);
      label.current!.textContent = hovering ? el!.dataset.cursor ?? '' : '';
    };
    const leave = () => {
      r.classList.remove('is-visible');
      d.classList.remove('is-visible');
    };
    const down = () => r.classList.add('is-down');
    const up = () => r.classList.remove('is-down');
    window.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerleave', leave);
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      document.removeEventListener('pointerleave', leave);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
    };
  }, [reduced]);

  if (reduced) return null;
  return (
    <>
      <div ref={ring} className="cursor-ring" aria-hidden>
        <span ref={label} className="cursor-label" />
      </div>
      <div ref={dot} className="cursor-dot" aria-hidden />
    </>
  );
}

/** Feeds pointer position to whichever `.panel` is under the cursor (CSS draws the light). */
export function useSpotlight() {
  useEffect(() => {
    if (!matchMedia('(pointer: fine)').matches) return;
    let last: HTMLElement | null = null;
    const move = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.('.panel') as HTMLElement | null;
      if (el !== last) last = el;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, []);
}

/** 3D tilt towards the pointer; springs back flat on leave. */
export function useTilt<T extends HTMLElement>(max = 6) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !matchMedia('(pointer: fine)').matches) return;
    gsap.set(el, { transformPerspective: 900, transformStyle: 'preserve-3d' });
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3.out' });
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3.out' });
    const move = (e: PointerEvent) => {
      if (reducedMotionNow() || e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      ry(((e.clientX - r.left) / r.width - 0.5) * max * 2);
      rx(-((e.clientY - r.top) / r.height - 0.5) * max * 2);
    };
    const leave = () => gsap.to(el, { rotationX: 0, rotationY: 0, duration: 1.1, ease: 'elastic.out(1, 0.45)' });
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
      gsap.killTweensOf(el);
    };
  }, [max]);
  return ref;
}
