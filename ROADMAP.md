# FeelFit — Platform Roadmap & Architecture Strategy

> From "blood report analyzer" to a category-defining **personal health
> intelligence platform**. What to build, in what order, on what stack — and
> why each choice creates a moat rather than a feature.

---

## 1. Where FeelFit is today (already shipped)

- 10-stage lab-report pipeline (OCR → NLP → LOINC → LLM narration, schema-validated)
- **AI model router** (`backend/llm/router.py`): every LLM feature routes
  Groq ⇄ Gemini by task + tier, with health-based fallback and premium chains
- AskFit copilot with RAG evidence + citations, medicine intelligence
  (OpenFDA/RxNorm live), doctor finder (OSM/Google), trends, health score,
  habit engine, 11 languages, web + Android from one codebase
- Freemium: 2 free analyses → +1 on signup (3 total) → plans
  (₹19 day / ₹89 wk / ₹349 mo / ₹1999 yr with anchor pricing)

## 2. The AI Router (implemented) — how it decides

| Task | Free chain | Premium chain |
|---|---|---|
| Report analysis | Groq Llama-3.3-70B → Gemini Flash | **Gemini Pro** → Groq → Flash |
| AskFit chat | Groq → Flash | **Gemini Pro** (longer answers) → Groq → Flash |
| Vision (images/PDFs) | Gemini Flash → Groq Scout | **Gemini Pro** → Flash → Scout |
| Utility (medicine etc.) | Groq → Flash | Groq → Flash (speed > depth here) |

Mechanics: per-provider circuit breaker (30s cooldown on errors, 60s+ on 429s
honoring Retry-After), per-model success/latency stats, capability-aware
skipping (only Gemini gets raw PDFs), env-overridable model ids. Adding a
provider (e.g. a local model later) = one adapter + chain entries.

**Why not LiteLLM?** It's a fine library, but our router is ~250 lines with
zero new dependencies, tuned to exactly two providers and our tier logic.
Adopt LiteLLM only when providers > 3 or you need cost accounting per key.

## 3. Premium that's worth paying for (beyond limits)

Ship in this order — each is visible value, not a bigger meter:

1. **Deep Analysis mode** (router: premium chain, longer budgets) — richer
   "what this means for YOU" narratives, cross-report correlation, and a
   doctor-visit prep sheet ("3 questions to ask"). *Mostly shipped — market it.*
