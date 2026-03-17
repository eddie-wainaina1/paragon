from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from mongoengine import (
    Document,
    StringField,
    IntField,
    BooleanField,
    DateTimeField,
    ReferenceField,
)
from app.models.organization import Organization
from app.models.user import User
from app.constants import SubscriptionPlan, SubscriptionStatus, StudentSubKind


class OrgSubscription(Document):
    """One subscription record per organization."""

    meta = {
        "collection": "org_subscriptions",
        "indexes": ["org"],
    }

    org = ReferenceField(Organization, required=True, unique=True)
    plan = StringField(
        choices=SubscriptionPlan.values(), default=SubscriptionPlan.free
    )
    status = StringField(
        choices=SubscriptionStatus.values(), default=SubscriptionStatus.active
    )
    seat_limit = IntField(default=50)   # -1 = unlimited (enterprise)
    seat_used = IntField(default=0)

    # Billing period (null for free / manually-managed enterprise)
    billing_cycle = StringField(choices=["monthly", "annual"], default=None)
    current_period_start = DateTimeField(default=None)
    current_period_end = DateTimeField(default=None)

    # Paystack
    paystack_subscription_code = StringField(default=None)
    paystack_customer_code = StringField(default=None)
    paystack_email_token = StringField(default=None)  # used to manage subscription link

    # Enterprise application
    enterprise_note = StringField(default=None, max_length=2000)
    enterprise_applied_at = DateTimeField(default=None)

    # Manual management audit
    managed_by = StringField(default=None)  # user id of finance/super_admin
    managed_at = DateTimeField(default=None)

    created_at = DateTimeField(default=lambda: datetime.now(timezone.utc))
    updated_at = DateTimeField(default=lambda: datetime.now(timezone.utc))

    # ── Queries ──────────────────────────────────────────────────────────────

    @classmethod
    def get_by_org(cls, org) -> Optional[OrgSubscription]:
        return cls.objects(org=org).first()

    @classmethod
    def get_by_id(cls, sub_id: str) -> Optional[OrgSubscription]:
        return cls.objects(id=sub_id).first()

    @classmethod
    def get_by_org_id(cls, org_id: str) -> Optional[OrgSubscription]:
        org = Organization.get_by_id(org_id)
        if not org:
            return None
        return cls.objects(org=org).first()

    @classmethod
    def list_all(cls):
        return cls.objects()

    @classmethod
    def get_by_paystack_code(cls, code: str) -> Optional[OrgSubscription]:
        return cls.objects(paystack_subscription_code=code).first()

    # ── Helpers ───────────────────────────────────────────────────────────────

    def has_available_seat(self) -> bool:
        """True if the org can add another student."""
        if self.seat_limit == -1:
            return True
        return self.seat_used < self.seat_limit

    def touch(self) -> None:
        self.updated_at = datetime.now(timezone.utc)

    # ── Serialisation ─────────────────────────────────────────────────────────

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "org": str(self.org.id),
            "org_name": self.org.name,
            "plan": self.plan,
            "status": self.status,
            "seat_limit": self.seat_limit,
            "seat_used": self.seat_used,
            "billing_cycle": self.billing_cycle,
            "current_period_start": (
                self.current_period_start.isoformat()
                if self.current_period_start
                else None
            ),
            "current_period_end": (
                self.current_period_end.isoformat()
                if self.current_period_end
                else None
            ),
            "paystack_subscription_code": self.paystack_subscription_code,
            "enterprise_note": self.enterprise_note,
            "enterprise_applied_at": (
                self.enterprise_applied_at.isoformat()
                if self.enterprise_applied_at
                else None
            ),
            "managed_by": self.managed_by,
            "managed_at": self.managed_at.isoformat() if self.managed_at else None,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class StudentSubscription(Document):
    """One subscription record per student user."""

    meta = {
        "collection": "student_subscriptions",
        "indexes": ["user"],
    }

    user = ReferenceField(User, required=True, unique=True)
    kind = StringField(
        choices=StudentSubKind.values(), default=StudentSubKind.org_covered
    )
    plan = StringField(choices=["free", "pro"], default="free")
    status = StringField(
        choices=SubscriptionStatus.values(), default=SubscriptionStatus.active
    )

    # Billing period (null for org_covered / free individual)
    billing_cycle = StringField(choices=["monthly", "annual"], default=None)
    current_period_start = DateTimeField(default=None)
    current_period_end = DateTimeField(default=None)

    # Paystack (individual students only)
    paystack_subscription_code = StringField(default=None)
    paystack_customer_code = StringField(default=None)
    paystack_email_token = StringField(default=None)

    created_at = DateTimeField(default=lambda: datetime.now(timezone.utc))
    updated_at = DateTimeField(default=lambda: datetime.now(timezone.utc))

    # ── Queries ──────────────────────────────────────────────────────────────

    @classmethod
    def get_by_user(cls, user) -> Optional[StudentSubscription]:
        return cls.objects(user=user).first()

    @classmethod
    def get_by_user_id(cls, user_id: str) -> Optional[StudentSubscription]:
        user = User.get_by_id(user_id)
        if not user:
            return None
        return cls.objects(user=user).first()

    @classmethod
    def get_by_id(cls, sub_id: str) -> Optional[StudentSubscription]:
        return cls.objects(id=sub_id).first()

    @classmethod
    def list_all(cls):
        return cls.objects()

    @classmethod
    def get_by_paystack_code(cls, code: str) -> Optional[StudentSubscription]:
        return cls.objects(paystack_subscription_code=code).first()

    # ── Helpers ───────────────────────────────────────────────────────────────

    def touch(self) -> None:
        self.updated_at = datetime.now(timezone.utc)

    # ── Serialisation ─────────────────────────────────────────────────────────

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "user": str(self.user.id),
            "user_name": self.user.name,
            "user_email": self.user.email,
            "kind": self.kind,
            "plan": self.plan,
            "status": self.status,
            "billing_cycle": self.billing_cycle,
            "current_period_start": (
                self.current_period_start.isoformat()
                if self.current_period_start
                else None
            ),
            "current_period_end": (
                self.current_period_end.isoformat()
                if self.current_period_end
                else None
            ),
            "paystack_subscription_code": self.paystack_subscription_code,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
