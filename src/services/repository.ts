/**
 * Persistence boundary. The UI and store only talk to `DataRepository`.
 * Swapping `localRepository` for an HTTP implementation later requires no UI changes.
 */
import type { Dataset } from '@/types';
import { datasetSchema } from '@/schemas';
import type { CurrencyCode } from '@/utils/money';
import type { DatasetId } from '@/mock-data/seed';
import { LEGACY_COLOR_MAP } from '@/constants/palette';

/** Map colours saved under the previous palette onto Vanilla × Moonstone equivalents. */
function recolor(d: Dataset): Dataset {
  const fix = <T extends { color: string }>(x: T): T => {
    const next = LEGACY_COLOR_MAP[x.color.toLowerCase()];
    return next ? { ...x, color: next } : x;
  };
  return { ...d, categories: d.categories.map(fix), accounts: d.accounts.map(fix), goals: d.goals.map(fix) };
}

export interface StoredWorkspace {
  version: 1;
  baseCurrency: CurrencyCode;
  datasetId: DatasetId;
  data: Dataset;
}

export interface DataRepository {
  load(): StoredWorkspace | null;
  save(ws: StoredWorkspace): void;
  clear(): void;
}

const KEY = 'cadence:workspace:v1';
const LEGACY_KEYS = [
  'europe_budget_db_users', 'europe_budget_db_transactions', 'europe_budget_db_savings',
  'europe_budget_db_budgets', 'europe_budget_db_audit_logs',
];

export const localRepository: DataRepository = {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.version !== 1) return null;
      const data = datasetSchema.safeParse(parsed.data);
      if (!data.success) {
        console.warn('Stored workspace failed validation; starting fresh.', data.error.issues.slice(0, 3));
        return null;
      }
      return { ...parsed, data: recolor(data.data as Dataset) };
    } catch (e) {
      console.warn('Could not read stored workspace', e);
      return null;
    }
  },
  save(ws) {
    try {
      localStorage.setItem(KEY, JSON.stringify(ws));
    } catch (e) {
      console.error('Could not persist workspace (storage full?)', e);
    }
  },
  clear() {
    localStorage.removeItem(KEY);
    // The legacy app stored plaintext passwords; never keep them around.
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
  },
};

/** Session only stores which demo profile is active — never credentials. */
const SESSION_KEY = 'cadence:session';
export const sessionRepository = {
  get(): string | null {
    try {
      const v = sessionStorage.getItem(SESSION_KEY);
      return v && /^[\w-]{1,64}$/.test(v) ? v : null;
    } catch {
      return null;
    }
  },
  set(userId: string | null) {
    try {
      if (userId) sessionStorage.setItem(SESSION_KEY, userId);
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* private mode */
    }
  },
};

/** Remove any legacy plaintext-password storage left by the previous version of the app. */
export function purgeLegacyStorage() {
  try {
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
    sessionStorage.removeItem('europe_budget_session_active');
  } catch {
    /* ignore */
  }
}
