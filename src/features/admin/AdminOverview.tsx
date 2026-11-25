import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowUpRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Controls';
import { AnimatedNumber, Reveal } from '@/components/animations/Motion';
import { Donut, MonthBars, RankBars } from '@/components/charts/Charts';
import { useMoney } from '@/hooks/useMoney';
import { byCategory, monthlySeries, totals } from '@/lib/finance';
import { addMonths, endOfMonth, startOfMonth, todayISO } from '@/utils/dates';
import { DemoNotice, initials, useAllData } from './shared';

export default function AdminOverview() {
  const { users, transactions, categories, audit } = useAllData();
  const { fmt, compact } = useMoney();
  const [active, setActive] = useState<string | null>(null);
  const f0 = (n: number) => fmt(n, { decimals: false });
  const today = todayISO();
  const s = useMemo(() => {
    const t = totals(transactions);
    // merge categories by name across users for a system view
    const raw = byCategory(transactions, categories, 'expense');
    const merged = new Map<string, { id: string; label: string; value: number; color: string }>();
    raw.forEach((r) => {
      const cur = merged.get(r.name) ?? { id: r.name, label: r.name, value: 0, color: r.color };
      cur.value += r.amount;
      merged.set(r.name, cur);
    });
    const perUser = users
      .filter((u) => u.role === 'user')
      .map((u) => {
        const ut = totals(transactions.filter((x) => x.userId === u.id));
        return { id: u.id, label: u.name, value: ut.expense, income: ut.income, color: 'var(--info)', meta: `${transactions.filter((x) => x.userId === u.id).length} txns` };
      })
      .sort((a, b) => b.value - a.value);
    const series = monthlySeries(transactions, { from: addMonths(startOfMonth(today), -11, 1), to: endOfMonth(today) });
    return { t, cats: [...merged.values()].sort((a, b) => b.value - a.value), perUser, series };
  }, [transactions, categories, users, today]);

  return (
    <>
      <PageHeader eyebrow="Admin" title="System overview" description="All profiles stored in this browser, at a glance." />
      <DemoNotice />
      <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-line bg-line lg:grid-cols-4">
        {[
          { l: 'Profiles', v: users.length, f: (n: number) => String(n), sub: `${users.filter((u) => u.status === 'active').length} active` },
          { l: 'Total income', v: s.t.income, f: f0, sub: 'all profiles' },
          { l: 'Total expenses', v: s.t.expense, f: f0, sub: `${s.t.count} transactions` },
          { l: 'Net surplus', v: s.t.net, f: f0, sub: `${s.t.savingsRate}% savings rate` },
        ].map((x) => (
          <div key={x.l} className="bg-surface px-5 py-5">
            <div className="label-mono">{x.l}</div>
            <div className="mt-1.5 text-[1.6rem] font-medium tracking-[-0.03em]"><AnimatedNumber value={x.v} format={x.f} /></div>
            <div className="text-xs text-fg-3">{x.sub}</div>
          </div>
        ))}
      </div>
      <Reveal className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div data-reveal className="lg:col-span-8">
          <Panel className="h-full" eyebrow="Volume" title="System cash flow, 12 months">
            <MonthBars data={s.series.map((p) => ({ month: p.month, income: p.income, expense: p.expense }))} keys={[{ key: 'income', name: 'Income', color: 'var(--accent)' }, { key: 'expense', name: 'Expenses', color: 'var(--neg)' }]} height={280} />
          </Panel>
        </div>
        <div data-reveal className="lg:col-span-4">
          <Panel className="h-full" eyebrow="Categories" title="System expense mix">
            <div className="flex flex-col items-center gap-4">
              <Donut slices={s.cats} centerLabel="All spend" centerValue={compact(s.t.expense)} active={active} onActive={setActive} size={190} />
              <div className="w-full"><RankBars items={s.cats.slice(0, 5)} active={active} onActive={setActive} valueFormat={f0} /></div>
            </div>
          </Panel>
        </div>
        <div data-reveal className="lg:col-span-6">
          <Panel className="h-full" eyebrow="Profiles" title="Spending by user" actions={<Link to="/admin/users" className="grid size-7 place-items-center rounded-[8px] text-fg-3 hover:bg-surface-2 hover:text-fg" aria-label="Users"><ArrowUpRight size={15} /></Link>}>
            <RankBars items={s.perUser.map((u) => ({ ...u, icon: <span className="grid size-7 place-items-center rounded-[7px] bg-surface-3 text-[10px] font-semibold">{initials(u.label)}</span> }))} valueFormat={f0} />
          </Panel>
        </div>
        <div data-reveal className="lg:col-span-6">
          <Panel className="h-full" eyebrow="Audit" title="Latest events" actions={<Link to="/admin/audit" className="grid size-7 place-items-center rounded-[8px] text-fg-3 hover:bg-surface-2 hover:text-fg" aria-label="Audit trail"><ArrowUpRight size={15} /></Link>}>
            <ul className="flex flex-col">
              {audit.slice(0, 7).map((a) => (
                <li key={a.id} className="flex gap-3 border-t border-line py-2.5 text-sm first:border-0">
                  <span className="w-[72px] shrink-0 text-xs text-fg-4 num">{new Date(a.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="min-w-0"><span className="font-medium">{a.action}</span> <span className="text-fg-3">· {a.details}</span></span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </Reveal>
    </>
  );
}
