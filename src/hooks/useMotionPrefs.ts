import { useSyncExternalStore } from 'react';
import { usePrefs } from '@/store/prefs';

const q = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
const subscribe = (cb: () => void) => {
  q?.addEventListener('change', cb);
  return () => q?.removeEventListener('change', cb);
};

/** True when motion should be reduced — OS setting or in-app override. */
export function useReducedMotion(): boolean {
  const sys = useSyncExternalStore(subscribe, () => !!q?.matches, () => false);
  const pref = usePrefs((s) => s.reduceMotion);
  return pref === 'on' ? true : pref === 'off' ? false : sys;
}

/** Non-hook check for imperative code (GSAP callbacks). */
export function reducedMotionNow(): boolean {
  const pref = usePrefs.getState().reduceMotion;
  return pref === 'on' ? true : pref === 'off' ? false : !!q?.matches;
}
