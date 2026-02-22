from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ClassCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    grade: Optional[str] = Field(None, max_length=100)


class ClassUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    grade: Optional[str] = Field(None, max_length=100)


class ClassOut(BaseModel):
    id: str
    name: str
    grade: Optional[str]
    teacher: str
    teacher_name: Optional[str]
    org: str
    org_name: Optional[str]
    student_count: int
    unlocked_content_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class ClassDetailOut(ClassOut):
    students: List[str]
    unlocked_content: List[str]


class AddStudentRequest(BaseModel):
    user_id: str
