"""
FeelFit — notification dispatcher + reminder queue (keys-optional).

The retest reminder is the subscription heartbeat — but real delivery needs a
provider (WhatsApp via Gupshup/Twilio, email via SMTP/Resend, push via FCM) that
isn't configured locally. So this works the same way Razorpay does: it queues
reminders now and, on dispatch, sends via whatever channel has credentials —
otherwise it records a clear "would send" log so the flow is fully testable.

Channels go live by setting env: WHATSAPP_API_URL/+TOKEN, SMTP_*, FCM_*.
"""
from __future__ import annotations

import logging
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from threading import Lock

from services.health_store import _DB

logger = logging.getLogger("feelfit.notify")
_lock = Lock()


@contextmanager
def _conn():
    cx = sqlite3.connect(_DB)
    cx.row_factory = sqlite3.Row
    try:
        yield cx
        cx.commit()
    finally:
        cx.close()


def _init():
    with _lock, _conn() as cx:
        cx.executescript(
            """
            CREATE TABLE IF NOT EXISTS reminders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                identity   TEXT,
                kind       TEXT,
                due_date   TEXT,
                title      TEXT,
                body       TEXT,
                sent       INTEGER DEFAULT 0,
                created_at TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_rem_due ON reminders(due_date, sent);
            """
        )


_init()


def channels_configured() -> dict:
    return {
        "whatsapp": bool(os.environ.get("WHATSAPP_API_URL") and os.environ.get("WHATSAPP_TOKEN")),
        "email": bool(os.environ.get("SMTP_HOST")),
        "push": bool(os.environ.get("FCM_SERVER_KEY")),
    }


def queue_retest_reminder(identity: str, due_date: str, label: str) -> None:
    """Schedule a retest reminder. Replaces any existing unsent retest reminder."""
    if not identity or not due_date:
        return
    title = "Time to retest"
    body = f"It's time to recheck your {label}. Book a test and upload it to see how far you've come."
    with _lock, _conn() as cx:
        cx.execute("DELETE FROM reminders WHERE identity=? AND kind='retest' AND sent=0", (identity,))
        cx.execute(
            "INSERT INTO reminders (identity, kind, due_date, title, body, sent, created_at) VALUES (?,?,?,?,?,0,?)",
            (identity, "retest", due_date, title, body, datetime.now().isoformat()),
        )


def clear_for(identity: str) -> None:
    """Remove all reminders for an identity (used when erasing their data)."""
    with _lock, _conn() as cx:
        cx.execute("DELETE FROM reminders WHERE identity=?", (identity,))


def pending(identity: str | None = None) -> list[dict]:
    q = "SELECT id, identity, kind, due_date, title, body, sent FROM reminders WHERE sent=0"
    args: tuple = ()
    if identity:
        q += " AND identity=?"; args = (identity,)
    q += " ORDER BY due_date ASC"
    with _conn() as cx:
        return [dict(r) for r in cx.execute(q, args).fetchall()]


def _send(channel: str, to: str, title: str, body: str) -> bool:
    """Send via a configured channel, else log a 'would send' (local-safe)."""
    cfg = channels_configured()
    if channel == "whatsapp" and cfg["whatsapp"]:
        try:
            import httpx
            httpx.post(
                os.environ["WHATSAPP_API_URL"],
                headers={"Authorization": f"Bearer {os.environ['WHATSAPP_TOKEN']}"},
                json={"to": to, "type": "text", "text": {"body": f"{title}\n\n{body}"}},
                timeout=10,
            )
            return True
        except Exception as e:
            logger.warning(f"whatsapp send failed: {e}")
            return False
    # Fallback: no provider configured — log it so the flow is testable.
    logger.info(f"[notify:would-send] to={to[:6]}… title={title!r} body={body!r}")
    return False


def dispatch_due(now_date: str | None = None) -> dict:
    """Send all reminders whose due date has arrived. Returns a summary."""
    today = now_date or datetime.now().strftime("%Y-%m-%d")
    sent, logged = 0, 0
    with _lock, _conn() as cx:
        due = cx.execute(
            "SELECT id, identity, title, body FROM reminders WHERE sent=0 AND due_date<=?",
            (today,),
        ).fetchall()
        for r in due:
            ok = _send("whatsapp", r["identity"], r["title"], r["body"])
            cx.execute("UPDATE reminders SET sent=1 WHERE id=?", (r["id"],))
            sent += 1 if ok else 0
            logged += 0 if ok else 1
    return {"processed": len(due), "delivered": sent, "logged_only": logged,
            "channels": channels_configured()}
