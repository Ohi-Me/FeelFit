# FeelFit — Health Copilot Architecture

How FeelFit went from a **lab-report explainer** to a **longitudinal health copilot**
that runs the loop: *report → one focus → 90-day plan → daily habit → retest → proof.*
This documents the data flow, modules, and endpoints added across Sprints 1–4.

---

## The core loop (what the product now does)

```
 Upload report ──► extract biomarkers ──► normalise to canonical keys
        │                                         │
        │                                  store as dated time-series   (health_store, SQLite)
        │                                         │
        ▼                                         ▼
   verdict (LLM)                        pick ONE focus + retest date     (focus_engine)
        │                                         │
        │                              build 90-day program + progress    (program_engine)
        ▼                                         │
   Results page  ◄── Focus card + (on retest) "Your number moved" proof ◄┘
        │
        ▼
  Home "Today" card: daily nudge · streak · retest countdown · log vitals/steps/sleep
        │
        ▼
  Re-upload retest ──► delta computed ──► PROOF (baseline → latest) ──► retention moment
```

Identity = logged-in email, else client IP (same key the rest of the app uses), so
the graph works for anonymous users too.

---

## New backend modules (`backend/services/`)

| Module | Responsibility |
|---|---|
| `health_store.py` | **The data spine.** SQLite, per-identity biomarker **time-series** (`readings`), `focus`, `checkins`. Canonical normalisation (`canonical_key`), vitals + wearable ingest (`record_vital`), streak math (`get_streak`), `graph()` / `latest_readings()` / `get_series()` / `timeline()`. DB path is env-configurable (`FEELFIT_DB`) — swap to a Postgres adapter behind this same function API for production. |
| `focus_engine.py` | **"Move One Number".** `pick_focus(latest)` chooses the single highest-priority abnormal biomarker (HbA1c → glucose → triglycerides → LDL → fatty liver → Vit D → B12 → ferritin → Hb → TSH → uric acid → creatinine), with target, why, plan, retest weeks. `retest_status()` (countdown), `daily_action()` (rotating nudge). Deterministic & non-diagnostic. |
| `program_engine.py` | **90-day program + proof.** `build_program(focus)` (Reset/Build/Lock-in phases, milestones). `compute_progress(identity, focus)` — direction-aware (lower-is-better vs higher-is-better) baseline→latest delta = the **proof**. |
| `analytics.py` | **Self-hosted product analytics.** `track(identity, event, **props)` (hashed identity), `metrics(days)` → funnel + daily-active + activation/proof rates. Swappable to PostHog/Amplitude. |
| `notifications.py` | **Keys-optional dispatcher.** `queue_retest_reminder()`, `dispatch_due()`. Sends via WhatsApp when `WHATSAPP_API_URL`/`WHATSAPP_TOKEN` set, else logs a "would-send" (local-safe, like Razorpay test mode). |

All five share the one SQLite DB (`backend/data/feelfit.db`). Tables:
`readings, focus, checkins, events, reminders`.

---

## New API endpoints (`backend/main.py`)

| Method · Path | Returns |
|---|---|
| `GET /api/health/graph` | latest snapshot + per-biomarker series + dated timeline |
| `GET /api/health/focus` | the current "one number to move" + retest date |
| `GET /api/health/today` | focus + today's action + retest countdown + streak |
| `GET /api/health/program` | 90-day program + live progress + proof |
| `POST /api/health/vitals` | log BP / weight / home glucose (auto-flagged vs range) |
| `POST /api/health/wearable` | ingest steps / sleep / resting HR / HRV |
| `POST /api/health/checkin` | mark today's action done → streak |
| `GET /api/health/reminders` | pending reminders + configured channels |
| `POST /api/health/reminders/run` | dispatch due reminders (cron-driven in prod) |
| `GET /api/admin/metrics` | funnel + engagement (guard with `ADMIN_TOKEN`) |

`/api/analyze` now also persists biomarkers, sets focus, queues the retest reminder,
emits analytics, and returns `focus`, `report_date`, `health_timeline`, `progress`
(incl. `proof`). `/api/rag/retrieve` folds the user's own recent abnormal labs +
focus into AskFit's context (**AskFit memory**).

---

## New frontend (`frontend/components/`)

| Component | Where | Shows |
|---|---|---|
| `analyze/FocusCard.tsx` | Results | The one number to move + plan + retest date |
| `analyze/ProofBanner.tsx` | Results (top, on retest) | "Your number moved: 6.8 → 5.9" |
| `home/TodayCard.tsx` | Home (after report exists) | Daily nudge · streak · retest countdown · vitals/steps/sleep log |
| `dashboard/ProgramPanel.tsx` | Dashboard | 90-day program · progress ring · phases · milestones · proof |

`lib/api.ts` adds `getToday / getProgram / getHealthGraph / logVital / checkinToday`.

---

## Env that unlocks the rest (built, waiting on keys)

- `GEMINI_API_KEY` — premium report extraction (paid path).
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` — live payments (else test mode).
- `GOOGLE_OAUTH_CLIENT_ID` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — Google sign-in.
- `WHATSAPP_API_URL` / `WHATSAPP_TOKEN` — live retest reminders (else logged).
- `FEELFIT_DB` — DB location; `ADMIN_TOKEN` — guard metrics.

---

## Production swap path (not yet done, by design)

1. **SQLite → Postgres**: re-implement `health_store` (+ analytics/notifications tables)
   behind the existing function signatures; everything else is unchanged.
2. **Analytics → PostHog/Amplitude**: forward inside `analytics.track()`.
3. **Reminders → scheduled job**: run `POST /api/health/reminders/run` on cron.
4. **Wearables**: implement OAuth sync to Google Fit / Apple Health / Ultrahuman,
   posting into `POST /api/health/wearable`.
