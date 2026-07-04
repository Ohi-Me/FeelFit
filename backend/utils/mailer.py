"""
FeelFit — Mailer for signup OTP codes.

Two ways to send, tried in this order:
  1. Resend API — just RESEND_API_KEY + RESEND_FROM. Simplest option, no SMTP
     host/port/credentials to juggle. Get a free key at https://resend.com/api-keys.
  2. Generic SMTP — works with Gmail (app password), SendGrid/Mailgun/SES SMTP
     relay, etc. via SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM.

If neither is configured, send_otp_email() returns False so the caller can
fall back to a dev-only path (never in production — see main.py).
"""
from __future__ import annotations

import logging
import os
import re
import smtplib
from email.mime.text import MIMEText

import httpx

logger = logging.getLogger("feelfit.mailer")

_SUBJECT_TMPL = "{code} is your FeelFit verification code"
_BODY_TMPL = (
    "Your FeelFit verification code is: {code}\n\n"
    "This code expires in 10 minutes. If you didn't request this, you can ignore this email."
)

# Zero-setup sandbox sender — always a valid fallback even with no domain
# verified in Resend. Used whenever RESEND_FROM is unset OR malformed, so a
# bad/placeholder value in the environment degrades gracefully instead of
# silently failing every signup.
_RESEND_SANDBOX_FROM = "FeelFit <onboarding@resend.dev>"

# Accepts "email@domain" or "Display Name <email@domain>" — the two formats
# Resend's `from` field accepts. Deliberately permissive on the local-part;
# this is a sanity check, not full RFC 5322 validation.
_FROM_ADDR_RE = re.compile(r"^(?:[^<>@]+\s)?<?[^<>@\s]+@[^<>@\s]+\.[^<>@\s]+>?$")


def resend_configured() -> bool:
    return bool(os.environ.get("RESEND_API_KEY"))


def smtp_configured() -> bool:
    return bool(os.environ.get("SMTP_HOST") and os.environ.get("SMTP_USER") and os.environ.get("SMTP_PASSWORD"))


def mailer_configured() -> bool:
    return resend_configured() or smtp_configured()


def _resend_from_address() -> str:
    """RESEND_FROM if it's a plausible email/`"Name <email>"` value, else the
    zero-setup sandbox sender. Guards against a blank, truncated, or garbled
    env var silently breaking every signup email (RESEND_FROM being *set* at
    all — even to one stray character — stops `os.environ.get`'s default
    from ever kicking in, so this check has to happen explicitly)."""
    raw = os.environ.get("RESEND_FROM", "").strip()
    if raw and _FROM_ADDR_RE.match(raw):
        return raw
    if raw:
        logger.error(
            f"RESEND_FROM={raw!r} doesn't look like a valid sender "
            f"('email@domain' or 'Name <email@domain>') — falling back to the "
            f"Resend sandbox sender. Fix RESEND_FROM in your environment."
        )
    return _RESEND_SANDBOX_FROM


def _send_via_resend(to_email: str, code: str) -> bool:
    api_key = os.environ["RESEND_API_KEY"]
    # Resend's shared sandbox sender works with zero setup for testing; once you
    # verify your own domain in Resend, set RESEND_FROM to send as your brand.
    from_addr = _resend_from_address()
    try:
        r = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "from": from_addr,
                "to": [to_email],
                "subject": _SUBJECT_TMPL.format(code=code),
                "text": _BODY_TMPL.format(code=code),
            },
            timeout=10,
        )
        if r.status_code >= 300:
            logger.error(f"Resend API error {r.status_code} sending to {to_email!r}: {r.text[:300]}")
            return False
        return True
    except Exception as e:
        logger.error(f"Resend API request failed for {to_email!r}: {e}")
        return False


def _send_via_smtp(to_email: str, code: str) -> bool:
    host = os.environ["SMTP_HOST"]
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ["SMTP_USER"]
    password = os.environ["SMTP_PASSWORD"]
    from_addr = os.environ.get("SMTP_FROM", user)

    msg = MIMEText(_BODY_TMPL.format(code=code))
    msg["Subject"] = _SUBJECT_TMPL.format(code=code)
    msg["From"] = from_addr
    msg["To"] = to_email

    try:
        with smtplib.SMTP(host, port, timeout=10) as server:
            server.starttls()
            server.login(user, password)
            server.sendmail(from_addr, [to_email], msg.as_string())
        return True
    except Exception as e:
        logger.error(f"Failed to send OTP email to {to_email!r} via SMTP: {e}")
        return False


def send_otp_email(to_email: str, code: str) -> bool:
    if resend_configured():
        return _send_via_resend(to_email, code)
    if smtp_configured():
        return _send_via_smtp(to_email, code)
    return False
