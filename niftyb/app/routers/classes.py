"""Class CRUD, student enrollment, ordered content management, and progress tracking."""

import logging
from typing import List
from fastapi import APIRouter, HTTPException, status, Depends

from app.models.class_ import Class, ClassContentItem
from app.models.user import User
from app.models.content import Content
from app.models.student_progress import StudentProgress
from app.schemas.class_ import (
    ClassCreate,
    ClassUpdate,
    ClassOut,
    ClassDetailOut,
    ClassContentDetailOut,
    AddStudentRequest,
    AddContentRequest,
    UpdateContentItemRequest,
    ClassProgressOut,
    StudentProgressOut,
)
from app.utils.deps import CurrentUser, require_roles
from app.utils.class_access import is_content_accessible
from app.telemetry import get_tracer
from app.constants import Role, ClassScope, ContentScope

router = APIRouter(prefix="/classes", tags=["classes"])
logger = logging.getLogger(__name__)
tracer = get_tracer(__name__)


def _class_out(c: Class, detail: bool = False) -> ClassOut | ClassDetailOut:
    d = c.to_dict(include_students=detail)
    return ClassDetailOut(**d) if detail else ClassOut(**d)


def _can_manage(cls: Class, user: User) -> bool:
    return user.role in Role.admin or str(cls.teacher.id) == str(user.id)


def _can_see_class(cls: Class, user: User) -> bool:
    if user.role == Role.super_admin:
        return True
    if cls.scope == ClassScope.global_scope:
        return True
    return str(cls.org.id) == str(user.org.id)


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
    if not _can_see_class(cls, current_user):
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
    if not _can_manage(cls, current_user):
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
    if not _can_manage(cls, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorised")
    StudentProgress.delete_by_class(cls)
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

    student = User.get_by_id(user_id)
    cls.students = [s for s in cls.students if str(s.id) != user_id]
    cls.save()
    if student:
        StudentProgress.delete_by_student_in_class(student, cls)
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
    StudentProgress.delete_by_student_in_class(current_user, cls)


# ── Class content management ──────────────────────────────────────────────────


def _build_content_detail(item, order: int, completed: bool, accessible: bool) -> dict:
    c = item.content
    d = c.to_dict()
    return {
        "content_id": d["id"],
        "blocking": item.blocking,
        "order": order,
        "completed": completed,
        "accessible": accessible,
        **{k: v for k, v in d.items() if k != "id"},
    }


@router.get("/{class_id}/content", response_model=List[ClassContentDetailOut])
async def list_class_content(class_id: str, current_user: CurrentUser):
    """
    Return ordered content for this class.
    - Enrolled students: see access/completion state based on their progress.
    - Unenrolled students: see all items as preview (completed=False, accessible=False).
    - Managers/tutors/admins: see all items as fully accessible (completed=False).
    """
    cls = Class.get_by_id(class_id)
    if not cls:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")
    if not _can_see_class(cls, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

    cls.reload()

    is_enrolled_student = (
        current_user.role == Role.student
        and any(str(s.id) == str(current_user.id) for s in cls.students if hasattr(s, "id"))
    )
    is_unenrolled_student = current_user.role == Role.student and not is_enrolled_student

    completed_ids: set[str] = set()
    if is_enrolled_student:
        progress = StudentProgress.objects(student=current_user, class_=cls).first()
        if progress:
            completed_ids = progress.completed_ids()

    result = []
    for i, item in enumerate(cls.content_items):
        if not hasattr(item.content, "id"):
            continue  # skip stale refs

        content_id = str(item.content.id)

        if is_unenrolled_student:
            completed = False
            accessible = False
        elif is_enrolled_student:
            completed = content_id in completed_ids
            accessible = is_content_accessible(cls.content_items, content_id, completed_ids)
        else:
            completed = False
            accessible = True

        result.append(ClassContentDetailOut(**_build_content_detail(item, i, completed, accessible)))

    return result


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
    if not _can_manage(cls, current_user):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Only the class teacher or admin can manage content",
        )

    content = Content.get_by_id(body.content_id)
    if not content:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Content not found")

    if content.scope != ContentScope.global_scope and str(content.org.id) != str(cls.org.id):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Content does not belong to this organization"
        )

    existing_ids = {
        str(item.content.id) for item in cls.content_items if hasattr(item.content, "id")
    }
    if body.content_id in existing_ids:
        raise HTTPException(status.HTTP_409_CONFLICT, "Content already in class")

    cls.content_items.append(ClassContentItem(content=content, blocking=body.blocking))
    cls.save()
    return _class_out(cls, detail=True)


