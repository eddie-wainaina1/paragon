from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from mongoengine import (
    Q, Document, EmbeddedDocument, StringField, ReferenceField, ObjectIdField,
    IntField, BooleanField, DateTimeField, DictField, FloatField,
    EmbeddedDocumentListField, ListField,
)
from app.models.organization import Organization
from app.models.user import User
from app.constants import ContentType, ContentScope, ContentEmoji, Role


class AssessmentQuestion(EmbeddedDocument):
    """A single question in an assessment content item."""
    qid = StringField(default=lambda: str(uuid.uuid4()), required=True)
    question = StringField(required=True, max_length=1000)
    choices = ListField(StringField(max_length=500))  # 2–6 items
    answer = IntField(required=True)                  # 0-based index into choices


class Content(Document):
    meta = {
        "collection": "content",
        "indexes": ["org", "author", "scope", "type"],
    }

    title = StringField(required=True, max_length=300)
    type = StringField(required=True, choices=ContentType.values())
    scope = StringField(required=True, choices=ContentScope.values(), default=ContentScope.org)
    org = ReferenceField(Organization, required=True)
    author = ReferenceField(User, required=True)
    subject = StringField(max_length=200)
    body = StringField()  # text content or URL
    file_id = ObjectIdField()  # GridFS reference for uploaded files
    file_name = StringField()
    file_content_type = StringField()
    hls_ready = BooleanField(default=False)
    hls_files = DictField(default=dict)  # {"master.m3u8": "<oid>", "720p_000.ts": "<oid>", ...}
    views = IntField(default=0, min_value=0)
    locked = BooleanField(default=False)
    emoji = StringField(max_length=10)
    # Assessment-specific fields
    questions = EmbeddedDocumentListField(AssessmentQuestion)
    max_questions = IntField(min_value=1)      # max questions drawn per attempt
    passing_score = FloatField(min_value=0, max_value=100, default=70)
    created_at = DateTimeField(default=lambda: datetime.now(timezone.utc))
    updated_at = DateTimeField(default=lambda: datetime.now(timezone.utc))

    # ── Queries ──────────────────────────────────────────────────────────────

    @classmethod
    def get_by_id(cls, content_id: str) -> Optional[Content]:
        return cls.objects(id=content_id).first()

    @classmethod
    def list_visible_to(cls, user):
        """Return a queryset of content visible to *user* based on role and org."""
        if user.role == Role.super_admin:
            return cls.objects()
        return cls.objects(Q(scope=ContentScope.global_scope) | Q(org=user.org))

    @classmethod
    def increment_views(cls, content_id: str) -> None:
        cls.objects(id=content_id).update_one(inc__views=1)

    @classmethod
    def delete_by_org(cls, org) -> None:
        cls.objects(org=org).delete()

    # ── Serialisation ────────────────────────────────────────────────────────

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
            "hls_ready": self.hls_ready,
            "file_id": str(self.file_id) if self.file_id else None,
            "file_name": self.file_name,
            "file_content_type": self.file_content_type,
            "views": self.views,
            "locked": self.locked,
            "emoji": self.emoji
            or ContentEmoji.to_dict().get(self.type, ContentEmoji.text),
            "questions_count": len(self.questions) if self.questions else 0,
            "max_questions": self.max_questions,
            "passing_score": self.passing_score,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
