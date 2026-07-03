"""
FeelFit v7 — Production FastAPI Backend
Full pipeline + Medicine + Profile Dashboard + CSV support
"""
import asyncio, csv, io, json, logging, os, re, sys, time, uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, List

# Load .env BEFORE importing project modules — several services read env vars
# (e.g. GOOGLE_MAPS_API_KEY) at import time, so this must run first.
from dotenv import load_dotenv
load_dotenv()

import httpx
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).parent))

from schemas.analysis import AnalyzeResponse, UserProfile, AbnormalTest, RiskLevel, TestStatus, ExtractedTest, AnalysisOutput
from extraction.extractor import extract_text, clean_extracted_text
from extraction.nlp import extract_structured_tests, compute_trends, parse_report_rows, _specialty_for, MEDICAL_KB
from llm.pipeline import run_llm_pipeline, summarize_from_tests
from services.medicine_service import get_medicine_info, check_drug_interactions
from services.osm_places_service import find_doctors_for_location
from services.google_places_service import find_doctors_google, enabled as gplaces_enabled
from services.medicine_live_service import get_live_medicine_info, check_live_interactions
from services.profile_service import profile_store, ProfileData, ReportSummary
from services import account_service as accounts
from services import health_store
from services import otp_store
from services.focus_engine import pick_focus, retest_status, daily_action
from services.program_engine import build_program, compute_progress
from services import analytics
from services import notifications
from utils.cache import analysis_cache, rate_limiter, validate_file_magic, assess_extraction_quality
from utils.email_validation import domain_can_receive_mail, is_disposable_domain
from utils.mailer import send_otp_email

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(name)s | %(message)s")
logger = logging.getLogger("feelfit")

if not os.environ.get("GROQ_API_KEY"):
    logger.error("CRITICAL: GROQ_API_KEY environment variable is missing!")
    logger.error("Please add GROQ_API_KEY to your .env file or environment.")
    sys.exit(1)
