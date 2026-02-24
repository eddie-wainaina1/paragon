from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from app.constants import OrgType


class OrgCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    type: str = Field("school", pattern=OrgType.pattern())
    internal: bool = False
    admin_email: Optional[EmailStr] = None


class OrgUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    type: Optional[str] = Field(None, pattern=OrgType.pattern())
    internal: Optional[bool] = None


class OrgOut(BaseModel):
    id: str
    name: str
    slug: str
    type: str
    internal: bool
    created_at: datetime

    class Config:
        from_attributes = True
