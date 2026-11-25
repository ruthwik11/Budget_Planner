import { useMemo } from 'react';
import { Info } from 'lucide-react';
import { useFinance } from '@/store/finance';

/** Admin works across every profile, so it reads the raw store instead of user-scoped hooks. */
export function useAllData() {
  const users = useFinance((s) => s.users);
  const transactions = useFinance((s) => s.transactions);
  const categories = useFinance((s) => s.categories);
  const accounts = useFinance((s) => s.accounts);
  const audit = useFinance((s) => s.audit);
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const acctMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  return { users, transactions, categories, accounts, audit, userMap, catMap, acctMap };
}

export function DemoNotice() {
  return (
    <div className="mb-5 flex items-start gap-2.5 rounded-[12px] border border-[color-mix(in_oklab,var(--info)_30%,transparent)] bg-info-soft px-4 py-3 text-xs text-fg-2">
      <Info size={14} className="mt-px shrink-0 text-info" />
      <p>
        Admin tools are a front-end demonstration. They act on data stored in this browser and don’t represent real authentication, authorization or server-side access control.
      </p>
    </div>
  );
}

export const initials = (name: string) => name.split(/\s+/).map((n) => n[0]).join('').slice(0, 2).toUpperCase();
