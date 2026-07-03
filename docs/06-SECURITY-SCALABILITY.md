# FeelFit — Security & Scalability Assessment

An honest, current-state read. Nothing is ever "unhackable"; this documents what is
hardened, what the limits are, and what to do before a real production launch.

---

## Security — what's in place
- **Security headers** on every response: backend middleware (`X-Content-Type-
  Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`,
  `Permissions-Policy`, `Cross-Origin-Resource-Policy`, HSTS over HTTPS) +
  `next.config.js` headers; `poweredByHeader: false`.
- **No injection surface:** every SQL query is parameterized (`?` placeholders);
  no `eval` / `exec` / `os.system` / `pickle`/ shell anywhere.
- **Upload safety:** magic-byte + MIME validation, 15 MB cap, early oversized-body
  rejection; files processed **in memory** (no path-traversal write surface).
- **No secret leakage:** browser never holds an LLM/provider key (all model calls
  proxy through the backend); `.env` is git-ignored and excluded from zips;
  generic error responses (no stack traces).
- **Auth:** passwords salted + PBKDF2 (100k); random url-safe tokens; Google OAuth
  ID-token verified server-side (audience check when client id set).
- **Admin metrics:** constant-time token compare; hidden (404) in production
  without a token.
- **Abuse control:** rate limiter on analyze; freemium keyed to **IP** (not a
  client-resettable session) with `TRUST_PROXY` for load balancers.

## Security — known limits (address before launch)
- **Data store:** `accounts.json` (file) + SQLite are fine for a demo/single node,
  but not encrypted at rest and not multi-node. → managed Postgres + at-rest
  encryption + backups.
- **Tokens in `localStorage`** (XSS-exposed). Mitigations: no `dangerouslySet…`
  with untrusted input, strict CSP (add in prod), consider httpOnly cookies.
- **Anonymous identity = IP** — a deterrent, not a wall (VPN/new network bypass).
  The real anti-abuse is **requiring sign-in**, which is supported.
- **CORS** defaults to `*` for dev — **set `ALLOWED_ORIGINS` to your domain** in prod.
- **Health data per-IP** on shared networks/localhost can collide — real per-user
  isolation needs accounts (Google sign-in).
- No formal audit log / 2FA / WAF yet; not HIPAA/GDPR-certified (it's
  health-education, non-diagnostic, but treat lab data as sensitive).

## Production security checklist
1. HTTPS everywhere (activates HSTS) · 2. `ALLOWED_ORIGINS` locked ·
3. strong `ADMIN_TOKEN` · 4. `TRUST_PROXY=1` behind a LB · 5. Postgres (encrypted) ·
6. add a Content-Security-Policy · 7. secrets in a vault, rotate keys ·
8. require sign-in for anything beyond the free trial.

---

## Scalability — current state
- **Frontend:** static/SSR Next.js → scales trivially (Vercel/CDN). Stateless.
- **Backend:** FastAPI is async and largely stateless per request — horizontally
  scalable **except** for the two local stores:
  - `accounts.json` — a single file with a process lock → **not multi-instance**.
  - `feelfit.db` (SQLite) — single-writer → fine to moderate load, not for many
    concurrent writers across nodes.
- **Heavy work** (OCR/PaddleOCR, Gemini, Groq) is I/O or external-API bound;
  CPU OCR is the main local cost.

## Scaling path (in order)
1. **Swap the stores** behind their existing function APIs:
   `health_store`/`analytics`/`notifications` → **Postgres**; accounts → Postgres.
   Callers don't change — this is the one real blocker to multi-node.
2. **Run N stateless backend replicas** behind a load balancer (set `TRUST_PROXY`).
3. **Offload OCR** to a worker/queue (Celery/RQ) or a managed OCR/vision API so web
   workers stay responsive; cache extraction results (already keyed by file+profile).
4. **Move reminders** to a scheduled job (`POST /api/health/reminders/run` on cron).
5. **Analytics → PostHog/Amplitude** (forward inside `analytics.track`).
6. **Add Redis** for the rate limiter + analysis cache across instances.
7. **CDN + object storage** for any stored report files (currently none persisted).

## Bottom line
- **Today:** secure enough for a demo / pilot on a single instance; the data layer
  is the scaling and at-rest-security limit.
- **To production:** the work is mostly **infra swaps** (Postgres, Redis, a worker,
  HTTPS/CORS/secret hygiene) — the application architecture is already written to
  make those swaps non-breaking.
