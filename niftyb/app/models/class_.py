from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from mongoengine import (
    Q, Document, EmbeddedDocument, StringField, ReferenceField, ListField,
    DateTimeField, EmbeddedDocumentListField, BooleanField, IntField,
)
from app.models.organization import Organization
from app.models.user import User
from app.models.content import Content
from app.constants import ClassScope, Role


class ClassContentItem(EmbeddedDocument):
    """An ordered content entry within a class, with an optional blocking flag."""
    content = ReferenceField(Content, required=True)
    blocking = BooleanField(default=False)
    # Assessment attempt limit settings (only meaningful when content.type == "assessment")
    max_attempts = IntField(min_value=1)              # null = unlimited
    attempt_interval_value = IntField(min_value=1)    # e.g. 2
    attempt_interval_unit = StringField(choices=["minutes", "hours", "days", "weeks"])


class Class(Document):
    meta = {
        "collection": "classes",
        "indexes": ["org", "teacher"],
    }

    name = StringField(required=True, max_length=200)
    grade = StringField(max_length=100)
    scope = StringField(default=ClassScope.org, choices=ClassScope.values())
    teacher = ReferenceField(User, required=True)
    org = ReferenceField(Organization, required=True)
    students = ListField(ReferenceField(User))
    content_items = EmbeddedDocumentListField(ClassContentItem)
    created_at = DateTimeField(default=lambda: datetime.now(timezone.utc))

    # ── Queries ──────────────────────────────────────────────────────────────

    @classmethod
    def get_by_id(cls, class_id: str) -> Optional[Class]:
        return cls.objects(id=class_id).first()

    @classmethod
    def list_for_user(cls, user):
        """Return all classes visible to *user* based on their role."""
        if user.role == Role.super_admin:
            return cls.objects()
        if user.role == Role.teacher:
            return cls.objects(teacher=user)
        if user.role == Role.student:
            return cls.objects(students=user)
        return cls.objects(org=user.org)

    @classmethod
    def list_available_for_student(cls, student):
        """Return org + global classes the student is not yet enrolled in."""
        enrolled_ids = cls.get_enrolled_ids(student)
        visible = cls.objects(Q(org=student.org) | Q(scope=ClassScope.global_scope))
        return [c for c in visible.order_by("-created_at").select_related()
                if str(c.id) not in enrolled_ids]

    @classmethod
    def get_enrolled_ids(cls, student) -> set[str]:
        return {str(c.id) for c in cls.objects(students=student).only("id")}

    # ── Serialisation ────────────────────────────────────────────────────────

    def to_dict(self, include_students: bool = False) -> dict:
        d = {
            "id": str(self.id),
            "name": self.name,
            "grade": self.grade,
            "teacher": str(self.teacher.id) if self.teacher else None,
            "teacher_name": self.teacher.name if self.teacher else None,
            "org": str(self.org.id) if self.org else None,
            "org_name": self.org.name if self.org else None,
            "scope": self.scope or ClassScope.org,
            "student_count": len(self.students),
            "content_count": len(self.content_items),
            "created_at": self.created_at.isoformat(),
        }
        if include_students:
            d["students"] = [str(s.id) for s in self.students]
            d["content_items"] = [
                {
                    "content_id": str(item.content.id),
                    "blocking": item.blocking,
                    "order": i,
                }
                for i, item in enumerate(self.content_items)
                if hasattr(item.content, "id")
            ]
        return d
