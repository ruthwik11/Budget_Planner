import { create } from 'zustand';
import type { Transaction } from '@/types';

export interface Toast {
  id: string;
  title: string;
  body?: string;
  tone: 'success' | 'info' | 'warning' | 'danger';
  action?: { label: string; run: () => void };
}

export type TxDraft = Partial<Transaction> & { type?: Transaction['type'] };

interface UIState {
  toasts: Toast[];
  toast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;

  txEditor: { open: boolean; editing: Transaction | null; draft?: TxDraft };
  openTxEditor: (opts?: { editing?: Transaction; draft?: TxDraft }) => void;
  closeTxEditor: () => void;

  txDetail: string | null;
  openTxDetail: (id: string | null) => void;

  palette: boolean;
  setPalette: (v: boolean) => void;

  mobileNav: boolean;
  setMobileNav: (v: boolean) => void;

  notifications: boolean;
  setNotifications: (v: boolean) => void;

  /** Curtain intro plays once per browser session. */
  introPlayed: boolean;
  setIntroPlayed: () => void;
}

let n = 0;
export const useUI = create<UIState>()((set) => ({
  toasts: [],
  toast: (t) => {
    const id = `t${++n}`;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), t.action ? 7000 : 4200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),

  txEditor: { open: false, editing: null },
  openTxEditor: (o) => set({ txEditor: { open: true, editing: o?.editing ?? null, draft: o?.draft } }),
  closeTxEditor: () => set((s) => ({ txEditor: { ...s.txEditor, open: false } })),

  txDetail: null,
  openTxDetail: (id) => set({ txDetail: id }),

  palette: false,
  setPalette: (v) => set({ palette: v }),

  mobileNav: false,
  setMobileNav: (v) => set({ mobileNav: v }),

  notifications: false,
  setNotifications: (v) => set({ notifications: v }),

  introPlayed: typeof sessionStorage !== 'undefined' && sessionStorage.getItem('cadence:intro') === '1',
  setIntroPlayed: () => {
    try {
      sessionStorage.setItem('cadence:intro', '1');
    } catch {
      /* ignore */
    }
    set({ introPlayed: true });
  },
}));
