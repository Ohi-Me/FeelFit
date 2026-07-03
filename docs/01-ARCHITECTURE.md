# FeelFit — System Architecture

FeelFit is an AI health platform: upload a lab report → understand every value in
plain language → get **one focus biomarker** to improve → follow a 90-day loop →
re-test → see proof. It also has AskFit (a grounded health chat), a medicine
lookup, a doctor finder, symptoms→tests, health tools, and a dashboard.

---

## High-level topology

```
┌─────────────────────────────┐         ┌──────────────────────────────────────┐
│  Frontend (Next.js 14)      │  HTTPS  │  Backend (FastAPI, Python 3.11)       │
│  React 18 · TS · Framer     │ ──────► │  uvicorn :8000                        │
│  Single page, tab-switched  │  JSON   │                                       │
│  :3000 / :3100              │ ◄────── │  ┌── extraction ── pdfplumber/PyMuPDF │
└─────────────────────────────┘         │  │   PaddleOCR→Tesseract, Gemini vis  │
        │                               │  ├── llm/pipeline ── Groq + RAG       │
        │ localStorage (history,        │  ├── services/ (health graph, focus,  │
        │ session, retention, token)    │  │   program, analytics, notif, docs) │
        ▼                               │  ├── rag/ (offline medical KB)         │
   Google Translate (i18n)             │  └── data/ feelfit.db (SQLite) +       │
   Web Speech API (voice)              │       accounts.json (file store)       │
                                        └──────────────────────────────────────┘
External (optional, key-gated): Groq (LLM) · Gemini (vision) · OpenFDA/RxNorm
(medicines) · OpenStreetMap / Google Places (doctors) · Razorpay (pay) · WhatsApp
```

## Frontend
- **Next.js 14 App Router**, a single client page (`app/page.tsx`) that switches
  "tabs" (home / analyze / askfit / medicine / doctors / symptoms / tools /
  dashboard / about) via React state, synced to **browser history** (`pushState`/
  `popstate`) so back/forward and deep links (`#doctors`) work.
- **Styling = CSS design tokens** in `styles/globals.css` (`:root` dark + `.light`
  default). No CSS framework; all components inline-styled against the tokens.
- **State/data:** local component state + `lib/api.ts` (the only network layer;
  the browser never calls an LLM directly). History/session/retention live in
  `localStorage`; the auth token is `localStorage` too.
- **Animation:** Framer Motion (`components/ui/motion.tsx`).

## Backend
- **FastAPI** app in `backend/main.py` (routes, middleware, error handlers).
- **Stateless request handling** + two small persistence stores:
  - `data/accounts.json` — accounts, tokens, freemium usage, passes (file-backed).
  - `data/feelfit.db` — SQLite: biomarker `readings`, `focus`, `checkins`,
    analytics `events`, `reminders`.
- **Services** (`backend/services/`): each a focused module behind a function API,
  so any can be swapped for a managed equivalent (e.g. SQLite → Postgres) without
  touching callers. See `03-CODEBASE-FLOW.md` and `COPILOT_ARCHITECTURE.md`.

## Identity & freemium
- Identity = logged-in **email** (token in `x-auth-token`), else the **client IP**
  (`_identity` / `_client_ip`, with `TRUST_PROXY` for load balancers).
- Free tier: 2 report checks + 10 AskFit questions per identity, then a plan.

## External integrations (all optional / key-gated, graceful fallback)
| Service | Used for | Without a key |
|---|---|---|
| Groq | LLM narrative + RAG answers | required (core) |
| Gemini | premium/recovery vision extraction, doc reading | free parser path |
| OpenFDA + RxNorm | live medicine info | local brand map |
| OpenStreetMap | doctor finder | always free |
| Google Places | doctor ratings/reviews | falls back to OSM |
| Razorpay | live payments | test mode (instant unlock) |
| Google OAuth | sign-in | "not configured" notice |
| WhatsApp | retest reminders | logged locally |

## Deploy targets
`render.yaml` (backend Docker), `frontend/vercel.json` + `next.config.js`
(standalone output), `backend/Procfile`/`Dockerfile`. Set env in host dashboards.
