from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.constants import ClassScope


class ClassCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    grade: Optional[str] = Field(None, max_length=100)
    scope: Optional[str] = Field(ClassScope.org, pattern=ClassScope.pattern())


class ClassUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    grade: Optional[str] = Field(None, max_length=100)


class ClassContentItemSimple(BaseModel):
    content_id: str
    blocking: bool
    order: int


class ClassOut(BaseModel):
    id: str
    name: str
    grade: Optional[str]
    scope: str = ClassScope.org
    teacher: str
    teacher_name: Optional[str]
    org: str
    org_name: Optional[str]
    student_count: int
    content_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class ClassDetailOut(ClassOut):
    students: List[str]
    content_items: List[ClassContentItemSimple]


class ClassContentDetailOut(BaseModel):
    """A class content item enriched with full content details + access metadata."""
    # Class-level metadata
    content_id: str
    blocking: bool
    order: int
    completed: bool
    accessible: bool
    # Content fields
    title: str
    type: str
    scope: str
    org: str
    org_name: Optional[str]
    author: str
    author_name: Optional[str]
    subject: Optional[str]
    body: Optional[str]
    hls_ready: bool
    file_id: Optional[str]
    file_name: Optional[str]
    file_content_type: Optional[str]
    views: int
    locked: bool
    emoji: Optional[str]
    created_at: datetime
    updated_at: datetime


class AddStudentRequest(BaseModel):
    user_id: str


class AddContentRequest(BaseModel):
    content_id: str
    blocking: bool = False


class UpdateContentItemRequest(BaseModel):
    blocking: Optional[bool] = None
    order: Optional[int] = None


class StudentProgressOut(BaseModel):
    student_id: str
    student_name: str
    student_avatar: str
    completed_count: int
    total_count: int
    completed_content_ids: List[str]


class ClassProgressOut(BaseModel):
    class_id: str
    total_content: int
    students: List[StudentProgressOut]
