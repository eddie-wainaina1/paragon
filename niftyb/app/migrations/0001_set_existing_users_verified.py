"""
Migration 0001: Back-fill verified=True on all existing User documents.

Safe to run on a fresh database (no users → no-op) and idempotent on
repeat runs (verified__ne=True matches False, null, and missing field).
"""
import logging

logger = logging.getLogger(__name__)


def run() -> None:
    from app.models.user import User

    updated = User.objects(verified__ne=True).update(set__verified=True)
    logger.info("Migration 0001 complete", extra={"users_updated": updated})
