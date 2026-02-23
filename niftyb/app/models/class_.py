from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from mongoengine import Q, Document, StringField, ReferenceField, ListField, DateTimeField
from app.models.organization import Organization
from app.models.user import User
from app.models.content import Content
from app.constants import ClassScope, Role


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
    unlocked_content = ListField(ReferenceField(Content))
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
            "unlocked_content_count": len(self.unlocked_content),
            "created_at": self.created_at.isoformat(),
        }
        if include_students:
            d["students"] = [str(s.id) for s in self.students]
            d["unlocked_content"] = [str(c.id) for c in self.unlocked_content]
        return d
