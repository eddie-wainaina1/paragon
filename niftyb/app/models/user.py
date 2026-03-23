from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from mongoengine import Document, StringField, EmailField, ReferenceField, DateTimeField, BooleanField
from app.models.organization import Organization
from app.constants import Role


class User(Document):
    meta = {
        "collection": "users",
        "indexes": ["email", "org"],
    }

    name = StringField(required=True, max_length=200)
    email = EmailField(required=True, unique=True)
    password_hash = StringField(required=True)
    role = StringField(required=True, choices=Role.values())
    org = ReferenceField(Organization, required=True)
    avatar = StringField(max_length=4, default="?")  # initials
    created_at = DateTimeField(default=lambda: datetime.now(timezone.utc))
    verified = BooleanField(default=False)
    terms_accepted_at = DateTimeField(default=None)
    phone = StringField(max_length=30, default=None)
    tutor_application_pending = BooleanField(default=False)
    must_change_password = BooleanField(default=False)

    # ── Queries ──────────────────────────────────────────────────────────────

    @classmethod
    def get_by_id(cls, user_id: str) -> Optional[User]:
        return cls.objects(id=user_id).first()

    @classmethod
    def get_by_email(cls, email: str) -> Optional[User]:
        return cls.objects(email=email).first()

    @classmethod
    def email_exists(cls, email: str, exclude_id: str | None = None) -> bool:
        """True if a user with *email* already exists (optionally ignoring *exclude_id*)."""
        qs = cls.objects(email=email)
        if exclude_id:
            qs = qs.filter(id__ne=exclude_id)
        return qs.first() is not None

    @classmethod
    def list_all(cls):
        return cls.objects()

    @classmethod
    def list_by_org(cls, org):
        return cls.objects(org=org)

    @classmethod
    def delete_by_org(cls, org) -> None:
        cls.objects(org=org).delete()

    # ── Serialisation ────────────────────────────────────────────────────────

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
            "verified": bool(self.verified),
            "terms_accepted_at": self.terms_accepted_at.isoformat() if self.terms_accepted_at else None,
            "phone": self.phone or None,
            "tutor_application_pending": bool(self.tutor_application_pending),
            "must_change_password": bool(self.must_change_password),
        }
