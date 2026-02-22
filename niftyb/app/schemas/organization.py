from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


class OrgCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    type: str = Field("school", pattern="^(platform|school)$")
    admin_email: Optional[EmailStr] = None


class OrgUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    type: Optional[str] = Field(None, pattern="^(platform|school)$")


class OrgOut(BaseModel):
    id: str
    name: str
    slug: str
    type: str
    created_at: datetime
    # Populated only when an admin user is auto-created during org registration
    admin_temp_password: Optional[str] = None

    class Config:
        from_attributes = True