app = FastAPI(
    title="FeelFit v7 API", version="9.0.0",
    description="AI Medical Intelligence — Lab Analysis + Medicine + Profile Dashboard",
    docs_url="/api/docs", redoc_url="/api/redoc",
)
# CORS: in production set ALLOWED_ORIGINS to your frontend URL(s), comma-separated,
# e.g. ALLOWED_ORIGINS="https://feelfit.vercel.app,https://www.feelfit.app".
# Defaults to "*" for local development.
_origins_env = os.environ.get("ALLOWED_ORIGINS", "*").strip()
_allowed_origins = ["*"] if _origins_env in ("", "*") else [o.strip() for o in _origins_env.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=_allowed_origins != ["*"],  # "*" + credentials is invalid per the CORS spec
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_MIME = {"application/pdf","image/jpeg","image/jpg","image/png","image/tiff","image/webp","text/csv","application/vnd.ms-excel","text/plain"}
MAX_SIZE = 15 * 1024 * 1024


def _client_ip(request: Request) -> str:
    """Real client IP. Honours X-Forwarded-For ONLY when behind a trusted proxy
    (set TRUST_PROXY=1 in production where a load balancer sets the header)."""
    if os.environ.get("TRUST_PROXY", "").lower() in ("1", "true", "yes"):
        xff = request.headers.get("x-forwarded-for", "")
        if xff:
            return xff.split(",")[0].strip()
    return request.client.host if request.client else "anon"


def _get_uid(request: Request) -> str:
    """Identity for profile/report continuity: the signed-in account (email/phone)
    when logged in, so a user's profile and report history follow their account
    across devices and browsers — else the browser session header, else IP."""
    email = accounts.email_for_token(request.headers.get("x-auth-token"))
    return email or request.headers.get("X-Session-Id") or _client_ip(request)


@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    t0 = time.time()
    # Reject oversized bodies early (defence-in-depth alongside per-route checks).
    cl = request.headers.get("content-length")
    if cl and cl.isdigit() and int(cl) > MAX_SIZE:
        return JSONResponse(status_code=413, content={"error": "File too large — max 15 MB."})
    response = await call_next(request)
    response.headers["X-Process-Time-Ms"] = str(int((time.time() - t0) * 1000))
    # ── Security headers (defence-in-depth) ──────────────────────────────────────
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(self), microphone=(), camera=()"
    response.headers["Cross-Origin-Resource-Policy"] = "same-site"
    response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
    # HSTS only meaningful over HTTPS (production).
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# ── Health ─────────────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {"service":"FeelFit v7","status":"healthy","version":"9.0.0","loinc_tests":len(MEDICAL_KB),"timestamp":datetime.now().isoformat()}

@app.get("/api/health")
async def health():
    return {"status":"healthy","version":"9.0.0","loinc_coverage":len(MEDICAL_KB),"cache_entries":analysis_cache.size,
            "features":["lab_analysis","medicine_info","drug_interactions","doctor_finder","health_profile","trend_tracking","csv_upload"]}

@app.get("/api/stats")
async def stats():
    return {"loinc_tests":len(MEDICAL_KB),"cache_entries":analysis_cache.size,"version":"9.0.0"}


# ── CSV Parser Helper ──────────────────────────────────────────────────────────
def parse_csv_report(csv_bytes: bytes) -> str:
    """Convert CSV lab report to text format for NLP extraction."""
    try:
        text = csv_bytes.decode("utf-8", errors="replace")
        reader = csv.reader(io.StringIO(text))
        lines = []
        for row in reader:
            if row:
                lines.append("\t".join(str(c).strip() for c in row))
        return "\n".join(lines)
    except Exception as e:
        logger.warning(f"CSV parse error: {e}")
        return csv_bytes.decode("utf-8", errors="replace")


# ── Accounts, usage & billing (freemium) ───────────────────────────────────────

def _identity(request: Request) -> tuple[str, Optional[str]]:
    """Return (identity, email) for the freemium gate + health graph.
    Identity = logged-in email, else the client IP (NOT the client-supplied
    session header) — so the free limit can't be reset by clearing cache or
    switching browsers. Truly robust anti-abuse still requires sign-in."""
    email = accounts.email_for_token(request.headers.get("x-auth-token"))
    if email:
        return email, email
    return "ip:" + _client_ip(request), None


def _seed_profile(uid: str, **fields) -> None:
    """Seed/refresh profile fields learned at sign-in (name, email, phone) without
    clobbering anything the user already filled in — upsert_profile only applies
    the non-None fields given here on top of an existing profile."""
    non_none = {k: v for k, v in fields.items() if v}
    if not non_none:
        return
    try:
        profile_store.upsert_profile(uid, ProfileData(**non_none))
    except Exception as e:
        logger.warning(f"Profile seed failed for {uid[:8]}: {e}")


class AuthRequest(BaseModel):
    email: str
    password: str


class SignupRequest(AuthRequest):
    code: str  # 6-digit code from /api/auth/signup/send-otp — proves inbox ownership
    # Collected once, at signup, so FeelFit's diagnosis summaries and AskFit
    # answers can be personalised from the very first report — not required,
    # but strongly encouraged in the UI.
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None


class SendOtpRequest(BaseModel):
    email: str


@app.post("/api/auth/signup/send-otp")
async def auth_signup_send_otp(req: SendOtpRequest):
    """Step 1 of email signup: validate the address, then email it a 6-digit
    code. Requiring this closes the "type any random address" gap that a
    disposable-domain blocklist alone can't catch — you have to actually
    receive the code."""
    email = (req.email or "").lower().strip()
    if "@" not in email:
        raise HTTPException(400, "Enter a valid email address.")
    if accounts.email_taken(email):
        raise HTTPException(400, "An account with this email already exists — please log in.")
    if is_disposable_domain(email):
        raise HTTPException(400, "Please sign up with a permanent email address — temporary/disposable emails aren't accepted.")
    domain = email.rsplit("@", 1)[-1]
    reachable = await asyncio.to_thread(domain_can_receive_mail, domain)
    if not reachable:
        raise HTTPException(400, "That email domain doesn't look like it can receive mail — please check for typos.")

    code, err = otp_store.issue(email)
    if err:
        raise HTTPException(429, err)
    sent = await asyncio.to_thread(send_otp_email, email, code)
    if not sent:
        if os.environ.get("ENVIRONMENT", "development").lower() == "production":
            raise HTTPException(503, "Could not send the verification email — please try again shortly.")
        # Dev fallback only — no SMTP configured locally, so hand the code back
        # instead of silently failing. Never happens in production (checked above).
        logger.warning(f"SMTP not configured — dev OTP for {email}: {code}")
        return {"ok": True, "dev_code": code}
    return {"ok": True}


@app.post("/api/auth/signup")
async def auth_signup(req: SignupRequest, request: Request):
    email = (req.email or "").lower().strip()
    # Check password strength BEFORE consuming the one-time OTP — otherwise a
    # weak password burns the code and forces the user to request a whole new
    # one just to fix a typo.
    pw_err = accounts.password_error(req.password)
    if pw_err:
        raise HTTPException(400, pw_err)
    otp_err = otp_store.verify(email, req.code)
    if otp_err:
        raise HTTPException(400, otp_err)
    token, err = accounts.signup(req.email, req.password)
    if err:
        raise HTTPException(400, err)
    _seed_profile(email, email=email, name=req.name, age=req.age, gender=req.gender)
    return {"token": token, "email": email, "status": accounts.status(email, email), "is_new_account": True}


@app.post("/api/auth/login")
async def auth_login(req: AuthRequest, request: Request):
    token, err = accounts.login(req.email, req.password)
    if err:
        raise HTTPException(401, err)
    email = req.email.lower().strip()
    _seed_profile(email, email=email)
    return {"token": token, "email": email, "status": accounts.status(email, email), "is_new_account": False}


class GoogleAuthRequest(BaseModel):
    credential: str


@app.post("/api/auth/google")
async def auth_google(req: GoogleAuthRequest):
    """Verify a Google ID token (from Google Identity Services) and sign the user in."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get("https://oauth2.googleapis.com/tokeninfo", params={"id_token": req.credential})
    except Exception:
        raise HTTPException(503, "Could not reach Google to verify sign-in.")
    if r.status_code != 200:
        raise HTTPException(401, "Google sign-in failed — please try again.")
    info = r.json()
    client_id = os.environ.get("GOOGLE_OAUTH_CLIENT_ID")
    if client_id and info.get("aud") != client_id:
        raise HTTPException(401, "Sign-in token was not issued for this app.")
    email = (info.get("email") or "").lower().strip()
    verified = str(info.get("email_verified", "")).lower() in ("true", "1")
    if not email or not verified:
        raise HTTPException(401, "Could not verify your Google email.")
    token, is_new = accounts.oauth_login(email, name=info.get("name"))
    _seed_profile(email, name=info.get("name"), email=email)
    return {"token": token, "email": email, "status": accounts.status(email, email), "is_new_account": is_new}


class PhoneAuthRequest(BaseModel):
    id_token: str


@app.post("/api/auth/phone")
async def auth_phone(req: PhoneAuthRequest):
    """Verify a Firebase phone-auth ID token (OTP already confirmed client-side)
    and sign the user in. No SMS provider keys needed on our end — Firebase
    handles OTP delivery; we only verify the resulting ID token's signature."""
    project_id = os.environ.get("FIREBASE_PROJECT_ID")
    if not project_id:
        raise HTTPException(503, "Phone sign-in isn't configured yet.")
    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token as google_id_token
        claims = await asyncio.to_thread(
            google_id_token.verify_firebase_token, req.id_token, google_requests.Request(), project_id,
        )
    except Exception:
        raise HTTPException(401, "Phone sign-in failed — please try again.")
    phone = (claims.get("phone_number") or "").strip()
    if not phone:
        raise HTTPException(401, "Could not verify your phone number.")
    token, is_new = accounts.oauth_login(phone)
    _seed_profile(phone, phone=phone)
    return {"token": token, "email": phone, "status": accounts.status(phone, phone), "is_new_account": is_new}


@app.get("/api/usage")
async def usage(request: Request):
    identity, email = _identity(request)
    return accounts.status(identity, email)


class CheckoutRequest(BaseModel):
    plan: Optional[str] = "day"


@app.post("/api/billing/checkout")
async def billing_checkout(request: Request, req: Optional[CheckoutRequest] = None):
    """Create an order for the selected plan. Test mode unless Razorpay keys are set."""
    identity, email = _identity(request)
    if not email:
        raise HTTPException(401, "Please log in before purchasing a plan.")
    plan = accounts.plan(req.plan if req else "day")
    key_id = os.environ.get("RAZORPAY_KEY_ID")
    key_secret = os.environ.get("RAZORPAY_KEY_SECRET")
    amount_paise = plan["price"] * 100
    if key_id and key_secret:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                r = await client.post(
                    "https://api.razorpay.com/v1/orders",
                    auth=(key_id, key_secret),
                    json={"amount": amount_paise, "currency": "INR", "notes": {"identity": identity, "plan": plan["id"]}},
                )
            if r.status_code in (200, 201):
                o = r.json()
                return {"mode": "razorpay", "order_id": o["id"], "amount": amount_paise,
                        "currency": "INR", "key_id": key_id, "plan": plan["id"], "plan_label": plan["label"]}
            logger.warning(f"Razorpay order error {r.status_code}: {r.text[:160]}")
        except Exception as e:
            logger.warning(f"Razorpay checkout failed: {e}")
    # Test mode — no real charge
    return {"mode": "test", "order_id": f"test_{uuid.uuid4().hex[:12]}", "amount": amount_paise,
            "currency": "INR", "plan": plan["id"], "plan_label": plan["label"],
            "note": "Test mode — no real payment. Configure RAZORPAY_KEY_ID/SECRET for live."}


class PaymentConfirm(BaseModel):
    order_id: str
    plan: Optional[str] = "day"
    razorpay_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None


@app.post("/api/billing/confirm")
async def billing_confirm(req: PaymentConfirm, request: Request):
    """Grant an unlimited pass for the chosen plan after payment. Verifies signature in live mode."""
    identity, email = _identity(request)
    if not email:
        raise HTTPException(401, "Please log in to activate your pass.")
    plan = accounts.plan(req.plan)
    key_secret = os.environ.get("RAZORPAY_KEY_SECRET")
    # A real Razorpay order_id always starts with "order_" (assigned by Razorpay's
    # API in billing_checkout above); our own test-mode fallback uses "test_".
    # If a real order was created, a verified signature is MANDATORY — without
    # this check, anyone could call this endpoint directly with a fabricated
    # order_id and get a free unlimited pass, bypassing payment entirely.
    is_real_order = req.order_id.startswith("order_")
    if key_secret and is_real_order:
        if not (req.razorpay_payment_id and req.razorpay_signature):
            raise HTTPException(400, "Payment verification required — missing payment confirmation.")
        import hmac, hashlib as _h
        expected = hmac.new(key_secret.encode(),
                            f"{req.order_id}|{req.razorpay_payment_id}".encode(), _h.sha256).hexdigest()
        if expected != req.razorpay_signature:
            raise HTTPException(400, "Payment verification failed.")
    # Test mode (or verified live payment): grant the pass for the plan's duration
    accounts.grant_pass(identity, seconds=plan["seconds"])
    analytics.track(identity, "plan_purchased", plan=plan["id"], price=plan["price"])
    logger.info(f"{plan['label']} pass granted to {identity}")
    return {"ok": True, "status": accounts.status(identity, email)}


_BLOCKED = ["diagnosed with", "you have", "prescribe", "disease confirmed",
            "i diagnose", "you are suffering", "treatment is"]


_MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}


