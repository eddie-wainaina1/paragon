from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.constants import SubscriptionPlan, SubscriptionStatus, StudentSubKind


# ── Org subscription schemas ──────────────────────────────────────────────────

class OrgSubscriptionOut(BaseModel):
    id: str
    org: str
    org_name: str
    plan: str
    status: str
    seat_limit: int
    seat_used: int
    billing_cycle: Optional[str] = None
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    paystack_subscription_code: Optional[str] = None
    enterprise_note: Optional[str] = None
    enterprise_applied_at: Optional[datetime] = None
    managed_by: Optional[str] = None
    managed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OrgUpgradeRequest(BaseModel):
    """Initiates a Paystack payment flow to upgrade an org to Pro."""
    billing_cycle: str = Field("monthly", pattern="^(monthly|annual)$")
    callback_url: str  # frontend URL to redirect to after payment


class OrgEnterpriseApplyRequest(BaseModel):
    note: Optional[str] = Field(None, max_length=2000)


class OrgSubscriptionManualUpdate(BaseModel):
    """Finance/SuperAdmin manual override."""
    plan: Optional[str] = Field(None, pattern=SubscriptionPlan.pattern())
    status: Optional[str] = Field(None, pattern=SubscriptionStatus.pattern())
    seat_limit: Optional[int] = None   # use -1 for unlimited
    billing_cycle: Optional[str] = Field(None, pattern="^(monthly|annual)$")
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    note: Optional[str] = Field(None, max_length=2000)


class PaystackInitResponse(BaseModel):
    """Returned to the frontend to redirect the user to Paystack checkout."""
    authorization_url: str
    access_code: str
    reference: str


# ── Student subscription schemas ──────────────────────────────────────────────

class StudentSubscriptionOut(BaseModel):
    id: str
    user: str
    user_name: str
    user_email: str
    kind: str
    plan: str
    status: str
    billing_cycle: Optional[str] = None
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    paystack_subscription_code: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StudentUpgradeRequest(BaseModel):
    """Initiates Paystack payment for an individual student Pro upgrade."""
    billing_cycle: str = Field("monthly", pattern="^(monthly|annual)$")
    callback_url: str


class StudentSubscriptionManualUpdate(BaseModel):
    """Finance/SuperAdmin manual override."""
    plan: Optional[str] = Field(None, pattern="^(free|pro)$")
    status: Optional[str] = Field(None, pattern=SubscriptionStatus.pattern())
    billing_cycle: Optional[str] = Field(None, pattern="^(monthly|annual)$")
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
