import { create } from 'zustand';
import type {
  Account, AppNotification, Budget, Category, Dataset, Goal, GoalContribution, Recurring, Transaction, User,
} from '@/types';
import { buildDataset, defaultCategoriesFor, type DatasetId } from '@/mock-data/seed';
import { localRepository, purgeLegacyStorage, sessionRepository, type StoredWorkspace } from '@/services/repository';
import { dueOccurrences, nextOccurrence } from '@/lib/finance';
import { addDays, todayISO } from '@/utils/dates';
import { uid } from '@/utils/id';
import type { CurrencyCode } from '@/utils/money';
import type { Backup } from '@/schemas';

type NewTx = Omit<Transaction, 'id' | 'userId' | 'createdAt'>;

export interface FinanceState extends Dataset {
  baseCurrency: CurrencyCode;
  datasetId: DatasetId;
  sessionUserId: string | null;
  /** Event-style notifications (transaction added etc.), newest first. */
  events: AppNotification[];

  // session (demo only — no real authentication)
  login: (userId: string) => { ok: true } | { ok: false; reason: string };
  logout: () => void;

  // transactions
  addTransaction: (t: NewTx) => Transaction;
  updateTransaction: (id: string, patch: Partial<NewTx>) => void;
  deleteTransactions: (ids: string[]) => void;
  restoreTransactions: (txs: Transaction[]) => void;
  importTransactions: (rows: NewTx[]) => number;

  // categories / accounts
  addCategory: (c: Omit<Category, 'id' | 'userId'>) => Category;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  deleteCategory: (id: string) => 'deleted' | 'archived';
  addAccount: (a: Omit<Account, 'id' | 'userId'>) => Account;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  deleteAccount: (id: string) => 'deleted' | 'archived';

  // budgets
  upsertBudget: (b: Omit<Budget, 'id' | 'userId'> & { id?: string }) => void;
  deleteBudget: (id: string) => void;

  // goals
  addGoal: (g: Omit<Goal, 'id' | 'userId' | 'createdAt'>) => Goal;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  contribute: (goalId: string, c: Omit<GoalContribution, 'id'>) => void;
  removeContribution: (goalId: string, contributionId: string) => void;

  // recurring
  addRecurring: (r: Omit<Recurring, 'id' | 'userId' | 'lastPosted'>) => Recurring;
  updateRecurring: (id: string, patch: Partial<Recurring>) => void;
  deleteRecurring: (id: string) => void;
  postRecurringNow: (id: string) => void;
  skipRecurring: (id: string) => void;
  processRecurring: () => number;

  // profile
  updateProfile: (patch: Pick<User, 'name'>) => void;

  // admin (frontend demonstration only)
  createUser: (u: Pick<User, 'name' | 'username' | 'role'>) => { ok: boolean; reason?: string };
  toggleUserStatus: (userId: string) => void;
  deleteUser: (userId: string) => void;
  adminDeleteTransaction: (id: string) => void;
  clearAudit: () => void;
  updatePolicy: (defaults: Record<string, number>) => void;

  // data
  loadDataset: (id: DatasetId) => void;
  wipeAll: () => void;
  importBackup: (b: Backup) => void;
  pushEvent: (n: Omit<AppNotification, 'id' | 'at'>) => void;
}

const DATA_KEYS: (keyof Dataset)[] = ['users', 'accounts', 'categories', 'transactions', 'budgets', 'goals', 'recurring', 'audit', 'policy'];

function initial(): Pick<FinanceState, keyof Dataset | 'baseCurrency' | 'datasetId'> {
  purgeLegacyStorage();
  const stored = localRepository.load();
  if (stored) return { ...stored.data, baseCurrency: stored.baseCurrency, datasetId: stored.datasetId };
  return { ...buildDataset('personal'), baseCurrency: 'INR', datasetId: 'personal' };
}

