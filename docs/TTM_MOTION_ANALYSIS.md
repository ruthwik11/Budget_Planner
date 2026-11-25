# TTM.SUPPLY — Motion Analysis

Reference: https://ttm.supply/ (inspected 2026-11-25)
Purpose: study motion *principles* for the Cadence budget planner. No code, assets, copy or branding are reused.

## How this was investigated

REA (Reverse Engineer Anything) was **not installed** on this machine. Its setup (`npx rea-agents setup`) rewrites Claude Code's MCP configuration and needs a Claude Code restart, so it could not be used inside the session that did this work. The investigation used the built-in browser instead, which gives the same runtime access REA relies on:

- live `window` inspection (loaded libraries, versions, globals)
- enumerating every live `ScrollTrigger` instance and its config
- fetching the site's own JS bundles in-page and extracting every `gsap.*`, `SplitText` and `ease:` call
- walking `document.styleSheets` for transition durations and `cubic-bezier` curves
- scrolling the page and screenshotting each stage

Each finding below is tagged **[Observed]** (read directly from runtime code, CSS or screenshots) or **[Inferred]** (my reading of how pieces fit together).

## 1. Stack [Observed]

| Layer | Library | Notes |
|---|---|---|
| Timeline / tween engine | GSAP 3.12.5 | jQuery-era code, `gsap.to(el, dur, vars)` legacy signature |
| Scroll | ScrollTrigger | 8 live triggers on the home page |
| Text splitting | SplitText | `type: "lines"` and `type: "words"` |
| Smooth scroll | Lenis | `duration: 1.2`, easing `t => min(1, 1.001 - 2^(-10t))` (expo-out), wheel smoothing on, touch smoothing **off** |
| Page transitions | Swup + HeadPlugin | AJAX page swaps; GSAP fades `header, .blocks, footer` to 0, then back |
| Media | `<canvas class="morphCanvas">` ×2 | Video frames drawn to canvas for a morph/warp effect |
| Fonts | Poppins | One family, weight carries hierarchy |

## 2. Observed patterns

### 2.1 Intro curtain [Observed CSS + inline script]
- An inline boot script adds `html.intro` unless `prefers-reduced-motion: reduce` matches, and removes it after 6 s (safety cutoff).
- `.introScreen` is a fixed full-viewport stack of layers: three thin coloured bands (`height: calc(3px + max(6px, .75vw))`) plus a dark layer holding the logo.
- Each layer has an SVG `.introEdge` path hanging off its bottom edge (`top: 100%`), so the wipe edge is **curved**, not straight.
- [Inferred] Layers translate upward in sequence, with the coloured bands trailing the dark layer like a striped hem.

### 2.2 Word reveal [Observed JS]
```
SplitText(type: "words")
per word: duration .9, y → 0, rotate → 0, opacity → 1, ease power3.out
delay per word: 0.3 s (default) or 0.1 s ("words-fast")
trigger: ScrollTrigger start "0% 90%" (or "0% 100%" for direct), onEnter, fires once
```
After completion each word gets `transformNone` so the browser can drop compositor layers.

### 2.3 Line reveal + scroll-scrubbed "reading" fill [Observed JS + screenshots]
- `SplitText(type: "lines")`. Each line slides up `.3s` (power1.out), staggered `0.05 s` per line.
- A per-line `.scrollLine` element widens from `0%` → `100%` in `.15s` steps as scroll progress crosses each line. On screen this reads as body copy going from dim grey to full white **line by line** as you scroll ("Every social post meant…" in the captures).

### 2.4 Orbit ring entrance [Observed JS + screenshots]
- Product cards sit on a ring around a centred headline. Position is computed every update from polar coordinates: `x = cx + cos(a)·r`, `y = cy + sin(a)·r`.
- Entrance: `gsap.to(entry, { turn: 0, r: 1, duration: 2.6, ease: "expo.out", delay: .65 })`. The ring both **unwinds** (turn → 0) and **expands** (r → 1) together. That two-parameter tween is why it looks like a fly-in rather than a fade.
- A "ring rush" timeline: `power2.out .4s` spike, then `power2.inOut 2.2s` settle.
- Card labels fade after the cards: `opacity 1, duration .8, power1.out, stagger .05`.

### 2.5 Pinned curved word wheel ("toolkit") [Observed JS]
- Section is pinned (`start: "center center"`).
- Items are placed with `y = (d + line)·row`, `x = bend(d)·k`, where `d` is distance from the centre row. The list bends around an arc.
- Colour per item is `gsap.utils.interpolate(dim, lit, w)`, where `w` is closeness to centre. The centre item is lit and slightly scaled, and the rest fade into a mask gradient (`transparent → black 12% → black 88% → transparent`).

### 2.6 Velocity-aware marquee [Observed JS]
- Infinite loop: `xPercent: -100, ease: "linear", repeat: -1`, started at `totalProgress(.5)`.
- Scroll direction flips `timeScale` (`gsap.to(tl, .6, { timeScale: ±direction })`), so the marquee reverses with scroll.
- A second variant boosts speed while hovered (`timeScale: boost, .3s`) and eases back (`timeScale: 1, .8s`).
- Separate scrubbed timeline: `scrollTrigger { start: "top bottom", end: "bottom top", scrub: 1 }` for parallax drift.

### 2.7 Pointer-reactive card "squash" [Observed JS]
```
timeline
 .to(img, { xPercent: -nx*24, yPercent: -ny*24, rotation: nx*ny*-14 + nx*6, scale: 1 - .22*(1-edge), duration: .22, ease: power2.out })
 .to(img, { xPercent: 0, yPercent: 0, rotation: 0, scale: 1, duration: 1, ease: "bounce.out" })
```
The element recoils away from the pointer's entry point, then springs back. It's a fast hit followed by a slow, elastic recovery.

