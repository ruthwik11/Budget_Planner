# Cadence: Budget Planner

A frontend-only personal finance app: income and expenses, budgets, savings goals, recurring transactions, multiple accounts, analytics, forecasts and reports. Data lives in your browser. There is no backend.

```bash
npm install
npm run dev        # http://localhost:5180
npm test           # financial-math unit tests (Vitest)
npm run typecheck
npm run build
```

Sign in by picking a demo profile (**Alex** or **Sarah**, personal) or **System Admin**. There are no passwords. Profiles are demo identities, and the admin role is a frontend demonstration, not access control.

## Modules (v2)

- **Debts & EMIs** (`/debts`): loans, EMIs and card balances; payments split into interest and principal; avalanche or snowball payoff plans with an extra-payment slider; debt-free date, interest saved, debt-to-income ratio, amortization schedules.
- **Split** (`/split`): groups, shared expenses split equally, by exact amounts or by percentage (shares always sum exactly), balances, and settle-up in the fewest transfers.
- **Tax planner** (`/tax`): India's new vs old regime on your real income (FY 2025-26 slabs, §87A rebate with marginal relief, 4% cess), deduction caps, break-even insight, ledger hints for 80D. Estimates only.
- **What-if** (`/what-if`): change income, add costs, trim categories, model a big purchase or a job gap, and see a 24-month projection plus how goal dates shift.

All of their maths lives in `src/lib/{debts,split,tax,simulate}.ts`, covered by `src/lib/modules.test.ts`.

## Stack

React 19 · TypeScript · Vite 6 · Tailwind CSS 4 · Framer Motion 12 · GSAP 3 (ScrollTrigger, SplitText) · Lenis · Zustand 5 · React Router 7 · Recharts 2 · React Hook Form + Zod · Lucide.

## Structure

```
src/
  app/                 App shell, router (lazy routes), guards, error boundary
  components/
    ui/                Button, Field/Input/Select/MoneyInput/Switch/Checkbox, Dialog/Drawer/Confirm,
                       Segmented, Badge, Progress, Ring, Menu, Panel, Delta, Toaster, CategoryGlyph
    layout/            AppShell (sidebar, top bar, mobile tab bar + drawer), CommandPalette, PageHeader, Wordmark
    charts/            Cash-flow composed chart, area, bars, custom SVG donut, rank bars, sparkline, tooltip, legend chips
    animations/        GSAP setup; AnimatedNumber, SplitReveal, Reveal, ScrollLitText, Ticker, Parallax,
                       useRecoil, useMagnetic, burst; CurtainIntro, SmoothScroll (Lenis), PageTransition
  features/            dashboard · transactions · accounts · income · expenses · budgets · savings ·
                       recurring · analytics · reports · notifications · settings · admin · auth
  lib/finance.ts       Pure calculations (totals, balances, budgets + rollover, goals, recurrence, forecasts, anomalies)
  store/               finance (domain data + actions), prefs (persisted preferences), ui (toasts, overlays)
  services/            Repository boundary (localStorage today, swappable for an API)
  schemas/             Zod schemas for every form, persisted data, backups and CSV rows
  mock-data/seed.ts    Deterministic demo datasets generated relative to today
  hooks/ utils/ constants/ types/ styles/
legacy/                The original three files, kept as the functional reference only
docs/                  TTM motion analysis · feature-parity checklist
```

## Money

All amounts are **integer minor units** (paise/cents). User input is parsed as a string straight to minor units (`parseMoney`), so `0.1 + 0.2` is exactly `30`. Currency conversion is one integer multiply/divide with a single rounding step. Formatting passes exact decimal strings to `Intl.NumberFormat`. Tests in `src/lib/finance.test.ts` cover parsing, conversion, totals, transfers, rollover budgets, goal ETAs, month-end clamping for recurrences and forecasts.

## Design system

