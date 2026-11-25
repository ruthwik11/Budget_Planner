/**
 * Motion tokens. Derived from the TTM analysis (docs/TTM_MOTION_ANALYSIS.md):
 * two speeds — fast UI feedback and slow spatial "settle" — never a muddy middle.
 */
export const DUR = {
  instant: 0.12,
  fast: 0.18,
  base: 0.28,
  ui: 0.45, // TTM's dominant UI duration
  slow: 0.9, // word reveals
  settle: 1.6, // counters, big numbers
  cinematic: 2.6, // orbit unwind
} as const;

/** CSS / Framer cubic-beziers. */
export const EASE = {
  out: [0.2, 0.8, 0.3, 1] as const, // fast-out soft-land: UI entrances
  outQuint: [0.22, 1, 0.36, 1] as const, // reveals
  inOut: [0.65, 0, 0.35, 1] as const, // state changes
  wipe: [0.76, 0, 0.24, 1] as const, // curtains, panels
  pop: [0.3, 1.4, 0.5, 1] as const, // small overshoot
} as const;

/** GSAP ease names mirroring the above. */
export const GEASE = {
  text: 'power3.out',
  settle: 'expo.out',
  draw: 'power2.inOut',
  fade: 'power1.out',
  wipe: 'power4.inOut',
  recoil: 'power2.out',
  spring: 'elastic.out(1, 0.45)',
} as const;

export const SPRING = {
  snappy: { type: 'spring', stiffness: 520, damping: 38, mass: 0.8 },
  soft: { type: 'spring', stiffness: 260, damping: 30 },
  nav: { type: 'spring', stiffness: 420, damping: 36 },
} as const;

export const STAGGER = { words: 0.06, rows: 0.035, cards: 0.07 } as const;
