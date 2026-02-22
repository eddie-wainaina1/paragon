from datetime import datetime, timezone
import mongoengine as me
from app.models.organization import Organization

ROLES = ["super_admin", "tutor", "finance", "org_admin", "teacher", "student"]


class User(me.Document):
    meta = {
        "collection": "users",
        "indexes": ["email", "org"],
    }

    name = me.StringField(required=True, max_length=200)
    email = me.EmailField(required=True, unique=True)
    password_hash = me.StringField(required=True)
    role = me.StringField(required=True, choices=ROLES)
    org = me.ReferenceField(Organization, required=True)
    avatar = me.StringField(max_length=4, default="?")  # initials
    created_at = me.DateTimeField(default=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "org": str(self.org.id) if self.org else None,
            "org_name": self.org.name if self.org else None,
            "avatar": self.avatar,
            "created_at": self.created_at.isoformat(),
        }