### 2.8 Band reveal drawing [Observed JS]
`gsap.to(state, { p: 1, duration: bandReveal, ease: "power2.inOut", onUpdate: draw(x0 + (x1-x0)·p, sin(πp)) })`. A canvas shape draws itself left→right, with a sine bulge peaking mid-way.

### 2.9 Accordion [Observed JS]
Height tweens `.3s` and calls `ScrollTrigger.refresh()` on every update, so pinned and scrubbed sections below never desync.

### 2.10 Video on scroll [Observed]
Videos have a ScrollTrigger at `start "0% 150%"`, `end "150% 0%"`, so they play/pause only while near the viewport. This is a performance gate.

## 3. Timing & easing vocabulary [Observed CSS]

Most frequent CSS transition durations: **.45s** (227 uses), .3s (90), .15s (52), .2s (45), .5s (41), .6s, .7s.

Most frequent curves:

| Curve | Uses | Character |
|---|---|---|
| `cubic-bezier(.65, 0, .35, 1)` | 19 | symmetric in-out (≈ easeInOutCubic) — state changes |
| `cubic-bezier(.76, 0, .24, 1)` | 10 | steep in-out (≈ easeInOutQuart) — wipes, panels |
| `cubic-bezier(.2, .8, .3, 1)` | 10 | fast-out, soft land — UI entrances |
| `cubic-bezier(.22, 1, .36, 1)` | 5 | easeOutQuint — reveals |
| `cubic-bezier(.3, 1.4, .5, 1)` / `(.2, 1.35, .35, 1)` | 9 | **overshoot** — playful pops on small elements |

GSAP side: `power3.out` (text), `expo.out` (big spatial moves, 2.6 s), `power1.out` (fades), `power2.inOut` (draws), `bounce.out` (pointer recoil), `none` (scrubbed/linear loops).

## 4. Responsive & accessibility behaviour
- [Observed] Everything is sized in `vw`, so type and motion distances scale with the viewport.
- [Observed] Lenis smooths the wheel only (`smoothTouch: false`), and native touch scrolling is kept on mobile.
- [Observed] The intro is skipped entirely under `prefers-reduced-motion`.
- [Observed] ScrollTrigger gates video playback. [Inferred] Canvas morphs are paused off-screen the same way.

## 5. Principles extracted

1. **Two-speed motion.** Big spatial moves are slow (1.2–2.6 s, expo.out). UI feedback is fast (.15–.45 s). Nothing sits in a muddy middle.
2. **Choreography over decoration.** The order is curtain → headline words → ring unwinds → labels. Each layer waits for the previous one.
3. **Motion carries meaning.** Text lighting up as you read and the wheel lighting the focused item both use motion to show *where attention is*.
4. **Physical response to input.** Scroll velocity, scroll direction and pointer entry vector all feed the animation.
5. **Clean up after yourself.** Transforms are cleared after reveals, off-screen media is paused, and triggers refresh on layout change.

## 6. Translation into Cadence (priority order)

| # | TTM principle | Cadence implementation | Where |
|---|---|---|---|
| 1 | Intro curtain with curved hem and colour bands | `CurtainIntro`: ink panel + 3 thin category-colour bands with an SVG curved edge, GSAP timeline wipes up (`.76,0,.24,1`, ~1.1 s), staggered 70 ms. Once per session, skipped under reduced motion. | Login → app entry |
| 2 | Word reveal, power3.out .9 s | `SplitReveal` (GSAP SplitText, words or chars, y 110% + rotate 4° → 0) | Page titles, dashboard greeting |
| 3 | Expo-out "settle" for big moves | `AnimatedNumber` counter (GSAP, `expo.out`, 1.6 s), tabular numerals so digits don't jitter | Balance hero, KPI strip, goal totals |
| 4 | Line-by-line scroll-lit text | `ScrollLitText`: insight narrative lines scrub dim → lit with ScrollTrigger | Dashboard "month in review" narrative |
| 5 | Orbit ring unwind (turn + radius tween) | Login: category glyphs orbit the wordmark, unwinding with `expo.out` 2.6 s. Goals: progress rings sweep in. | Login, Savings |
| 6 | Velocity-aware marquee | `Ticker`: recent activity tape whose `timeScale` follows Lenis velocity and direction | Dashboard header band |
| 7 | Pointer recoil + bounce settle | `useRecoil` on the primary FAB and goal cards (fast hit .22 s, `elastic.out` return 1 s) | New-transaction button, goal cards |
| 8 | Band draw with power2.inOut | Chart lines draw via stroke-dash, donut segments sweep in sequence | All charts |
| 9 | Overshoot curves for small pops | Badges, toggles, notification dot (`cubic-bezier(.3,1.4,.5,1)`) | UI primitives |
| 10 | Lenis expo smoothing, touch native | Lenis 1.2 s, `syncTouch` off, driven by `gsap.ticker`, disabled under reduced motion or the user setting | App-wide |
| 11 | Pinned focus wheel | Not used. Pinning in a data app hijacks scrolling people need for reading tables; the dim→lit idea is reused in §4 instead. | — |
| 12 | Swup fade between pages | Framer Motion `AnimatePresence` route transition (y + subtle blur, 450 ms) plus a shared `layoutId` nav indicator | Routing |

## 7. Guardrails for a finance app
- Numbers animate **into** their value once per change. They never loop or wobble, and the final value is always the exact formatted figure.
- No pinning or scroll-jacking around tables or forms.
- All GSAP work lives in `gsap.context()` scoped to a component and is reverted on unmount.
- `prefers-reduced-motion` (or the in-app "Reduce motion" setting) turns off the curtain, counters, scrubs, marquee and Lenis. Content appears in its final state.
