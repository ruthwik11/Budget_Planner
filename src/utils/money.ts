import type { Minor } from '@/types';

/**
 * Money is always handled as integer minor units (1/100 of a unit).
 * Floats only appear at the very edge: when Intl formats a decimal string.
 */

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'SGD';

export interface CurrencyMeta {
  code: CurrencyCode;
  symbol: string;
  name: string;
  /** Demo rate: paise of INR per 1 major unit. Fixed so math is deterministic. */
  inrPaise: number;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', inrPaise: 100 },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', inrPaise: 8300 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', inrPaise: 9000 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', inrPaise: 10500 },
  AED: { code: 'AED', symbol: 'AED', name: 'UAE Dirham', inrPaise: 2260 },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', inrPaise: 6200 },
};

export type NumberLocale = 'en-IN' | 'en-US' | 'de-DE' | 'fr-FR';

/** Convert minor units between currencies with a single rounding step. */
export function convert(minor: Minor, from: CurrencyCode, to: CurrencyCode): Minor {
  if (from === to) return minor;
  return Math.round((minor * CURRENCIES[from].inrPaise) / CURRENCIES[to].inrPaise);
}

/** Exact decimal string for a minor amount, e.g. -123456 → "-1234.56". */
export function minorToDecimalString(minor: Minor): string {
  const neg = minor < 0;
  const abs = Math.abs(Math.trunc(minor));
  const units = Math.floor(abs / 100);
  const cents = abs % 100;
  return `${neg ? '-' : ''}${units}.${cents.toString().padStart(2, '0')}`;
}

/**
 * Parse user input like "1,23,456.7" or "1234" into minor units without floats.
 * Returns null for invalid input.
 */
export function parseMoney(input: string | number): Minor | null {
  const raw = String(input).trim().replace(/[\s,_]/g, '').replace(/^[^\d.-]+/, '');
  if (!/^-?\d*(\.\d{0,2})?$/.test(raw) || raw === '' || raw === '-' || raw === '.') return null;
  const neg = raw.startsWith('-');
  const [intPart = '0', fracPart = ''] = raw.replace('-', '').split('.');
  const units = Number(intPart || '0');
  const cents = Number((fracPart + '00').slice(0, 2));
  if (!Number.isSafeInteger(units * 100 + cents)) return null;
  const v = units * 100 + cents;
  return neg ? -v : v;
}

/** Minor → plain number of major units, for chart scales only (never for math). */
export const toMajor = (minor: Minor) => minor / 100;

const fmtCache = new Map<string, Intl.NumberFormat>();
function nf(locale: string, opts: Intl.NumberFormatOptions) {
  const key = locale + JSON.stringify(opts);
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, opts);
    fmtCache.set(key, f);
  }
  return f;
}

export interface FormatOptions {
  currency: CurrencyCode;
  locale: NumberLocale;
  decimals?: boolean;
  sign?: 'auto' | 'always' | 'never';
}

export function formatMoney(minor: Minor, o: FormatOptions): string {
  const decimals = o.decimals ?? true;
  const f = nf(o.locale, {
    style: 'currency',
    currency: o.currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
    signDisplay: o.sign === 'always' ? 'exceptZero' : o.sign === 'never' ? 'never' : 'auto',
  });
  const value = decimals ? minorToDecimalString(minor) : String(Math.round(minor / 100));
  // Intl accepts exact decimal strings (NumberFormat v3); avoids float rounding.
  return f.format(value as unknown as number);
}

/** Compact form for axes and dense UI: ₹12.4L, $1.2M, €840. */
export function formatCompact(minor: Minor, o: Pick<FormatOptions, 'currency' | 'locale'>): string {
  const major = minor / 100;
  const abs = Math.abs(major);
  const sym = CURRENCIES[o.currency].symbol;
  const sign = major < 0 ? '−' : '';
  if (o.locale === 'en-IN') {
    if (abs >= 1e7) return `${sign}${sym}${trim(abs / 1e7)}Cr`;
    if (abs >= 1e5) return `${sign}${sym}${trim(abs / 1e5)}L`;
    if (abs >= 1e3) return `${sign}${sym}${trim(abs / 1e3)}K`;
    return `${sign}${sym}${Math.round(abs)}`;
  }
  if (abs >= 1e9) return `${sign}${sym}${trim(abs / 1e9)}B`;
  if (abs >= 1e6) return `${sign}${sym}${trim(abs / 1e6)}M`;
  if (abs >= 1e3) return `${sign}${sym}${trim(abs / 1e3)}K`;
  return `${sign}${sym}${Math.round(abs)}`;
}

function trim(n: number) {
  return n >= 100 ? Math.round(n).toString() : n.toFixed(1).replace(/\.0$/, '');
}

/** Integer-safe percentage (0–100+, one decimal) without accumulating float error. */
export function percent(part: Minor, whole: Minor): number {
  if (whole === 0) return 0;
  return Math.round((part * 1000) / whole) / 10;
}

export const sumMinor = (values: Minor[]) => values.reduce((a, b) => a + b, 0);
