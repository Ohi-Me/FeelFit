<div align="center">

# 🩺 FeelFit — AI Medical Intelligence Platform

![FeelFit](https://img.shields.io/badge/FeelFit-Medical_Intelligence-8B5CF6?style=for-the-badge&logo=heart&logoColor=white)
![Platform](https://img.shields.io/badge/Platform-Web_•_Android_•_iOS-8B5CF6?style=for-the-badge)

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Capacitor](https://img.shields.io/badge/Capacitor-6.1-119EFF?style=flat-square&logo=capacitor)](https://capacitorjs.com/)
[![Groq](https://img.shields.io/badge/Groq-Llama_4-FF6F00?style=flat-square&logo=nvidia)](https://groq.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python)](https://www.python.org/)
[![OpenStreetMap](https://img.shields.io/badge/OpenStreetMap-Free-7EBC6F?style=flat-square&logo=openstreetmap)](https://www.openstreetmap.org/)

**Upload lab reports → AI analysis → medicine info → doctor finder → health dashboard.
One codebase, three targets — Web (Vercel/Docker), Android (APK/AAB), and iOS (IPA).**

[✨ Features](#-features) • [🚀 Quick Start](#-quick-start) • [📱 Mobile Build](#-mobile-build-android--ios) • [🌐 Deployment](#-deployment) • [📚 Documentation](#-documentation) • [🗺️ Roadmap](#️-roadmap)

</div>

---

## 🎯 Overview

FeelFit is a **production-grade health platform** that turns raw medical lab reports into actionable, personalized health intelligence. A user uploads a PDF, image, or CSV of their lab results; an AI pipeline then extracts every test value, maps it to standard LOINC codes, enriches it with medical context, and produces a clear, severity-aware interpretation along with personalized recommendations and nearby specialist referrals.

The platform is built as a **single shared codebase** that ships to three targets: a responsive web app for Vercel/Docker, a native Android app via Capacitor (APK/AAB), and a native iOS app via Capacitor (IPA). There is exactly **one copy** of `app/`, `components/`, `lib/`, `public/`, `styles/`, and `types/` — web, Android, and iOS all consume the same source.

### 🌟 Key Highlights

- **🤖 AI-Powered Analysis** — Groq-served Llama 3.3 (text) and Llama 4 (vision) deliver fast, sub-3-second insights
- **🧠 Medical RAG 2.0** — Every Copilot answer is grounded in retrieved evidence across LOINC, disease, medication, specialist, and research layers — never answered from model memory alone
- **📄 Multi-Format Support** — PDF (pdfplumber), JPEG, PNG (Tesseract OCR), and CSV ingestion
- **🌍 Location-Based Doctor Finder** — Real healthcare facilities across India via free OpenStreetMap (Nominatim geocoding + Overpass POI search) — no API key, no billing
- **📱 True Cross-Platform** — One Next.js codebase → Web, Android, and iOS with native UX (haptics, safe-area, bottom sheets, pull-to-refresh, hardware back button)
- **🔒 Zero Client-Side Keys** — All AI features are served by the backend; the frontend never calls an LLM provider, so no API key is ever exposed
- **🎨 Premium UI/UX** — Dark/light mode, Framer Motion animations, 44pt tap targets, spring-in active pill navigation
- **🏥 Safety First** — Health insights only (never diagnoses/prescriptions), banned-phrase detection at schema + prompt level, "may suggest / worth discussing with your doctor" language enforced

---

## ✨ Features

### 🔬 Lab Analysis Pipeline
A 10-stage production pipeline turns a raw upload into structured medical intelligence:

| Stage | Action |
|---|---|
| 1. Upload | Receive PDF / JPEG / PNG / CSV via multipart form |
| 2. Validate | File type, size, and integrity checks |
| 3. Cache | Content-hash deduplication for instant re-analysis |
| 4. Extract | pdfplumber for PDF text; Tesseract OCR for images |
| 5. NLP / LOINC | Map extracted test names to standard LOINC codes |
| 6. Enrich | Augment each test with reference ranges & medical context |
| 7. LLM | Groq Llama 3.3 / Llama 4 vision for interpretation |
| 8. Validate | Schema + banned-phrase validation on AI output |
| 9. Respond | Structured JSON to the client |
| 10. Persist | Optional storage in user report history (dashboard) |

**Mobile adds native capture options:** *Take Photo*, *From Gallery*, and *Browse Files* — each routed through the Capacitor bridge for native camera roll access.

### 💊 Medicine Info
- **Drug Database Lookup** — Comprehensive drug information at your fingertips
- **Dosage Guidance** — Standard dosing for adults and pediatric populations
- **Side Effects** — Common, serious, and rare adverse reactions surfaced clearly
- **Interaction Checker** — Cross-reference multiple medications for dangerous combinations
- **Pregnancy & Lactation Warnings** — Safety classifications for special populations

### 👨‍⚕️ Doctor Finder
- **Real Healthcare Facilities** — Pulls from OpenStreetMap's live POI database (no stale doctor listings, no API key)
- **Proximity Ranking** — Results sorted by distance from the user's current location
- **Anywhere in India** — Works in every city, town, and rural area covered by OpenStreetMap
- **Mobile Native UX** — Direct dialer integration and native maps app launching on Android & iOS
- **Geolocation** — Uses native Capacitor Geolocation on mobile for high-accuracy GPS

### 📊 Health Dashboard
- **Health Score (0–100)** — Composite score derived from the user's latest report
- **Trend Sparklines** — Visualize how each biomarker changes across reports over time
- **Profile Editor** — Age, gender, weight, and conditions personalize reference ranges
- **Report History** — Every uploaded report stored, searchable, and comparable
- **Smart Insights** — AI-generated longitudinal analysis ("Your LDL has trended up 12% over 3 reports")

### 🔬 Research Copilot (Medical RAG 2.0)
The flagship AI feature — a retrieval-augmented medical intelligence engine that grounds every answer in retrieved evidence:

- **Multi-Layer Retrieval** — Searches across LOINC codes, disease profiles, medication databases, specialist referrals, and peer-reviewed research
- **Confidence Scoring** — Every answer ships with an explicit confidence score and source citations
- **No Hallucination Mode** — The model is instructed to refuse rather than fabricate when evidence is insufficient
- **Streaming Responses** — Token-by-token streaming for instant perceived latency
- **Citation Links** — Every factual claim is hyperlinked back to its source document

### 📱 Mobile-Only UX (Capacitor)
Features that ship exclusively on the native Android and iOS builds — web users see a graceful fallback:

- ✅ Safe-area insets for notched / dynamic-island devices
- ✅ 44pt minimum tap targets (Apple HIG compliant)
- ✅ Bottom-sheet modals (auto-upgraded from `Modal`)
- ✅ Pull-to-refresh with weighted resistance + haptic on release
- ✅ Hardware back-button routing (Android)
- ✅ Native share sheet for insights & reports
- ✅ Haptic feedback on key actions
- ✅ Status-bar theme sync (light/dark)
- ✅ Offline banner with network state monitoring
- ✅ Biometric authentication (Face ID / Touch ID / fingerprint)
- ✅ Secure storage for auth tokens
- ✅ Push notifications

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | FastAPI + Pydantic v2 + pdfplumber + Tesseract OCR + Groq (Llama 3.3 / Llama 4 vision) |
| **Frontend** | Next.js 14 + TypeScript 5 + React 18 + Framer Motion (fully componentized) |
| **Mobile** | Capacitor 6.1 (Android + iOS) — single shared Next.js codebase, no rewrite |
| **Doctor Finder** | OpenStreetMap (Nominatim geocoding + Overpass POI search) — free, no API key |
| **AI Provider** | Groq Cloud (Llama 3.3 70B for text, Llama 4 vision for image-based reports) |
| **Pipeline** | 10-stage: Upload → Validate → Cache → Extract → NLP/LOINC → Enrich → LLM → Validate → Respond |

> All AI features are served by the backend (Groq). The frontend never calls an LLM provider directly, so **no API key is ever exposed client-side**.

---

## 📁 Repository Layout

```
FeelFit/
├── backend/                # FastAPI backend (Python)
│   ├── main.py             # API server with all endpoints
│   ├── requirements.txt
│   ├── Dockerfile          # Tesseract preinstalled
│   ├── Procfile
│   └── .env.example
├── frontend/               # Single shared Next.js 14 frontend (web + mobile)
│   ├── app/                # App router pages
│   ├── components/         # Fully componentized React UI
│   ├── lib/                # Native bridge, utilities, API client
│   ├── public/             # Static assets
│   ├── styles/             # Global + mobile.css (scoped under html.is-capacitor)
│   ├── types/              # Shared TypeScript types
│   ├── scripts/            # prepare-mobile.mjs (post-build injection)
│   ├── capacitor.config.ts # One config drives both platforms
│   └── package.json
├── android/                # Native Android Studio project (Capacitor 6)
├── ios/                    # Native Xcode project (Capacitor 6)
├── docs/                   # Architecture docs + MERGE_REPORT.md
├── scripts/                # dev.sh, build-mobile.sh
├── RAG_ARCHITECTURE.md     # Medical RAG 2.0 design doc
├── COPILOT_ARCHITECTURE.md # Copilot architecture doc
└── README.md               # This file
```

There is exactly **one copy** of `app/`, `components/`, `lib/`, `public/`, `styles/`, `types/`. Web, Android, and iOS all consume the same source — no React Native rewrite, no separate mobile team.

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ (for frontend)
- **Python** 3.11+ (for backend)
- **Tesseract OCR** (system package — `apt install tesseract-ocr` on Debian/Ubuntu)
- **Groq API Key** — free tier available at [console.groq.com/keys](https://console.groq.com/keys)

### One-Shot (Recommended)

```bash
# Starts backend on :8024 and frontend on :3000
scripts/dev.sh
```

### Manual Setup

#### 1. Backend (REQUIRED — serves all AI features)

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env        # then add your GROQ_API_KEY
python main.py              # http://localhost:8024/api/docs
```

#### 2. Frontend

```bash
cd frontend
npm install --legacy-peer-deps
cp .env.example .env.local  # NEXT_PUBLIC_API_URL defaults to http://localhost:8000
npm run dev                 # http://localhost:3000
```

> **The only required key is `GROQ_API_KEY`.** The doctor finder uses free OpenStreetMap (no key, no billing).

---

## 📱 Mobile Build (Android + iOS)

> **IMPORTANT — Capacitor workflow:** The native projects (`android/`, `ios/`) contain ONLY native platform code. The web assets (`android/app/src/main/assets/public/` and `ios/App/App/public/`) are GENERATED by `cap sync` from `frontend/out/`. They are **not** in version control and must be regenerated before opening the native projects.

```bash
cd frontend
npm install --legacy-peer-deps   # postinstall auto-creates android/ios + root node_modules symlinks

# ── STEP 1: Build the frontend (static export for Capacitor) ──────────────
BUILD_TARGET=mobile NEXT_PUBLIC_API_URL=https://api.feelfit.app npm run build

# ── STEP 2: Sync the build output into the native projects ────────────────
# This regenerates android/app/src/main/assets/public/ and ios/App/App/public/
npx cap sync

# ── STEP 3: Open the native project and build ─────────────────────────────
npx cap open android              # → Android Studio → Run ▶ (builds APK)
npx cap open ios                  # → Xcode → Run ▶ (requires macOS + pod install first)

# Or use the one-shot helper (does Steps 1+2+3):
../scripts/build-mobile.sh android   # build APK
../scripts/build-mobile.sh ios       # open Xcode
```

> **Note on symlinks:** Capacitor expects `android/` and `ios/` next to `capacitor.config.ts`. The merged layout puts the real native projects at the repo root, so `frontend/android` and `frontend/ios` are symlinks (auto-created by `npm install`'s `postinstall` hook). A top-level `node_modules` symlink (→ `frontend/node_modules`) ensures the iOS Podfile and Android `capacitor.settings.gradle` paths resolve correctly. All symlinks are git-ignored.

---

## 🏛️ Mobile Architecture (Single Source of Truth)

Every mobile concern is funneled through one typed entry point, ensuring the web build stays provably unaffected.

| Concern | Where | Notes |
|---|---|---|
| Native bridge | `frontend/lib/native.ts` | Single typed entry point for every Capacitor plugin (haptics, secure storage, biometrics, push, share, status bar, splash, network, device, geolocation, etc.). Web falls back gracefully. |
| Mobile CSS | `frontend/styles/mobile.css` | All rules scoped under `html.is-capacitor` — web build is provably unaffected. |
| Boot hook | `frontend/components/hooks/useNativeBridge.ts` | Wires splash hide, status bar, safe-area, back button, app resume — runs once on app mount. |
| Pull-to-refresh | `frontend/components/hooks/usePullToRefresh.ts` | Touch-driven, weighted resistance, haptic on release. |
| Bottom navigation | `frontend/components/layout/BottomNav.tsx` | 5-tab Capacitor-only nav with spring-in active pill. |
| Modal → Bottom Sheet | `frontend/components/ui/BottomSheet.tsx` | `Modal` auto-upgrades to bottom sheet on Capacitor. |
| Build prep | `frontend/scripts/prepare-mobile.mjs` | Post-build: injects `<base href="./">` for Capacitor WebView + auto-creates android/ios symlinks. |
| Capacitor config | `frontend/capacitor.config.ts` | One config drives both platforms. HTTPS-only (cleartext disabled). |

---

## 🔌 API Reference

### Base URL
```
http://localhost:8024/api    (dev)     |     https://api.feelfit.app/api    (prod)
```

### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check — server + Groq + Tesseract status |
| `POST` | `/api/analyze` | Upload a report (PDF/JPEG/PNG/CSV) → AI analysis |
| `POST` | `/api/doctors` | Find nearby specialists given a location + specialization |
| `POST` | `/api/medicine` | Drug information lookup |
| `POST` | `/api/copilot` | Medical RAG 2.0 — evidence-grounded Q&A with citations |
| `GET` | `/api/info` | API version + supported formats |

### Example: Analyze a Report

```bash
curl -X POST http://localhost:8024/api/analyze \
  -F "file=@lab_report.pdf"
```

### Response Format

```json
{
  "reportType": "Blood Test",
  "patientInfo": {
    "name": "John Doe",
    "age": "35",
    "gender": "Male"
  },
  "testResults": [
    {
      "test": "Hemoglobin",
      "value": "14.5 g/dL",
      "normalRange": "13.5-17.5 g/dL",
      "loincCode": "718-7",
      "status": "normal"
    }
  ],
  "keyFindings": ["All parameters within normal range"],
  "diagnosis": "Healthy individual",
  "severity": "low",
  "recommendations": ["Maintain current lifestyle"],
  "prescriptions": [],
  "lifestyle": ["Regular exercise", "Balanced diet"],
  "followUp": "Annual checkup recommended",
  "specialization": "General Physician",
  "urgency": "routine"
}
```

> Full interactive API docs available at `http://localhost:8024/api/docs` (Swagger UI).

---

## 🌐 Deployment

### Web — Frontend (Vercel)

1. Import the repo on [Vercel](https://vercel.com); set **Root Directory** to `frontend/`.
2. Add env var `NEXT_PUBLIC_API_URL` = your backend URL (no trailing slash).
3. Deploy — Vercel auto-detects Next.js.

### Web — Backend (Render / Railway / Fly / any Docker host)

1. Set root to `backend/`. Ships with `Dockerfile` (Tesseract preinstalled) and `Procfile`.
2. Configure env vars (see `backend/.env.example`):
   - `GROQ_API_KEY` — **required**
   - `ALLOWED_ORIGINS` — your frontend URL(s), comma-separated
   - `ENVIRONMENT=production`
3. Server binds to `$PORT` automatically. Health check: `GET /api/health`.

### Mobile — Android

1. `cd frontend && BUILD_TARGET=mobile NEXT_PUBLIC_API_URL=https://api.feelfit.app npm run cap:sync:android`
2. `npx cap open android` → Android Studio → **Run ▶** or **Build → Generate Signed APK/AAB**
3. Upload AAB to [Google Play Console](https://play.google.com/console)

### Mobile — iOS (requires macOS)

1. `cd ios/App && pod install`
2. `cd ../.. && cd frontend && BUILD_TARGET=mobile NEXT_PUBLIC_API_URL=https://api.feelfit.app npm run cap:sync:ios`
3. `npx cap open ios` → Xcode → set signing team → **Run ▶** or **Product → Archive**
4. Upload to [App Store Connect](https://appstoreconnect.apple.com) via Xcode Organizer

> **HTTPS required for mobile production builds.** Capacitor config disables cleartext HTTP. Use `https://` for `NEXT_PUBLIC_API_URL`.

---

## 🔧 Configuration

### Frontend — `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8024     # Backend URL (no trailing slash)
NEXT_PUBLIC_APP_NAME=FeelFit
```

### Backend — `backend/.env`

```env
GROQ_API_KEY=your_groq_api_key_here           # Required — free at console.groq.com/keys
HOST=0.0.0.0
PORT=8024
ENVIRONMENT=development                       # or "production"
ALLOWED_ORIGINS=http://localhost:3000         # Comma-separated frontend URLs
```

> `.env` files are git-ignored — never commit real keys; configure them in the host's dashboard.

---

## 🔒 Safety & Security

### Medical Safety
- ✅ Health insights **only** — never diagnoses or prescriptions
- ✅ Banned-phrase detection at both schema and prompt level
- ✅ "May suggest", "worth discussing with your doctor" language enforced
- ✅ Confidence scoring on every Copilot answer
- ✅ Refusal-over-hallucination: RAG refuses when evidence is insufficient

### Security Best Practices
- ✅ HTTPS/TLS encryption (cleartext disabled in Capacitor)
- ✅ CORS configuration via `ALLOWED_ORIGINS`
- ✅ Input validation on every endpoint (Pydantic v2)
- ✅ File type verification + size limits on uploads
- ✅ Environment variable protection — no client-side keys
- ✅ Secure storage for auth tokens on mobile (Capacitor SecureStorage)
- ✅ Biometric authentication available on mobile (Face ID / Touch ID)
- ✅ Error handling without stack-trace leaks

---

## 📊 Performance

| Metric | Target |
|---|---|
| Frontend Load Time (web) | < 2s |
| API Response Time (cached) | < 500ms |
| API Response Time (AI analysis) | < 3s |
| File Processing (PDF text) | < 5s |
| File Processing (image OCR) | < 8s |
| Mobile App Cold Start | < 1.5s |
| Uptime Target | 99.9% |

### Optimization Tips

**Frontend:**
- Next.js image optimization enabled
- Lazy loading for off-screen report history
- Code splitting per route
- Static export for mobile (no SSR overhead in Capacitor WebView)

**Backend:**
- Content-hash caching for repeat analysis
- Redis caching (optional, for production scale)
- Rate limiting (configure per host)
- Connection pooling for OpenStreetMap requests

---

## 📚 Documentation

| Doc | Content |
|---|---|
| `docs/MERGE_REPORT.md` | Full merge report: every file added/merged/removed, every dependency, every conflict resolved |
| `docs/01-ARCHITECTURE.md` | System architecture |
| `docs/02-DESIGN.md` | Design system |
| `docs/03-CODEBASE-FLOW.md` | Codebase flow |
| `docs/04-LLM-RAG.md` | LLM + RAG deep dive |
| `docs/05-CHANGELOG.md` | Changelog |
| `docs/06-SECURITY-SCALABILITY.md` | Security & scalability |
| `docs/07-COPILOT-DEEP-DIVE.md` | Copilot deep dive |
| `RAG_ARCHITECTURE.md` | Medical RAG 2.0 design |
| `COPILOT_ARCHITECTURE.md` | Copilot architecture |

---

## 🗺️ Roadmap

### Phase 1 — Current ✅
- [x] Lab report analysis (PDF / image / CSV)
- [x] 10-stage extraction pipeline with LOINC mapping
- [x] Medicine info + interaction checker
- [x] OpenStreetMap doctor finder (India-wide)
- [x] Health dashboard with score + trends
- [x] Medical RAG 2.0 Copilot with citations
- [x] Web deployment (Vercel + Render)
- [x] Android + iOS via Capacitor (single codebase)

### Phase 2 — Q3 2026
- [ ] User authentication (email + OAuth)
- [ ] Multi-language support (Hindi, Tamil, Bengali, Marathi)
- [ ] Apple Health / Google Fit integration
- [ ] Wearable device sync (smartwatch biomarkers)
- [ ] Report sharing via secure links

### Phase 3 — Q4 2026
- [ ] Telemedicine integration (in-app video consults)
- [ ] Appointment scheduling with real doctors
- [ ] Insurance provider integration
- [ ] Pharmacy delivery partner integration
- [ ] Family / dependent profiles

### Phase 4 — Q1 2027
- [ ] AI voice assistant for hands-free Q&A
- [ ] Predictive health risk modeling (longitudinal ML)
- [ ] Advanced analytics with cohort benchmarks
- [ ] Clinician review portal (HIPAA-compliant)
- [ ] Regional expansion beyond India

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork** the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a **Pull Request**

### Development Guidelines

- Follow existing code style (TypeScript strict mode, Python Black + isort)
- Write meaningful commit messages (conventional commits preferred)
- Add tests for new features (`pytest` for backend, `npm test` for frontend)
- Update documentation when adding public API surface
- Ensure all tests pass before requesting review
- **Never commit API keys** — all secrets live in environment variables

---

## 💰 Keys & Cost

- **Only `GROQ_API_KEY` is needed** — free tier available at [console.groq.com](https://console.groq.com/keys)
- Doctor finder uses free **OpenStreetMap** — no key, no billing, no rate-limit headaches
- `.env` files are git-ignored — configure keys in your host's dashboard, never in code
- Estimated monthly cost at moderate traffic (10k analyses): **<$5** on Groq free + Vercel hobby tier

---

## 📞 Support

- **🐛 Bug Reports & Feature Requests:** [Open a GitHub Issue](../../issues)
- **📖 Architecture Questions:** See the `docs/` directory (especially `01-ARCHITECTURE.md` and `04-LLM-RAG.md`)
- **🔌 API Questions:** Interactive Swagger docs at `/api/docs` once the backend is running

---

<div align="center">

**Built with ❤️ by [Your Name]**

[⬆ Back to Top](#-feelfit--ai-medical-intelligence-platform)

⭐ **Star this repo if you find it useful!** ⭐

</div>
