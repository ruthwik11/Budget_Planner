import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CornerDownLeft, Moon, Plus, Search } from 'lucide-react';
import { useUI } from '@/store/ui';
import { useCurrentUser, useUserData } from '@/hooks/useData';
import { useMoney } from '@/hooks/useMoney';
import { useDebounced } from '@/hooks/useMisc';
import { ADMIN_NAV, SETTINGS_ITEM, USER_NAV } from './nav';
import { useThemeToggle } from './AppShell';
import { CategoryGlyph } from '@/components/ui/Icon';
import { Kbd } from '@/components/ui/Controls';
import { cn } from '@/utils/cn';
import { formatDate } from '@/utils/dates';
import { EASE } from '@/constants/motion';

interface Cmd {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
}

/** ⌘K — jump anywhere, run actions, search transactions (debounced). */
export function CommandPalette() {
  const open = useUI((s) => s.palette);
  const setOpen = useUI((s) => s.setPalette);
  const openTx = useUI((s) => s.openTxEditor);
  const openDetail = useUI((s) => s.openTxDetail);
  const navigate = useNavigate();
  const user = useCurrentUser();
  const { txs, catMap } = useUserData();
  const { fmt } = useMoney();
  const { toggle } = useThemeToggle();
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 120);
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const cmds = useMemo<Cmd[]>(() => {
    const close = () => setOpen(false);
    const nav = (user?.role === 'admin' ? ADMIN_NAV : USER_NAV).flatMap((g) => g.items).concat(SETTINGS_ITEM);
    const base: Cmd[] = [
      ...(user?.role === 'user'
        ? [
            { id: 'new-exp', group: 'Actions', label: 'New expense', hint: 'N', icon: <Plus size={15} />, run: () => { close(); openTx({ draft: { type: 'expense' } }); } },
            { id: 'new-inc', group: 'Actions', label: 'New income', icon: <Plus size={15} />, run: () => { close(); openTx({ draft: { type: 'income' } }); } },
            { id: 'new-xfer', group: 'Actions', label: 'New transfer', icon: <Plus size={15} />, run: () => { close(); openTx({ draft: { type: 'transfer' } }); } },
          ]
        : []),
      { id: 'theme', group: 'Actions', label: 'Toggle theme', icon: <Moon size={15} />, run: () => { toggle(); close(); } },
      ...nav.map((n) => ({ id: n.to, group: 'Go to', label: n.label, icon: <n.icon size={15} />, run: () => { close(); navigate(n.to); } })),
    ];
    const s = dq.trim().toLowerCase();
    if (!s) return base;
    const matchesBase = base.filter((c) => c.label.toLowerCase().includes(s));
    const txHits =
      user?.role === 'user'
        ? txs
            .filter((t) => t.title.toLowerCase().includes(s) || (t.categoryId && catMap.get(t.categoryId)?.name.toLowerCase().includes(s)) || t.tags.some((g) => g.includes(s)))
            .slice(0, 8)
            .map<Cmd>((t) => {
              const c = t.categoryId ? catMap.get(t.categoryId) : undefined;
              return {
                id: t.id, group: 'Transactions', label: t.title,
                hint: `${formatDate(t.date, 'DD MMM YYYY')} · ${t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''}${fmt(t.amount)}`,
                icon: <CategoryGlyph icon={c?.icon ?? 'wallet'} color={c?.color ?? 'var(--info)'} size={22} />,
                run: () => { close(); openDetail(t.id); },
              };
            })
        : [];
    return [...matchesBase, ...txHits];
  }, [dq, txs, catMap, fmt, user?.role, navigate, openTx, openDetail, setOpen, toggle]);

  useEffect(() => setIdx(0), [dq]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${idx}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  const groups = cmds.reduce<Record<string, (Cmd & { i: number })[]>>((g, c, i) => {
    (g[c.group] ??= []).push({ ...c, i });
    return g;
  }, {});

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[85] flex items-start justify-center px-3 pt-[12vh]" data-lenis-prevent>
          <motion.div className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: EASE.out }}
            className="relative w-full max-w-[600px] overflow-hidden rounded-[16px] border border-line-strong bg-surface shadow-lg"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false);
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(cmds.length - 1, i + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              if (e.key === 'Enter') { e.preventDefault(); cmds[idx]?.run(); }
              if (e.key === 'Tab') e.preventDefault();
            }}
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search size={17} className="text-fg-3" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search transactions, pages, actions…"
                aria-label="Search"
                role="combobox"
                aria-expanded
                aria-controls="cmd-list"
                aria-activedescendant={cmds[idx] ? `cmd-${idx}` : undefined}
                className="h-14 flex-1 bg-transparent text-md outline-none placeholder:text-fg-4"
              />
              <Kbd>Esc</Kbd>
            </div>
            <div ref={listRef} id="cmd-list" role="listbox" className="max-h-[52vh] overflow-y-auto p-2">
              {cmds.length === 0 && <p className="px-3 py-10 text-center text-sm text-fg-3">Nothing matches “{q}”.</p>}
              {Object.entries(groups).map(([g, items]) => (
                <div key={g} className="mb-1">
                  <div className="label-mono px-3 pb-1 pt-2">{g}</div>
                  {items.map((c) => (
                    <button
                      key={c.id}
                      id={`cmd-${c.i}`}
                      data-i={c.i}
                      role="option"
                      aria-selected={idx === c.i}
                      onMouseMove={() => setIdx(c.i)}
                      onClick={c.run}
                      className={cn('relative flex w-full items-center gap-3 rounded-[9px] px-3 py-2 text-left text-sm', idx === c.i ? 'text-fg' : 'text-fg-2')}
                    >
                      {idx === c.i && <motion.span layoutId="cmd-hl" className="absolute inset-0 rounded-[9px] bg-surface-2" transition={{ type: 'spring', stiffness: 600, damping: 40 }} />}
                      <span className="relative text-fg-3">{c.icon}</span>
                      <span className="relative flex-1 truncate">{c.label}</span>
                      {c.hint && <span className="relative text-xs text-fg-3 num">{c.hint}</span>}
                      {idx === c.i && <CornerDownLeft size={13} className="relative text-fg-4" />}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-2xs text-fg-4">
              <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
              <span className="flex items-center gap-1"><Kbd>↵</Kbd> open</span>
              <span className="ml-auto flex items-center gap-1">
                <ArrowRight size={11} /> Cadence
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
