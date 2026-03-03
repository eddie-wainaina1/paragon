from __future__ import annotations

from typing import Optional

from mongoengine import Document, ReferenceField, ListField


class StudentProgress(Document):
    """Tracks which content items a student has completed within a class."""
    meta = {
        "collection": "student_progress",
        "indexes": [("student", "class_")],
    }

    student = ReferenceField("User", required=True)
    class_ = ReferenceField("Class", required=True)
    completed_content = ListField(ReferenceField("Content"))

    # ── Helpers ──────────────────────────────────────────────────────────────

    @classmethod
    def get_or_create(cls, student, class_) -> "StudentProgress":
        obj = cls.objects(student=student, class_=class_).first()
        if not obj:
            obj = cls(student=student, class_=class_)
            obj.save()
        return obj

    def completed_ids(self) -> set[str]:
        return {str(c.id) for c in self.completed_content if hasattr(c, "id")}

    def complete(self, content) -> None:
        if not any(str(c.id) == str(content.id) for c in self.completed_content if hasattr(c, "id")):
            self.completed_content.append(content)
            self.save()

    def uncomplete(self, content) -> None:
        self.completed_content = [
            c for c in self.completed_content
            if hasattr(c, "id") and str(c.id) != str(content.id)
        ]
        self.save()

    @classmethod
    def delete_by_class(cls, class_) -> None:
        cls.objects(class_=class_).delete()

    @classmethod
    def delete_by_student(cls, student) -> None:
        cls.objects(student=student).delete()

    @classmethod
    def delete_by_student_in_class(cls, student, class_) -> None:
        cls.objects(student=student, class_=class_).delete()

    @classmethod
    def get_all_for_class(cls, class_) -> list["StudentProgress"]:
        return list(cls.objects(class_=class_).select_related())
