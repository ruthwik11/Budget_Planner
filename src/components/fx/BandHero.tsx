import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { gsap } from '@/components/animations/gsap';
import { reducedMotionNow } from '@/hooks/useMotionPrefs';
import { Band, film } from './Editorial';
import { cn } from '@/utils/cn';

export interface HeroStat {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}

/**
 * Poster-style hero: one huge display-serif figure on the liquid band,
 * a caption, and a rail of supporting stats. The figure rises from a mask,
 * stats cascade in, and the whole block parallaxes gently on scroll.
 */
export function BandHero({
  eyebrow, figure, caption, stats, aside, className,
}: { eyebrow: string; figure: ReactNode; caption?: ReactNode; stats: HeroStat[]; aside?: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el || reducedMotionNow()) return;
    const delay = performance.now() - film.at < 900 ? 0.7 : 0.1;
    const ctx = gsap.context(() => {
      gsap
        .timeline({ delay, defaults: { ease: 'expo.out' } })
        .from(el, { clipPath: 'inset(12% 4% 12% 4% round 28px)', duration: 1.2, ease: 'power4.inOut', clearProps: 'clipPath' })
        .from('[data-hero-eyebrow]', { opacity: 0, y: 12, duration: 0.7 }, '-=0.7')
        .from('[data-hero-figure]', { yPercent: 105, duration: 1.2 }, '<')
        .from('[data-hero-caption]', { opacity: 0, y: 10, duration: 0.8 }, '-=0.9')
        .from('[data-hero-stat]', { opacity: 0, y: 24, duration: 0.9, stagger: 0.07, clearProps: 'all' }, '-=0.9');
      gsap.to('[data-hero-figure]', { yPercent: -8, ease: 'none', scrollTrigger: { trigger: el, start: 'top top', end: 'bottom top', scrub: 0.6 } });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className={cn('mb-6', className)}>
      <Band>
        <div className="grid gap-8 px-6 py-8 md:px-10 md:py-12 xl:grid-cols-[1.5fr_1fr] xl:items-end">
          <div className="min-w-0">
            <p data-hero-eyebrow className="label-mono !text-band-fg-2">
              {eyebrow}
            </p>
            <div className="mt-4 overflow-hidden pb-[0.06em]">
              <div data-hero-figure className="display-serif text-[clamp(3.6rem,10vw,8.5rem)] text-band-fg">
                {figure}
              </div>
            </div>
            {caption && (
              <p data-hero-caption className="mt-4 max-w-lg text-[0.95rem] leading-relaxed text-band-fg-2">
                {caption}
              </p>
            )}
            {aside}
          </div>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[18px] border border-band-line bg-band-line">
            {stats.map((s) => (
              <div key={s.label} data-hero-stat className="px-4 py-4 backdrop-blur-sm [background:color-mix(in_oklab,var(--band)_82%,transparent)]">
                <dt className="label-mono !text-band-fg-2">{s.label}</dt>
                <dd className="mt-1.5 text-[1.3rem] font-medium tracking-[-0.03em] text-band-fg num">{s.value}</dd>
                {s.hint && <dd className="mt-0.5 text-xs text-band-fg-2">{s.hint}</dd>}
              </div>
            ))}
          </dl>
        </div>
      </Band>
    </div>
  );
}