def _extract_report_date(text: str) -> Optional[str]:
    """
    Best-effort: pull the collection/report date PRINTED on the report (not the
    analysis time). Returns an ISO date string (YYYY-MM-DD) or None.
    Prefers a date that appears near a 'collected/reported/sample' label.
    """
    if not text:
        return None
    t = text[:4000]
    # Numeric dd/mm/yyyy or dd-mm-yyyy (also yyyy-mm-dd)
    num = r"(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})"
    iso = r"(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})"
    # dd Mon yyyy / Mon dd, yyyy
    txt = r"(\d{1,2})\s*[-\s]\s*([A-Za-z]{3,9})\s*[-,\s]\s*(\d{2,4})"
    label = r"(?:collect|report|sample|drawn|received|registered|date)[^\n:]{0,18}[:\-]?\s*"

    def norm_year(y: str) -> int:
        yi = int(y)
        return yi + 2000 if yi < 100 else yi

    # 1) date sitting right after a relevant label (most reliable)
    for pat, kind in ((iso, "iso"), (num, "num"), (txt, "txt")):
        m = re.search(label + pat, t, re.IGNORECASE)
        if not m:
            continue
        try:
            if kind == "iso":
                y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
            elif kind == "num":
                d, mo, y = int(m.group(1)), int(m.group(2)), norm_year(m.group(3))
            else:
                d = int(m.group(1)); mo = _MONTHS.get(m.group(2)[:3].lower(), 0); y = norm_year(m.group(3))
            if mo and 1 <= mo <= 12 and 1 <= d <= 31 and 1990 <= y <= 2100:
                return f"{y:04d}-{mo:02d}-{d:02d}"
        except Exception:
            pass
    # 2) any 'dd Mon yyyy' anywhere (unambiguous month name)
    m = re.search(txt, t)
    if m:
        try:
            d = int(m.group(1)); mo = _MONTHS.get(m.group(2)[:3].lower(), 0); y = norm_year(m.group(3))
            if mo and 1 <= d <= 31 and 1990 <= y <= 2100:
                return f"{y:04d}-{mo:02d}-{d:02d}"
        except Exception:
            pass
    return None


def _safe_text(s: str, fallback: str) -> str:
    s = (s or "").strip()
    low = s.lower()
    if any(p in low for p in _BLOCKED):
        return fallback
    return s or fallback


# Extra defense-in-depth for the new diet/exercise/habit tips: besides the
# diagnostic-language blocklist, drop any bullet that smells like a medicine
# dosage instruction (e.g. "500mg twice daily") — the prompt already forbids
# this, but a list gets silently filtered here rather than trusted blindly.
_DOSAGE_PATTERN = re.compile(r"\b\d+\s*(mg|mcg|ml|iu)\b|\btablet\b|\bcapsule\b|\bdose\b|\bdosage\b", re.IGNORECASE)


def _safe_list(items: Optional[list], limit: int = 5) -> list[str]:
    out = []
    for item in (items or []):
        text = str(item or "").strip()
        if not text:
            continue
        low = text.lower()
        if any(p in low for p in _BLOCKED) or _DOSAGE_PATTERN.search(text):
            continue
        out.append(text)
    return out[:limit]


def _assemble_analysis(tests, narration: dict, trends) -> AnalysisOutput:
    """Build the AnalysisOutput deterministically from an extracted test list + narration."""
    out_of_range = [t for t in tests if t.status in (TestStatus.LOW, TestStatus.HIGH, TestStatus.CRITICAL)]
    abnormal = []
    for t in out_of_range:
        rng = f"{t.normal_min}–{t.normal_max} {t.unit}".strip() if (t.normal_min is not None or t.normal_max is not None) else None
        abnormal.append(AbnormalTest(
            loinc_code=t.loinc_code, test_name=t.test_name, value=t.value, unit=t.unit,
            normal_range=rng, status=t.status,
            clinical_note=f"{t.test_name} is outside the typical reference range — worth discussing with your doctor.",
            specialty=t.specialty or _specialty_for(t.test_name),
        ))

    if any(t.status == TestStatus.CRITICAL for t in out_of_range) or len(out_of_range) >= 6:
        risk = RiskLevel.HIGH
    elif len(out_of_range) >= 1:
        risk = RiskLevel.MODERATE
    else:
        risk = RiskLevel.LOW

    key_findings = [f"{t.status.value.title()} {t.test_name} ({t.value} {t.unit})" for t in out_of_range[:8]] \
        or ["All values within the typical reference range"]

    specs: list = []
    for ab in abnormal:
        if ab.specialty and ab.specialty not in specs:
            specs.append(ab.specialty)
    req_spec = narration.get("required_specialization") or (", ".join(specs[:2]) if specs else "General Physician")

    summary = _safe_text(
        narration.get("summary"),
        "Several values fall outside the typical reference range. These may warrant attention; "
        "please consult your doctor for proper interpretation.",
    )[:1000]
    recs = [r for r in (narration.get("recommendations") or []) if r] or ["Discuss these results with a qualified doctor."]
    life = [l for l in (narration.get("lifestyle_suggestions") or []) if l] or ["Maintain a balanced diet, regular activity, and adequate sleep."]
    diet = _safe_list(narration.get("diet_tips")) or ["Eat a balanced diet rich in fruits, vegetables, and whole grains."]
    exercise = _safe_list(narration.get("exercise_tips")) or ["Aim for at least 150 minutes of moderate activity per week."]
    habits = _safe_list(narration.get("habit_tips")) or ["Prioritise 7-8 hours of sleep and stay well hydrated."]
    urgency = narration.get("urgency") or ("soon" if out_of_range else "routine")

    return AnalysisOutput(
        report_type=narration.get("report_type") or "Comprehensive Health Check",
        summary=summary, risk_level=risk, confidence=0.92,
        key_findings=key_findings, abnormal_tests=abnormal, all_tests=tests,
        recommendations=recs, lifestyle_suggestions=life,
        diet_tips=diet, exercise_tips=exercise, habit_tips=habits,
        follow_up=narration.get("follow_up") or "Schedule a follow-up with your doctor to review these results.",
        required_specialization=req_spec, urgency=urgency, trends=trends or None,
    )


