import { useCallback, useMemo } from 'react';
import { usePrefs } from '@/store/prefs';
import { useFinance } from '@/store/finance';
import { CURRENCIES, convert, formatCompact, formatMoney } from '@/utils/money';
import type { Minor } from '@/types';

/**
 * Formatting bound to the user's display currency & number locale.
 * Stored values are in the workspace base currency; conversion happens here, at display time only.
 */
export function useMoney() {
  const currency = usePrefs((s) => s.currency);
  const locale = usePrefs((s) => s.locale);
  const hide = usePrefs((s) => s.hideAmounts);
  const base = useFinance((s) => s.baseCurrency);

  const toDisplay = useCallback((m: Minor) => convert(m, base, currency), [base, currency]);
  const fromDisplay = useCallback((m: Minor) => convert(m, currency, base), [base, currency]);

  const fmt = useCallback(
    (m: Minor, o?: { decimals?: boolean; sign?: 'auto' | 'always' | 'never'; reveal?: boolean }) => {
      if (hide && !o?.reveal) return '••••••';
      return formatMoney(toDisplay(m), { currency, locale, decimals: o?.decimals, sign: o?.sign });
    },
    [currency, locale, hide, toDisplay],
  );
  const compact = useCallback(
    (m: Minor) => (hide ? '•••' : formatCompact(toDisplay(m), { currency, locale })),
    [currency, locale, hide, toDisplay],
  );
  return useMemo(
    () => ({ fmt, compact, toDisplay, fromDisplay, currency, locale, base, symbol: CURRENCIES[currency].symbol, hidden: hide }),
    [fmt, compact, toDisplay, fromDisplay, currency, locale, base, hide],
  );
}
export type MoneyApi = ReturnType<typeof useMoney>;
