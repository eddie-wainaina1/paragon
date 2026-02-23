"""Single source of truth for domain constants used across models, schemas, and routers."""

from typing import Any


class Constant:
    """Base class for constant groups with utility methods for pattern generation and introspection."""

    @classmethod
    def values(cls) -> list[str]:
        """Return all constant values from non-private, non-method class attributes."""
        return [
            getattr(cls, attr)
            for attr in dir(cls)
            if not attr.startswith("_") and not callable(getattr(cls, attr))
        ]

    @classmethod
    def to_dict(cls) -> dict[str, Any]:
        """Return a mapping of attribute names to their values."""
        return {
            attr: getattr(cls, attr)
            for attr in dir(cls)
            if not attr.startswith("_") and not callable(getattr(cls, attr))
        }

    @classmethod
    def pattern(cls, values: list[str] | None = None) -> str:
        """Generate a regex pattern for Pydantic validation from values."""
        vals = values or cls.values()
        return f"^({'|'.join(vals)})$"


class Role(Constant):
    super_admin = "super_admin"
    tutor = "tutor"
    finance = "finance"
    org_admin = "org_admin"
    teacher = "teacher"
    student = "student"

    # Roles restricted to internal organizations only
    internal = ["super_admin", "tutor", "finance"]

    # Roles that may create content
    creator = ["super_admin", "tutor", "org_admin", "teacher"]

    # Admin roles (super_admin + org_admin)
    admin = ["super_admin", "org_admin"]

    # Roles that may manage classes
    manager = ["super_admin", "org_admin", "teacher"]

    # Roles that may create/set global scope on content or classes
    global_scope = ["super_admin", "tutor"]

    @classmethod
    def values(cls) -> list[str]:
        """Return all role values (excluding role groups)."""
        return [
            getattr(cls, attr)
            for attr in [
                "super_admin",
                "tutor",
                "finance",
                "org_admin",
                "teacher",
                "student",
            ]
        ]


class ContentType(Constant):
    text = "text"
    video = "video"
    audio = "audio"

    @classmethod
    def values(cls) -> list[str]:
        """Return all content type values."""
        return [cls.text, cls.video, cls.audio]


class ContentScope(Constant):
    global_scope = "global"
    org = "org"

    @classmethod
    def values(cls) -> list[str]:
        """Return all content scope values."""
        return [cls.global_scope, cls.org]


class ClassScope(Constant):
    global_scope = "global"
    org = "org"

    @classmethod
    def values(cls) -> list[str]:
        """Return all class scope values."""
        return [cls.global_scope, cls.org]


class ContentEmoji(Constant):
    text = "📄"
    video = "🎬"
    audio = "🎧"

    @classmethod
    def to_dict(cls) -> dict[str, str]:
        """Return emoji mapping for content types."""
        return {
            ContentType.text: cls.text,
            ContentType.video: cls.video,
            ContentType.audio: cls.audio,
        }


class OrgType(Constant):
    platform = "platform"
    school = "school"

    @classmethod
    def values(cls) -> list[str]:
        """Return all org type values."""
        return [cls.platform, cls.school]
