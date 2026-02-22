from datetime import datetime, timezone
from bson import ObjectId
import mongoengine as me
from app.models.organization import Organization
from app.models.user import User

CONTENT_TYPES = ["text", "video", "audio"]
CONTENT_SCOPES = ["global", "org"]
EMOJI_MAP = {"text": "📄", "video": "🎬", "audio": "🎧"}


class Content(me.Document):
    meta = {
        "collection": "content",
        "indexes": ["org", "author", "scope", "type"],
    }

    title = me.StringField(required=True, max_length=300)
    type = me.StringField(required=True, choices=CONTENT_TYPES)
    scope = me.StringField(required=True, choices=CONTENT_SCOPES, default="org")
    org = me.ReferenceField(Organization, required=True)
    author = me.ReferenceField(User, required=True)
    subject = me.StringField(max_length=200)
    body = me.StringField()  # text content or URL
    file_id = me.ObjectIdField()  # GridFS reference for uploaded files
    file_name = me.StringField()
    file_content_type = me.StringField()
    views = me.IntField(default=0, min_value=0)
    locked = me.BooleanField(default=False)
    emoji = me.StringField(max_length=10)
    created_at = me.DateTimeField(default=lambda: datetime.now(timezone.utc))
    updated_at = me.DateTimeField(default=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "title": self.title,
            "type": self.type,
            "scope": self.scope,
            "org": str(self.org.id) if self.org else None,
            "org_name": self.org.name if self.org else None,
            "author": str(self.author.id) if self.author else None,
            "author_name": self.author.name if self.author else None,
            "subject": self.subject,
            "body": self.body,
            "file_id": str(self.file_id) if self.file_id else None,
            "file_name": self.file_name,
            "file_content_type": self.file_content_type,
            "views": self.views,
            "locked": self.locked,
            "emoji": self.emoji or EMOJI_MAP.get(self.type, "📄"),
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