# ── Analyze Report ─────────────────────────────────────────────────────────────
@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze_report(
    request: Request,
    file: UploadFile = File(...),
    age: Optional[int] = Form(None),
    gender: Optional[str] = Form(None),
    known_conditions: Optional[str] = Form(None),
    current_medications: Optional[str] = Form(None),
    historical_tests: Optional[str] = Form(None),
    skip_cache: Optional[bool] = Form(False),
    save_to_profile: Optional[bool] = Form(True),
):
    job_id = str(uuid.uuid4())[:8]
    t0 = time.time()
    uid = _get_uid(request)
    logger.info(f"[{job_id}] START uid={uid[:8]} file={file.filename}")

    # Rate limit
    allowed, _ = rate_limiter.is_allowed(uid)
    if not allowed:
        raise HTTPException(429, "Too many requests. Please wait 60 seconds.")

    # Freemium gate: free users get a few checks (via the free parser), then must
    # log in + buy a ₹9/day pass. Paid users get unlimited checks + Gemini accuracy.
    identity, identity_email = _identity(request)
    paid_user = accounts.is_paid(identity)
    if not paid_user and accounts.usage_count(identity) >= accounts.FREE_LIMIT:
        analytics.track(identity, "paywall_shown")
        raise HTTPException(402, "You've used your free report checks. "
                                 f"Upgrade to a ₹{accounts.PRICE_INR}/day pass for unlimited checks.")

    # Detect if CSV
    filename = (file.filename or "").lower()
    content_type = file.content_type or ""
    is_csv = filename.endswith(".csv") or "csv" in content_type

    if not is_csv and content_type not in ALLOWED_MIME:
        if filename.endswith(".pdf"):    content_type = "application/pdf"
        elif filename.endswith((".jpg",".jpeg")): content_type = "image/jpeg"
        elif filename.endswith(".png"):  content_type = "image/png"
        else: raise HTTPException(400, f"Unsupported file type: {file.content_type}")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_SIZE: raise HTTPException(413, "File too large (max 15MB)")
    if len(file_bytes) < 5:        raise HTTPException(400, "File appears empty")

    if not is_csv:
        detected = validate_file_magic(file_bytes)
        if detected is None:
            logger.warning(f"[{job_id}] Magic byte mismatch for {file.filename}")

    hist_tests = None
    if historical_tests:
        try: hist_tests = json.loads(historical_tests)
        except: pass

    # Auto-load historical tests from profile
    if hist_tests is None:
        profile_reports = profile_store.get_reports(uid)
        if profile_reports and profile_reports[0].test_values:
            hist_tests = profile_reports[0].test_values

    profile = UserProfile(
        age=age, gender=gender,
        known_conditions=[c.strip() for c in (known_conditions or "").split(",") if c.strip()],
        current_medications=[m.strip() for m in (current_medications or "").split(",") if m.strip()],
        historical_tests=hist_tests,
    )

    # Cache check
    cache_key = analysis_cache.make_key(file_bytes, profile.model_dump(exclude={"historical_tests"}))
    if not skip_cache:
        cached = analysis_cache.get(cache_key)
        if cached:
            logger.info(f"[{job_id}] Cache HIT")
            cached["job_id"] = job_id
            cached["processing_time_ms"] = int((time.time() - t0) * 1000)
            cached["cache_hit"] = True
            return AnalyzeResponse(**cached)

    # Extract text. OCR (Tesseract/PaddleOCR) is CPU-bound and synchronous, so it
    # always runs in a worker thread (never blocks the event loop for other
    # requests).
    #
    # Gemini vision is the top-priority extraction engine for EVERY tier — it
    # reads dense/photographed tables far more reliably than OCR. We always try
    # it first (free and paid alike) and only fall back to the deterministic
    # parser/OCR-based extraction when Gemini itself fails (its own quota/rate
    # limit, a transient error, etc.) — never based on the user's paid status.
    # It's kicked off in parallel with OCR so the fallback path costs nothing
    # extra on top of OCR time when Gemini succeeds.
    from llm.pipeline import gemini_extract_tests
    gemini_task = None
    if is_csv:
        text = parse_csv_report(file_bytes)
        content_type = "text/csv"
    else:
        gemini_eligible = bool(file_bytes and os.environ.get("GEMINI_API_KEY"))
        if gemini_eligible:
            gemini_task = asyncio.create_task(gemini_extract_tests(file_bytes, content_type))
        raw_text = await asyncio.to_thread(extract_text, file_bytes, content_type)
        text = clean_extracted_text(raw_text)

    quality = assess_extraction_quality(text)
    logger.info(f"[{job_id}] Extracted {len(text)} chars | quality={quality['quality']}")

    # Date printed on the report (for the timeline) — falls back to None.
    report_date = _extract_report_date(text)

    # Previous report context (most recent prior report) for a timeline-aware verdict.
    prev_meta = None
    try:
        _prev = profile_store.get_reports(uid)
        if _prev:
            p0 = _prev[0]
            prev_meta = {
                "date": getattr(p0, "report_date", None) or (p0.timestamp[:10] if p0.timestamp else None),
                "report_type": p0.report_type,
                "risk_level": p0.risk_level,
                "abnormal_count": p0.abnormal_count,
                "key_findings": list(p0.key_findings or [])[:4],
            }
    except Exception as e:
        logger.warning(f"[{job_id}] prev report meta error: {e}")

    tests = extract_structured_tests(text, gender=gender, age=age) if text else []

    # Deterministic row parser (reads exact values + the lab's printed H/L flags).
    # For images/PDFs this is far more reliable than the LLM on dense tables, so
    # when it finds a solid set of rows we make it the primary extraction.
    parser_tests = []
    if not is_csv and text:
        parser_tests = parse_report_rows(text)
        logger.info(f"[{job_id}] Deterministic parser found {len(parser_tests)} rows (nlp found {len(tests)})")
        if len(parser_tests) >= max(6, len(tests)):
            tests = parser_tests

    # Gemini vision extraction — top-priority engine, started above alongside OCR.
    # `gemini_attempted` tracks whether we tried at all (key configured, not CSV)
    # so the response can tell the user when we quietly fell back to the
    # standard model, regardless of their paid status.
    gemini_tests = []
    gemini_attempted = gemini_task is not None
    if gemini_task is not None:
        raw_g = await gemini_task
        if raw_g:
            try:
                gemini_tests = [ExtractedTest(**t) for t in raw_g]
            except Exception as e:
                logger.warning(f"[{job_id}] Gemini test parse error: {e}")
            if len(gemini_tests) >= 6:
                tests = gemini_tests
        logger.info(f"[{job_id}] Gemini extracted {len(gemini_tests)} tests (paid={paid_user})")

    # Pick the deterministic authoritative test list (Gemini preferred, then parser,
    # then the NLP extractor for clean CSV exports). This lets CSV uploads — a very
    # common lab-export format — skip the slow single-shot LLM extraction+narration
    # call entirely and use the fast "narration only" path below, since the NLP
    # parser is regex/rule-based (not an LLM) and reads a clean CSV table reliably.
    det_tests = (
        gemini_tests if len(gemini_tests) >= 6
        else parser_tests if len(parser_tests) >= 6
        else tests if (is_csv and len(tests) >= 6)
        else None
    )

    # ── Hard guard: NEVER fabricate values from an empty extraction ──────────────
    # The LLM-fabricator path used to invent ~5 plausible-looking tests when the
    # photo couldn't be read. For a medical app that's the worst possible failure
    # mode (worse than no result). Bail out early with a clear, friendly retry
    # message instead. Only triggered when extraction TRULY found nothing.
    if det_tests is None and len(tests) < 2 and not is_csv:
        logger.warning(f"[{job_id}] Extraction failed: ocr_chars={len(text or '')} "
                       f"parser={len(parser_tests)} gemini={len(gemini_tests)}")
        ms = int((time.time() - t0) * 1000)
        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "job_id": job_id,
                "error": "couldnt_read_report",
                "message": (
                    "We couldn’t read this report clearly, even with our AI vision model. "
                    "For the best results, try a sharp, well-lit photo of the whole page (not at an angle), or upload the original PDF."
                ),
                "extraction_quality": quality.get("quality"),
                "extraction_warning": quality.get("warning"),
                "processing_time_ms": ms,
                "usage": accounts.status(identity, identity_email),
            },
        )

    if det_tests is not None:
        # Reliable path: extraction is already done (Gemini/parser). The LLM only
        # writes the short narrative — fast, and no giant-JSON failures.
        tests = det_tests
        loinc_matched = sum(1 for t in tests if t.loinc_code)
        trends = compute_trends(tests, hist_tests) if hist_tests else None
        narration = await summarize_from_tests(tests, profile, trends=trends, prev_meta=prev_meta, report_date=report_date)
        analysis = _assemble_analysis(tests, narration, trends)
        fallback_used = False
    else:
        loinc_matched = sum(1 for t in tests if t.loinc_code)
        trends = compute_trends(tests, hist_tests) if hist_tests else None
        analysis, fallback_used = await run_llm_pipeline(
            text=text, tests=tests, profile=profile, trends=trends,
            file_bytes=file_bytes if not is_csv else None,
            mime_type=content_type if not is_csv else None,
        )
        # If the LLM read a full list, make it authoritative and rebuild the abnormal set.
        if analysis and analysis.all_tests:
            tests = analysis.all_tests
            loinc_matched = sum(1 for t in tests if t.loinc_code)
            trends = compute_trends(tests, hist_tests) if hist_tests else None
            analysis = _assemble_analysis(
                tests,
                {
                    "report_type": analysis.report_type,
                    "summary": analysis.summary,
                    "recommendations": analysis.recommendations,
                    "lifestyle_suggestions": analysis.lifestyle_suggestions,
                    "diet_tips": analysis.diet_tips,
                    "exercise_tips": analysis.exercise_tips,
                    "habit_tips": analysis.habit_tips,
                    "follow_up": analysis.follow_up,
                    "required_specialization": analysis.required_specialization,
                    "urgency": analysis.urgency.value if hasattr(analysis.urgency, "value") else analysis.urgency,
                },
                trends,
            )

    ms = int((time.time() - t0) * 1000)
    logger.info(f"[{job_id}] DONE {ms}ms risk={analysis.risk_level} conf={analysis.confidence:.2f}")

    # ── Longitudinal health graph + "Move One Number" focus ───────────────────────
    # Persist every recognised biomarker as a dated point, then pick the one focus
    # to improve this cycle + a retest date. Works for anonymous users too (per IP).
    focus = None
    health_timeline = None
    progress = None
    try:
        health_store.record_readings(identity, tests or [], report_date, job_id)
        latest = health_store.latest_readings(identity)
        # Preserve the existing focus's start_date so progress/proof is measured from
        # the FIRST report, not reset on every upload.
        prev_focus = health_store.get_focus(identity)
        focus = pick_focus(latest)
        if focus and prev_focus and prev_focus.get("canonical") == focus.get("canonical"):
            focus["start_date"] = prev_focus.get("start_date", focus["start_date"])
        if focus:
            health_store.set_focus(identity, focus)
            progress = compute_progress(identity, focus)
            analytics.track(identity, "focus_set", canonical=focus.get("canonical"))
            notifications.queue_retest_reminder(identity, focus.get("retest_date"), focus.get("label"))
            if progress and progress.get("proof") and progress["proof"].get("improved"):
                analytics.track(identity, "proof_improved", canonical=focus.get("canonical"),
                                delta=progress["proof"].get("delta"))
        health_timeline = health_store.timeline(identity)
    except Exception as e:
        logger.warning(f"[{job_id}] health graph update failed: {e}")

    analytics.track(identity, "report_analyzed", tests=len(tests or []),
                    risk=getattr(analysis.risk_level, "value", str(analysis.risk_level)),
                    paid=paid_user, engine=("gemini" if len(gemini_tests) >= 6 else "parser"))

    # Count this check against the free tier (paid users are unlimited)
    if not paid_user:
        accounts.incr_usage(identity)

    # Gemini is now tried first for every tier — when it was attempted but didn't
    # produce a usable result (its own quota/rate-limit, a transient error, etc.),
    # tell the user plainly that we fell back to the standard model instead of
    # silently serving a lower-accuracy read. Free users get an upgrade nudge;
    # paid users get an honest heads-up without the upsell.
    downgraded = gemini_attempted and len(gemini_tests) < 6
    downgrade_message = None
    if downgraded:
        downgrade_message = (
            "We used our standard extraction model for this report — our premium AI "
            "vision model was temporarily unavailable. Your results are still accurate; "
            "try again shortly for premium-quality extraction."
        ) if paid_user else (
            "We used our standard extraction model for this report — our premium AI "
            "vision model has hit its usage limit for now. Upgrade to a paid plan for "
            "priority access to premium AI accuracy on every report."
        )

    response_data = {
        "success": True, "job_id": job_id, "analysis": analysis,
        "extracted_tests": tests or None,
        "raw_text_preview": text[:500] if text else None,
        "processing_time_ms": ms, "loinc_matched": loinc_matched,
        "total_tests_found": len(tests), "fallback_used": fallback_used,
        "extraction_quality": quality.get("quality"),
        "extraction_warning": quality.get("warning"),
        "file_type": "csv" if is_csv else "document",
        "engine": ("gemini" if len(gemini_tests) >= 6
                   else "parser" if len(parser_tests) >= 6
                   else "csv_parser" if (is_csv and det_tests is not None)
                   else "llm"),
        "usage": accounts.status(identity, identity_email),
        "focus": focus,
        "report_date": report_date,
        "health_timeline": health_timeline,
        "progress": progress,
        "downgraded": downgraded,
        "downgrade_message": downgrade_message,
    }

    if not fallback_used:
        analysis_cache.set(cache_key, {**response_data, "analysis": analysis.model_dump()})

    # Auto-save to profile
    if save_to_profile and analysis:
        try:
            report_summary = ReportSummary(
                job_id=job_id,
                report_type=analysis.report_type,
                risk_level=analysis.risk_level.value,
                confidence=analysis.confidence,
                timestamp=datetime.now().isoformat(),
                report_date=report_date,
                summary_preview=(analysis.summary or "")[:100] + "...",
                key_findings=list(analysis.key_findings or [])[:5],
                abnormal_count=len(analysis.abnormal_tests or []),
                total_tests=len(tests),
                loinc_matched=loinc_matched,
                test_values=[t.model_dump() for t in tests] if tests else None,
            )
            profile_store.add_report(uid, report_summary)
        except Exception as e:
            logger.warning(f"[{job_id}] Profile save error: {e}")

    return AnalyzeResponse(**response_data)


