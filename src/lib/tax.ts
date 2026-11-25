/**
 * Indian income-tax estimator for individuals (resident, below 60, salaried).
 * Rules: FY 2025-26 (AY 2026-27), as announced in Union Budget 2025.
 *  · New regime: standard deduction ₹75,000; slabs 0–4L nil, 4–8L 5%, 8–12L 10%,
 *    12–16L 15%, 16–20L 20%, 20–24L 25%, >24L 30%; §87A rebate up to ₹60,000 when
 *    taxable income ≤ ₹12L, with marginal relief just above ₹12L.
 *  · Old regime: standard deduction ₹50,000; slabs 0–2.5L nil, 2.5–5L 5%, 5–10L 20%,
 *    >10L 30%; §87A rebate up to ₹12,500 when taxable ≤ ₹5L; deductions capped
 *    (80C 1.5L, 80D 1L ceiling here, 80CCD(1B) 50k, home-loan interest 2L).
 *  · 4% health & education cess. Surcharge (income > ₹50L) is NOT modelled.
 * Estimates only, not tax advice.
 */
import type { Minor, TaxProfile, TaxRegime } from '@/types';

const L = (lakh: number) => Math.round(lakh * 100000 * 100); // ₹ lakh → paise

export const TAX_YEAR = 'FY 2025-26';
export const LIMITS = {
  sec80C: L(1.5),
  sec80D: L(1),
  sec80CCD1B: L(0.5),
  homeLoanInterest: L(2),
};

type Slab = [upTo: number, rateBps: number];
const NEW_SLABS: Slab[] = [[L(4), 0], [L(8), 500], [L(12), 1000], [L(16), 1500], [L(20), 2000], [L(24), 2500], [Infinity, 3000]];
const OLD_SLABS: Slab[] = [[L(2.5), 0], [L(5), 500], [L(10), 2000], [Infinity, 3000]];

export function slabTax(taxable: Minor, slabs: Slab[]): { tax: Minor; bands: { from: Minor; to: Minor; rateBps: number; tax: Minor }[] } {
  let prev = 0;
  let tax = 0;
  const bands: { from: Minor; to: Minor; rateBps: number; tax: Minor }[] = [];
  for (const [upTo, rate] of slabs) {
    if (taxable <= prev) break;
    const top = Math.min(taxable, upTo);
    const t = Math.round(((top - prev) * rate) / 10000);
    bands.push({ from: prev, to: top, rateBps: rate, tax: t });
    tax += t;
    prev = upTo;
  }
  return { tax, bands };
}

export interface TaxResult {
  regime: TaxRegime;
  gross: Minor;
  deductions: Minor;
  taxable: Minor;
  slabTax: Minor;
  rebate: Minor;
  cess: Minor;
  total: Minor;
  effectiveRate: number; // % of gross
  monthly: Minor;
  bands: { from: Minor; to: Minor; rateBps: number; tax: Minor }[];
  surchargeIgnored: boolean;
}

export function oldRegimeDeductions(p: TaxProfile): Minor {
  return (
    L(0.5) +
    Math.min(p.sec80C, LIMITS.sec80C) +
    Math.min(p.sec80D, LIMITS.sec80D) +
    Math.min(p.sec80CCD1B, LIMITS.sec80CCD1B) +
    Math.min(p.homeLoanInterest, LIMITS.homeLoanInterest) +
    p.hraExemption +
    p.otherDeductions
  );
}

export function computeTax(regime: TaxRegime, gross: Minor, p: TaxProfile): TaxResult {
  const deductions = regime === 'new' ? L(0.75) : oldRegimeDeductions(p);
  const taxable = Math.max(0, gross - deductions);
  const { tax, bands } = slabTax(taxable, regime === 'new' ? NEW_SLABS : OLD_SLABS);
  let rebate = 0;
  if (regime === 'new') {
    if (taxable <= L(12)) rebate = Math.min(tax, L(0.6));
    else if (tax > taxable - L(12)) rebate = tax - (taxable - L(12)); // marginal relief
  } else if (taxable <= L(5)) rebate = Math.min(tax, L(0.125));
  const afterRebate = tax - rebate;
  const cess = Math.round(afterRebate * 0.04);
  const total = afterRebate + cess;
  return {
    regime, gross, deductions, taxable, slabTax: tax, rebate, cess, total,
    effectiveRate: gross > 0 ? Math.round((total * 1000) / gross) / 10 : 0,
    monthly: Math.round(total / 12), bands, surchargeIgnored: taxable > L(50),
  };
}

/** Extra old-regime deductions needed before old beats new (null if it never can within caps). */
export function breakEvenDeductions(gross: Minor, p: TaxProfile): Minor | null {
  const target = computeTax('new', gross, p).total;
  if (computeTax('old', gross, p).total <= target) return 0;
  let lo = 0;
  let hi = L(20);
  const at = (extra: Minor) => computeTax('old', gross, { ...p, otherDeductions: p.otherDeductions + extra }).total;
  if (at(hi) > target) return null;
  while (hi - lo > 100) {
    const mid = Math.floor((lo + hi) / 2);
    if (at(mid) <= target) hi = mid;
    else lo = mid;
  }
  return hi;
}

export const emptyTaxProfile = (userId: string): TaxProfile => ({
  userId, grossOverride: null, sec80C: 0, sec80D: 0, sec80CCD1B: 0, homeLoanInterest: 0, hraExemption: 0, otherDeductions: 0,
});
