"""Class CRUD and student enrollment endpoints."""

import logging
from typing import List
from fastapi import APIRouter, HTTPException, status, Depends

from app.models.class_ import Class
from app.models.user import User
from app.models.content import Content
from app.schemas.class_ import (
    ClassCreate,
    ClassUpdate,
    ClassOut,
    ClassDetailOut,
    AddStudentRequest,
    AddContentRequest,
)
from app.schemas.content import ContentOut
from app.utils.deps import CurrentUser, require_roles
from app.cache import cache_delete, cache_delete_pattern
from app.telemetry import get_tracer
from app.constants import Role, ClassScope, ContentScope

router = APIRouter(prefix="/classes", tags=["classes"])
logger = logging.getLogger(__name__)
tracer = get_tracer(__name__)


def _class_out(c: Class, detail: bool = False) -> ClassOut | ClassDetailOut:
    d = c.to_dict(include_students=detail)
    return ClassDetailOut(**d) if detail else ClassOut(**d)


@router.get("", response_model=List[ClassOut])
async def list_classes(current_user: CurrentUser):
    with tracer.start_as_current_span("classes.list"):
        classes = Class.list_for_user(current_user)
        return [_class_out(c) for c in classes.order_by("-created_at").select_related()]


@router.post("", response_model=ClassOut, status_code=status.HTTP_201_CREATED)
async def create_class(
    body: ClassCreate,
    current_user: User = Depends(require_roles(*Role.manager)),
):
    scope = body.scope or ClassScope.org
    if scope == ClassScope.global_scope and current_user.role not in Role.global_scope:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Only super admins and tutors can create global classes",
        )
    cls = Class(
        name=body.name,
        grade=body.grade,
        scope=scope,
        teacher=current_user,
        org=current_user.org,
    )
    cls.save()
    logger.info("Class created", extra={"class_id": str(cls.id)})
    return _class_out(cls)


@router.get("/available", response_model=List[ClassOut])
async def list_available_classes(current_user: CurrentUser):
    """Return classes in the student's org that they are not yet enrolled in."""
    if current_user.role != Role.student:
        return []
    available = Class.list_available_for_student(current_user)
    return [_class_out(c) for c in available]


@router.get("/{class_id}", response_model=ClassDetailOut)
async def get_class(class_id: str, current_user: CurrentUser):
    cls = Class.get_by_id(class_id)
    if not cls:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")
    if (
        current_user.role != Role.super_admin
        and cls.scope != ClassScope.global_scope
        and str(cls.org.id) != str(current_user.org.id)
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")
    return _class_out(cls, detail=True)


@router.put("/{class_id}", response_model=ClassOut)
async def update_class(
    class_id: str,
    body: ClassUpdate,
    current_user: User = Depends(require_roles(*Role.manager)),
):
    cls = Class.get_by_id(class_id)
    if not cls:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")
    if current_user.role not in Role.admin and str(cls.teacher.id) != str(current_user.id):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only the class teacher or admin can update"
        )

    if body.name:
        cls.name = body.name
    if body.grade is not None:
        cls.grade = body.grade
    cls.save()
    return _class_out(cls)


@router.delete("/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_class(
    class_id: str,
    current_user: User = Depends(require_roles(*Role.manager)),
):
    cls = Class.get_by_id(class_id)
    if not cls:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")
    if current_user.role not in Role.admin and str(cls.teacher.id) != str(current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorised")
    cls.delete()


@router.post("/{class_id}/students", response_model=ClassDetailOut)
async def add_student(
    class_id: str,
    body: AddStudentRequest,
    current_user: User = Depends(require_roles(*Role.manager)),
):
    cls = Class.get_by_id(class_id)
    if not cls:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")

    student = User.get_by_id(body.user_id)
    if not student:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if student.role != Role.student:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "User is not a student")
    if student in cls.students:
        raise HTTPException(status.HTTP_409_CONFLICT, "Student already enrolled")

    cls.students.append(student)
    cls.save()
    return _class_out(cls, detail=True)


