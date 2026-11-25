import {
  ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChartNoAxesColumn, ChartPie, FileText, FlaskConical, Gauge, Landmark, LayoutDashboard,
  Percent, Repeat, ScrollText, Settings, ShieldCheck, SlidersHorizontal, Split, Target, Users, Wallet, type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  short?: string;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const USER_NAV: NavGroup[] = [
  {
    label: 'Ledger',
    items: [
      { to: '/', label: 'Overview', icon: LayoutDashboard },
      { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight, short: 'Activity' },
      { to: '/accounts', label: 'Accounts', icon: Wallet },
      { to: '/split', label: 'Split', icon: Split },
    ],
  },
  {
    label: 'Plan',
    items: [
      { to: '/budgets', label: 'Budgets', icon: Gauge },
      { to: '/goals', label: 'Goals', icon: Target },
      { to: '/recurring', label: 'Recurring', icon: Repeat },
      { to: '/debts', label: 'Debts & EMIs', icon: Landmark, short: 'Debts' },
    ],
  },
  {
    label: 'Understand',
    items: [
      { to: '/income', label: 'Income', icon: ArrowDownLeft },
      { to: '/expenses', label: 'Expenses', icon: ArrowUpRight },
      { to: '/analytics', label: 'Analytics', icon: ChartNoAxesColumn },
      { to: '/tax', label: 'Tax planner', icon: Percent, short: 'Tax' },
      { to: '/what-if', label: 'What-if', icon: FlaskConical },
      { to: '/reports', label: 'Reports', icon: FileText },
    ],
  },
];

export const ADMIN_NAV: NavGroup[] = [
  {
    label: 'System',
    items: [
      { to: '/admin', label: 'Overview', icon: ShieldCheck },
      { to: '/admin/users', label: 'Users', icon: Users },
      { to: '/admin/transactions', label: 'All transactions', icon: ChartPie, short: 'Ledger' },
      { to: '/admin/audit', label: 'Audit trail', icon: ScrollText, short: 'Audit' },
      { to: '/admin/policy', label: 'Policy & data', icon: SlidersHorizontal, short: 'Policy' },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = { to: '/settings', label: 'Settings', icon: Settings };

export const PAGE_TITLES: Record<string, string> = Object.fromEntries(
  [...USER_NAV, ...ADMIN_NAV].flatMap((g) => g.items.map((i) => [i.to, i.label])).concat([['/settings', 'Settings'], ['/admin/settings', 'Settings']]),
);

/** "04 — Plan" style index for editorial page headers. */
export function navIndex(path: string): { n: string; group: string } | null {
  for (const groups of [USER_NAV, ADMIN_NAV]) {
    let i = 0;
    for (const g of groups)
      for (const it of g.items) {
        i++;
        if (it.to === path) return { n: String(i).padStart(2, '0'), group: g.label };
      }
  }
  return null;
}
