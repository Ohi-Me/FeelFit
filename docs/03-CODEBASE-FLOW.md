# FeelFit — Codebase Flow

How a request travels through the code, and where each responsibility lives.

---

## Repository layout
```
feelFit v2.0/
├── frontend/                     Next.js 14 app
│   ├── app/page.tsx              the single page (tab switch, history, modals)
│   ├── app/layout.tsx            html shell, fonts, metadata
│   ├── components/
│   │   ├── layout/Navbar, LanguageSwitcher
│   │   ├── home/HomePage, TodayCard, FitTips
│   │   ├── analyze/UploadPanel, AnalyzingState, Results, FocusCard, ProofBanner
│   │   ├── copilot/AskFit        (the chat)
│   │   ├── medicine / doctors / symptoms / tools / dashboard / about
│   │   └── ui/ Icon, BrandMark, index (Btn/Card/…), motion
│   ├── lib/api.ts                ALL network calls
│   ├── types/index.ts            shared TS types
│   └── styles/globals.css        design tokens + keyframes
└── backend/
    ├── main.py                   FastAPI app: every route, middleware, errors
    ├── extraction/               extractor (OCR/PDF), nlp (deterministic parser)
    ├── llm/pipeline.py           Groq + Gemini calls, prompts, RAG answer
    ├── rag/                      offline medical knowledge base + retriever
    ├── services/                 account, profile, health_store, focus_engine,
    │                            program_engine, analytics, notifications,
    │                            osm_places, google_places, medicine_*
    ├── schemas/analysis.py       Pydantic request/response models
    └── data/                     accounts.json + feelfit.db (runtime)
```

## Frontend flow
1. `app/page.tsx` mounts, reads `localStorage` (session, history, usage) and the
   URL hash → sets the active `tab`. Tab changes `pushState` to history.
2. The active tab renders its component. User actions call `lib/api.ts`, which adds
   `authHeaders()` (token) + `X-Session-Id`, and `fetch`es the backend.
3. Results/Focus/Proof/Program render from the JSON response; history is saved to
   `localStorage` (with retention pruning).

## Backend flow — the analyze path (the heart)
`POST /api/analyze` (`main.py`):
1. `_identity` (email or IP) → freemium check (402 if free limit hit).
2. Validate file (magic bytes, size, MIME). Read bytes.
3. **Extract text:** CSV parser · else `extraction/extractor.extract_text`
   (pdfplumber/PyMuPDF for PDFs; PaddleOCR→Tesseract for images).
4. `_extract_report_date(text)` → the date printed on the report (for the timeline).
5. **Structure tests** (in priority): Gemini vision (paid, or **free recovery when
   OCR fails**) → deterministic `parse_report_rows` → NLP `extract_structured_tests`.
6. **Hard guard:** if extraction truly found < 2 tests → **422 "couldn't read"**
   (never fabricate values).
7. Status (low/high/critical) recomputed **in code** from reference ranges.
8. Narrative: `summarize_from_tests` (fast path) or `run_llm_pipeline` (fallback),
   grounded in tests + full profile + trends + dated timeline.
9. **Health graph:** persist biomarkers (`health_store.record_readings`), pick the
   **focus** (`focus_engine.pick_focus`), compute progress/proof
   (`program_engine`), queue a retest reminder, emit analytics.
10. Response includes `analysis`, `extracted_tests`, `focus`, `progress`(+`proof`),
    `report_date`, `health_timeline`, `usage`.

## Other key routes
- `/api/health/*` — graph, focus, today, program, vitals, checkin, **DELETE data**.
- `/api/rag/retrieve` — AskFit: RAG retrieval + grounded answer (folds in the
  user's own labs + focus + conversation + an optional attached document).
- `/api/askfit/attach` — read an uploaded doc (Gemini/OCR) → text for the chat.
- `/api/medicine/*`, `/api/doctors/search`, `/api/billing/*`, `/api/auth/*`,
  `/api/admin/metrics`.

## Cross-cutting
- **Middleware:** timing + oversized-body reject + **security headers**.
- **Error handlers:** generic JSON (no stack leak).
- **Caching:** `utils/cache` (analysis cache + rate limiter + magic validation).
