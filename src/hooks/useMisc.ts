import { useEffect, useState, useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export function useDebounced<T>(value: T, ms = 200): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Runs `handler` for a keyboard shortcut; ignores typing inside inputs unless `global`. */
export function useHotkey(key: string, handler: (e: KeyboardEvent) => void, opts: { meta?: boolean; global?: boolean } = {}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (opts.meta && !(e.metaKey || e.ctrlKey)) return;
      if (!opts.meta && (e.metaKey || e.ctrlKey || e.altKey)) return;
      const el = e.target as HTMLElement | null;
      if (!opts.global && el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (e.key.toLowerCase() === key.toLowerCase()) handler(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [key, handler, opts.meta, opts.global]);
}
