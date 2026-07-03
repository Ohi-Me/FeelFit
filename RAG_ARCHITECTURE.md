# FeelFit Medical RAG 2.0 — Architecture

Transforms FeelFit from an OCR + LLM report analyzer into a **Retrieval-Augmented
Medical Intelligence Platform**. The system never relies on model memory alone:
every analysis can retrieve evidence from trusted medical knowledge before the
LLM reasons over it.

```
LLM  = Reasoning Engine
RAG  = Medical Knowledge Engine
```

Knowledge comes from **retrieval**. Reasoning comes from the **LLM**.

---

## What is implemented (Phase 2 scaffold)

A real, runnable, **dependency-free** retrieval stack lives in `backend/rag/`.
It boots with no external services (no vector DB, no embedding API, no numpy) by
indexing the local LOINC KB + seed knowledge + a knowledge graph using an offline
hashing embedder. Every piece is a seam you can swap for a production backend.

| File | Responsibility |
|------|----------------|
| `types.py` | `KnowledgeDoc`, `RetrievedDoc`, `Citation`, `RetrievalQuery`, `EvidenceBundle` (confidence + citations + prompt rendering) |
| `embeddings.py` | `Embedder` protocol + offline `HashingEmbedder` (word + char-trigram feature hashing) |
| `vector_store.py` | `VectorStore` protocol + `InMemoryVectorStore` (cosine) |
| `sources.py` | `KnowledgeSource` registry — `LoincSource`, `DiseaseSeedSource`, `SpecialistSeedSource` (live), `RxNorm/Research/IndianHealth` (stubs) |
| `knowledge_graph.py` | `MedicalKnowledgeGraph`: Test → Condition → Medication → Specialist → Lifestyle → Risk |
| `retrieval.py` | `HybridRetriever`: semantic + keyword + ontology + metadata fused with Reciprocal Rank Fusion |
| `layers.py` | The 5 retrieval layers (LOINC / Medication / Disease / Specialist / Research) |
| `orchestrator.py` | `MedicalRAG` + `get_rag()` singleton → produces an `EvidenceBundle` |

### Multi-layer retrieval

| Layer | Purpose | Source families |
|-------|---------|-----------------|
| 1 LOINC | Exact laboratory test meaning | LOINC |
| 2 Medication | Drug info, interactions, warnings | RxNorm, DrugBank/OpenFDA/DailyMed |
| 3 Disease | Condition context, guidelines, risks | SNOMED CT, ICD-10/11 |
| 4 Specialist | Finding → specialist mapping | Knowledge graph |
| 5 Research | Latest evidence / guidelines | PubMed/NIH/WHO/CDC, ICMR/CDSCO |

### Hybrid retrieval (not vector-only)

Each query runs semantic (vector cosine), keyword (token overlap), ontology
(clinical alias/synonym hits), and metadata (specialty/condition filters)
rankers. Their ranked lists are merged with **Reciprocal Rank Fusion** so the
scorers need not share a scale.

### Confidence + Explainability

`EvidenceBundle` is the Confidence Engine envelope. Every response carries:

- `confidence` — derived from retrieval strength × layer coverage
- `validation_status` — `evidence_supported` / `partial_evidence` / `insufficient_evidence`
- `citations` — source, title, version, score for each retrieved doc
- `knowledge_version`, `retrieved_at`

---

## How it plugs in

### 1. Direct retrieval / Research Copilot API

```
POST /api/rag/retrieve
{ "query": "Why is ferritin low?", "age": 34, "gender": "female",
  "conditions": ["anemia"] }
```

Returns the full evidence bundle (layers, citations, confidence, validation
status).

### 2. Grounded report analysis (env-gated, default OFF)

In `llm/pipeline.py`, `build_rag_evidence()` retrieves an evidence block from the
extracted tests + patient profile and injects it into the LLM prompt. It is
gated by `ENABLE_RAG`:

```bash
ENABLE_RAG=1   # 1|true|yes|on  → ground the LLM in retrieved evidence
# unset/0       → existing flow is byte-for-byte unchanged
```

Failure is non-fatal — if RAG is unavailable, the pipeline falls back to the
ungrounded prompt.

### 3. Live medication retrieval (async)

`MedicalRAG.aretrieve()` is the async entry point (used by the API + pipeline).
When `RAG_LIVE_MEDS=1`, it augments the **medication** layer with live OpenFDA +
RxNorm data for the patient's current medications (reusing
`services/medicine_live_service`). Offline seed data is always present as a
fallback; live docs are additive and failure is non-fatal.

---

## Configuration (env flags)

| Flag | Default | Effect |
|------|---------|--------|
| `ENABLE_RAG` | off | Ground report analysis in retrieved evidence |
| `RAG_LIVE_MEDS` | off | Add live OpenFDA/RxNorm docs to the medication layer |
| `RAG_EMBEDDER` | `hashing` | `hashing` (offline) or `sentence-transformers` |
| `RAG_EMBED_MODEL` | `all-MiniLM-L6-v2` | model for sentence-transformers |
| `RAG_VECTOR_STORE` | `memory` | `memory`, `qdrant`, or `pgvector` |
| `QDRANT_URL` / `QDRANT_COLLECTION` | localhost | Qdrant connection |
| `DATABASE_URL` / `PGVECTOR_TABLE` | — | pgvector connection |

Every selector falls back safely: if a model/DB can't initialize, the engine
reverts to the offline hashing embedder + in-memory store.

---

## What's implemented vs. roadmap

**Implemented now**
- Offline hashing embedder **and** optional `SentenceTransformerEmbedder`
  (`embeddings.get_default_embedder`).
- In-memory store **and** `QdrantVectorStore` / `PgVectorStore`
  (`vector_store.get_default_store`) — all behind the `VectorStore` protocol.
- All 5 layers seeded with real evidence (LOINC, drug, disease, specialist+graph,
  research + Indian health); live medication layer via `aretrieve`.
- `medical_kb.json` expanded to 57 curated LOINC tests (disease + specialist
  layers derive from it automatically).

**Roadmap (additive, no orchestration changes)**
1. **Full LOINC catalogue** — grow `medical_kb.json` → 20,000+ tests.
2. **Live research/Indian sources** — replace seeds with PubMed/WHO/CDC and
   ICMR/CDSCO document indexing.
3. **Knowledge graph at scale** — hydrate millions of edges from SNOMED CT +
   RxNorm + curated guidelines.
4. **Longitudinal memory** — index past reports per user so trends are retrieved,
   not just computed.
