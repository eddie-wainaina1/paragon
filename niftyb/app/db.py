"""MongoDB connection via MongoEngine + GridFS helpers."""
import logging
from pymongo import MongoClient
from pymongo.database import Database
import gridfs
import mongoengine

from app.config import settings

logger = logging.getLogger(__name__)

_mongo_client: MongoClient | None = None
_db: Database | None = None
_fs: gridfs.GridFS | None = None


def connect_db() -> None:
    global _mongo_client, _db, _fs

    # MongoEngine connection (used by ODM models)
    mongoengine.connect(host=settings.mongodb_uri)

    # Raw PyMongo client for GridFS
    _mongo_client = MongoClient(settings.mongodb_uri)
    db_name = settings.mongodb_uri.rsplit("/", 1)[-1].split("?")[0]
    _db = _mongo_client[db_name]
    _fs = gridfs.GridFS(_db)

    logger.info("MongoDB connected", extra={"uri": settings.mongodb_uri})


def disconnect_db() -> None:
    mongoengine.disconnect()
    if _mongo_client:
        _mongo_client.close()
    logger.info("MongoDB disconnected")


def get_gridfs() -> gridfs.GridFS:
    if _fs is None:
        raise RuntimeError("GridFS not initialised — call connect_db() first")
    return _fs


def get_raw_db() -> Database:
    if _db is None:
        raise RuntimeError("DB not initialised — call connect_db() first")
    return _db


# ── GridFS helpers (used by routers instead of accessing fs directly) ─────────


def gridfs_put(file_data: bytes, filename: str, content_type: str):
    """Write *file_data* to GridFS and return the new ObjectId."""
    return get_gridfs().put(file_data, filename=filename, content_type=content_type)


def gridfs_get(file_id) -> gridfs.GridOut:
    """Return the GridOut object for *file_id*."""
    return get_gridfs().get(file_id)


def gridfs_delete(file_id) -> None:
    """Delete the GridFS file identified by *file_id*, silently ignoring missing files."""
    try:
        get_gridfs().delete(file_id)
    except Exception:
        pass
