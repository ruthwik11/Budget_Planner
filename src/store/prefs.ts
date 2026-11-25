import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CurrencyCode, NumberLocale } from '@/utils/money';
import type { DateFormat, RangePreset } from '@/utils/dates';

export type ThemePref = 'dark' | 'light' | 'system';

export const DASHBOARD_WIDGETS = [
  { id: 'cashflow', label: 'Cash flow' },
  { id: 'spending', label: 'Spending breakdown' },
  { id: 'budgets', label: 'Budget utilisation' },
  { id: 'narrative', label: 'Month in review' },
  { id: 'goals', label: 'Savings goals' },
  { id: 'upcoming', label: 'Upcoming payments' },
  { id: 'recent', label: 'Recent activity' },
  { id: 'insights', label: 'Insights' },
  { id: 'accounts', label: 'Accounts' },
] as const;
export type WidgetId = (typeof DASHBOARD_WIDGETS)[number]['id'];

export interface NotificationPrefs {
  budget: boolean;
  overspend: boolean;
  goals: boolean;
  upcoming: boolean;
  summary: boolean;
  transactions: boolean;
}

interface PrefsState {
  theme: ThemePref;
  currency: CurrencyCode;
  locale: NumberLocale;
  dateFormat: DateFormat;
  reduceMotion: 'system' | 'on' | 'off';
  smoothScroll: boolean;
  hideAmounts: boolean;
  notifications: NotificationPrefs;
  dashboardOrder: WidgetId[];
  dashboardHidden: WidgetId[];
  dashboardRange: RangePreset;
  readNotifications: string[];
  dismissedNotifications: string[];
  set: (p: Partial<Omit<PrefsState, 'set' | 'markRead' | 'dismiss' | 'resetDashboard'>>) => void;
  markRead: (ids: string[]) => void;
  dismiss: (id: string) => void;
  resetDashboard: () => void;
}

const DEFAULT_ORDER = DASHBOARD_WIDGETS.map((w) => w.id) as WidgetId[];

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      theme: 'light',
      currency: 'INR',
      locale: 'en-IN',
      dateFormat: 'DD MMM YYYY',
      reduceMotion: 'system',
      smoothScroll: true,
      hideAmounts: false,
      notifications: { budget: true, overspend: true, goals: true, upcoming: true, summary: true, transactions: true },
      dashboardOrder: DEFAULT_ORDER,
      dashboardHidden: [],
      dashboardRange: 'this-month',
      readNotifications: [],
      dismissedNotifications: [],
      set: (p) => set(p),
      markRead: (ids) => set((s) => ({ readNotifications: [...new Set([...s.readNotifications, ...ids])].slice(-500) })),
      dismiss: (id) => set((s) => ({ dismissedNotifications: [...new Set([...s.dismissedNotifications, id])].slice(-500) })),
      resetDashboard: () => set({ dashboardOrder: DEFAULT_ORDER, dashboardHidden: [] }),
    }),
    {
      name: 'cadence:prefs',
      version: 1,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PrefsState>;
        // keep widget list in sync with code if widgets were added
        const order = (p.dashboardOrder ?? []).filter((id) => DEFAULT_ORDER.includes(id));
        const missing = DEFAULT_ORDER.filter((id) => !order.includes(id));
        return { ...current, ...p, dashboardOrder: [...order, ...missing] };
      },
    },
  ),
);
