from datetime import datetime, timezone
import mongoengine as me
from app.models.organization import Organization
from app.models.user import User
from app.models.content import Content


class Class(me.Document):
    meta = {
        "collection": "classes",
        "indexes": ["org", "teacher"],
    }

    name = me.StringField(required=True, max_length=200)
    grade = me.StringField(max_length=100)
    teacher = me.ReferenceField(User, required=True)
    org = me.ReferenceField(Organization, required=True)
    students = me.ListField(me.ReferenceField(User))
    unlocked_content = me.ListField(me.ReferenceField(Content))
    created_at = me.DateTimeField(default=lambda: datetime.now(timezone.utc))

    def to_dict(self, include_students: bool = False) -> dict:
        d = {
            "id": str(self.id),
            "name": self.name,
            "grade": self.grade,
            "teacher": str(self.teacher.id) if self.teacher else None,
            "teacher_name": self.teacher.name if self.teacher else None,
            "org": str(self.org.id) if self.org else None,
            "org_name": self.org.name if self.org else None,
            "student_count": len(self.students),
            "unlocked_content_count": len(self.unlocked_content),
            "created_at": self.created_at.isoformat(),
        }
        if include_students:
            d["students"] = [str(s.id) for s in self.students]
            d["unlocked_content"] = [str(c.id) for c in self.unlocked_content]
        return d
