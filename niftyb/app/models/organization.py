from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from mongoengine import Document, StringField, BooleanField, DateTimeField
from app.constants import OrgType


class Organization(Document):
    meta = {
        "collection": "organizations",
        "indexes": ["slug"],
    }

    name = StringField(required=True, max_length=200)
    slug = StringField(required=True, unique=True, max_length=200)
    type = StringField(required=True, choices=OrgType.values(), default=OrgType.school)
    internal = BooleanField(default=False)
    created_at = DateTimeField(default=lambda: datetime.now(timezone.utc))

    # ── Queries ──────────────────────────────────────────────────────────────

    @classmethod
    def get_by_id(cls, org_id: str) -> Optional[Organization]:
        return cls.objects(id=org_id).first()

    @classmethod
    def slug_exists(cls, slug: str) -> bool:
        return cls.objects(slug=slug).first() is not None

    @classmethod
    def list_all(cls):
        return cls.objects()

    # ── Serialisation ────────────────────────────────────────────────────────

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "name": self.name,
            "slug": self.slug,
            "type": self.type,
            "internal": self.internal,
            "created_at": self.created_at.isoformat(),
        }
