import { Component, lazy, Suspense, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, Outlet } from 'react-router';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import { AppShell } from '@/components/layout/AppShell';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { Toaster } from '@/components/ui/Toaster';
import { CurtainIntro, PageTransition, SmoothScroll } from '@/components/animations/Cinematic';
import { FilmTransition } from '@/components/fx/Editorial';
import { Cursor } from '@/components/fx/Interactions';
import { TransactionEditor } from '@/features/transactions/TransactionEditor';
import { TransactionDetail } from '@/features/transactions/TransactionDetail';
import { NotificationsPanel } from '@/features/notifications/NotificationsPanel';
import { useCurrentUser } from '@/hooks/useData';
import { useReducedMotion } from '@/hooks/useMotionPrefs';
import { usePrefs } from '@/store/prefs';
import { useUI } from '@/store/ui';
import { useFinance } from '@/store/finance';

const Login = lazy(() => import('@/features/auth/LoginPage'));
const Dashboard = lazy(() => import('@/features/dashboard/DashboardPage'));
const Transactions = lazy(() => import('@/features/transactions/TransactionsPage'));
const Accounts = lazy(() => import('@/features/accounts/AccountsPage'));
const Income = lazy(() => import('@/features/income/IncomePage'));
const Expenses = lazy(() => import('@/features/expenses/ExpensesPage'));
const Budgets = lazy(() => import('@/features/budgets/BudgetsPage'));
const Goals = lazy(() => import('@/features/savings/GoalsPage'));
const Recurring = lazy(() => import('@/features/recurring/RecurringPage'));
const Analytics = lazy(() => import('@/features/analytics/AnalyticsPage'));
const Reports = lazy(() => import('@/features/reports/ReportsPage'));
const Debts = lazy(() => import('@/features/debts/DebtsPage'));
const Split = lazy(() => import('@/features/split/SplitPage'));
const Tax = lazy(() => import('@/features/tax/TaxPage'));
const WhatIf = lazy(() => import('@/features/whatif/WhatIfPage'));
const Settings = lazy(() => import('@/features/settings/SettingsPage'));
const AdminOverview = lazy(() => import('@/features/admin/AdminOverview'));
const AdminUsers = lazy(() => import('@/features/admin/AdminUsers'));
const AdminTransactions = lazy(() => import('@/features/admin/AdminTransactions'));
const AdminAudit = lazy(() => import('@/features/admin/AdminAudit'));
const AdminPolicy = lazy(() => import('@/features/admin/AdminPolicy'));

// ───────────────────────── error boundary ─────────────────────────

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error(error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 text-center">
        <p className="label-mono">Something broke</p>
        <h1 className="text-2xl font-medium tracking-tight">This view hit an error.</h1>
        <p className="text-sm text-fg-3">Your data is safe in local storage. Reload the page, or go back to the overview.</p>
        <div className="mt-2 flex gap-2">
          <button className="h-9 rounded-[9px] bg-accent px-4 text-sm font-medium text-accent-ink" onClick={() => location.reload()}>
            Reload
          </button>
          <a className="grid h-9 place-items-center rounded-[9px] border border-line-strong px-4 text-sm" href="/">
            Overview
          </a>
        </div>
      </div>
    );
  }
}

function RouteFallback() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-9 w-56" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="skeleton h-32" />
        <div className="skeleton h-32" />
        <div className="skeleton h-32" />
      </div>
      <div className="skeleton h-72" />
    </div>
  );
}

// ───────────────────────── environment effects ─────────────────────────

function useEnvironment() {
  const theme = usePrefs((s) => s.theme);
  const reduced = useReducedMotion();
  useEffect(() => {
    const apply = () => {
      const t = theme === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : theme;
      document.documentElement.dataset.theme = t;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#0c1e23' : '#ffebaf');
    };
    apply();
    const m = matchMedia('(prefers-color-scheme: light)');
    m.addEventListener('change', apply);
    return () => m.removeEventListener('change', apply);
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(reduced);
  }, [reduced]);
}

// ───────────────────────── guards ─────────────────────────

function RequireRole({ role }: { role: 'user' | 'admin' }) {
  const user = useCurrentUser();
  const logout = useFinance((s) => s.logout);
  const location = useLocation();
  const introPlayed = useUI((s) => s.introPlayed);
  const setIntroPlayed = useUI((s) => s.setIntroPlayed);
  useEffect(() => {
    if (user?.status === 'suspended') logout();
  }, [user, logout]);
  if (!user || user.status === 'suspended') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />;
  return (
    <>
      {!introPlayed && <CurtainIntro onDone={setIntroPlayed} />}
      <FilmTransition />
      <AppShell>
        <ErrorBoundary>
          <AnimatePresence mode="wait" initial={false}>
            <PageTransition key={location.pathname}>
              <Suspense fallback={<RouteFallback />}>
                <Outlet />
              </Suspense>
            </PageTransition>
          </AnimatePresence>
        </ErrorBoundary>
      </AppShell>
      {role === 'user' && (
        <>
          <TransactionEditor />
          <TransactionDetail />
          <NotificationsPanel />
        </>
      )}
      <CommandPalette />
    </>
  );
}

function AppRoutes() {
  const location = useLocation();
  return (
    <Routes location={location}>
      <Route
        path="/login"
        element={
          <Suspense fallback={null}>
            <Login />
          </Suspense>
        }
      />
      <Route element={<RequireRole role="user" />}>
        <Route index element={<Dashboard />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="accounts" element={<Accounts />} />
        <Route path="income" element={<Income />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="budgets" element={<Budgets />} />
        <Route path="goals" element={<Goals />} />
        <Route path="recurring" element={<Recurring />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="reports" element={<Reports />} />
        <Route path="debts" element={<Debts />} />
        <Route path="split" element={<Split />} />
        <Route path="tax" element={<Tax />} />
        <Route path="what-if" element={<WhatIf />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="admin" element={<RequireRole role="admin" />}>
        <Route index element={<AdminOverview />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="transactions" element={<AdminTransactions />} />
        <Route path="audit" element={<AdminAudit />} />
        <Route path="policy" element={<AdminPolicy />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  useEnvironment();
  const reduced = useReducedMotion();
  const customCursor = usePrefs((s) => s.customCursor);
  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <BrowserRouter>
        <SmoothScroll />
        {customCursor && <Cursor />}
        <AppRoutes />
        <Toaster />
      </BrowserRouter>
    </MotionConfig>
  );
}
