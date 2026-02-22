from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

ROLES = ["super_admin", "tutor", "finance", "org_admin", "teacher", "student"]


class UserCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: str = Field(..., pattern="^(super_admin|tutor|finance|org_admin|teacher|student)$")
    org_id: str


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=6)
    role: Optional[str] = Field(None, pattern="^(super_admin|tutor|finance|org_admin|teacher|student)$")


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: str
    org: str
    org_name: str
    avatar: str
    created_at: datetime

    class Config:
        from_attributes = True


class RegisterOrgRequest(BaseModel):
    org_name: str = Field(..., min_length=1, max_length=200)
    admin_first: str = Field(..., min_length=1, max_length=100)
    admin_last: str = Field(default="", max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
