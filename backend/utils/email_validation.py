"""
FeelFit — Signup email validation.

Blocks two kinds of fake signups people try when they want to "just fill fake
data": (1) known disposable/temp-mail services, and (2) made-up domains that
can't actually receive mail at all (verified via a live MX lookup).

Both checks are best-effort and fail OPEN — if the MX lookup times out or DNS
is flaky, we let the signup through rather than blocking a real user over a
network hiccup. Only a definitive "this domain is disposable" or "this domain
cannot receive mail" verdict blocks signup.
"""
from __future__ import annotations

import logging

logger = logging.getLogger("feelfit.email_validation")

# Common disposable/temp-mail domains. Not exhaustive — combined with the MX
# check below, which catches most other throwaway domains people improvise.
DISPOSABLE_DOMAINS: set[str] = {
    "mailinator.com", "mailinator.net", "mailinator2.com", "sogetthis.com",
    "10minutemail.com", "10minutemail.net", "20minutemail.com",
    "guerrillamail.com", "guerrillamail.net", "guerrillamail.org",
    "guerrillamail.biz", "guerrillamail.de", "guerrillamailblock.com", "grr.la",
    "tempmail.com", "temp-mail.org", "tempmail.net", "tempmailo.com",
    "tempmail.de", "tempinbox.com", "tempr.email", "tempemail.co", "tempemail.net",
    "throwawaymail.com", "trashmail.com", "trashmail.net", "trash-mail.com",
    "yopmail.com", "yopmail.net", "yopmail.fr", "cool.fr.nf", "jetable.fr.nf",
    "dispostable.com", "maildrop.cc", "fakeinbox.com", "fakemailgenerator.com",
    "mintemail.com", "mytemp.email", "emailondeck.com", "mohmal.com", "moakt.com",
    "getnada.com", "nada.email", "sharklasers.com", "spam4.me", "spamgourmet.com",
    "mailnesia.com", "mailcatch.com", "mailnull.com", "spambox.us", "emltmp.com",
    "discard.email", "discardmail.com", "harakirimail.com", "no-spam.ws",
    "objectmail.com", "proxymail.eu", "rcpt.at", "s0ny.net", "spamfree24.org",
    "thankyou2010.com", "trashmail.io", "wegwerfmail.de", "wegwerfmail.net",
    "wegwerfmail.org", "wh4f.org", "willselfdestruct.com", "pokemail.net",
    "correojet.com", "incognitomail.org", "mt2015.com", "1secmail.com",
    "1secmail.net", "1secmail.org", "burnermail.io", "deadaddress.com",
    "fakemail.net", "inboxkitten.com", "luxusmail.org", "mailsac.com",
    "mailtemp.info", "moburl.com", "mytrashmail.com", "no-mail.me",
    "notsharingmy.info", "shortmail.net", "spamherelots.com", "tafmail.com",
    "tempail.com", "tempmailaddress.com", "temporary-mail.net", "tmpmail.org",
    "tmpeml.com", "tmail.ws", "vomoto.com", "zetmail.com",
}


def _domain_of(email: str) -> str:
    return (email or "").rsplit("@", 1)[-1].strip().lower()


def is_disposable_domain(email: str) -> bool:
    return _domain_of(email) in DISPOSABLE_DOMAINS


def domain_can_receive_mail(domain: str, timeout: float = 2.5) -> bool:
    """
    True if the domain has MX records (or at least resolves, as some domains
    route mail via the A record with no MX). False ONLY on a definitive
    NXDOMAIN/no-answer — any other error (timeout, our own DNS being down)
    returns True so we never block a real signup over a network blip.
    """
    try:
        import dns.resolver
    except ImportError:
        return True  # dnspython not installed — skip this layer, don't block signup

    def _lookup(resolver) -> bool | None:
        """None means 'inconclusive, try the next resolver'; True/False are final."""
        try:
            resolver.resolve(domain, "MX")
            return True
        except dns.resolver.NoAnswer:
            # No MX record — some domains still accept mail via a bare A record.
            try:
                resolver.resolve(domain, "A")
                return True
            except dns.resolver.NXDOMAIN:
                return False
            except Exception:
                return None
        except dns.resolver.NXDOMAIN:
            return False  # domain doesn't exist at all — definitive
        except Exception:
            return None  # timeout / unreachable resolver — inconclusive

    # Try the system resolver first, then fall back to public DNS — some dev
    # machines (VPNs, Docker/WSL virtual adapters) have a local resolver that
    # can't actually reach the internet, which would otherwise make this check
    # a permanent no-op rather than just failing open occasionally.
    for resolver in (dns.resolver.Resolver(), _public_dns_resolver(timeout)):
        resolver.timeout = timeout
        resolver.lifetime = timeout
        result = _lookup(resolver)
        if result is not None:
            return result

    logger.warning(f"MX lookup inconclusive for {domain!r} after trying system + public DNS — failing open")
    return True


def _public_dns_resolver(timeout: float):
    import dns.resolver
    r = dns.resolver.Resolver(configure=False)
    r.nameservers = ["8.8.8.8", "1.1.1.1"]
    r.timeout = timeout
    r.lifetime = timeout
    return r


def validate_signup_email(email: str) -> str | None:
    """Returns an error message if the email should be rejected, else None."""
    domain = _domain_of(email)
    if not domain:
        return "Enter a valid email address."
    if domain in DISPOSABLE_DOMAINS:
        return "Please sign up with a permanent email address — temporary/disposable emails aren't accepted."
    if not domain_can_receive_mail(domain):
        return "That email domain doesn't look like it can receive mail — please check for typos."
    return None