# ── Health graph & Focus ("Move One Number") ───────────────────────────────────

@app.get("/api/health/graph")
async def health_graph(request: Request):
    """The user's longitudinal biomarker graph: latest snapshot + per-test series + dated timeline."""
    identity, _ = _identity(request)
    return health_store.graph(identity)


@app.get("/api/health/focus")
async def health_focus(request: Request):
    """The current 'one number to move' focus + retest date (recomputed live from the graph)."""
    identity, _ = _identity(request)
    latest = health_store.latest_readings(identity)
    focus = pick_focus(latest) or health_store.get_focus(identity)
    return {"focus": focus, "biomarker_count": len(latest), "timeline": health_store.timeline(identity)}


@app.delete("/api/health/data")
async def erase_health_data(request: Request):
    """Permanently erase this identity's biomarker graph, focus, check-ins & reminders."""
    identity, _ = _identity(request)
    n = health_store.erase_identity(identity)
    try:
        notifications.clear_for(identity)
    except Exception:
        pass
    analytics.track(identity, "data_erased")
    return {"ok": True, "deleted_readings": n}


@app.get("/api/health/program")
async def health_program(request: Request):
    """The 90-day 'Move One Number' program + live progress + outcome proof."""
    identity, _ = _identity(request)
    latest = health_store.latest_readings(identity)
    focus = pick_focus(latest) or health_store.get_focus(identity)
    return {
        "focus": focus,
        "program": build_program(focus),
        "progress": compute_progress(identity, focus),
        "retest": retest_status(focus.get("retest_date") if focus else None),
    }