@router.delete("/{class_id}/students/{user_id}", response_model=ClassDetailOut)
async def remove_student(
    class_id: str,
    user_id: str,
    current_user: User = Depends(require_roles(*Role.manager)),
):
    cls = Class.get_by_id(class_id)
    if not cls:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")

    cls.students = [s for s in cls.students if str(s.id) != user_id]
    cls.save()
    return _class_out(cls, detail=True)


# ── Student self-subscribe ────────────────────────────────────────────────────


@router.post("/{class_id}/subscribe", response_model=ClassOut)
async def subscribe_to_class(class_id: str, current_user: CurrentUser):
    """Allow a student to self-subscribe to a class."""
    if current_user.role != Role.student:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only students can subscribe to classes"
        )

    cls = Class.get_by_id(class_id)
    if not cls:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")
    if cls.scope != ClassScope.global_scope and str(cls.org.id) != str(current_user.org.id):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Class is not in your organization"
        )
    if current_user in cls.students:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Already subscribed to this class"
        )

    cls.students.append(current_user)
    cls.save()
    logger.info(
        "Student subscribed",
        extra={"class_id": class_id, "user_id": str(current_user.id)},
    )
    return _class_out(cls)


@router.delete("/{class_id}/subscribe", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe_from_class(class_id: str, current_user: CurrentUser):
    """Allow a student to unsubscribe from a class."""
    if current_user.role != Role.student:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only students can unsubscribe from classes"
        )

    cls = Class.get_by_id(class_id)
    if not cls:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")

    cls.students = [s for s in cls.students if str(s.id) != str(current_user.id)]
    cls.save()


# ── Class content management ──────────────────────────────────────────────────


@router.get("/{class_id}/content", response_model=List[ContentOut])
async def list_class_content(class_id: str, current_user: CurrentUser):
    """Return content items assigned to this class. Accessible to enrolled students, the teacher, and admins."""
    cls = Class.get_by_id(class_id)
    if not cls:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")

    # Access check
    if current_user.role == Role.super_admin:
        pass
    elif current_user.role == Role.org_admin and str(cls.org.id) == str(current_user.org.id):
        pass
    elif current_user.role == Role.teacher and str(cls.teacher.id) == str(current_user.id):
        pass
    elif current_user.role == Role.student and current_user in cls.students:
        pass
    else:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

    return [ContentOut(**c.to_dict()) for c in cls.unlocked_content]


@router.post("/{class_id}/content", response_model=ClassDetailOut)
async def add_content_to_class(
    class_id: str,
    body: AddContentRequest,
    current_user: User = Depends(require_roles(*Role.manager)),
):
    """Add an existing content item to a class."""
    cls = Class.get_by_id(class_id)
    if not cls:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")
    if current_user.role not in Role.admin and str(cls.teacher.id) != str(current_user.id):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Only the class teacher or admin can manage content",
        )

    content = Content.get_by_id(body.content_id)
    if not content:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Content not found")

    # Ensure the content is accessible to this org (global or same org)
    if content.scope != ContentScope.global_scope and str(content.org.id) != str(cls.org.id):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Content does not belong to this organization"
        )

    if content in cls.unlocked_content:
        raise HTTPException(status.HTTP_409_CONFLICT, "Content already in class")

    cls.unlocked_content.append(content)
    cls.save()
    return _class_out(cls, detail=True)


@router.delete("/{class_id}/content/{content_id}", response_model=ClassDetailOut)
async def remove_content_from_class(
    class_id: str,
    content_id: str,
    current_user: User = Depends(require_roles(*Role.manager)),
):
    """Remove a content item from a class."""
    cls = Class.get_by_id(class_id)
    if not cls:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")
    if current_user.role not in Role.admin and str(cls.teacher.id) != str(current_user.id):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Only the class teacher or admin can manage content",
        )

    cls.unlocked_content = [c for c in cls.unlocked_content if str(c.id) != content_id]
    cls.save()
    return _class_out(cls, detail=True)
