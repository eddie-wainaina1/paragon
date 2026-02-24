"""MongoEngine document that tracks applied migrations."""
from datetime import datetime, timezone
from mongoengine import Document, StringField, DateTimeField


class Migration(Document):
    meta = {
        "collection": "migrations",
        "indexes": [{"fields": ["name"], "unique": True}],
    }

    name = StringField(required=True, unique=True, max_length=200)
    applied_at = DateTimeField(default=lambda: datetime.now(timezone.utc))
