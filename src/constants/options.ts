import type { AccountType, BudgetPeriod, Frequency, PaymentMethod } from '@/types';

export const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'card', label: 'Card' },
  { id: 'upi', label: 'UPI' },
  { id: 'bank', label: 'Bank transfer' },
  { id: 'cash', label: 'Cash' },
  { id: 'wallet', label: 'Wallet' },
  { id: 'other', label: 'Other' },
];

export const ACCOUNT_TYPES: { id: AccountType; label: string }[] = [
  { id: 'checking', label: 'Checking' },
  { id: 'savings', label: 'Savings' },
  { id: 'credit', label: 'Credit card' },
  { id: 'cash', label: 'Cash' },
  { id: 'investment', label: 'Investment' },
];

export const FREQUENCIES: { id: Frequency; label: string; every: string }[] = [
  { id: 'daily', label: 'Daily', every: 'day' },
  { id: 'weekly', label: 'Weekly', every: 'week' },
  { id: 'monthly', label: 'Monthly', every: 'month' },
  { id: 'yearly', label: 'Yearly', every: 'year' },
];

export const BUDGET_PERIODS: { id: BudgetPeriod; label: string }[] = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
];

export const BUDGET_WARN_AT = 80; // % utilisation that triggers a threshold alert
