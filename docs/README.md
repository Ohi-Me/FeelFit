# FeelFit — Documentation Index

| # | Doc | What it covers |
|---|-----|----------------|
| 01 | [Architecture](01-ARCHITECTURE.md) | System topology, frontend/backend, identity, integrations |
| 02 | [Design](02-DESIGN.md) | Tokens, typography, components, motifs, i18n |
| 03 | [Codebase Flow](03-CODEBASE-FLOW.md) | Repo layout + how a request travels (esp. analyze) |
| 04 | [LLM, RAG & Extraction](04-LLM-RAG.md) | Extraction priority, deterministic status, AskFit RAG, safety |
| 05 | [Changelog](05-CHANGELOG.md) | Everything changed this session, by theme |
| 06 | [Security & Scalability](06-SECURITY-SCALABILITY.md) | Honest current-state + production path |
| 07 | [Copilot Deep-Dive](07-COPILOT-DEEP-DIVE.md) | The health-copilot data spine, services, endpoints |

Also at the repo root: `HANDOFF.md` (session context), `README.md`,
`RAG_ARCHITECTURE.md`, `REFERENCE.md`.

**Run locally:** backend `uvicorn main:app --port 8000`; frontend `npm run dev`.
**Keys (optional, graceful fallback):** `GEMINI_API_KEY`, `RAZORPAY_*`,
`GOOGLE_OAUTH_CLIENT_ID`/`NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `GOOGLE_MAPS_API_KEY`,
`WHATSAPP_*`, `ADMIN_TOKEN`, `TRUST_PROXY`, `ALLOWED_ORIGINS`.
