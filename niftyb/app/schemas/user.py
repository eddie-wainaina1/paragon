from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from app.constants import Role


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(min_length=6)
    role: str = Field(pattern=Role.pattern())
    org_id: str


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=6)
    role: Optional[str] = Field(None, pattern=Role.pattern())


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: str
    org: str
    org_name: str
    avatar: str
    created_at: datetime
    verified: bool = False
    terms_accepted_at: Optional[datetime] = None
    phone: Optional[str] = None
    tutor_application_pending: bool = False

    class Config:
        from_attributes = True


class AcceptTermsRequest(BaseModel):
    accept: bool


class RegisterOrgRequest(BaseModel):
    org_name: str = Field(min_length=1, max_length=200)
    admin_first: str = Field(min_length=1, max_length=100)
    admin_last: str = Field(default="", max_length=100)
    email: EmailStr
    password: str = Field(min_length=6)


class RegisterIndividualRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(default="", max_length=100)
    email: EmailStr
    password: str = Field(min_length=6)
    apply_as_tutor: bool = False
    phone: Optional[str] = Field(None, max_length=30)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=6)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
