# FeelFit — Design System

Calm, premium, trustworthy. Light-first, monochrome base with semantic medical
colors and a warm "AskFit" accent. Everything is driven by CSS variables, so
changing a token restyles the whole app.

---

## Tokens (`frontend/styles/globals.css`)
- **Themes:** `:root` = dark, `.light` = default. The whole palette swaps via tokens.
- **Backgrounds / surfaces:** `--bg`, `--bg1..4`, `--surf`, `--surf2/3`.
- **Text:** `--txt`, `--txt2/3/4` (decreasing emphasis).
- **Borders:** `--bd`, `--bd2/3` (hairlines).
- **Brand (monochrome):** `--accent` (black on light / white on dark), grads.
- **AskFit accent ("love + fit"):** `--askfit` (emerald, theme-aware),
  `--askfit-2` (rose), `--askfit-grad` (rose→emerald), `--askfit-bg/bd/glow`.
- **Semantic (kept colored for clarity):** `--ok` (green), `--warn` (amber),
  `--danger` (red), `--crit` (rose) — each with `-bg`, `-bd`, `-glow`.
- **Radius/shadow/transition** scales; `--ff` display font, `--fb` body, `--fm` mono.

## Typography
- Display + body: **Della Respira** (serif) — `--ff` / `--fb`.
- Weight forced to **400** (the face ships only 400; faux-bold removed for an even,
  light look). Numbers use **DM Mono** (`--fm`) for tabular alignment.

## Components (`frontend/components/ui/`)
- `Icon.tsx` — a single stroke-icon set (activity, heart, dumbbell, salad, bottle,
  scale, calendar, people, lotus, droplet, paperclip, mic, globe, …).
- `BrandMark.tsx` — the **"F" monogram** (green-gradient F + leaf flick). Favicon
  mirrors it (`public/favicon.svg`).
- `index.tsx` — `Btn`, `Card`, `Badge`, `Collapse`, `Modal`, `Input`, `SecHead`,
  `Skeleton`, `Toast`.
- `motion.tsx` — Framer wrappers (`FadeIn`, `Reveal`, `Stagger`, `AnimatedRing`,
  `AnimatedNumber`, `PageTransition`, eases/springs).

## Signature motifs
- **Floating capsule navbar** (wordmark + globe + Get Started + menu); hamburger
  opens a centered dark panel with animated feature tabs.
- **Energetic headline** — cycles slogans; the 2nd word of each line slides/fades
  (`mode="wait"`, pauses when tab hidden, wraps for long languages).
- **Sweep** (`.sweep`) — left→right shine on hover for CTAs.
- **AskFit aura** (`.askfit-aura`) — a soft breathing edge-glow on the chat input.
- **Focus / Proof cards** — the rose→emerald gradient hero moments.
- **Health-green selected state** across tool selectors (never white-on-white).

## Accessibility & i18n
- Focus-visible rings; status colors paired with labels/icons (not color-only).
- Whole-site translation via a hidden Google Translate widget (11 Indian languages,
  navbar globe); headline/voice adapt to the chosen language.

## Conventions
- Match surrounding code: inline styles against tokens, not hard-coded colors.
- New surfaces use `--surf`/`--bd`; selected/active states use `--ok`/`--askfit`
  families so they read correctly in both themes.