@app.get("/api/health/today")
async def health_today(request: Request):
    """The daily companion card: focus + one action for today + retest countdown + streak."""
    identity, _ = _identity(request)
    latest = health_store.latest_readings(identity)
    focus = pick_focus(latest) or health_store.get_focus(identity)
    return {
        "focus": focus,
        "action": daily_action(focus),
        "retest": retest_status(focus.get("retest_date") if focus else None),
        "streak": health_store.get_streak(identity),
        "checked_in_today": health_store.checked_in_today(identity),
        "biomarker_count": len(latest),
    }


class VitalRequest(BaseModel):
    type: str           # bp_systolic | bp_diastolic | weight | glucose_home
    value: float
    unit: Optional[str] = None


@app.post("/api/health/vitals")
async def log_vital(req: VitalRequest, request: Request):
    """Log a self-measured vital (BP / weight / home glucose) into the health graph."""
    identity, _ = _identity(request)
    try:
        rec = health_store.record_vital(identity, req.type, req.value, req.unit)
    except ValueError as e:
        raise HTTPException(400, str(e))
    analytics.track(identity, "vital_logged", type=req.type)
    return {"ok": True, "reading": rec, "series": health_store.get_series(identity, rec["canonical"])}


class WearableRequest(BaseModel):
    steps: Optional[float] = None
    sleep_hours: Optional[float] = None
    resting_hr: Optional[float] = None
    hrv: Optional[float] = None


@app.post("/api/health/wearable")
async def log_wearable(req: WearableRequest, request: Request):
    """Ingest continuous-signal data (steps / sleep / resting HR / HRV) into the graph.
    Scaffolding for Google Fit / Apple Health / Ultrahuman device sync."""
    identity, _ = _identity(request)
    saved = []
    for field in ("steps", "sleep_hours", "resting_hr", "hrv"):
        val = getattr(req, field)
        if val is not None:
            try:
                saved.append(health_store.record_vital(identity, field, val))
            except ValueError:
                pass
    if saved:
        analytics.track(identity, "wearable_synced", signals=[s["canonical"] for s in saved])
    return {"ok": True, "saved": saved}


@app.get("/api/health/reminders")
async def health_reminders(request: Request):
    """Pending reminders for this user + which delivery channels are configured."""
    identity, _ = _identity(request)
    return {"pending": notifications.pending(identity), "channels": notifications.channels_configured()}


@app.post("/api/health/reminders/run")
async def run_reminders():
    """Dispatch any due reminders (local-safe: logs when no provider keys are set).
    In production this is driven by a scheduled job / cron."""
    return notifications.dispatch_due()


@app.get("/api/admin/metrics")
async def admin_metrics(request: Request, days: int = 30):
    """Product funnel + engagement snapshot. Guard with ADMIN_TOKEN in production."""
    import secrets as _sec
    token = os.environ.get("ADMIN_TOKEN")
    # Require a token in any non-development environment; compare in constant time.
    if not token:
        if os.environ.get("ENVIRONMENT", "development").lower() == "production":
            raise HTTPException(404, "not found")  # don't reveal the endpoint in prod without a token
    elif not _sec.compare_digest(request.headers.get("x-admin-token", ""), token):
        raise HTTPException(401, "admin token required")
    return analytics.metrics(max(1, min(days, 365)))


class CheckinRequest(BaseModel):
    action: Optional[str] = None


@app.post("/api/health/checkin")
async def health_checkin(req: CheckinRequest, request: Request):
    """Mark today's action done → builds the daily streak (the return habit)."""
    identity, _ = _identity(request)
    streak = health_store.add_checkin(identity, req.action)
    analytics.track(identity, "checkin", streak=streak)
    return {"ok": True, "streak": streak, "checked_in_today": True}


# ── Medicine Endpoints ─────────────────────────────────────────────────────────

class MedicineRequest(BaseModel):
    medicine_name: str
    user_conditions: Optional[List[str]] = None

class InteractionRequest(BaseModel):
    medicines: List[str]

