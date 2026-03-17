"""Paystack payment gateway integration."""
import hashlib
import hmac
import logging
import secrets
from typing import Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

PAYSTACK_BASE = "https://api.paystack.co"


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.paystack_secret_key}",
        "Content-Type": "application/json",
    }


def _ref() -> str:
    """Generate a unique payment reference."""
    return f"nifty_{secrets.token_urlsafe(16)}"


async def initialize_transaction(
    email: str,
    amount: int,  # in smallest currency unit (KES × 100)
    callback_url: str,
    plan_code: Optional[str] = None,
    metadata: Optional[dict] = None,
    reference: Optional[str] = None,
) -> dict:
    """
    Initialize a Paystack transaction.
    Returns {'authorization_url', 'access_code', 'reference'}.
    When plan_code is provided Paystack creates a recurring subscription.
    """
    ref = reference or _ref()
    payload: dict = {
        "email": email,
        "amount": amount,
        "reference": ref,
        "callback_url": callback_url,
        "currency": "KES",
    }
    if plan_code:
        payload["plan"] = plan_code
    if metadata:
        payload["metadata"] = metadata

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{PAYSTACK_BASE}/transaction/initialize",
            json=payload,
            headers=_headers(),
        )
        resp.raise_for_status()
        data = resp.json()
        if not data.get("status"):
            raise ValueError(data.get("message", "Paystack initialization failed"))
        return data["data"]  # authorization_url, access_code, reference


async def verify_transaction(reference: str) -> dict:
    """
    Verify a transaction by reference.
    Returns the full transaction object; raises on failure.
    """
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{PAYSTACK_BASE}/transaction/verify/{reference}",
            headers=_headers(),
        )
        resp.raise_for_status()
        data = resp.json()
        if not data.get("status"):
            raise ValueError(data.get("message", "Paystack verification failed"))
        return data["data"]


async def disable_subscription(subscription_code: str, email_token: str) -> bool:
    """Cancel/disable a Paystack subscription."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{PAYSTACK_BASE}/subscription/disable",
            json={"code": subscription_code, "token": email_token},
            headers=_headers(),
        )
        data = resp.json()
        return bool(data.get("status"))


def verify_webhook_signature(payload: bytes, signature: str) -> bool:
    """Validate that a webhook request genuinely came from Paystack."""
    expected = hmac.new(
        settings.paystack_secret_key.encode(),
        payload,
        hashlib.sha512,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