2. **Health Timeline & Memory** — every report/vital/note becomes part of a
   longitudinal record; AskFit answers reference *your* history ("your TSH has
   risen across your last 3 reports"). Requires the memory layer (§4).
3. **Family profiles** — parents manage reports for kids/elders under one
   subscription. In India this is THE killer feature; reports are a family affair.
4. **Comparison intelligence** — "people with your profile" percentile bands
   (anonymized aggregates once volume allows; curated reference bands until then).
5. **Report → Action plans** — premium turns findings into a 4-week plan wired
   into the existing habit engine + reminders; free sees the plan's outline.
6. **Priority + longer AskFit** — already routed; premium also gets attachment
   memory across sessions.
7. **Exports & sharing** — clean PDF summary for the doctor, one-tap share
   links with expiry. Small build, high perceived value.

## 4. Architecture evaluation (what to adopt, what to skip)

### Adopt now (high leverage, low cost)
| Tech | Verdict | Why |
|---|---|---|
| **Supabase (Postgres + Storage + Auth-adjacent)** | ✅ Now | The JSON-file stores (`accounts`, `usage`, `health_store`) won't survive multi-instance deploys on Render. Postgres row-level security + free tier fits. Keep FastAPI as the only client (no client-side Supabase) so the API stays the single security boundary. |
| **pgvector on Supabase** | ✅ Now | Replaces the in-memory vector store; embeddings persist across restarts and RAG memory becomes durable. One extension, zero new infra. |
| **Medical memory** | ✅ Now | A `memories` table (per-user, typed: lab_fact, condition, preference, event) + retrieval into AskFit/analysis prompts. This is the moat: switching apps means losing your health brain. |
| **Redis (Upstash free)** | ✅ Soon | Analysis cache + rate limits are in-process today; Redis makes them survive restarts and scale-out. Skip Celery until jobs exceed request timeouts. |
| **PostHog + Sentry** | ✅ Now | You can't tune conversion (2→3 free → paid) blind. Both have generous free tiers. |

### Adopt when the trigger fires
| Tech | Trigger |
|---|---|
| **FHIR (as an EXPORT format)** | First integration with a hospital/lab or ABDM (India's health stack). Store internally in your own schema; emit FHIR `DiagnosticReport`/`Observation` at the boundary. Full internal FHIR is over-engineering at this stage. |
| **SNOMED CT / ICD-10** | When symptom-checker + conditions need coding for interop or analytics. LOINC (labs) + RxNorm (drugs) already cover current features. SNOMED licensing needs care (India is a member country — free national license). |
| **Knowledge graph (start in Postgres)** | The `rag/knowledge_graph.py` layer already models test↔condition↔specialty. Keep it in Postgres tables (nodes/edges) — Neo4j only when you need multi-hop graph queries you can't express in SQL. Don't run a second database for a graph that fits in two tables. |
| **Meilisearch/OpenSearch** | When Postgres FTS gets slow (>100k docs) or you need typo-tolerant medicine search at scale. |
| **Celery + Redis queue** | When any pipeline stage exceeds ~60s (e.g., DICOM series processing) — then move analysis to jobs + polling/Realtime updates. |

### Recommended production shape (target, incremental)
```
Vercel (Next.js) ─┐                       ┌─ Groq / Gemini (via AI Router)
Capacitor apps  ──┼── FastAPI on Render ──┼─ Supabase Postgres (+pgvector, RLS)
                  │   (sole API boundary) ├─ Supabase Storage (reports, private buckets)
                  │                       ├─ Upstash Redis (cache, rate-limit)
                  │                       └─ OpenFDA / RxNorm / PubMed / OSM / MedlinePlus
                  └── Firebase Auth (Google/phone) + Resend (email OTP)  [as today]
```
Keep: FastAPI, the router, LOINC layer, Capacitor, Render/Vercel, GitHub Actions.
Replace: JSON file stores → Postgres. Add: pgvector, Storage, Redis, PostHog/Sentry.

## 5. Beyond blood reports — the document expansion map

Sequence by (user demand × feasibility with current stack). Gemini vision +
the existing pipeline pattern (extract → standardize → narrate → validate)
generalizes to almost all of these:

**Wave 1 — same pipeline, new prompts (weeks):**
urine & stool reports · hormone panels · prescriptions (→ auto-populate the
medicine tab + interaction checks!) · vaccination records · discharge
summaries · dental reports · histopathology *text* reports · genetic report
PDFs (interpretation of stated findings only)

**Wave 2 — image understanding with guardrails (months):**
skin photos (triage-level: "worth showing a dermatologist", never diagnosis) ·
eye photos · ECG strips (rate/rhythm description from the printout) ·
X-ray *reports* first, then the images with heavy "educational only" framing

**Wave 3 — signals & devices (the daily-engagement engine):**
wearables (Google Fit / Apple Health via Capacitor plugins) · CGM curves ·
BP/glucose meter photos ("point camera at any medical device" is a magic
moment) · nutrition/fitness app imports

**Wave 4 — heavy imaging (partnerships/regulatory):**
CT/MRI/ultrasound/echo: interpret the radiologist's REPORT for the patient
(high value, low risk) rather than raw DICOM reading (regulated medical
device territory — don't go there without clearance).

**The unifying product:** every document lands in one **Health Timeline**.
The pitch stops being "we read blood reports" and becomes **"the moment
anything health-related happens to you, FeelFit understands it, files it,
and tells you what it means — in your language."**

## 6. Moats (why users stay for years)

1. **Longitudinal memory** — 2 years of history makes FeelFit irreplaceable;
   every new report gets smarter because of the old ones. (Data moat)
2. **Family graph** — one account holding a household's health multiplies
   switching costs and organic growth. (Network moat)
3. **India-first depth** — 11 languages, Indian lab formats, Indian reference
   ranges, ₹19 day passes, ABDM readiness. Global players won't out-localize
   you. (Localization moat)
4. **Trust architecture** — non-diagnostic guardrails, citations, on-device
   history, doctor-friendly exports. In health, trust IS the brand. (Brand moat)
5. **Routing economics** — free-tier models for free users, paid models only
   where premium users feel it → gross margin most competitors won't match.
   (Cost moat)

**Daily-engagement loop:** morning check-in (exists) → wearable pulse (wave 3)
→ medicine reminders (exists) → weekly "health digest" notification → monthly
trend report. Reports bring users in; the loop keeps them.

## 7. Suggested build order

| Phase | Ship |
|---|---|
| Now (done) | AI router, 2+1 freemium, anchor pricing |
| Next 2–4 wks | Supabase migration (accounts/usage/health → Postgres, reports → Storage), PostHog+Sentry, prescription reading, PDF export |
| 1–2 mo | Medical memory + pgvector, Health Timeline UI, family profiles, urine/hormone/vaccination docs |
| 2–4 mo | Wearables + CGM, weekly digest, comparison bands, imaging *reports* |
| 4–6 mo | ABDM/FHIR export, partnerships (labs/clinics), premium action plans |
