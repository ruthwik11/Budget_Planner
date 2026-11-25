import { useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { ArrowRight, Info, ShieldCheck } from 'lucide-react';
import { gsap } from '@/components/animations/gsap';
import { SplitReveal } from '@/components/animations/Motion';
import { Glyph, Wordmark } from '@/components/layout/Wordmark';
import { CategoryGlyph } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Controls';
import { Input } from '@/components/ui/Field';
import { useFinance } from '@/store/finance';
import { useUI } from '@/store/ui';
import { reducedMotionNow } from '@/hooks/useMotionPrefs';
import { CATEGORY_PALETTE } from '@/constants/palette';
import { EASE } from '@/constants/motion';
import type { IconName } from '@/types';
import { cn } from '@/utils/cn';

const ORBIT: IconName[] = ['home', 'utensils', 'plane', 'briefcase', 'piggy-bank', 'car', 'film', 'heart-pulse', 'laptop', 'shopping-bag', 'zap', 'gift'];

/**
 * Orbit ring — translation of TTM's polar card ring (§2.4). Glyphs sit on a circle
 * computed each frame from {turn, r}; the entrance tweens both together with expo.out
 * over 2.6s so the ring unwinds *and* expands. Afterwards it drifts slowly, and the
 * pointer tilts the whole ring in 3D.
 */
function OrbitRing() {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const items = [...el.querySelectorAll<HTMLElement>('[data-orbit]')];
    const state = { turn: reducedMotionNow() ? 0 : -1.4, r: reducedMotionNow() ? 1 : 0.15, drift: 0 };
    const place = () => {
      const R = Math.min(el.clientWidth, el.clientHeight) * 0.42 * state.r;
      items.forEach((it, i) => {
        const a = (i / items.length) * Math.PI * 2 + state.turn * Math.PI * 2 + state.drift;
        gsap.set(it, { x: Math.cos(a) * R, y: Math.sin(a) * R * 0.92, xPercent: -50, yPercent: -50 });
      });
    };
    place();
    const ctx = gsap.context(() => {
      if (reducedMotionNow()) return;
      gsap.to(state, { turn: 0, r: 1, duration: 2.6, ease: 'expo.out', delay: 0.35, onUpdate: place });
      gsap.from(items, { opacity: 0, scale: 0.4, duration: 1.2, ease: 'expo.out', stagger: 0.05, delay: 0.35 });
      gsap.to(state, { drift: Math.PI * 2, duration: 120, ease: 'none', repeat: -1, onUpdate: place, delay: 2.8 });
      const tiltX = gsap.quickTo(el, 'rotationX', { duration: 1, ease: 'power3.out' });
      const tiltY = gsap.quickTo(el, 'rotationY', { duration: 1, ease: 'power3.out' });
      const move = (e: PointerEvent) => {
        tiltY(((e.clientX / innerWidth) - 0.5) * 14);
        tiltX(-((e.clientY / innerHeight) - 0.5) * 14);
      };
      window.addEventListener('pointermove', move);
      return () => window.removeEventListener('pointermove', move);
    }, el);
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => {
      ctx.revert();
      ro.disconnect();
    };
  }, []);
  return (
    <div className="absolute inset-0 [perspective:900px]" aria-hidden>
      <div ref={root} className="absolute inset-0 [transform-style:preserve-3d]">
        <div className="absolute left-1/2 top-1/2 size-[84%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-line" />
        <div className="absolute left-1/2 top-1/2 size-[56%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-line" />
        {ORBIT.map((ic, i) => (
          <div key={ic} data-orbit className="absolute left-1/2 top-1/2">
            <CategoryGlyph icon={ic} color={CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]} size={i % 3 === 0 ? 44 : 36} className="shadow-md backdrop-blur" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const users = useFinance((s) => s.users);
  const login = useFinance((s) => s.login);
  const toast = useUI((s) => s.toast);
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);

  const enter = (userId: string) => {
    const res = login(userId);
    if (!res.ok) {
      setError(res.reason);
      return;
    }
    const u = users.find((x) => x.id === userId)!;
    const from = (location.state as { from?: string } | null)?.from;
    navigate(u.role === 'admin' ? '/admin' : from && !from.startsWith('/admin') ? from : '/', { replace: true });
    toast({ tone: 'success', title: `Welcome, ${u.role === 'admin' ? u.name : u.name.split(' ')[0]}`, body: u.role === 'admin' ? 'Admin workspace (demo).' : 'Your ledger is up to date.' });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = users.find((x) => x.username === username.trim().toLowerCase());
    if (!u) {
      setError('No profile with that username on this device.');
      return;
    }
    enter(u.id);
  };

  return (
    <div className="grain relative grid min-h-dvh lg:grid-cols-[1.15fr_1fr]">
      {/* brand side */}
      <section className="relative hidden overflow-hidden border-r border-line lg:block" style={{ background: 'var(--glow), var(--bg-sunken)' }}>
        <div className="absolute left-10 top-8 z-10">
          <Wordmark size={20} />
        </div>
        <div className="absolute inset-x-10 bottom-[230px] top-20">
          <OrbitRing />
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex flex-col items-center text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.6, rotate: -20, filter: 'blur(8px)' }}
                animate={{ opacity: 1, scale: 1, rotate: 0, filter: 'blur(0px)' }}
                transition={{ duration: 1.4, delay: 0.9, ease: EASE.outQuint }}
              >
                <Glyph size={72} />
              </motion.div>
              <SplitReveal as="p" type="chars" delay={1.3} stagger={0.02} className="label-mono mt-4">
                every category, one rhythm
              </SplitReveal>
            </div>
          </div>
        </div>
        <div className="absolute bottom-10 left-10 z-10 max-w-md">
          <SplitReveal as="h1" delay={0.4} className="text-[3.4rem] font-medium leading-[0.98] tracking-[-0.045em]">
            Money, in rhythm.
          </SplitReveal>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 0.8 }} className="mt-4 max-w-sm text-sm text-fg-3">
            Budgets that breathe with your month. Goals that show their pace. A ledger you can actually read.
          </motion.p>
        </div>
      </section>

      {/* access side */}
      <section className="relative flex items-center justify-center px-5 py-12">
        <div className="absolute left-5 top-6 lg:hidden">
          <Wordmark size={19} />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.2, ease: EASE.outQuint }}
          className="w-full max-w-[400px]"
        >
          <p className="label-mono">Choose a profile</p>
          <h2 className="mt-2 text-[1.9rem] font-medium leading-tight tracking-[-0.035em]">
            Open your <span className="serif italic text-accent-fg">workspace</span>
          </h2>

          <ul className="mt-7 flex flex-col gap-2">
            {users.map((u, i) => (
              <motion.li key={u.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45 + i * 0.07, duration: 0.6, ease: EASE.outQuint }}>
                <button
                  onClick={() => enter(u.id)}
                  disabled={u.status === 'suspended'}
                  className={cn(
                    'group flex w-full items-center gap-3 rounded-[14px] border border-line bg-surface p-3 text-left shadow-sm transition-all duration-300',
                    'hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md disabled:opacity-50',
                  )}
                >
                  <span className={cn('grid size-10 place-items-center rounded-[10px] text-sm font-semibold', u.role === 'admin' ? 'bg-info-soft text-info' : 'bg-accent-soft text-accent-fg')}>
                    {u.role === 'admin' ? <ShieldCheck size={18} /> : u.name.split(' ').map((n) => n[0]).join('')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{u.name}</span>
                    <span className="block text-xs text-fg-3">@{u.username}</span>
                  </span>
                  {u.status === 'suspended' ? <Badge tone="neg">Suspended</Badge> : <Badge tone={u.role === 'admin' ? 'info' : 'neutral'}>{u.role === 'admin' ? 'Admin' : 'Personal'}</Badge>}
                  <ArrowRight size={16} className="text-fg-4 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-fg" />
                </button>
              </motion.li>
            ))}
          </ul>

          <div className="my-6 flex items-center gap-3 text-2xs text-fg-4">
            <span className="h-px flex-1 bg-line" /> OR BY USERNAME <span className="h-px flex-1 bg-line" />
          </div>
          <form onSubmit={submit} className="flex gap-2">
            <label htmlFor="username" className="sr-only">
              Username
            </label>
            <Input
              id="username"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(null); }}
              placeholder="alex, sarah or admin"
              autoComplete="username"
              aria-invalid={!!error}
              aria-describedby={error ? 'login-err' : undefined}
            />
            <button type="submit" className="h-10 shrink-0 rounded-[9px] bg-accent px-4 text-sm font-medium text-accent-ink active:scale-95">
              Open
            </button>
          </form>
          {error && (
            <motion.p id="login-err" role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 text-xs text-neg">
              {error}
            </motion.p>
          )}

          <div className="mt-8 flex gap-2.5 rounded-[12px] border border-line bg-surface-2/60 p-3.5 text-xs text-fg-3">
            <Info size={14} className="mt-px shrink-0" />
            <p>
              Demo mode. Profiles and data live only in this browser’s storage. There are no passwords and no real authentication, and the admin role is a
              front-end demonstration, not access control.
            </p>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
