# FeelFit — LLM, RAG & Extraction Pipeline

How FeelFit reads a report, grounds its answers, and stays safe (non-diagnostic).
Design principle: **the LLM never owns the numbers.** Extraction is deterministic
where possible; thresholds are computed in code; the LLM only writes the narrative
and answers questions over retrieved evidence.

---

## 1. Document extraction (most-accurate-first)
`backend/extraction/` + `llm/pipeline.py`:
1. **CSV** → stdlib parser.
2. **PDF** → `pdfplumber` (layout-aware) → `PyMuPDF` fallback.
3. **Image** → PaddleOCR (table-grade) → Tesseract fallback.
4. **Gemini vision** (`gemini_extract_tests`) — reads 2D table layouts natively;
   far better on dense/photographed reports. Runs for **paid users**, and as a
   **free recovery path when basic OCR returns almost nothing** (prevents
   fabrication). `GEMINI_MODEL` configurable; "thinking" disabled for speed.
5. **Deterministic row parser** (`extraction/nlp.parse_report_rows`) — reads exact
   values + the lab's printed H/L flags. Authoritative when it finds ≥6 rows.

**Authority order:** Gemini (≥6) → parser (≥6) → NLP. If all yield < 2 tests →
**HTTP 422 "couldn't read"** (never invent values).

## 2. Status & risk (deterministic, not LLM)
Each value's status (low / high / critical / normal) is recomputed in code from the
reference range — LLMs under-flag, so they are not trusted for this. Risk level and
the abnormal list are assembled from the computed statuses.

## 3. Narrative generation (Groq)
- **Fast path** `summarize_from_tests` — given an already-extracted test list, the
  LLM writes only the summary/recommendations/lifestyle/follow-up. Context fed in:
  full profile (age, gender, **conditions, medications**), **trend movement** vs
  the previous report, and a **dated timeline** (this report's date + the previous
  report's date/findings). Safe language enforced ("may suggest", "worth
  discussing with your doctor").
- **Fallback** `run_llm_pipeline` — when extraction is uncertain, a larger schema-
  guided call reads the report itself; output is then re-assembled deterministically.

## 4. AskFit — Medical RAG
`/api/rag/retrieve` (`main.py`) → `rag/` retriever + `generate_rag_answer`:
1. **Retrieve** grounded evidence from the offline KB across layers (LOINC lab
   standards, medication, disease/SNOMED, specialist, research) with confidence +
   citations.
2. **AskFit memory** — the user's own recent **abnormal labs + current focus** are
   folded into the context, so answers reference *their* data.
3. **Answer** (`generate_rag_answer`, Groq) — a warm, direct, genuinely helpful
   reply that uses the evidence **plus** general health knowledge (it never says
   "the evidence doesn't cover this"). It receives: reference notes, an optional
   **attached document's text**, the **conversation history**, the question, and
   the patient context.
4. The frontend shows the clean answer + a "well/partly supported" badge + friendly
   **source chips** (not raw LOINC dumps), with suggested follow-ups.

## 5. Multimodal attach
`/api/askfit/attach` extracts text from an uploaded report/prescription/note
(`extract_text` → `gemini_read_text` fallback for tough photos) and returns it; the
chat then answers over **document + profile + lab history + conversation**.

## 6. Safety guardrails
- No diagnosis / prescription / dosing; calm, educational language by design.
- A blocklist (`_BLOCKED`) screens for diagnostic phrasing; deterministic fallbacks
  on any LLM failure; disclaimers shown separately (not from the model).
- The browser never holds an LLM key — all model calls go through the backend.

## 7. Models & cost control
- **Groq** (`llama-3.3-70b-versatile`) for narrative + RAG answers (fast, cheap).
- **Gemini** (`gemini-2.x-flash`) for vision extraction / document reading.
- Free tier uses the parser path; Gemini gated to paid + the OCR-failure recovery.
