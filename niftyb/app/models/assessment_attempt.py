from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from mongoengine import (
    Document, ReferenceField, ListField, StringField, DictField,
    FloatField, DateTimeField,
)


class AssessmentAttempt(Document):
    """Records a single assessment attempt by a student in a class context."""
    meta = {
        "collection": "assessment_attempts",
        "indexes": [
            {"fields": ["student", "content", "class_"]},
            "student",
            "content",
        ],
    }

    student = ReferenceField("User", required=True)
    content = ReferenceField("Content", required=True)
    class_ = ReferenceField("Class", required=True)
    questions_shown = ListField(StringField())   # ordered list of qids
    answers = DictField()                        # {qid: chosen_index (int)}
    score = FloatField()                         # 0–100; None until submitted
    submitted_at = DateTimeField()
    created_at = DateTimeField(default=lambda: datetime.now(timezone.utc))

    # ── Queries ──────────────────────────────────────────────────────────────

    @classmethod
    def get_active(cls, student, content, class_) -> Optional[AssessmentAttempt]:
        """Return the most recent unsubmitted attempt, or None."""
        return cls.objects(
            student=student, content=content, class_=class_, submitted_at=None
        ).order_by("-created_at").first()

    @classmethod
    def get_or_create_active(cls, student, content, class_, questions_shown: list[str]) -> AssessmentAttempt:
        """Return existing unsubmitted attempt or create a new one."""
        existing = cls.get_active(student, content, class_)
        if existing:
            return existing
        attempt = cls(
            student=student,
            content=content,
            class_=class_,
            questions_shown=questions_shown,
        )
        attempt.save()
        return attempt

    @classmethod
    def count_submitted(cls, student, content, class_) -> int:
        return cls.objects(
            student=student, content=content, class_=class_, submitted_at__ne=None
        ).count()

    @classmethod
    def best_score(cls, student, content, class_) -> Optional[float]:
        attempts = list(cls.objects(
            student=student, content=content, class_=class_, submitted_at__ne=None
        ).only("score"))
        if not attempts:
            return None
        scores = [a.score for a in attempts if a.score is not None]
        return max(scores) if scores else None

    @classmethod
    def last_submitted_at(cls, student, content, class_) -> Optional[datetime]:
        attempt = cls.objects(
            student=student, content=content, class_=class_, submitted_at__ne=None
        ).order_by("-submitted_at").first()
        return attempt.submitted_at if attempt else None

    @classmethod
    def delete_for_student(cls, student, content, class_) -> None:
        cls.objects(student=student, content=content, class_=class_).delete()

    @classmethod
    def delete_by_class(cls, class_) -> None:
        cls.objects(class_=class_).delete()

    @classmethod
    def delete_by_student(cls, student) -> None:
        cls.objects(student=student).delete()
