from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.constants import ContentType, ContentScope


class AssessmentQuestionIn(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    choices: List[str] = Field(min_length=2, max_length=6)
    answer: int = Field(ge=0)  # 0-based index into choices


class AssessmentQuestionOut(BaseModel):
    qid: str
    question: str
    choices: List[str]
    answer: int  # only returned to creator/admin


class AssessmentQuestionForStudent(BaseModel):
    qid: str
    question: str
    choices: List[str]  # no answer field


class AddQuestionsRequest(BaseModel):
    questions: List[AssessmentQuestionIn]


class ContentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    type: str = Field(pattern=ContentType.pattern())
    scope: str = Field("org", pattern=ContentScope.pattern())
    subject: Optional[str] = Field(None, max_length=200)
    body: Optional[str] = None
    emoji: Optional[str] = Field(None, max_length=10)
    max_questions: Optional[int] = Field(None, ge=1)
    passing_score: Optional[float] = Field(None, ge=0, le=100)


class ContentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=300)
    type: Optional[str] = Field(None, pattern=ContentType.pattern())
    scope: Optional[str] = Field(None, pattern=ContentScope.pattern())
    subject: Optional[str] = Field(None, max_length=200)
    body: Optional[str] = None
    locked: Optional[bool] = None
    emoji: Optional[str] = Field(None, max_length=10)
    max_questions: Optional[int] = Field(None, ge=1)
    passing_score: Optional[float] = Field(None, ge=0, le=100)


class ContentOut(BaseModel):
    id: str
    title: str
    type: str
    scope: str
    org: str
    org_name: Optional[str]
    author: str
    author_name: Optional[str]
    subject: Optional[str]
    body: Optional[str]
    hls_ready: bool = False
    file_id: Optional[str]
    file_name: Optional[str]
    file_content_type: Optional[str]
    views: int
    locked: bool
    emoji: str
    questions_count: int = 0
    max_questions: Optional[int] = None
    passing_score: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