**Palette: Vanilla `#FFEBAF` × Moonstone `#4C9DB0`.** Light is the default theme ("Vanilla"). The page is true Vanilla paper, cards are a lighter cream, Moonstone carries every action (buttons, active nav, links, focus, the income series), and text is a deep Moonstone ink (`#11343D`) instead of black. The dark theme ("Moonstone night") is a deep Moonstone-ink ledger with Vanilla as the highlighter for primary actions and figures. Gains (sea green), losses (terracotta) and warnings (ochre) are tuned to sit inside the palette. Every text/background pair passes WCAG AA (4.7:1 minimum). Buttons use dark ink on Moonstone (4.9:1), because Vanilla on Moonstone is only 2.6:1. That swatch pairing appears only in the decorative intro curtain.

- **Tokens** are in `src/styles/index.css`: backgrounds (`bg`, `sunken`), three surface steps, hover, two line weights, four text levels, accent/pos/neg/warn/info with soft variants, grid colour, three shadow levels (inset highlight + depth in dark mode), scrim, type scale, radii and easing curves. Tailwind reads them through `@theme`, so `bg-surface`, `text-fg-3`, `border-line` and the rest switch with the theme.
- **Type.** Geist for UI. Geist Mono, uppercase and tracked, for labels and metadata (the "ledger" voice). Instrument Serif italic for a few editorial accents. Every figure uses tabular, slashed-zero numerals (`.num`).
- **Category palette.** Ten hues derived from the two brand colours (moonstone, vanilla gold, deep teal, seafoam, sage, terracotta…) in `constants/palette.ts`. Data saved under the old palette is recoloured on load (`LEGACY_COLOR_MAP`).
- **One container** (`Panel`): 1px hairline, 14px radius, a faint top light, and a mono eyebrow over the title. Hierarchy comes from type and spacing, not from nesting cards inside cards.

## Motion

**v2 layer** (`src/components/fx/`): film-cut route transitions (band panel + page title in display serif), editorial kinetic headlines, colour-block bands over a WebGL liquid shader (`LiquidCanvas`, no 3D library), a cursor follower, pointer spotlight on panels, 3D tilt on cards, a velocity-reactive word marquee. Film cuts and the cursor can be turned off in Settings; everything respects reduced motion.

The motion language comes from a runtime study of ttm.supply. See [`docs/TTM_MOTION_ANALYSIS.md`](TTM_MOTION_ANALYSIS.md) for what was observed, what was inferred, and how each idea was translated. In brief:

- **Two speeds.** UI feedback runs 0.15–0.45s. Spatial "settle" moves run 0.9–2.6s on expo-out. Tokens are in `constants/motion.ts`.
- **GSAP** handles orchestrated timelines (curtain intro, dashboard hero entrance), SplitText word/char reveals, counters, ScrollTrigger batch reveals, scroll-scrubbed "lit" text, the velocity-reactive ticker, the gauge needle (`svgOrigin` + elastic), the orbit ring on login, pointer recoil, magnetic buttons and milestone bursts.
- **Framer Motion** handles route transitions, shared-layout indicators (nav, segmented controls, tabs, command palette highlight), dialogs, drawers, sheets, toasts, list presence, SVG path drawing and springs.
- **CSS** handles hover colour shifts and lightweight keyframes.
- Every GSAP effect is scoped with `gsap.context()` and reverted on unmount.
- `prefers-reduced-motion`, or Settings → Reduce motion, disables the curtain, counters, reveals, scrubs, the ticker and Lenis, and content renders in its final state.

## Security notes (frontend scope)

- No credentials are stored. The legacy app's plaintext-password keys are removed on load.
- All rendering goes through React, with no `dangerouslySetInnerHTML`. Text inputs are trimmed and stripped of control characters by Zod.
- Imports (CSV and JSON backups) are size-capped at 5 MB, parsed without `eval`, and schema-validated before anything is written. CSV import shows a preview first.
- CSV exports neutralise spreadsheet formula injection.
- Downloads use revocable Blob URLs. No user data goes into URLs.
- Persisted data is re-validated on load. If validation fails, the app starts from a clean workspace instead of crashing.

This is **not** secure authentication. Anyone with access to the browser can read or change the data.

## Swapping in a backend

`services/repository.ts` defines `DataRepository { load, save, clear }`. The store only goes through that interface, so an HTTP implementation can replace `localRepository` without touching UI code.