@router.patch("/{class_id}/content/{content_id}", response_model=ClassDetailOut)
async def update_content_item(
    class_id: str,
    content_id: str,
    body: UpdateContentItemRequest,
    current_user: User = Depends(require_roles(*Role.manager)),
):
    """Update blocking flag or reorder a content item in the class."""
    cls = Class.get_by_id(class_id)
    if not cls:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")
    if not _can_manage(cls, current_user):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Only the class teacher or admin can manage content",
        )

    idx = next(
        (i for i, item in enumerate(cls.content_items)
         if hasattr(item.content, "id") and str(item.content.id) == content_id),
        None,
    )
    if idx is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Content not in class")

    if body.blocking is not None:
        cls.content_items[idx].blocking = body.blocking

    if body.order is not None:
        new_pos = max(0, min(body.order, len(cls.content_items) - 1))
        item = cls.content_items.pop(idx)
        cls.content_items.insert(new_pos, item)

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
    if not _can_manage(cls, current_user):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Only the class teacher or admin can manage content",
        )

    cls.content_items = [
        item for item in cls.content_items
        if not (hasattr(item.content, "id") and str(item.content.id) == content_id)
    ]
    cls.save()
    return _class_out(cls, detail=True)


# ── Student progress ──────────────────────────────────────────────────────────


@router.post("/{class_id}/content/{content_id}/complete", status_code=status.HTTP_200_OK)
async def mark_content_complete(class_id: str, content_id: str, current_user: CurrentUser):
    """Student marks a content item as completed."""
    if current_user.role != Role.student:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only students can mark content complete")

    cls = Class.get_by_id(class_id)
    if not cls:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")

    if not any(str(s.id) == str(current_user.id) for s in cls.students if hasattr(s, "id")):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not enrolled in this class")

    content = Content.get_by_id(content_id)
    if not content:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Content not found")

    item_ids = {str(item.content.id) for item in cls.content_items if hasattr(item.content, "id")}
    if content_id not in item_ids:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Content not in this class")

    progress = StudentProgress.get_or_create(current_user, cls)
    if not is_content_accessible(cls.content_items, content_id, progress.completed_ids()):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Content is not yet accessible")

    progress.complete(content)
    return {"message": "Content marked as complete"}


@router.delete("/{class_id}/content/{content_id}/complete", status_code=status.HTTP_200_OK)
async def unmark_content_complete(class_id: str, content_id: str, current_user: CurrentUser):
    """Student unmarks a content item as completed."""
    if current_user.role != Role.student:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only students can unmark content")

    cls = Class.get_by_id(class_id)
    if not cls:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")

    content = Content.get_by_id(content_id)
    if not content:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Content not found")

    progress = StudentProgress.objects(student=current_user, class_=cls).first()
    if progress:
        progress.uncomplete(content)
    return {"message": "Content unmarked"}


@router.get("/{class_id}/progress", response_model=ClassProgressOut)
async def get_class_progress(class_id: str, current_user: CurrentUser):
    """
    Return progress for all enrolled students.
    Accessible to: teacher of the class, org_admin (same org), super_admin, tutor.
    """
    cls = Class.get_by_id(class_id)
    if not cls:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")

    can_view = (
        current_user.role == Role.super_admin
        or current_user.role == Role.tutor
        or (current_user.role == Role.org_admin and str(cls.org.id) == str(current_user.org.id))
        or (current_user.role == Role.teacher and str(cls.teacher.id) == str(current_user.id))
    )
    if not can_view:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

    total_content = len([item for item in cls.content_items if hasattr(item.content, "id")])
    all_progress = {str(p.student.id): p for p in StudentProgress.get_all_for_class(cls)}

    student_out: list[StudentProgressOut] = []
    for student in cls.students:
        if not hasattr(student, "id"):
            continue
        sid = str(student.id)
        progress = all_progress.get(sid)
        completed_ids = list(progress.completed_ids()) if progress else []
        student_out.append(StudentProgressOut(
            student_id=sid,
            student_name=student.name,
            student_avatar=student.avatar,
            completed_count=len(completed_ids),
            total_count=total_content,
            completed_content_ids=completed_ids,
        ))

    return ClassProgressOut(
        class_id=class_id,
        total_content=total_content,
        students=student_out,
    )