export const useFinance = create<FinanceState>()((set, get) => {
  const me = () => get().users.find((u) => u.id === get().sessionUserId) ?? null;
  const actor = () => {
    const u = me();
    return u ? `${u.name} (${u.role})` : 'System';
  };
  const log = (action: string, details: string) =>
    set((s) => ({ audit: [{ id: uid('log'), at: Date.now(), action, actor: actor(), details }, ...s.audit].slice(0, 2000) }));
  const uidOrThrow = () => {
    const id = get().sessionUserId;
    if (!id) throw new Error('No active session');
    return id;
  };

  return {
    ...initial(),
    sessionUserId: sessionRepository.get(),
    events: [],

    login(userId) {
      const u = get().users.find((x) => x.id === userId);
      if (!u) return { ok: false, reason: 'Profile not found.' };
      if (u.status === 'suspended') return { ok: false, reason: 'This profile is suspended by an administrator.' };
      sessionRepository.set(u.id);
      set({ sessionUserId: u.id, events: [] });
      log('Sign in', `${u.username} opened the ${u.role} workspace (demo session).`);
      if (u.role === 'user') get().processRecurring();
      return { ok: true };
    },
    logout() {
      const u = me();
      if (u) log('Sign out', `${u.username} ended the session.`);
      sessionRepository.set(null);
      set({ sessionUserId: null, events: [] });
    },

    addTransaction(t) {
      const tx: Transaction = { ...t, id: uid('tx'), userId: uidOrThrow(), createdAt: Date.now() };
      set((s) => ({ transactions: [tx, ...s.transactions] }));
      return tx;
    },
    updateTransaction(id, patch) {
      set((s) => ({ transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
    },
    deleteTransactions(ids) {
      const set_ = new Set(ids);
      set((s) => ({ transactions: s.transactions.filter((t) => !set_.has(t.id)) }));
    },
    restoreTransactions(txs) {
      set((s) => ({ transactions: [...txs, ...s.transactions] }));
    },
    importTransactions(rows) {
      const userId = uidOrThrow();
      const now = Date.now();
      const txs = rows.map((r, i) => ({ ...r, id: uid('tx'), userId, createdAt: now + i }));
      set((s) => ({ transactions: [...txs, ...s.transactions] }));
      log('Import', `Imported ${txs.length} transactions from CSV.`);
      return txs.length;
    },

    addCategory(c) {
      const cat: Category = { ...c, id: uid('cat'), userId: uidOrThrow() };
      set((s) => ({ categories: [...s.categories, cat] }));
      return cat;
    },
    updateCategory(id, patch) {
      set((s) => ({ categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
    },
    deleteCategory(id) {
      const used = get().transactions.some((t) => t.categoryId === id) || get().recurring.some((r) => r.categoryId === id);
      if (used) {
        get().updateCategory(id, { archived: true });
        set((s) => ({ budgets: s.budgets.filter((b) => b.categoryId !== id) }));
        return 'archived';
      }
      set((s) => ({ categories: s.categories.filter((c) => c.id !== id), budgets: s.budgets.filter((b) => b.categoryId !== id) }));
      return 'deleted';
    },
    addAccount(a) {
      const acc: Account = { ...a, id: uid('acc'), userId: uidOrThrow() };
      set((s) => ({ accounts: [...s.accounts, acc] }));
      return acc;
    },
    updateAccount(id, patch) {
      set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
    },
    deleteAccount(id) {
      const used = get().transactions.some((t) => t.accountId === id || t.toAccountId === id);
      if (used) {
        get().updateAccount(id, { archived: true });
        return 'archived';
      }
      set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) }));
      return 'deleted';
    },

    upsertBudget(b) {
      const userId = uidOrThrow();
      set((s) => {
        if (b.id) return { budgets: s.budgets.map((x) => (x.id === b.id ? { ...x, ...b, id: x.id } : x)) };
        // one budget per category+period
        const existing = s.budgets.find((x) => x.userId === userId && x.categoryId === b.categoryId && x.period === b.period);
        if (existing) return { budgets: s.budgets.map((x) => (x.id === existing.id ? { ...x, ...b, id: x.id } : x)) };
        return { budgets: [...s.budgets, { ...b, id: uid('bud'), userId }] };
      });
    },
    deleteBudget(id) {
      set((s) => ({ budgets: s.budgets.filter((b) => b.id !== id) }));
    },

    addGoal(g) {
      const goal: Goal = { ...g, id: uid('goal'), userId: uidOrThrow(), createdAt: todayISO() };
      set((s) => ({ goals: [...s.goals, goal] }));
      return goal;
    },
    updateGoal(id, patch) {
      set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) }));
    },
    deleteGoal(id) {
      set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }));
    },
    contribute(goalId, c) {
      set((s) => ({
        goals: s.goals.map((g) => (g.id === goalId ? { ...g, contributions: [...g.contributions, { ...c, id: uid('ctb') }] } : g)),
      }));
    },
    removeContribution(goalId, cid) {
      set((s) => ({
        goals: s.goals.map((g) => (g.id === goalId ? { ...g, contributions: g.contributions.filter((c) => c.id !== cid) } : g)),
      }));
    },

    addRecurring(r) {
      const rec: Recurring = { ...r, id: uid('rec'), userId: uidOrThrow(), lastPosted: null };
      set((s) => ({ recurring: [...s.recurring, rec] }));
      get().processRecurring();
      return get().recurring.find((x) => x.id === rec.id) ?? rec;
    },
    updateRecurring(id, patch) {
      set((s) => ({ recurring: s.recurring.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
    },
    deleteRecurring(id) {
      set((s) => ({ recurring: s.recurring.filter((r) => r.id !== id) }));
    },
    postRecurringNow(id) {
      const r = get().recurring.find((x) => x.id === id);
      if (!r) return;
      const date = nextOccurrence(r, r.lastPosted ?? addDays(r.startDate, -1));
      get().addTransaction({
        type: r.type, title: r.title, amount: r.amount, date: date > todayISO() ? todayISO() : date, categoryId: r.categoryId,
        accountId: r.accountId, paymentMethod: r.paymentMethod, tags: ['recurring'], recurringId: r.id,
      });
      get().updateRecurring(id, { lastPosted: date });
    },
    skipRecurring(id) {
      const r = get().recurring.find((x) => x.id === id);
      if (!r) return;
      get().updateRecurring(id, { lastPosted: nextOccurrence(r, r.lastPosted ?? addDays(r.startDate, -1)) });
    },
    processRecurring() {
      const userId = get().sessionUserId;
      if (!userId) return 0;
      const today = todayISO();
      const newTx: Transaction[] = [];
      const updates = new Map<string, string>();
      for (const r of get().recurring) {
        if (r.userId !== userId) continue;
        const due = dueOccurrences(r, today);
        if (!due.length) continue;
        for (const d of due)
          newTx.push({
            id: uid('tx'), userId, type: r.type, title: r.title, amount: r.amount, date: d, categoryId: r.categoryId,
            accountId: r.accountId, paymentMethod: r.paymentMethod, tags: ['recurring'], recurringId: r.id, createdAt: Date.now(),
          });
        updates.set(r.id, due[due.length - 1]);
      }
      if (!newTx.length) return 0;
      set((s) => ({
        transactions: [...newTx, ...s.transactions],
        recurring: s.recurring.map((r) => (updates.has(r.id) ? { ...r, lastPosted: updates.get(r.id)! } : r)),
      }));
      return newTx.length;
    },

    updateProfile(patch) {
      const id = uidOrThrow();
      set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) }));
      log('Profile updated', `Display name changed to “${patch.name}”.`);
    },

    createUser(u) {
      if (get().users.some((x) => x.username === u.username)) return { ok: false, reason: 'That username is taken.' };
      const user: User = { ...u, id: uid('usr'), status: 'active', createdAt: todayISO() };
      const cats = defaultCategoriesFor(user.id);
      const budgets: Budget[] = Object.entries(get().policy.defaults).flatMap(([name, limit]) => {
        const c = cats.find((x) => x.name === name);
        return c ? [{ id: uid('bud'), userId: user.id, categoryId: c.id, period: 'monthly' as const, limit, rollover: false }] : [];
      });
      set((s) => ({
        users: [...s.users, user],
        categories: [...s.categories, ...cats],
        budgets: [...s.budgets, ...budgets],
        accounts: [...s.accounts, { id: uid('acc'), userId: user.id, name: 'Main account', type: 'checking', openingBalance: 0, color: '#4c9db0' }],
      }));
      log('User created', `Created ${u.role} profile “${u.username}” with default budget policy.`);
      return { ok: true };
    },
    toggleUserStatus(userId) {
      const u = get().users.find((x) => x.id === userId);
      if (!u) return;
      const status = u.status === 'active' ? 'suspended' : 'active';
      set((s) => ({ users: s.users.map((x) => (x.id === userId ? { ...x, status } : x)) }));
      log('User status changed', `“${u.username}” is now ${status}.`);
    },
    deleteUser(userId) {
      const u = get().users.find((x) => x.id === userId);
      if (!u || u.id === get().sessionUserId) return;
      set((s) => {
        const keep = <T extends { userId: string }>(a: T[]) => a.filter((x) => x.userId !== userId);
        return {
          users: s.users.filter((x) => x.id !== userId), transactions: keep(s.transactions), accounts: keep(s.accounts),
          categories: keep(s.categories), budgets: keep(s.budgets), goals: keep(s.goals), recurring: keep(s.recurring),
        };
      });
      log('User deleted', `Deleted profile “${u.username}” and all of its records.`);
    },
    adminDeleteTransaction(id) {
      const t = get().transactions.find((x) => x.id === id);
      get().deleteTransactions([id]);
      if (t) log('Transaction deleted', `Removed “${t.title}” (${(t.amount / 100).toFixed(2)}) from ${t.userId}.`);
    },
    clearAudit() {
      set({ audit: [] });
      log('Audit cleared', 'Audit trail was cleared.');
    },
    updatePolicy(defaults) {
      set({ policy: { defaults } });
      log('Policy updated', `Default budget policy now covers ${Object.keys(defaults).length} categories.`);
    },

    loadDataset(id) {
      const d = buildDataset(id);
      const session = get().sessionUserId;
      set({ ...d, datasetId: id, events: [], sessionUserId: d.users.some((u) => u.id === session) ? session : null });
      if (!get().sessionUserId) sessionRepository.set(null);
      get().processRecurring();
    },
    wipeAll() {
      localRepository.clear();
      sessionRepository.set(null);
      const d = buildDataset('empty');
      set({ ...d, datasetId: 'empty', sessionUserId: null, events: [] });
    },
    importBackup(b) {
      set({ ...(b.data as Dataset), baseCurrency: b.baseCurrency, events: [] });
      if (!get().users.some((u) => u.id === get().sessionUserId)) {
        sessionRepository.set(null);
        set({ sessionUserId: null });
      }
      log('Backup restored', `Restored backup exported ${b.exportedAt}.`);
    },
    pushEvent(n) {
      set((s) => ({ events: [{ ...n, id: uid('evt'), at: Date.now() }, ...s.events].slice(0, 50) }));
    },
  };
});

