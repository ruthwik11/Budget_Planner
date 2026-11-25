/** Cadence wordmark: a hand-drawn cash-flow wave glyph + lowercase name. */
export function Glyph({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8.5" fill="var(--accent)" />
      <path d="M7.5 20.5c2.6 0 3.4-9 6-9s3.4 9 6 9 2.6-5 5-5" fill="none" stroke="var(--accent-ink)" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-[0.4em] font-medium tracking-[-0.04em]" style={{ fontSize: size }}>
      <Glyph size={size * 1.15} />
      cadence
    </span>
  );
}
