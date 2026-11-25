<div align="center">

# 💸 cadence

### your money, but make it ✨ *rhythm* ✨

**a budget planner that actually slaps.** no cap, your bank app could never.

[![License](https://img.shields.io/badge/License-MIT-007ec6?style=flat)](LICENSE)
[![Stack](https://img.shields.io/badge/Stack-React%2019%20%7C%20TypeScript%20%7C%20Vite-5b5bd6?style=flat)](#-the-stack-its-giving-modern)
[![Financial Guardrails](https://img.shields.io/badge/Financial%20Guardrails-Deterministic%20Plain%20Code-44cc11?style=flat)](#-the-math-is-mathing)
[![Wrong-Approval Rate](https://img.shields.io/badge/Wrong--Approval%20Rate-0.0%25%20%28Safety%20Target%29-10b981?style=flat)](#-the-math-is-mathing)

### 🔗 [**try it live → cadence-budget-planner.vercel.app**](https://cadence-budget-planner.vercel.app)

</div>

---

## 👀 ok but what is it

you know how every budget app looks like a spreadsheet had a midlife crisis? yeah. **not this one.**

cadence is a full personal finance app: income, spending, budgets, savings goals, loans, splitting bills with the group chat, tax, and a little crystal ball that tells you what happens if you buy that car. it runs **entirely in your browser**. no backend, no sign-up, no one selling your data. your money tea stays *your* money tea ☕

> pick a demo profile (**Alex**, **Sarah**, or **Admin**), hit the button, and you're in. zero passwords. it's a demo, bestie, not a bank vault.

---

## ✨ the features (it's giving main character)

| | vibe check |
|---|---|
| 🏠 **overview** | your whole financial era on one screen. giant balance, cash-flow chart, where your money went, month-end forecast, plus a "month in review" written from *your* data |
| 💳 **transactions** | search, filter, sort, bulk delete (with undo bc we all panic-click), CSV import/export |
| 🏦 **accounts** | checking, savings, cards, cash. move money between them without it counting as spending |
| 🎯 **budgets** | weekly/monthly/yearly limits, rollover, and a little tick showing where you'll land at your current pace. lowkey judgmental, highkey helpful |
| 🐷 **goals** | save for the trip, the camera, the down payment. shows when you'll get there and throws confetti at 25/50/75/100% 🎉 |
| 🔁 **recurring** | rent, salary, netflix. posts itself when due. pause, skip, or post early |
| 🏛️ **debts & EMIs** | car loan, edu loan, that credit card you don't talk about. avalanche vs snowball plans + a slider for extra payments → your exact **debt-free date** |
| 🍕 **split** | goa trip with the gang? split equally, by exact amounts, or by % and settle up in the fewest transfers. no more "bro you owe me" texts |
| 🧾 **tax planner** | new vs old regime on your real income (FY 2025-26 slabs). tells you which one saves more. *estimates, not tax advice fr* |
| 🔮 **what-if** | "what if i get a raise / cut dining by 40% / take a 3-month break?" see the next 24 months redraw live |
| 📊 **analytics + reports** | heatmaps, trends, forecasts, and monthly/annual statements you can save as PDF |
| 🛡️ **admin** | manage demo profiles, audit trail, budget policy. (front-end demo only, not real security, we're being honest here) |

---

## 🎨 the aesthetic (we ate)

- **palette:** Vanilla `#FFEBAF` × Moonstone `#4C9DB0`. that's it. that's the brand 🍦🌊
- **light mode** = vanilla paper. **dark mode** = moonstone night where the vanilla flips into the highlighter. both are first-class, not an afterthought
- **giant serif headlines** whose letters rise into place like a movie title card 🎬
- **liquid hero blocks**: a live WebGL shader that flows and reacts to your mouse (no 3D library, just one tiny shader)
- **film-cut page transitions**, a cursor that vibes with buttons, cards that tilt in 3D, a light that follows your mouse
- **every text passes WCAG AA contrast.** pretty AND accessible, imagine
- motion too much? **reduce motion** in settings and it all chills out ✌️

---

## 🧮 the math is mathing

this is the part where we're serious for 5 seconds:

- **no floating-point money.** every amount is stored in whole paise/cents, so `0.1 + 0.2` is exactly `0.3` here. your bank balance won't randomly end in .0000001
- **deterministic plain code.** budgets, loans, tax, splits and forecasts are all regular, testable TypeScript. no AI guessing your money, no vibes-based arithmetic
- **37 unit tests** on the money logic (`npm test`): EMIs, payoff plans, tax slabs (₹12.75L → ₹0 under the new regime ✅), split shares that always add up to the paisa
- **validated everything:** forms, imports and backups go through Zod. fake dates like `2026-13-01` get rejected, no cap

---

## 🛠️ the stack (it's giving modern)

`React 19` · `TypeScript` · `Vite` · `Tailwind CSS 4` · `Framer Motion` · `GSAP` (+ ScrollTrigger, SplitText) · `Lenis` · `Zustand` · `Recharts` · `React Hook Form` · `Zod` · `Lucide`

deployed on **Vercel**. data lives in your browser's localStorage.

---

## 🚀 run it locally (speedrun)

```bash
git clone https://github.com/ruthwik11/Budget_Planner.git
cd Budget_Planner
npm install
npm run dev        # → http://localhost:5180
```

other spells:

```bash
npm test           # run the money-math tests
npm run typecheck  # make sure typescript is happy
npm run build      # production build
```

---

## 📁 where stuff lives

```
src/
  features/     → every page (dashboard, debts, split, tax, what-if…)
  lib/          → the money math (finance, debts, split, tax, simulate) + tests
  components/   → ui pieces, charts, animations, the fancy fx layer
  store/        → app state (zustand)
  schemas/      → validation (zod)
legacy/         → the OG v0 html/css/js version, kept for nostalgia 🥲
docs/           → the nerdy deep dives
```

want the full technical breakdown? → [`docs/TECHNICAL.md`](docs/TECHNICAL.md)
motion design research → [`docs/TTM_MOTION_ANALYSIS.md`](docs/TTM_MOTION_ANALYSIS.md)
everything carried over from v0 → [`docs/FEATURE_PARITY.md`](docs/FEATURE_PARITY.md)

---

## 🙏 the fine print (read it, it's short)

- it's a **front-end demo**. demo login = no real authentication. don't put your actual bank details in here
- your data stays in **your** browser. clear your browser data and it's gone, so use **Settings → Export backup** if you care
- tax numbers are **estimates** based on FY 2025-26 rules. check the current year before you file

---

## 📜 license

[MIT](LICENSE). do whatever, just keep the credit. 🫶

---

<div align="center">

**Built with ❤️ by Ruthwik**

[GitHub](https://github.com/ruthwik11) | [Website](https://cadence-budget-planner.vercel.app)

</div>

---
