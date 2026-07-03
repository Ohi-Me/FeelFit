# FeelFit — Session Changelog

A complete record of everything changed in this work session, grouped by theme.
Scope: a full redesign + a strategic rebuild from "lab-report explainer" into a
longitudinal **health copilot**, plus polish, security, and reliability fixes.

> Run locally: backend on `:8000` (`uvicorn main:app`), frontend on `:3000`/`:3100`
> (`npm run dev` / `next start`). See `HANDOFF.md` and `COPILOT_ARCHITECTURE.md`.

---

## 1. Design system & typography
- Iterated the app font: serif **Della Respira** is the current display/body face
  (earlier passes tried Space Grotesk/Inter); `--ff`/`--fb` CSS tokens in
  `styles/globals.css`, font links in `app/layout.tsx`.
- Forced a lighter, even weight (Della Respira ships only 400) — removed synthetic
  faux-bold so nothing looks heavy.
- Kept DM Mono for tabular numbers only.

## 2. Branding & icons
- **New "F" monogram logo** (green-gradient F with a leaf flick) — `components/ui/BrandMark.tsx`
  and `public/favicon.svg`. (Earlier the mark was a heart-pulse.)
- **Removed the icon from the navbar** (wordmark "FeelFit" only — no redundant mark).
- Recreated a premium icon set as clean SVGs in `components/ui/Icon.tsx`
  (dumbbell, bottle, salad, scale, calendar, people, lotus, droplet, leaf, flame,
  globe, heartpulse, paperclip, mic) and wired them into the FitTips cards,
  TodayCard vitals, and Health Tools tabs.

## 3. Navbar & hamburger
- Compact floating capsule; tightened spacing (no big gap between wordmark and
  language switcher); removed the "Analyze" text link (Get Started covers it).
- Hamburger: removed Analyze/AskFit (both reachable elsewhere); small centred
  "Sign in or up"; theme toggle hidden after sign-in; appealing hover animations.
- **Language switcher** (globe) — whole-site translation via a hidden Google
  Translate widget across **11 Indian languages**; overflow fixed so labels don't spill.

## 4. Home page
- **Energetic rotating headline** (Aptos-style): two lines, 2nd word animates
  (slide + blur). Slogans: *Understand your / whole health · Feel your / absolute
  best · Own your / health story · Thrive every / single day*.
  - Smoother `mode="wait"` transitions (no overlap/"mixed"), slower 5.2s cycle,
    **pauses when the tab is hidden** (fixes the burst on return), and **font/wrap
    eased so long translated headlines fit**.
- Fixed dark-mode contrast on the "Understand your results today" CTA and the
  "Understand it" feature card (white-on-white → readable).
- Hero "AI" node fixed (was white-on-white) → a clickable **AskFit** node.
- **FitTips** section: 32 shuffling wellness cards (new set each visit + "show me more").
- Trust/badge copy reworded; "in plain language" → "in your language".

## 5. About pages
- New `components/about/AboutPage.tsx` (Health education, Sources shown, Privacy
  first, Made-with-care) + a "Made with love, by Ohi" finale; footer links wired.

## 6. Copy pass (positive, on-brand, country-neutral)
- "Copilot" → **AskFit** everywhere (component `ResearchCopilot`→`AskFit`, file
  renamed, tab key `copilot`→`askfit`).
- "Made for India" → "Made with care"; "Educational only" → "Here to help you
  understand"; "plain English" → "simple"; reframed negatives ("No signup",
  "Never sold", etc.) into positive promises. Medical-safety disclaimers kept.

## 7. Pricing & payments
- Plan ladder: **Day ₹9 · Weekly ₹49 · Monthly ₹199 · Lifetime ₹999**
  (`backend/services/account_service.py` PLANS + `lib/api.ts`).
- Redesigned **AccountModal** plan cards: centered, "Most Popular" ribbon, radio
  selection, feature checklist; plans visible **without sign-in**.
- **Independent Sign in / up** always available (Google) — payment requires it,
  but signing in to save history does not.
- Razorpay flow wired (test mode without keys; real sheet when keys set);
  per-plan duration on the backend.

## 8. The Health Copilot rebuild (Sprints 1–4) — see `COPILOT_ARCHITECTURE.md`
The core strategic shift: *report → one focus → 90-day plan → daily loop → retest → proof.*
- **Sprint 1 — data spine + focus:** `services/health_store.py` (SQLite,
  per-identity biomarker **time-series**, canonical normalisation),
  `services/focus_engine.py` ("Move One Number" — picks one biomarker to improve
  with target/why/plan/retest). Wired into `/api/analyze`; `/api/health/graph` &
  `/api/health/focus`. **AskFit gained memory** of the user's own labs.
  Frontend `FocusCard` on Results.
- **Sprint 2 — retention loop:** retest countdown, **vitals logging** (BP/weight/
  glucose/steps/sleep), **daily check-in streak**, personalized "Today" nudge.
  `/api/health/today`, `/vitals`, `/checkin`; home `TodayCard`.
