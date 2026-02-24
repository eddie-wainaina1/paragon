"""
Migration runner.

Discovers migration modules matching NNNN_*.py in this package directory,
checks the migrations collection for already-applied ones, and runs new
migrations in ascending filename order.
"""
import importlib
import logging
import re
from pathlib import Path

from mongoengine.errors import NotUniqueError

logger = logging.getLogger(__name__)

_MIGRATION_PATTERN = re.compile(r"^\d{4}_.*\.py$")


def run_migrations() -> None:
    """
    Called from main.py lifespan after connect_db().

    Each migration module must expose a run() function with no arguments.
    A migration is recorded in the DB only after run() returns successfully.
    Failures abort startup — a partially-applied migration leaves the DB in an
    unknown state, which is worse than refusing to start.
    """
    from app.migrations.models import Migration

    migrations_dir = Path(__file__).parent
    candidates = sorted(
        f for f in migrations_dir.iterdir()
        if f.is_file() and _MIGRATION_PATTERN.match(f.name)
    )

    if not candidates:
        logger.info("No migration files found")
        return

    applied = {m.name for m in Migration.objects()}

    for path in candidates:
        name = path.stem  # e.g. "0001_set_existing_users_verified"
        if name in applied:
            logger.debug("Migration already applied, skipping", extra={"migration": name})
            continue

        logger.info("Running migration", extra={"migration": name})
        try:
            module = importlib.import_module(f"app.migrations.{name}")
            module.run()
            try:
                Migration(name=name).save()
            except NotUniqueError:
                # Another instance recorded it first during a concurrent restart — safe to ignore
                logger.info(
                    "Migration already recorded by another instance",
                    extra={"migration": name},
                )
            logger.info("Migration applied", extra={"migration": name})
        except Exception as exc:
            logger.error(
                "Migration failed — aborting startup",
                extra={"migration": name, "error": str(exc)},
                exc_info=True,
            )
            raise
