/**
 * Domain types. All money values are integer MINOR units (paise / cents)
 * in the workspace base currency. Never store floats for money.
 */
export type Minor = number;
export type ISODate = string; // YYYY-MM-DD

export type Role = 'user' | 'admin';
export type UserStatus = 'active' | 'suspended';

export interface User {
  id: string;
  name: string;
  username: string;
  role: Role;
  status: UserStatus;
  createdAt: ISODate;
}

export type TxType = 'income' | 'expense' | 'transfer';
export type CategoryKind = 'income' | 'expense';

export interface Category {
  id: string;
  userId: string;
  name: string;
  kind: CategoryKind;
  icon: IconName;
  color: string;
  archived?: boolean;
}

export type AccountType = 'checking' | 'savings' | 'credit' | 'cash' | 'investment';

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  openingBalance: Minor;
  color: string;
  archived?: boolean;
}

export type PaymentMethod = 'card' | 'upi' | 'bank' | 'cash' | 'wallet' | 'other';

export interface Transaction {
  id: string;
  userId: string;
  type: TxType;
  title: string;
  amount: Minor; // always positive
  date: ISODate;
  categoryId: string | null; // null for transfers
  accountId: string;
  toAccountId?: string; // transfers only
  paymentMethod: PaymentMethod;
  tags: string[];
  notes?: string;
  recurringId?: string;
  createdAt: number;
}

export type BudgetPeriod = 'weekly' | 'monthly' | 'yearly';

export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  period: BudgetPeriod;
  limit: Minor;
  rollover: boolean;
}

export interface GoalContribution {
  id: string;
  date: ISODate;
  amount: Minor; // may be negative for withdrawals
  note?: string;
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  target: Minor;
  deadline: ISODate | null;
  color: string;
  icon: IconName;
  contributions: GoalContribution[];
  createdAt: ISODate;
}

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Recurring {
  id: string;
  userId: string;
  type: Exclude<TxType, 'transfer'>;
  title: string;
  amount: Minor;
  categoryId: string;
  accountId: string;
  paymentMethod: PaymentMethod;
  frequency: Frequency;
  interval: number; // every N periods
  startDate: ISODate;
  endDate: ISODate | null;
  /** Last date for which a transaction was materialised. */
  lastPosted: ISODate | null;
  autoPost: boolean;
  active: boolean;
}

export interface AuditLog {
  id: string;
  at: number;
  action: string;
  actor: string;
  details: string;
}

export type NotificationKind =
  | 'budget-threshold'
  | 'overspend'
  | 'goal-milestone'
  | 'upcoming'
  | 'summary'
  | 'transaction';

export interface AppNotification {
  id: string; // deterministic for derived alerts → de-duplicated
  kind: NotificationKind;
  title: string;
  body: string;
  at: number;
  severity: 'info' | 'success' | 'warning' | 'danger';
  href?: string;
}

export interface BudgetPolicy {
  /** Default monthly limits (minor units) by category NAME, applied to new users. */
  defaults: Record<string, Minor>;
}

export type IconName =
  | 'home' | 'utensils' | 'car' | 'plane' | 'shopping-bag' | 'zap' | 'heart-pulse' | 'film'
  | 'graduation-cap' | 'gift' | 'shield' | 'wifi' | 'coffee' | 'dumbbell' | 'paw-print'
  | 'baby' | 'briefcase' | 'laptop' | 'trending-up' | 'building' | 'landmark' | 'coins'
  | 'piggy-bank' | 'wallet' | 'receipt' | 'ticket' | 'hotel' | 'train' | 'globe' | 'mountain'
  | 'sparkles' | 'target' | 'tag' | 'smartphone' | 'shirt' | 'wrench' | 'book' | 'music';

export interface Dataset {
  users: User[];
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  recurring: Recurring[];
  audit: AuditLog[];
  policy: BudgetPolicy;
}

export interface DateRange {
  from: ISODate;
  to: ISODate;
}
