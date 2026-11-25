# Feature parity: legacy app → Cadence

The legacy app (`legacy/index.html`, `legacy/style.css`, `legacy/script.js`) was audited line by line. Every capability it had is listed below with its status in the new app.

**Implemented** = same capability. **Improved** = same capability, done better. **Expanded** = substantially more than before.

## Legacy features

| # | Legacy feature (where) | Status | Where it lives now |
|---|---|---|---|
| 1 | Login with role selector + username/password (`login-form`) | Improved | `features/auth/LoginPage.tsx`: pick a profile or type a username. **No passwords are stored.** The legacy app kept plaintext passwords in localStorage, and those keys are purged on load (`services/repository.ts`). The page states clearly that this is demo mode. |
| 2 | One-click demo login (traveler / admin) | Implemented | Profile cards on the login page |
| 3 | Show/hide password toggle | Removed (no passwords) | Not applicable: frontend-only demo with no credentials |
| 4 | Suspended users blocked from login | Implemented | `store/finance.ts → login()`; also force sign-out if suspended mid-session (`app/App.tsx`) |
| 5 | Session in sessionStorage | Improved | Only the profile id is stored, never user objects or credentials |
| 6 | Logout (+ audit log) | Implemented | Sidebar user card, `logout()` |
| 7 | Dark/light theme toggle | Expanded | Two first-class themes + "Auto" (system), no-flash boot script, `styles/index.css` |
| 8 | Currency toggle ₹/€/$/£ with fixed rates | Expanded | 6 currencies (adds AED, SGD), same fixed demo rates (₹90/€, ₹83/$, ₹105/£). Conversion uses integer minor units with one rounding step (`utils/money.ts`) |
| 9 | Dashboard hero: budget / spent / surplus | Expanded | `features/dashboard`: balance, income, expenses, net cash flow, savings rate, month-end projection, available after bills, budget use, total saved |
| 10 | KPI cards: income, expenses, remaining, savings | Improved | Hero stats with period-over-period deltas and animated counters |
| 11 | Overspending alerts (total > income; category > limit) | Expanded | Derived notifications: 80% threshold + overspend + goal milestones + upcoming bills + monthly summary (`hooks/useNotifications.ts`); budget cards flag "Near limit"/"Over" |
| 12 | Toast notifications | Improved | `components/ui/Toaster.tsx`: animated stack, undo actions, live region |
| 13 | Dashboard doughnut of category spending | Improved | Custom SVG donut with sequenced segment draw + linked ranked bars |
| 14 | Dashboard category-budget progress list | Improved | Budget utilisation widget, sorted by utilisation |
| 15 | Recent transactions table with delete | Improved | Recent activity widget → detail drawer (edit / duplicate / delete with undo) |
| 16 | Add income form (title, amount, date, category) | Expanded | Unified transaction editor (income / expense / transfer) with Zod validation, payment method, tags, notes, repeat |
| 17 | Income list + total | Expanded | `/income`: totals, monthly stacked bars, source breakdown, comparisons, payment methods, largest, recurring income, history |
| 18 | Add expense form | Expanded | Same editor; category picker with icons/colours |
| 19 | Category spending grid | Improved | `/expenses` breakdown donut, ranked bars, category vs previous period table |
| 20 | Expense list + total | Expanded | `/expenses` history table with sort, pagination, bulk actions |
| 21 | Savings goals ("city legs"): create, deposit, delete, progress | Expanded | `/goals`: create/edit/delete, contributions + withdrawals, history drawer, ETA, needed per month, on-track flag, milestones with celebration, growth chart |
| 22 | Category budget limits: view + edit per category | Expanded | `/budgets`: create/edit/delete, weekly/monthly/yearly, rollover, projected spend tick, 6-month history, vs-last-period, gauge |
| 23 | Analytics: highest category, count, pie, daily bars, budget-vs-spent bars | Expanded | `/analytics`: cash flow + 3-month forecast, savings-rate trend, month-vs-month pace, annual comparison, category × month heatmap, weekday pattern, largest purchases |
| 24 | Analytics month selector (was unused) | Improved | Working range presets everywhere (MTD/1M/3M/6M/YTD/12M) |
| 25 | Transaction history: search, type, category, month filters, reset | Expanded | `/transactions`: debounced search over title/notes/tags/category, type, category, account, date range, sort, pagination, bulk select/delete, live totals of the filtered set |
| 26 | CSV export | Improved | Formula-injection-safe CSV with exact decimal amounts (`utils/csv.ts`), filtered export, report CSV, audit CSV, system CSV |
| 27 | Settings: name, currency, master budget target | Implemented / Changed | Name + currency + number/date formats. The "master budget" field silently overwrote the first Trip Fund income, which was a data-integrity bug. Totals now come from real income entries, and the Europe dataset still has its ₹15L master budget as an income transaction. |
| 28 | Reset to default Europe 15L data | Improved | Settings → Demo datasets: **Personal finances**, **Europe trip planner** (the original data, ported intact), **Start fresh** |
| 29 | End session button | Implemented | Sign-out in sidebar |
| 30 | Admin dashboard: users, system income/expenses/balance, charts | Improved | `/admin`: KPIs, 12-month system cash flow, merged category mix, spending by user, latest audit events |
| 31 | Admin user management: list, suspend/activate, delete (+cascade) | Implemented | `/admin/users` with confirm dialogs; deleting cascades to all of that user's records |
| 32 | Admin create user (name, username, password, role) | Improved | No password stored; new profile gets default categories, a main account and the default budget policy |
| 33 | Admin all-transactions monitor: search, user, type, export, delete | Implemented | `/admin/transactions` (+ pagination); deletes are audit-logged |
| 34 | Audit trail + clear | Expanded | `/admin/audit`: timeline, filter, CSV export, clear (logs its own clear) |
| 35 | Default category budget policy for new users | Improved | `/admin/policy`: editable rows (any category), validated |
| 36 | Reset sample DB / wipe DB | Implemented | `/admin/policy` maintenance + Settings |
| 37 | Mobile sidebar with hamburger + overlay | Improved | Bottom tab bar with centre "+" + swipe-to-close drawer |

