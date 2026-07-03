"""
FeelFit — lightweight, self-hosted product analytics.

The audit flagged it bluntly: without an events layer you are blind on retention.
This records the funnel + engagement events that actually matter for a health
subscription (report analyzed → focus set → daily check-ins → retest → proof →
paywall → purchase), so you can measure activation, retention and conversion.

Stored in the same SQLite DB; swappable to PostHog/Amplitude/Postgres later
behind track(). Identity is hashed so raw IPs/emails aren't stored in the clear.
"""
from __future__ import annotations

import hashlib
import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta
from threading import Lock

from services.health_store import _DB

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
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ts        TEXT,
                day       TEXT,
                actor     TEXT,
                event     TEXT,
                props     TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_events_evt ON events(event, day);
            CREATE INDEX IF NOT EXISTS idx_events_actor ON events(actor, day);
            """
        )


_init()


def _actor(identity: str | None) -> str:
    if not identity:
        return "anon"
    return hashlib.sha256(identity.encode()).hexdigest()[:16]


def track(identity: str | None, event: str, **props) -> None:
    """Record a product event. Never raises — analytics must not break a request."""
    try:
        now = datetime.now()
        with _lock, _conn() as cx:
            cx.execute(
                "INSERT INTO events (ts, day, actor, event, props) VALUES (?,?,?,?,?)",
                (now.isoformat(), now.strftime("%Y-%m-%d"), _actor(identity), event,
                 json.dumps(props) if props else None),
            )
    except Exception:
        pass


def metrics(days: int = 30) -> dict:
    """A compact funnel + engagement snapshot for the last N days."""
    since = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    out: dict = {"window_days": days}
    with _conn() as cx:
        # event counts
        rows = cx.execute(
            "SELECT event, COUNT(*) n, COUNT(DISTINCT actor) u FROM events WHERE day>=? GROUP BY event ORDER BY n DESC",
            (since,),
        ).fetchall()
        out["events"] = {r["event"]: {"count": r["n"], "users": r["u"]} for r in rows}
        # daily active actors
        da = cx.execute(
            "SELECT day, COUNT(DISTINCT actor) u FROM events WHERE day>=? GROUP BY day ORDER BY day",
            (since,),
        ).fetchall()
        out["daily_active"] = {r["day"]: r["u"] for r in da}
        # totals
        tot = cx.execute("SELECT COUNT(*) n, COUNT(DISTINCT actor) u FROM events WHERE day>=?", (since,)).fetchone()
        out["total_events"] = tot["n"]
        out["active_users"] = tot["u"]

    ev = out["events"]
    g = lambda k: ev.get(k, {}).get("users", 0)
    analyzed = g("report_analyzed")
    out["funnel"] = {
        "analyzed_report": analyzed,
        "got_focus": g("focus_set"),
        "checked_in": g("checkin"),
        "logged_vital": g("vital_logged"),
        "saw_proof": g("proof_improved"),
        "hit_paywall": g("paywall_shown"),
        "purchased": g("plan_purchased"),
    }
    out["activation_rate"] = round(g("checkin") / analyzed, 3) if analyzed else 0.0
    out["proof_rate"] = round(g("proof_improved") / analyzed, 3) if analyzed else 0.0
    return out
