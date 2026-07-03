# FeelFit — Complete Project Details

> **The one document that explains everything.** What FeelFit does, how it does it,
> what it's built with, and how every piece fits together — written so a beginner
> can follow it top-to-bottom, with advanced details for anyone digging deeper.

---

## Table of Contents

1. [What is FeelFit?](#1-what-is-feelfit)
2. [What can it do? (Features)](#2-what-can-it-do-features)
3. [The Tech Stack](#3-the-tech-stack)
4. [How the Repository is Organized](#4-how-the-repository-is-organized)
5. [How a Lab Report Gets Analyzed (the 10-stage pipeline)](#5-how-a-lab-report-gets-analyzed)
6. [What Files/Documents Are Supported](#6-what-filesdocuments-are-supported)
7. [How the AI Answers (LLM + RAG)](#7-how-the-ai-answers-llm--rag)
8. [The Backend — Every Endpoint](#8-the-backend--every-endpoint)
9. [The Frontend — Pages, Tabs & Components](#9-the-frontend--pages-tabs--components)
10. [The Mobile App (Android/iOS via Capacitor)](#10-the-mobile-app-androidios-via-capacitor)
11. [Accounts, Sign-in & Payments](#11-accounts-sign-in--payments)
12. [Environment Variables — the Complete List](#12-environment-variables--the-complete-list)
13. [Running Locally (Development)](#13-running-locally-development)
14. [Deploying (Web + Android)](#14-deploying-web--android)
15. [Safety & Privacy Design](#15-safety--privacy-design)
16. [Glossary for Beginners](#16-glossary-for-beginners)

---

## 1. What is FeelFit?

FeelFit is an **AI medical-report intelligence platform**. In plain words:

> You upload a photo, PDF, or CSV of your lab report → FeelFit reads it,
> understands every test value, and explains what it all means in calm,
> simple language — then helps you act on it (track trends, find doctors,
> ask follow-up questions, learn about medicines).

It is **one codebase, three targets**:

| Target | How it ships |
|---|---|
| **Web app** | Next.js app deployed on Vercel (frontend) + FastAPI on Render (backend) |
| **Android app** | The same Next.js frontend wrapped in a native shell by Capacitor → APK/AAB |
| **iOS app** | Same again → Xcode project → IPA (requires a Mac to build) |

FeelFit **never diagnoses or prescribes**. It explains, flags what's worth
discussing with a doctor, and uses careful language ("may suggest", "worth
discussing with your doctor") that is enforced at both the AI-prompt level and
the response-validation level.

---

## 2. What can it do? (Features)

| Feature | What it does | Where |
|---|---|---|
| 📄 **Analyze** | Upload a lab report (PDF/photo/CSV) → extracts every test value → AI explains each one, gives an overall summary, risk level, key findings, diet/exercise/lifestyle tips | `Analyze` tab |
| 🔬 **AskFit (Research Copilot)** | Ask any health question ("Why is my TSH high?") → answers grounded in retrieved medical evidence with confidence scores and citations. Can also read an attached document | `AskFit` tab |
| 💊 **Medicine** | Look up any medicine: what it's for, dosage, side effects; check interactions between two drugs. Uses live OpenFDA/RxNorm data with a curated local fallback | `Medicine` tab |
| 👨‍⚕️ **Doctor Finder** | Finds real clinics/hospitals near any location in India, ranked by distance. Free OpenStreetMap by default; Google Places (ratings, open-now) when a key is configured | `Doctors` tab |
| 📊 **Dashboard ("You")** | Health score (0–100), trend sparklines per test over time, report history, profile editor (age/gender/conditions/medications for personalized analysis) | `Dashboard` tab |
| 🩺 **Symptom Checker** | Describe how you feel → suggests what it could relate to and which specialist to consider | `Symptoms` tab |
| 🧰 **Health Tools** | BMI, water intake, sleep and other everyday calculators | `Tools` tab |
| ❤️ **Health habits (Stay Fit)** | Daily check-ins, focus areas, action programs, reminders | Home + backend engines |
| 🌐 **11 languages** | Whole-site translation (English, Hindi, Bengali, Telugu, Marathi, Tamil, Gujarati, Kannada, Punjabi, Malayalam, Urdu) via a Google Translate widget | Language switcher |
| 📱 **Mobile-only UX** | 2s animated boot splash, 5-tab bottom navigation, "More" sheet, native camera/gallery upload, haptics, pull-to-refresh, hardware back button, offline banner, biometric lock support | Android/iOS build |

---

## 3. The Tech Stack

### Frontend
| Piece | Technology | Why |
|---|---|---|
| Framework | **Next.js 14** (App Router) + **React 18** + **TypeScript 5** | One codebase renders the web app AND exports static files for mobile |
| Animation | **Framer Motion 11** | All the springs, page transitions, staggered reveals |
| Styling | Plain CSS custom properties (`styles/globals.css`) + a mobile-only layer (`styles/mobile.css`) | No CSS framework — full design control, tiny bundle |
| Mobile bridge | **Capacitor 6** + ~20 official plugins (camera, haptics, geolocation, push, biometrics…) | Wraps the web build in a real native app without a rewrite |

### Backend
| Piece | Technology | Why |
|---|---|---|
| API server | **FastAPI** (Python 3.11) + **Pydantic v2** | Fast async API with strict schema validation on every response |
| PDF text | **pdfplumber** + **PyMuPDF** | Digital-PDF text extraction |
| OCR (images/scans) | **PaddleOCR** (primary) + **Tesseract** (fallback) | Reading photographed/scanned reports |
| Vision AI (optional) | **Gemini 2.0 Flash** | Best-accuracy reading of dense/photographed reports when a key is set |
| LLM | **Groq** running **Llama 3.3 / Llama 4** | Fast, cheap inference for analysis + AskFit answers |
| Auth | **google-auth** (Google Sign-In token verification), Firebase Phone-Auth token verification, email OTP via **Resend** | No passwords stored; signature verification only |
| Payments | **Razorpay** (test mode when keys unset) | Day/weekly/monthly/yearly passes |

### Where things run
```
Browser / Android WebView
        │  HTTPS (JSON)
        ▼
FastAPI backend  ──►  Groq LLM  (all AI calls happen server-side —
        │             no API key ever ships to the client)
        ├──►  OpenStreetMap / Google Places  (doctor search)
        ├──►  OpenFDA / RxNorm              (live medicine data)
        └──►  Gemini (optional vision)      (photo-report reading)
```

---

## 4. How the Repository is Organized

```
FeelFit/
├── backend/                  # FastAPI backend (Python)
│   ├── main.py               # All API routes (~1,400 lines)
│   ├── extraction/           # extractor.py (PDF/OCR), nlp.py (test parsing, LOINC)
│   ├── llm/pipeline.py       # Groq calls: analysis narration, AskFit, Gemini vision
│   ├── rag/                  # Medical RAG 2.0 (see §7)
│   ├── services/             # medicine, doctors (OSM/Google), profiles, accounts,
│   │                         # health store, focus/program engines, notifications
│   ├── schemas/analysis.py   # Pydantic response models (the API contract)
│   ├── utils/                # cache, rate limiter, file-magic validation, mailer
│   └── medical_kb.json       # Curated knowledge base (tests, ranges, specialties)
│
├── frontend/                 # Next.js app (web + mobile source of truth)
│   ├── app/                  # layout.tsx + page.tsx (the single-page tab shell)
│   ├── components/           # analyze/, copilot/ (AskFit), dashboard/, doctors/,
│   │                         # medicine/, symptoms/, tools/, home/, about/,
│   │                         # layout/ (Navbar, BottomNav, LanguageSwitcher),
│   │                         # ui/ (Modal, BottomSheet, Icon, motion, BootSplash)
│   ├── lib/                  # api.ts (backend client), native.ts (Capacitor bridge),
│   │                         # constants.ts
│   ├── styles/               # globals.css (web design system), mobile.css (Capacitor-only)
│   ├── capacitor.config.ts   # One config drives Android + iOS
│   └── scripts/prepare-mobile.mjs  # Post-build patching for the mobile export
│
├── android/                  # Native Android project (Gradle) — web assets are
│                             # GENERATED into it by `npx cap sync`
├── ios/                      # Native Xcode project (same idea, needs macOS)
├── docs/                     # Architecture deep-dives (01–07)
├── samples/                  # sample_labs.csv etc. for testing uploads
└── scripts/                  # dev.sh, build-mobile.sh helpers
```

**Key idea:** there is exactly **one copy** of the UI code. Web, Android and iOS
all consume `frontend/`. Mobile-specific behavior is layered on top, never forked:
- `styles/mobile.css` — every rule scoped under `html.is-capacitor` (web provably unaffected)
- `lib/native.ts` — single typed entry point for every Capacitor plugin; each helper
  no-ops gracefully on the web
- Components check `isCapacitor()` for mobile-only branches (BottomNav, BootSplash, bottom-sheet modals)

---

## 5. How a Lab Report Gets Analyzed

This is the heart of the product — `POST /api/analyze`. Step by step:

```
 1. UPLOAD      User picks a file (drag-drop on web; camera/gallery/files on mobile)
 2. VALIDATE    Size ≤ 15 MB, MIME type allowed, and the file's magic bytes
                actually match its claimed type (an attacker can't rename .exe → .pdf)
 3. RATE-LIMIT  Per-session limiter + free-tier usage check (2 free checks,
                then the plans paywall — HTTP 402)
 4. CACHE       SHA-based cache: the identical file re-uploaded returns instantly
 5. EXTRACT     PDF → pdfplumber/PyMuPDF text. Image → PaddleOCR (Tesseract fallback).
                CSV → parsed directly. If GEMINI_API_KEY is set, images/PDFs can be
                read by Gemini vision for the best accuracy on photos
 6. NLP + LOINC The raw text is parsed into structured tests: name, value, unit,
                normal range → each mapped to its LOINC code (the international
                standard identifier for lab tests) via medical_kb.json
 7. ENRICH      Trends vs. the user's previous reports, profile context (age,
                gender, conditions, medications), report-date detection,
                specialty mapping (which doctor each abnormal test points to)
 8. LLM         Groq (Llama 3.3) writes the human narration: summary, key
                findings, per-test clinical notes, recommendations, diet/exercise
                tips — optionally grounded by RAG evidence (§7)
 9. VALIDATE    The LLM output is forced through Pydantic schemas; banned-phrase
                detection strips anything diagnostic/prescriptive
10. RESPOND     JSON: report_type, summary, risk_level (low/moderate/high),
                confidence, key_findings[], abnormal_tests[], all_tests[],
                recommendations[], lifestyle/diet/exercise tips, suggested
                specialist + nearby doctors. Also saved to the user's history
```

Fast path: clean CSV exports skip the LLM extraction (a deterministic parser
reads them), so CSV analysis is much faster and cheaper.

---

## 6. What Files/Documents Are Supported

| Type | Extensions | How it's read |
|---|---|---|
| PDF documents | `.pdf` | pdfplumber → PyMuPDF fallback → OCR if scanned → Gemini vision if configured |
| Photos/scans | `.jpg` `.jpeg` `.png` `.tiff` `.webp` | PaddleOCR → Tesseract fallback → Gemini vision if configured |
| Spreadsheet exports | `.csv` (also `text/plain`, Excel-flavored CSV) | Direct parser (fastest path) |

- Maximum size: **15 MB**
- Magic-byte validation: the file content must match the claimed type
- Works with reports from any lab — the NLP layer looks for test-name/value/unit/range
  patterns rather than any fixed layout
- AskFit attachments (`/api/askfit/attach`) accept the same types, so you can ask
  questions about a prescription or a doctor's letter too

---

## 7. How the AI Answers (LLM + RAG)

**Plain-language version:** instead of letting the AI answer from memory (where
it can hallucinate), FeelFit first **retrieves real medical reference text** about
the exact tests/medicines/conditions in question, and the AI is instructed to
answer **only from that evidence**, citing it.

**Medical RAG 2.0** (`backend/rag/`) is organized in layers:

| Layer | Contents |
|---|---|
| LOINC layer | Canonical definitions of lab tests, normal ranges, interpretation notes |
| Disease layer | Condition profiles linked to test patterns |
| Medication layer | Drug facts; optionally enriched live from OpenFDA/RxNorm (`RAG_LIVE_MEDS=1`) |
| Specialist layer | Which specialty handles what |
| Research layer | Reference/guideline snippets |

The moving parts:
- `embeddings.py` — turns text into vectors. Default is a **hashing embedder**
  (fully offline, no downloads); `sentence-transformers` optional for higher quality
- `vector_store.py` — in-memory store by default; Qdrant or pgvector optional
- `knowledge_graph.py` — links tests ↔ conditions ↔ specialties
- `retrieval.py` + `orchestrator.py` — pull the most relevant evidence per query,
  score confidence, assemble citations
- Every AskFit answer returns its confidence and the evidence used

RAG is behind flags (see §12) and degrades gracefully: with everything off, the
system still works using the curated `medical_kb.json` + carefully-prompted LLM.

---

## 8. The Backend — Every Endpoint

Interactive docs are auto-generated at **`/api/docs`** (Swagger UI) when the server runs.

| Area | Endpoints |
|---|---|
| Health/meta | `GET /` · `GET /api/health` · `GET /api/stats` · `GET /api/admin/metrics` |
| Analysis | `POST /api/analyze` (multipart file + optional profile) |
| AskFit | `POST /api/askfit/attach` (read a document) · `POST /api/rag/retrieve` (evidence-grounded answers) |
| Medicine | `POST /api/medicine/info` · `POST /api/medicine/interactions` · `GET /api/medicine/common` |
| Doctors | `POST /api/doctors/search` (location text or lat/lng) · `GET /api/doctors/suggest` |
| Reference | `GET /api/loinc/{loinc_code}` |
| Profile | `GET/POST /api/profile` · `GET /api/profile/dashboard` · `GET /api/profile/health-score` · `GET /api/profile/trends` · `GET/DELETE /api/profile/reports` |
| Habits | `GET /api/health/today` · `GET /api/health/focus` · `GET /api/health/program` · `GET /api/health/graph` · `POST /api/health/checkin` · `POST /api/health/vitals` · `POST /api/health/wearable` · `GET /api/health/reminders` · `POST /api/health/reminders/run` · `DELETE /api/health/data` |
| Auth | `POST /api/auth/google` · `POST /api/auth/phone` · `POST /api/auth/login` · `POST /api/auth/signup` · `POST /api/auth/signup/send-otp` |
| Billing | `GET /api/usage` (free checks remaining / plan status) · `POST /api/billing/checkout` · `POST /api/billing/confirm` |

Cross-cutting behavior: CORS from `ALLOWED_ORIGINS`, security headers (HSTS),
per-session rate limiting, response-schema validation, and an in-memory
analysis cache.

---

## 9. The Frontend — Pages, Tabs & Components

The app is a **single page** (`app/page.tsx`) that switches between tabs —
each tab is lazy-loaded so the first paint ships only ~180 kB of JS:

| Tab | Component | Notes |
|---|---|---|
| Home | `components/home/HomePage` | Hero, how-it-works, feature cards, Stay-Fit tips, FAQ |
| Analyze | `analyze/UploadPanel → AnalyzingState → Results` | The 3-state upload flow; native camera/gallery buttons on mobile |
| AskFit | `copilot/AskFit` | Chat-style Q&A with citations + attachments |
| Medicine | `medicine/MedicineTab` | Info + interaction checker |
| Doctors | `doctors/DoctorSection` | Geolocation or typed location |
| Symptoms | `symptoms/SymptomChecker` | |
| Tools | `tools/HealthTools` | |
| Dashboard | `dashboard/DashboardTab` | Score ring, trends, history, profile editor |
| About | `about/AboutPage` | |

Shared machinery worth knowing:
- `components/ui/motion.tsx` — every animation primitive (FadeIn, Reveal, Stagger,
  AnimatedNumber, AnimatedRing, PageTransition). Change animation feel in ONE file.
- `components/ui/index.tsx` — Modal (auto-upgrades to a bottom sheet on mobile), Toast
- `lib/api.ts` — the only place that talks to the backend (base URL from
  `NEXT_PUBLIC_API_URL`); also manages the session id, local history, auth token
- Tab state syncs to the URL hash (`#doctors`), so browser back/forward and
  shared links work naturally.

---

## 10. The Mobile App (Android/iOS via Capacitor)

### How the same code becomes an app
1. `BUILD_TARGET=mobile npm run build` → Next.js **static export** into `frontend/out/`
2. `scripts/prepare-mobile.mjs` patches the HTML (`<base href="./">`, `is-capacitor` class)
3. `npx cap sync android` copies `out/` into `android/app/src/main/assets/public/`
   and wires the 20 native plugins
4. Gradle builds the APK/AAB (Android Studio or command line)

### Mobile-only experience (all added without touching web behavior)
| Piece | Implementation |
|---|---|
| **Animated boot splash** | `components/ui/BootSplash.tsx` — 5 health icon chips (heartbeat, dumbbell, salad, lotus, flame) spring onto an orbit, converge into the FeelFit wordmark, fade to Home (~2s, once per cold start, respects reduced-motion). The native splash is a plain light window (no default Capacitor logo), so boot is one seamless surface |
| **Bottom navigation** | `layout/BottomNav.tsx` — 5 tabs (Home, Analyze, AskFit, Meds, You) + More. The active pill *glides* between tabs (framer-motion `layoutId`), icons pop with springs, taps give haptic feedback |
| **"More" sheet** | The web navbar + footer content consolidated into ONE spring-up sheet above the bottom nav: Find Doctors, Symptom Checker, Health Tools, About, Plans & upgrade, Appearance (animated theme switch), Language, Sign in. Nothing is duplicated anywhere in the mobile UI |
| **Header-less chrome** | The web navbar and footer are hidden on mobile (`mobile.css`); content starts below the status bar via safe-area insets |
| **Safe areas** | The `@capacitor-community/safe-area` plugin injects `--safe-area-inset-*` CSS vars (Android WebView's `env()` is always 0); `mobile.css` consumes them for the status bar and gesture bar |
| **Performance layer** | On mobile, the expensive web effects are disabled: full-screen `blur(90px)` animated backdrops, `backdrop-filter` on cards, infinite gradient/shimmer loops. Page transitions are a fast 120 ms exit + 260 ms spring enter |
| **Native integrations** | Camera/gallery upload, geolocation for doctors, share sheet, clipboard, haptics, secure storage for the auth token, biometric lock, local + push notifications, network status banner, hardware back-button routing, tap-to-dismiss keyboard, pull-to-refresh |

### Dev vs production builds
`capacitor.config.ts` reads one env var:
- **`CAP_DEV_HTTP=1 npx cap sync android`** → dev mode: allows plain-HTTP API
  (`http://10.0.2.2:8024` = your PC from the emulator), WebView debuggable via `chrome://inspect`
- **Without it (default)** → production: HTTPS-only, mixed content blocked, WebView not inspectable

---

## 11. Accounts, Sign-in & Payments

- **Anonymous by default** — 2 free report checks per device/session, no account needed
- **Sign-in options:** Google (One Tap / OAuth), phone + OTP (Firebase), email + OTP (Resend)
- The backend never stores passwords — it only *verifies signed tokens* (Google/Firebase)
  or emails one-time codes
- **Plans** (via Razorpay): Day ₹19 · Weekly ₹89 · Monthly ₹349 · Yearly ₹1999 —
  unlimited checks + premium AI accuracy. With no Razorpay keys configured the flow
  runs in **test mode**: passes are granted instantly without charging, so the full
  journey is testable
- The auth token is kept in native **secure storage** on mobile, localStorage on web

---

## 12. Environment Variables — the Complete List

### Backend (`backend/.env`, set on Render dashboard in production)
| Variable | Required? | Purpose |
|---|---|---|
| `GROQ_API_KEY` | ✅ **required** | All LLM features. Free at console.groq.com/keys. Server exits without it |
| `ALLOWED_ORIGINS` | ✅ in production | Comma-separated frontend URLs for CORS, e.g. `https://your-app.vercel.app` |
| `ENVIRONMENT` | recommended | `production` disables auto-reload |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | optional | Vision reading of photographed reports |
| `GOOGLE_OAUTH_CLIENT_ID` | optional | Google Sign-In (same value as the frontend var) |
| `GOOGLE_MAPS_API_KEY` | optional | Premium doctor search (ratings/open-now); OSM is the free fallback |
| `FIREBASE_PROJECT_ID` | optional | Phone/OTP sign-in |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | optional | Real payments (unset = test mode) |
| `RESEND_API_KEY`, `RESEND_FROM` | optional | Email OTP delivery |
| `ENABLE_RAG`, `RAG_LIVE_MEDS`, `RAG_EMBEDDER`, `RAG_VECTOR_STORE` | optional | RAG feature flags (§7) |
| `PORT` | auto | Set by the host (Render/Railway); defaults to 8000 locally |

### Frontend (`frontend/.env.local` locally; Vercel env vars in production; baked in at build time for mobile)
| Variable | Required? | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ | Backend base URL, no trailing slash. **Must be HTTPS for mobile production builds** |
| `BUILD_TARGET` | mobile builds | `mobile` switches Next.js to static-export mode |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | optional | Google Sign-In button |
| `NEXT_PUBLIC_FIREBASE_*` (5 vars) | optional | Phone/OTP sign-in (public config values, not secrets) |
| `CAP_DEV_HTTP` | dev only | `1` = allow HTTP + WebView debugging in the mobile build. **Never set for release** |

---

## 13. Running Locally (Development)

```bash
# ── Backend ──────────────────────────────────────────────
cd backend
python -m venv venv && venv/Scripts/activate      # (Windows) or source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                              # add your GROQ_API_KEY
python main.py                                    # → http://localhost:8000/api/docs
# (this project's local convention: uvicorn main:app --port 8024)

# ── Frontend (web) ───────────────────────────────────────
cd frontend
npm install --legacy-peer-deps
cp .env.example .env.local                        # point NEXT_PUBLIC_API_URL at the backend
npm run dev                                       # → http://localhost:3000

# ── Mobile (Android, on the emulator) ────────────────────
cd frontend
BUILD_TARGET=mobile NEXT_PUBLIC_API_URL=http://10.0.2.2:8024 npm run build
node scripts/prepare-mobile.mjs
CAP_DEV_HTTP=1 npx cap sync android               # dev flags ON
cd ../android && ./gradlew assembleDebug          # needs JDK 17
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Notes:
- `10.0.2.2` is how the Android emulator reaches your PC's localhost
- JDK 17 is required by the Android Gradle Plugin (Java 8 will fail)
- Windows: if the `frontend/android`, `frontend/ios`, or root `node_modules`
  links are missing, create junctions: `mklink /J frontend\android android` etc.

---

## 14. Deploying (Web + Android)

### Web (already done in this project — checklist to confirm)
1. **Backend on Render:** root `backend/`, Docker (the included Dockerfile ships
   Tesseract). Env vars: `GROQ_API_KEY`, `ALLOWED_ORIGINS=https://<your-vercel-domain>`,
   `ENVIRONMENT=production` (+ any optional keys). Health check: `GET /api/health`
2. **Frontend on Vercel:** Root Directory = `frontend/`. Env var:
   `NEXT_PUBLIC_API_URL=https://<your-render-service>.onrender.com` (no trailing slash).
   Redeploy after changing env vars — they're baked at build time
3. **Google Sign-In:** add the Vercel domain to *Authorized JavaScript origins*
   in Google Cloud Console for your OAuth client

### Android — from code to a shareable app
```bash
# 1. Production mobile build (HTTPS backend, dev flags OFF)
cd frontend
BUILD_TARGET=mobile NEXT_PUBLIC_API_URL=https://<your-render-service>.onrender.com npm run build
node scripts/prepare-mobile.mjs
npx cap sync android                              # NOTE: no CAP_DEV_HTTP

# 2. Create your signing key (ONCE — keep it forever, losing it means you
#    can never update the app on the Play Store)
keytool -genkey -v -keystore feelfit-release.keystore -alias feelfit \
        -keyalg RSA -keysize 2048 -validity 10000

# 3. Build the signed release
cd ../android && ./gradlew bundleRelease          # → .aab for the Play Store
#            or ./gradlew assembleRelease         # → .apk for direct sharing
```
Then either:
- **Play Store:** create a developer account (one-time $25), create the app in
  Play Console, upload the `.aab`, fill the store listing + data-safety forms, submit
- **Direct APK:** share the signed `.apk` from your website/GitHub Releases —
  users enable "Install unknown apps" to install

(Signing config goes in `android/app/build.gradle` or `~/.gradle/gradle.properties` —
see any "Android app signing" guide; Android Studio's *Build → Generate Signed
Bundle/APK* wizard does it all through UI if you prefer.)

---

## 15. Safety & Privacy Design

- **Health insights only** — never diagnoses, never prescribes. Banned-phrase
  detection at the schema level + prompt-level language rules
- **No client-side AI keys** — every AI call goes through the backend
- **File safety** — magic-byte validation, 15 MB cap, MIME whitelist
- **Report history lives on the device** (localStorage / native storage) with
  user-controlled auto-delete (7 or 30 days) and one-tap "Erase all"
- **Auth without passwords** — only signed-token verification and one-time codes
- **Disposable-email rejection** + MX-record validation on signup
- **HTTPS-only mobile builds**; CORS locked to your domains in production; HSTS header

---

## 16. Glossary for Beginners

| Term | Meaning |
|---|---|
| **LLM** | Large Language Model — the AI that writes the explanations (here: Llama, served by Groq) |
| **RAG** | Retrieval-Augmented Generation — fetch real reference text first, make the AI answer from it (fewer hallucinations, citable answers) |
| **OCR** | Optical Character Recognition — turning a photo of text into actual text |
| **LOINC** | The international standard code system for lab tests (e.g. Hemoglobin = 718-7) |
| **Capacitor** | A tool that wraps a web app in a real native Android/iOS app and gives JS access to native features (camera, haptics…) |
| **WebView** | The embedded browser inside the native app that renders the UI |
| **Static export** | Next.js compiling the whole site to plain HTML/JS/CSS files (what Capacitor bundles) |
| **APK / AAB** | Android app package formats — APK installs directly; AAB is what the Play Store accepts |
| **Safe area** | The screen regions covered by the notch/status bar/gesture bar that content must avoid |
| **Pydantic schema** | A strict "shape" the API responses must match — malformed AI output gets rejected, not shipped |
| **CORS** | Browser rule controlling which websites may call the API |
| **Haptics** | The tiny vibration feedback when you tap something in the app |

---

*Generated July 2026. See also: [README.md](README.md) (quick start),
[REFERENCE.md](REFERENCE.md) (full architecture reference), `docs/01–07`
(deep dives per topic), [RAG_ARCHITECTURE.md](RAG_ARCHITECTURE.md) and
[COPILOT_ARCHITECTURE.md](COPILOT_ARCHITECTURE.md).*
