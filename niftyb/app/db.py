"""MongoDB connection via MongoEngine + GridFS bucket."""
import logging
from gridfs import GridIn
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
