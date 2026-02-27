from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.constants import ContentType, ContentScope


class ContentCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    type: str = Field(..., pattern=ContentType.pattern())
    scope: str = Field("org", pattern=ContentScope.pattern())
    subject: Optional[str] = Field(None, max_length=200)
    body: Optional[str] = None
    emoji: Optional[str] = Field(None, max_length=10)


class ContentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=300)
    type: Optional[str] = Field(None, pattern=ContentType.pattern())
    scope: Optional[str] = Field(None, pattern=ContentScope.pattern())
    subject: Optional[str] = Field(None, max_length=200)
    body: Optional[str] = None
    locked: Optional[bool] = None
    emoji: Optional[str] = Field(None, max_length=10)


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
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