## New features (not in the legacy app)

- Transfers between accounts (not counted as income/expense), multiple accounts with types, opening balances, balance history, archive/restore
- Recurring transactions: daily/weekly/monthly/yearly with interval, auto-posting when due, post-now, skip, pause, 5-week calendar, upcoming preview, monthly-equivalent totals
- Custom categories with icon + colour; used categories archive instead of breaking history
- Reports: monthly/annual statements with focus modes (income, expense, category, budget performance), print/PDF with a forced light "paper" theme
- Forecasting: month-end balance (discretionary pace + scheduled bills) and 3-month projection
- Unusual-expense detection (≥2.5× category median)
- Customisable dashboard (drag to reorder, show/hide, expand charts), date-range presets, period comparisons
- Command palette (⌘K / Ctrl K / `/`), `N` for new transaction, hide-amounts privacy mode
- JSON backup export/import (schema-validated), CSV transaction import with preview
- Notification centre with read/dismiss state and per-type preferences
- Reduced-motion and smooth-scroll preferences

## Bugs in the legacy app that are fixed

- Plaintext passwords in localStorage → no credentials stored, legacy keys purged
- `innerHTML` with user-entered titles (stored XSS) → React escaping everywhere, Zod-sanitised input
- Floating-point money (`parseFloat`, `toFixed`) → integer minor units throughout
- Month filters ignored by the analytics/total functions (`filterMonthISO` was unused) → every view honours its date range
- "Master budget" setting overwrote an income record → removed
- Category totals hard-coded to 9 trip categories (unknown categories collapsed into "Other") → fully dynamic categories