@app.post("/api/medicine/info")
async def medicine_info(req: MedicineRequest, request: Request):
    """Get educational information about a medicine — now with live OpenFDA + RxNorm data."""
    if not req.medicine_name or len(req.medicine_name.strip()) < 2:
        raise HTTPException(400, "Please provide a valid medicine name")
    logger.info(f"Medicine info: {req.medicine_name}")

    # Try live APIs first
    live_result = await get_live_medicine_info(req.medicine_name, req.user_conditions)

    # If live APIs returned useful data (confidence ≥ 0.5), enrich with LLM for missing fields.
    # Price is never in OpenFDA/RxNorm (US data sources), so it always needs the LLM (Groq,
    # with Gemini as a second opinion — see get_medicine_info) to fill an India price estimate.
    if live_result.get("confidence", 0) >= 0.5:
        needs_llm = not live_result.get("how_it_works") or not live_result.get("commonly_used_for") or not live_result.get("typical_price_inr")
        if needs_llm:
            llm_result = await get_medicine_info(req.medicine_name, req.user_conditions)
            # Merge: prefer live data but fill gaps from LLM
            for field in ["how_it_works", "commonly_used_for", "typical_dosage_info", "typical_price_inr"]:
                if not live_result.get(field) and llm_result.get(field):
                    live_result[field] = llm_result[field]
        live_result["data_source"] = "live_apis + ai"
        return live_result

    # Fall back to LLM-only. Nothing came back from RxNorm/OpenFDA, so this is a
    # genuinely unfamiliar name (new/obscure supplement, India-only brand, etc)
    # — prefer_grounded=True so the LLM checks real search results before
    # answering instead of risking a confident but wrong guess.
    llm_result = await get_medicine_info(req.medicine_name, req.user_conditions, prefer_grounded=True)
    llm_result["data_source"] = "ai_only"
    llm_result["spelling_suggestions"] = live_result.get("spelling_suggestions", [])
    return llm_result

@app.post("/api/medicine/interactions")
async def medicine_interactions(req: InteractionRequest, request: Request):
    """Check drug interactions using RxNorm + AI fallback."""
    if len(req.medicines) < 2:
        raise HTTPException(400, "Provide at least 2 medicines to check interactions")
    if len(req.medicines) > 8:
        raise HTTPException(400, "Maximum 8 medicines per check")
    logger.info(f"Interaction check: {req.medicines}")
    # Try RxNorm live interactions first
    live = await check_live_interactions(req.medicines)
    if live.get("interactions"):
        return live
    # Fall back to LLM if RxNorm returned nothing
    result = await check_drug_interactions(req.medicines)
    return result

@app.get("/api/medicine/common")
async def common_medicines():
    """Return common medicine categories for quick access."""
    return {
        "categories": [
            {"name":"Antidiabetic","examples":["Metformin","Glimepiride","Insulin","Sitagliptin"]},
            {"name":"Antihypertensive","examples":["Amlodipine","Losartan","Atenolol","Ramipril"]},
            {"name":"Thyroid","examples":["Levothyroxine","Carbimazole","Methimazole"]},
            {"name":"Cardiovascular","examples":["Atorvastatin","Rosuvastatin","Aspirin","Clopidogrel"]},
            {"name":"Antibiotics","examples":["Amoxicillin","Azithromycin","Ciprofloxacin","Doxycycline"]},
            {"name":"Pain & Inflammation","examples":["Paracetamol","Ibuprofen","Diclofenac","Naproxen"]},
            {"name":"Supplements","examples":["Vitamin D3","Vitamin B12","Iron","Calcium","Folate"]},
            {"name":"Gastric","examples":["Omeprazole","Pantoprazole","Ondansetron","Domperidone"]},
        ]
    }


# ── Doctor Finder 2.0 — OpenStreetMap powered ──────────────────────────────────

class DoctorSearchRequest(BaseModel):
    location: str                          # any city/area/PIN/landmark in India
    specialization: Optional[str] = ""
    user_lat: Optional[float] = None
    user_lng: Optional[float] = None
    radius_km: Optional[int] = 5
    max_results: Optional[int] = 20


@app.post("/api/doctors/search")
async def search_doctors_osm(req: DoctorSearchRequest, request: Request):
    """
    Doctor discovery with a paid-tier upgrade:
      • Free users → free OpenStreetMap (Nominatim + Overpass).
      • Paid users → Google Places (real ratings, reviews, open-now) when a key
        is set; falls back to OSM if Google fails so results never break.
    Same response shape either way.
    """
    if not req.location or len(req.location.strip()) < 2:
        raise HTTPException(400, "Please provide a valid location (city, area, PIN, or landmark)")

    identity, _ = _identity(request)
    paid = accounts.is_paid(identity)
    use_google = paid and gplaces_enabled()

    logger.info(f"Doctor Search: location={req.location!r} spec={req.specialization!r} "
                f"paid={paid} google={use_google}")

    # Paid users with a configured key → Google first; on any miss/error → OSM.
    result = None
    if use_google:
        result = await find_doctors_google(
            location=req.location.strip(),
            specialization=req.specialization or "",
            user_lat=req.user_lat,
            user_lng=req.user_lng,
            radius_km=req.radius_km or 5,
            max_results=req.max_results or 20,
        )

    if not result:
        result = await find_doctors_for_location(
            location=req.location.strip(),
            specialization=req.specialization or "",
            user_lat=req.user_lat,
            user_lng=req.user_lng,
            radius_km=req.radius_km or 5,
            max_results=req.max_results or 20,
        )

    # Surface the tier so the UI can show a "Premium" badge — based on whether real
    # Google data was actually returned, not just paid status. Without this, a paid
    # user whose search silently fell back to OSM (missing key, quota, API error)
    # would see a "Premium" badge on data that isn't actually premium.
    if isinstance(result, dict):
        result["tier"] = "premium" if result.get("source") == "google" else "free"
    return result


@app.get("/api/doctors/suggest")
async def suggest_locations(q: str = ""):
    """
    Simple location suggestions for the search box.
    Returns common Indian cities/areas that match the query.
    """
    COMMON_LOCATIONS = [
        "Mumbai", "Delhi", "Bangalore", "Chennai", "Hyderabad", "Kolkata",
        "Pune", "Ahmedabad", "Jaipur", "Lucknow", "Kanpur", "Nagpur",
        "Patna", "Bhopal", "Indore", "Bhubaneswar", "Ranchi", "Chandigarh",
        "Noida", "Gurgaon", "Faridabad", "Ghaziabad", "Agra", "Varanasi",
        "Allahabad", "Prayagraj", "Coimbatore", "Madurai", "Surat", "Vadodara",
        "Rajkot", "Ludhiana", "Amritsar", "Jammu", "Dehradun", "Kochi",
        "Thiruvananthapuram", "Visakhapatnam", "Vijayawada", "Mangalore",
        "Mysore", "Hubli", "Belgaum", "Jodhpur", "Udaipur", "Kota",
    ]
    q_lower = q.lower().strip()
    if not q_lower:
        return {"suggestions": COMMON_LOCATIONS[:10]}
    matches = [loc for loc in COMMON_LOCATIONS if q_lower in loc.lower()][:8]
    return {"suggestions": matches}


# ── Profile & Dashboard ────────────────────────────────────────────────────────

@app.get("/api/profile")
async def get_profile(request: Request):
    uid = _get_uid(request)
    profile = profile_store.get_profile(uid)
    return {"profile": profile.model_dump() if profile else None, "uid_prefix": uid[:8]}