- **Sprint 3 — 90-day program + proof:** `services/program_engine.py`
  (Reset/Build/Lock-in phases) and **outcome proof** — on a re-test that improves
  the focus number, a celebratory "Your number moved: 6.8 → 5.9" banner.
  `/api/health/program`; `ProofBanner` + dashboard `ProgramPanel`.
- **Sprint 4 — infra/analytics/notifications:** `services/analytics.py`
  (self-hosted funnel/engagement), `services/notifications.py` (keys-optional
  WhatsApp/retest reminders), `/api/admin/metrics`. Report-date timeline +
  full-profile context now feed the LLM verdict.

## 9. AskFit (chat) — multimodal & conversational
- Rebuilt from a single-query view into a **continuous chat** (thread, follow-ups,
  typing indicator); **removed the LOINC/technical evidence dumps** — answers show
  a clean reply + friendly source chips + a "well/partly supported" badge.
- Rewrote the answer prompt so replies are **warm, direct and helpful** (no more
  "the retrieved evidence doesn't cover this"); passes conversation history.
- **10 free questions**, then a plan is required.
- **Voice input** (Web Speech API) — follows the selected language (hi/mr/ta/…),
  continuous dictation, permission feedback.
- **Document upload** (PDF/image/CSV) — `/api/askfit/attach` reads a report/
  prescription/note (Gemini vision + OCR fallback) so questions combine the doc +
  profile + lab history (like Claude/GPT/Gemini).
- Wider chat box (840px) with a **flowing gradient aura** around the input.
- Floating AskFit button (bottom-right, rose→emerald gradient) on every tab.

## 10. Analyze reliability & the PDF
- **Critical fix — never fabricate values.** On a hard extraction failure the
  pipeline used to invent ~5 plausible-but-wrong tests. Now it returns a 422 with
  a friendly retry message, and **Gemini vision runs as a free recovery path** when
  basic OCR fails — so real reports (e.g. CityCare, 37 tests) read correctly.
- **Premium PDF export** — redesigned into a proper A4 medical document (dark cover
  with brand mark + risk pill, patient row, summary, test-overview cells, Focus
  card, colour-coded results table, recommendations, branded footer + report ID).
- Results layout: stacked Key Findings + Recommendations + Lifestyle in the left
  column so the tall Abnormal Values list no longer leaves an empty gap.
- BMI calculator enriched: "what it means", ideal-weight range, care tips,
  "good to know" (incl. lower ~23 South-Asian threshold).
- Medicine copy de-jargoned (dropped "RxNorm & OpenFDA").

## 11. Doctor finder
- **Google Places** path (real ratings/reviews/open-now) when `GOOGLE_MAPS_API_KEY`
  is set — `services/google_places_service.py` — with a transparent **fallback to
  the free OpenStreetMap finder** so results never break without a key.

## 12. History, navigation, freemium, security
- **Report history retention:** per-item delete, "Erase all" (also wipes the
  server health graph via `DELETE /api/health/data`), and **auto-delete after
  7 days** (default) or **1 month** — pruned on load, genuinely working.
- **Browser back/forward/swipe** now navigate between tabs (tabs synced to history
  via `pushState`/`popstate`; deep links like `#doctors` work).
- **Freemium is IP-based** (was per-browser session, bypassable by switching
  browsers) — `_identity` keys on client IP; `TRUST_PROXY` for production proxies.
  (Truly robust anti-abuse still needs sign-in, which is supported.)
- **Security hardening:** security headers (backend middleware + `next.config.js`),
  early oversized-body rejection, constant-time admin-token compare, generic error
  responses (no stack leak); verified all SQL is parameterized and no
  eval/exec/os.system; secrets stay in git-ignored `.env`.

---

## Key new files
**Backend** (`backend/services/`): `health_store.py`, `focus_engine.py`,
`program_engine.py`, `analytics.py`, `notifications.py`, `google_places_service.py`
(+ `llm/pipeline.py` `gemini_read_text`, report-date extraction in `main.py`).
**Frontend** (`frontend/components/`): `home/TodayCard.tsx`, `home/FitTips.tsx`,
`about/AboutPage.tsx`, `analyze/FocusCard.tsx`, `analyze/ProofBanner.tsx`,
`dashboard/ProgramPanel.tsx`, `layout/LanguageSwitcher.tsx`, `ui/BrandMark.tsx`
(+ rewritten `copilot/AskFit.tsx`).
**Docs:** `COPILOT_ARCHITECTURE.md`, this `SESSION_CHANGELOG.md`.

## Pending / needs keys (built, waiting)
`GEMINI_API_KEY` (premium/recovery extraction), `RAZORPAY_*` (live pay),
`GOOGLE_OAUTH_CLIENT_ID` + `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (Google sign-in),
`GOOGLE_MAPS_API_KEY` (doctor ratings), `WHATSAPP_*` (reminders), `ADMIN_TOKEN`,
`TRUST_PROXY` + `ALLOWED_ORIGINS` (production).
