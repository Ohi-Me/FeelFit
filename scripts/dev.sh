#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# scripts/dev.sh — one-shot local development bootstrap
# ════════════════════════════════════════════════════════════════════════════
# Starts the FastAPI backend on :8000 and the Next.js frontend on :3000.
# Use Ctrl-C to stop both. Requires Python ≥ 3.10 and Node ≥ 18.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[dev] Backend: http://localhost:8000  (FastAPI)"
echo "[dev] Frontend: http://localhost:3000 (Next.js)"
echo ""

# ── Backend ────────────────────────────────────────────────────────────────
if [ -d backend ]; then
  python3 -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000 &
  BE_PID=$!
else
  echo "[dev] No backend/ directory found, skipping backend."
  BE_PID=""
fi

# ── Frontend ───────────────────────────────────────────────────────────────
cd frontend
npm install --legacy-peer-deps --silent 2>/dev/null || npm install --legacy-peer-deps
npm run dev &
FE_PID=$!

trap 'kill $BE_PID $FE_PID 2>/dev/null || true' EXIT INT TERM
wait