@app.post("/api/profile")
async def save_profile(data: ProfileData, request: Request):
    uid = _get_uid(request)
    saved = profile_store.upsert_profile(uid, data)
    return {"success": True, "profile": saved.model_dump()}

@app.get("/api/profile/reports")
async def get_report_history(request: Request):
    uid = _get_uid(request)
    reports = profile_store.get_reports(uid)
    return {"reports": [r.model_dump() for r in reports], "count": len(reports)}

@app.delete("/api/profile/reports")
async def clear_report_history(request: Request):
    uid = _get_uid(request)
    profile_store.clear_reports(uid)
    return {"success": True}

@app.get("/api/profile/health-score")
async def get_health_score(request: Request):
    uid = _get_uid(request)
    score = profile_store.compute_health_score(uid)
    return score.model_dump()

@app.get("/api/profile/trends")
async def get_trends(request: Request, test_name: Optional[str] = None):
    uid = _get_uid(request)
    trends = profile_store.get_test_trends(uid, test_name)
    return {"trends": [t.model_dump() for t in trends], "count": len(trends)}

@app.get("/api/profile/dashboard")
async def get_dashboard(request: Request):
    """Full dashboard data in one call."""
    uid = _get_uid(request)
    profile   = profile_store.get_profile(uid)
    reports   = profile_store.get_reports(uid)
    score     = profile_store.compute_health_score(uid)
    trends    = profile_store.get_test_trends(uid)
    return {
        "profile":  profile.model_dump() if profile else None,
        "reports":  [r.model_dump() for r in reports[:5]],
        "score":    score.model_dump(),
        "trends":   [t.model_dump() for t in trends[:6]],
        "report_count": len(reports),
    }


# ── Medical RAG 2.0 — retrieval / Research Copilot ──────────────────────────────

class RagQueryRequest(BaseModel):
    query: str
    top_k: Optional[int] = 4
    age: Optional[int] = None
    gender: Optional[str] = None
    conditions: Optional[List[str]] = None
    medications: Optional[List[str]] = None
    history: Optional[List[dict]] = None  # prior chat turns: [{role, text}]
    attachment: Optional[str] = None      # extracted text of a doc the user attached


def _personal_health_context(identity: str) -> list[str]:
    """AskFit memory: the user's own recent abnormal biomarkers + current focus,
    expressed as short context strings so answers are grounded in THEIR data."""
    bits: list[str] = []
    try:
        latest = health_store.latest_readings(identity)
        for key, r in latest.items():
            if (r.get("status") or "").lower() in ("low", "high", "critical"):
                bits.append(f"{health_store.label_for(key)} {r.get('value')} {r.get('unit') or ''} ({r.get('status')})".strip())
        focus = health_store.get_focus(identity)
        if focus:
            bits.append(f"current health focus: {focus.get('label')} — {focus.get('target')}")
    except Exception:
        pass
    return bits[:10]


@app.post("/api/askfit/attach")
async def askfit_attach(request: Request, file: UploadFile = File(...)):
    """
    Read a document the user attaches in AskFit (lab report, prescription, doctor's
    note — PDF / image / CSV) and return its transcribed text, so they can then ask
    questions about it. Multimodal, like Claude/GPT/Gemini.
    """
    filename = (file.filename or "document").lower()
    file_bytes = await file.read()
    if len(file_bytes) > MAX_SIZE:
        raise HTTPException(413, "File too large — max 15 MB.")
    if not file_bytes:
        raise HTTPException(400, "Empty file.")

    ctype = file.content_type or "application/octet-stream"
    is_csv = filename.endswith(".csv")
    if is_csv:
        text = parse_csv_report(file_bytes)
    else:
        try:
            text = clean_extracted_text(extract_text(file_bytes, ctype)) or ""
        except Exception:
            text = ""
        # If basic OCR is thin (angled photo, scan), read it with Gemini vision.
        if len(text.strip()) < 80 and os.environ.get("GEMINI_API_KEY"):
            from llm.pipeline import gemini_read_text
            g = await gemini_read_text(file_bytes, ctype)
            if g:
                text = g

    if len(text.strip()) < 20:
        raise HTTPException(422, "Couldn’t read this document. Try a clearer photo or a PDF.")

    return {"ok": True, "filename": file.filename, "chars": len(text), "text": text[:6000]}


@app.post("/api/rag/retrieve")
async def rag_retrieve(req: RagQueryRequest, request: Request):
    """
    Retrieve grounded medical evidence (LOINC / disease / specialist / graph /
    research layers) with confidence + citations. Foundation for AskFit — the LLM
    reasons over this evidence AND the user's own recent results, never from memory.
    """
    if not req.query or len(req.query.strip()) < 2:
        raise HTTPException(400, "Please provide a query of at least 2 characters")
    try:
        from rag import get_rag
    except Exception as e:
        raise HTTPException(503, f"RAG engine unavailable: {e}")

    # Fold the user's own recent labs + focus into the context (AskFit memory).
    identity, _ = _identity(request)
    personal = _personal_health_context(identity)
    conditions = list(req.conditions or [])
    if personal:
        conditions = conditions + personal

    bundle = await get_rag().aretrieve(
        req.query.strip(),
        top_k=req.top_k or 4,
        age=req.age,
        gender=req.gender,
        conditions=conditions or None,
        medications=req.medications,
    )
    payload = bundle.to_dict()
    payload["personalized"] = bool(personal)

    # Generate a grounded natural-language answer over the retrieved evidence.
    # Non-fatal: if the LLM is unavailable, the evidence bundle is still returned.
    try:
        from llm.pipeline import generate_rag_answer
        if bundle.all_docs():
            payload["answer"] = await generate_rag_answer(
                req.query.strip(),
                bundle.to_prompt_block(),
                age=req.age,
                gender=req.gender,
                conditions=conditions or None,
                medications=req.medications,
                history=req.history,
                attachment=req.attachment,
            )
        else:
            payload["answer"] = None
    except Exception as e:
        logger.warning(f"RAG answer generation failed (returning evidence only): {e}")
        payload["answer"] = None

    return payload


# ── LOINC lookup ───────────────────────────────────────────────────────────────
@app.get("/api/loinc/{loinc_code}")
async def get_loinc(loinc_code: str):
    entry = MEDICAL_KB.get(loinc_code)
    if not entry:
        raise HTTPException(404, f"LOINC '{loinc_code}' not in KB")
    return entry


# ── Error handlers ─────────────────────────────────────────────────────────────
@app.exception_handler(HTTPException)
async def http_err(request, exc):
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail, "timestamp": datetime.now().isoformat()})

@app.exception_handler(Exception)
async def generic_err(request, exc):
    logger.error(f"Unhandled: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"error": "Internal server error", "timestamp": datetime.now().isoformat()})


if __name__ == "__main__":
    import uvicorn
    # Honour the host-provided $PORT (Render/Railway/Fly set this). Enable
    # auto-reload only outside production.
    port = int(os.environ.get("PORT", "8000"))
    reload = os.environ.get("ENVIRONMENT", "development").lower() != "production"
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=reload)
