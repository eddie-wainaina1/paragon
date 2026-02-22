from datetime import datetime, timezone
import mongoengine as me


class Organization(me.Document):
    meta = {
        "collection": "organizations",
        "indexes": ["slug"],
    }

    name = me.StringField(required=True, max_length=200)
    slug = me.StringField(required=True, unique=True, max_length=200)
    type = me.StringField(required=True, choices=["platform", "school"], default="school")
    created_at = me.DateTimeField(default=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "name": self.name,
            "slug": self.slug,
            "type": self.type,
            "created_at": self.created_at.isoformat(),
        }
