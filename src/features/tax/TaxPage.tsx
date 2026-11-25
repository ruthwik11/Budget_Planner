import { useEffect, useMemo, useState } from 'react';
import { LayoutGroup, motion } from 'framer-motion';
import { Info, Save, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { BandHero } from '@/components/fx/BandHero';
import { useTilt } from '@/components/fx/Interactions';
import { Badge, Panel, Progress } from '@/components/ui/Controls';
import { Button } from '@/components/ui/Button';
import { Field, MoneyInput, Switch } from '@/components/ui/Field';
import { AnimatedNumber, Reveal } from '@/components/animations/Motion';
import { useUserData } from '@/hooks/useData';
import { useMoney } from '@/hooks/useMoney';
import { useFinance } from '@/store/finance';
import { useUI } from '@/store/ui';
import { breakEvenDeductions, computeTax, emptyTaxProfile, LIMITS, TAX_YEAR, type TaxResult } from '@/lib/tax';
import { totals } from '@/lib/finance';
import { EASE } from '@/constants/motion';
import { minorToDecimalString, parseMoney, percent } from '@/utils/money';
import { addDays, addMonths, startOfMonth, todayISO } from '@/utils/dates';
import { cn } from '@/utils/cn';
import type { TaxProfile, TaxRegime } from '@/types';

type Key = Exclude<keyof TaxProfile, 'userId' | 'grossOverride'>;
const FIELDS: { key: Key; label: string; hint: string; cap?: number }[] = [
  { key: 'sec80C', label: 'Section 80C', hint: 'EPF, PPF, ELSS, life insurance, tuition, principal on home loan', cap: LIMITS.sec80C },
  { key: 'sec80D', label: 'Section 80D', hint: 'Health insurance premiums for you, family, parents', cap: LIMITS.sec80D },
  { key: 'sec80CCD1B', label: 'Section 80CCD(1B)', hint: 'Extra NPS contribution', cap: LIMITS.sec80CCD1B },
  { key: 'homeLoanInterest', label: 'Home-loan interest · 24(b)', hint: 'Self-occupied property', cap: LIMITS.homeLoanInterest },
  { key: 'hraExemption', label: 'HRA exemption', hint: 'From your salary slip / Form 16' },
  { key: 'otherDeductions', label: 'Other deductions', hint: '80E, 80G, 80TTA and others' },
];
const rate = (bps: number) => `${bps / 100}%`;

function RegimeCard({ r, best, saving }: { r: TaxResult; best: boolean; saving: number }) {
  const { fmt } = useMoney();
  const tilt = useTilt<HTMLDivElement>(3);
  const f0 = (n: number) => fmt(n, { decimals: false });
  const rows: [string, number, string?][] = [
    ['Gross income', r.gross],
    [r.regime === 'new' ? 'Standard deduction' : 'Deductions (capped)', -r.deductions],
    ['Taxable income', r.taxable, 'strong'],
    ['Tax on slabs', r.slabTax],
    ['Rebate §87A', -r.rebate],
    ['Health & education cess (4%)', r.cess],
  ];
  return (
    <div data-reveal ref={tilt} className="h-full">
      <article className={cn('panel relative flex h-full flex-col p-6', best && '!border-[var(--accent-line)]')}>
        {best && <motion.div layoutId="best-regime" className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[0_0_0_2px_var(--accent-line),0_20px_60px_-30px_var(--accent)]" transition={{ type: 'spring', stiffness: 300, damping: 30 }} />}
        <header className="flex items-start justify-between gap-3">
          <div>
            <div className="label-mono">{r.regime === 'new' ? 'Default regime' : 'With deductions'}</div>
            <h3 className="display-serif mt-1 text-[2.4rem] text-fg">{r.regime === 'new' ? 'New regime' : 'Old regime'}</h3>
          </div>
          {best ? <Badge tone="accent">Saves {f0(saving)}</Badge> : <Badge>{r.effectiveRate}% effective</Badge>}
        </header>
        <div className="mt-4">
          <div className="label-mono">Tax payable</div>
          <div className="display-serif text-[3rem] text-fg"><AnimatedNumber value={r.total} format={f0} duration={1} /></div>
          <div className="text-xs text-fg-3 num">{f0(r.monthly)} / month · {r.effectiveRate}% of income</div>
        </div>
        {/* taxable income split across slabs */}
        <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-surface-3" role="img" aria-label="Taxable income by slab">
          {r.bands.map((b, i) => (
            <motion.span
              key={i}
              title={`${rate(b.rateBps)} on ${f0(b.to - b.from)}`}
              className="h-full border-r border-surface last:border-0"
              style={{ background: `color-mix(in oklab, var(--accent) ${15 + (b.rateBps / 3000) * 85}%, var(--surface-3))` }}
              initial={{ width: 0 }}
              animate={{ width: `${r.taxable ? percent(b.to - b.from, r.taxable) : 0}%` }}
              transition={{ duration: 1, delay: 0.2 + i * 0.06, ease: EASE.outQuint }}
            />
          ))}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] text-fg-3">
          {r.bands.filter((b) => b.tax > 0 || b.rateBps === 0).map((b, i) => <span key={i} className="num">{rate(b.rateBps)} · {f0(b.tax)}</span>)}
        </div>
        <dl className="mt-5 flex flex-col border-t border-line pt-3 text-sm">
          {rows.map(([k, v, s]) => (
            <div key={k} className="flex justify-between border-b border-dashed border-line py-1.5 last:border-0">
              <dt className={cn(s ? 'font-medium' : 'text-fg-2')}>{k}</dt>
              <dd className={cn('num', s && 'font-medium', v < 0 && 'text-pos')}>{v < 0 ? '−' : ''}{f0(Math.abs(v))}</dd>
            </div>
          ))}
        </dl>
        {r.surchargeIgnored && <p className="mt-3 text-xs text-warn">Surcharge above ₹50L income isn’t included.</p>}
      </article>
    </div>
  );
}

export default function TaxPage() {
  const { txs, catMap } = useUserData();
  const userId = useFinance((s) => s.sessionUserId) ?? '';
  const stored = useFinance((s) => s.taxProfiles.find((t) => t.userId === userId));
  const save = useFinance((s) => s.saveTaxProfile);
  const toast = useUI((s) => s.toast);
  const { fmt, symbol, toDisplay, fromDisplay } = useMoney();
  const today = todayISO();
  const f0 = (n: number) => fmt(n, { decimals: false });

  const last12 = { from: addMonths(startOfMonth(today), -12, 1), to: addDays(startOfMonth(today), -1) };
  const autoGross = totals(txs, last12).income;
  const profile = stored ?? emptyTaxProfile(userId);
  const [draft, setDraft] = useState<Record<Key | 'gross', string>>({} as Record<Key | 'gross', string>);
  const [useOverride, setUseOverride] = useState(false);
  useEffect(() => {
    const d = Object.fromEntries(FIELDS.map((f) => [f.key, profile[f.key] ? minorToDecimalString(toDisplay(profile[f.key])) : ''])) as Record<Key | 'gross', string>;
    d.gross = profile.grossOverride ? minorToDecimalString(toDisplay(profile.grossOverride)) : '';
    setDraft(d);
    setUseOverride(profile.grossOverride !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored, toDisplay]);

  const val = (k: Key | 'gross') => fromDisplay(Math.max(0, parseMoney(draft[k] ?? '') ?? 0));
  const live: TaxProfile = useMemo(() => {
    const p = { ...emptyTaxProfile(userId) };
    FIELDS.forEach((f) => (p[f.key] = val(f.key)));
    p.grossOverride = useOverride && val('gross') > 0 ? val('gross') : null;
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, useOverride, userId, fromDisplay]);
  const gross = live.grossOverride ?? autoGross;
  const nw = computeTax('new', gross, live);
  const old = computeTax('old', gross, live);
  const best: TaxRegime = nw.total <= old.total ? 'new' : 'old';
  const saving = Math.abs(nw.total - old.total);
  const breakEven = best === 'new' ? breakEvenDeductions(gross, live) : 0;
  const dirty = JSON.stringify(live) !== JSON.stringify({ ...emptyTaxProfile(userId), ...profile });

  // ledger hints: health-insurance premiums in the last 12 months → 80D
  const healthIns = txs.filter((t) => t.type === 'expense' && t.date >= last12.from && /insurance/i.test(t.title) && /health/i.test(`${t.title} ${catMap.get(t.categoryId ?? '')?.name ?? ''}`)).reduce((s, t) => s + t.amount, 0);

  return (
    <>
      <PageHeader
        title="Tax planner"
        description={`Compare India’s new and old income-tax regimes on your actual income, and see which deductions are worth chasing. Uses ${TAX_YEAR} slabs; estimates only, not tax advice.`}
        actions={dirty ? <Button variant="primary" icon={<Save size={15} />} onClick={() => { save(live); toast({ tone: 'success', title: 'Tax profile saved' }); }}>Save profile</Button> : undefined}
      />
      <BandHero
        eyebrow={`Estimated tax · ${best === 'new' ? 'new' : 'old'} regime`}
        figure={<AnimatedNumber value={Math.min(nw.total, old.total)} format={f0} />}
        caption={saving === 0 ? 'Both regimes cost the same at your income.' : <>The {best} regime saves you <b>{f0(saving)}</b> a year at your income. That works out to {f0(Math.round(Math.min(nw.total, old.total) / 12))} a month to set aside.</>}
        stats={[
          { label: 'Income considered', value: f0(gross), hint: live.grossOverride ? 'your override' : 'last 12 months of income' },
          { label: 'Effective rate', value: `${best === 'new' ? nw.effectiveRate : old.effectiveRate}%` },
          { label: 'Deductions used', value: f0(old.deductions), hint: 'old regime, after caps' },
          { label: 'Take-home / mo', value: f0(Math.round((gross - Math.min(nw.total, old.total)) / 12)) },
        ]}
      />
      <LayoutGroup>
        <Reveal className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <RegimeCard r={nw} best={best === 'new'} saving={saving} />
          <RegimeCard r={old} best={best === 'old'} saving={saving} />
        </Reveal>
      </LayoutGroup>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel className="xl:col-span-8" eyebrow="Old regime" title="Your deductions">
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            {FIELDS.map((f) => {
              const v = val(f.key);
              return (
                <div key={f.key}>
                  <Field label={f.label} hint={f.hint}>
                    {(p) => <MoneyInput {...p} symbol={symbol} value={draft[f.key] ?? ''} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} placeholder="0" />}
                  </Field>
                  {f.cap && (
                    <div className="mt-2">
                      <Progress value={percent(v, f.cap)} label={`${f.label} used`} height={4} color={v > f.cap ? 'var(--warn)' : undefined} animateIn={false} />
                      <div className="mt-1 flex justify-between text-[11px] text-fg-3 num">
                        <span>{v >= f.cap ? 'Fully used' : `${f0(f.cap - v)} room left`}</span>
                        <span>cap {f0(f.cap)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex items-center justify-between gap-4 rounded-[12px] border border-line bg-surface-2/60 p-4">
            <div>
              <div className="text-sm font-medium">Override annual income</div>
              <div className="text-xs text-fg-3">By default we use your last 12 months of recorded income ({f0(autoGross)}).</div>
            </div>
            <div className="flex items-center gap-3">
              {useOverride && <div className="w-40"><MoneyInput symbol={symbol} value={draft.gross ?? ''} onChange={(e) => setDraft({ ...draft, gross: e.target.value })} aria-label="Annual income" /></div>}
              <Switch checked={useOverride} onChange={setUseOverride} label="Override annual income" />
            </div>
          </div>
        </Panel>
        <div className="flex flex-col gap-4 xl:col-span-4">
          <Panel eyebrow="Insight" title="What would change the answer?">
            {best === 'new' ? (
              breakEven === null ? (
                <p className="text-sm text-fg-2">Even maxing every capped deduction, the old regime can’t beat the new one at your income. Keep it simple.</p>
              ) : (
                <p className="text-sm text-fg-2">The old regime would need about <b className="num text-fg">{f0(breakEven)}</b> more in deductions to win. If that’s not realistic, stay on the new regime.</p>
              )
            ) : (
              <p className="text-sm text-fg-2">Your deductions are large enough that the old regime wins by <b className="num text-fg">{f0(saving)}</b>. Remember to declare it to your employer at the start of the year.</p>
            )}
            {live.sec80C < LIMITS.sec80C && best === 'old' && (
              <p className="mt-3 text-sm text-fg-2">You still have <b className="num">{f0(LIMITS.sec80C - live.sec80C)}</b> of 80C room; an ELSS SIP fills it and lowers tax further.</p>
            )}
          </Panel>
          {healthIns > 0 && (
            <Panel eyebrow="Found in your ledger" title="Health insurance premium">
              <p className="text-sm text-fg-2"><b className="num">{f0(healthIns)}</b> paid in the last 12 months. It counts under Section 80D.</p>
              <Button size="sm" variant="secondary" className="mt-3" icon={<Sparkles size={14} />} onClick={() => setDraft({ ...draft, sec80D: minorToDecimalString(toDisplay(healthIns)) })}>Use for 80D</Button>
            </Panel>
          )}
          <p className="flex gap-2 px-1 text-xs text-fg-4"><Info size={13} className="mt-px shrink-0" />Resident individual below 60. Surcharge, capital gains and special-rate income aren’t modelled. Check the current year’s rules before filing.</p>
        </div>
      </div>
    </>
  );
}