// ── debounced persistence through the repository ──
let saveTimer: ReturnType<typeof setTimeout> | undefined;
useFinance.subscribe((s, prev) => {
  if (DATA_KEYS.every((k) => s[k] === prev[k]) && s.baseCurrency === prev.baseCurrency) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const st = useFinance.getState();
    const ws: StoredWorkspace = {
      version: 1, baseCurrency: st.baseCurrency, datasetId: st.datasetId,
      data: Object.fromEntries(DATA_KEYS.map((k) => [k, st[k]])) as unknown as Dataset,
    };
    localRepository.save(ws);
  }, 250);
});
// persist the very first workspace too
if (!localRepository.load()) {
  const st = useFinance.getState();
  localRepository.save({
    version: 1, baseCurrency: st.baseCurrency, datasetId: st.datasetId,
    data: Object.fromEntries(DATA_KEYS.map((k) => [k, st[k]])) as unknown as Dataset,
  });
}
// session restored from sessionStorage → catch up recurring items
if (useFinance.getState().sessionUserId) useFinance.getState().processRecurring();

export const exportBackup = (): Backup => {
  const st = useFinance.getState();
  return {
    app: 'cadence', version: 1, exportedAt: new Date().toISOString(), baseCurrency: st.baseCurrency,
    data: Object.fromEntries(DATA_KEYS.map((k) => [k, st[k]])) as unknown as Backup['data'],
  };
};
