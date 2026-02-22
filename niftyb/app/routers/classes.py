"""Class CRUD and student enrollment endpoints."""
import logging
from typing import List
from fastapi import APIRouter, HTTPException, status, Depends

from app.models.class_ import Class
from app.models.user import User
from app.models.content import Content
from app.schemas.class_ import ClassCreate, ClassUpdate, ClassOut, ClassDetailOut, AddStudentRequest
from app.utils.deps import CurrentUser, require_roles
from app.cache import cache_delete, cache_delete_pattern
from app.telemetry import get_tracer

router = APIRouter(prefix="/classes", tags=["classes"])
logger = logging.getLogger(__name__)
tracer = get_tracer(__name__)

MANAGER_ROLES = ("super_admin", "org_admin", "teacher")


def _class_out(c: Class, detail: bool = False) -> ClassOut | ClassDetailOut:
    d = c.to_dict(include_students=detail)
    return ClassDetailOut(**d) if detail else ClassOut(**d)


@router.get("", response_model=List[ClassOut])
async def list_classes(current_user: CurrentUser):
    with tracer.start_as_current_span("classes.list"):
        if current_user.role == "super_admin":
            classes = Class.objects().select_related()
        elif current_user.role == "teacher":
            classes = Class.objects(teacher=current_user).select_related()
        elif current_user.role == "student":
            classes = Class.objects(students=current_user).select_related()
        else:
            classes = Class.objects(org=current_user.org).select_related()
        return [_class_out(c) for c in classes.order_by("-created_at")]


@router.post("", response_model=ClassOut, status_code=status.HTTP_201_CREATED)
async def create_class(
    body: ClassCreate,
    current_user: User = Depends(require_roles(*MANAGER_ROLES)),
):
    cls = Class(
        name=body.name,
        grade=body.grade,
        teacher=current_user,
        org=current_user.org,
    )
    cls.save()
    logger.info("Class created", extra={"class_id": str(cls.id)})
    return _class_out(cls)


@router.get("/{class_id}", response_model=ClassDetailOut)
async def get_class(class_id: str, current_user: CurrentUser):
    cls = Class.objects(id=class_id).select_related().first()
    if not cls:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")
    if current_user.role not in ("super_admin",) and str(cls.org.id) != str(current_user.org.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")
    return _class_out(cls, detail=True)


@router.put("/{class_id}", response_model=ClassOut)
async def update_class(
    class_id: str,
    body: ClassUpdate,
    current_user: User = Depends(require_roles(*MANAGER_ROLES)),
):
    cls = Class.objects(id=class_id).select_related().first()
    if not cls:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")
    if current_user.role not in ("super_admin", "org_admin") and str(cls.teacher.id) != str(current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the class teacher or admin can update")

    if body.name:
        cls.name = body.name
    if body.grade is not None:
        cls.grade = body.grade
    cls.save()
    return _class_out(cls)


@router.delete("/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_class(
    class_id: str,
    current_user: User = Depends(require_roles(*MANAGER_ROLES)),
):
    cls = Class.objects(id=class_id).select_related().first()
    if not cls:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")
    if current_user.role not in ("super_admin", "org_admin") and str(cls.teacher.id) != str(current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorised")
    cls.delete()


@router.post("/{class_id}/students", response_model=ClassDetailOut)
async def add_student(
    class_id: str,
    body: AddStudentRequest,
    current_user: User = Depends(require_roles(*MANAGER_ROLES)),
):
    cls = Class.objects(id=class_id).select_related().first()
    if not cls:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")

    student = User.objects(id=body.user_id).first()
    if not student:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if student.role != "student":
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
    current_user: User = Depends(require_roles(*MANAGER_ROLES)),
):
    cls = Class.objects(id=class_id).select_related().first()
    if not cls:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")

    cls.students = [s for s in cls.students if str(s.id) != user_id]
    cls.save()
    return _class_out(cls, detail=True)
