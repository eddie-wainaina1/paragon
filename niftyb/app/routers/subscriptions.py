"""Subscription management — org plans and student plans."""
import logging
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.cache import cache_delete
from app.config import settings
from app.constants import Role, SubscriptionPlan, SubscriptionStatus, StudentSubKind
from app.models.organization import Organization
from app.models.subscription import OrgSubscription, StudentSubscription
from app.models.user import User
from app.schemas.subscription import (
    OrgEnterpriseApplyRequest,
    OrgSubscriptionManualUpdate,
    OrgSubscriptionOut,
    OrgUpgradeRequest,
    PaystackInitResponse,
    StudentSubscriptionManualUpdate,
    StudentSubscriptionOut,
    StudentUpgradeRequest,
)
from app.services import paystack as paystack_svc
from app.telemetry import get_tracer
from app.utils.deps import CurrentUser, require_roles

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])
logger = logging.getLogger(__name__)
tracer = get_tracer(__name__)

# Roles that can manage any subscription
_FINANCE_ADMIN = [Role.super_admin, Role.finance]


def _org_sub_out(sub: OrgSubscription) -> OrgSubscriptionOut:
    return OrgSubscriptionOut.model_validate(sub.to_dict())


def _student_sub_out(sub: StudentSubscription) -> StudentSubscriptionOut:
    return StudentSubscriptionOut.model_validate(sub.to_dict())


def _get_org_or_404(org_id: str) -> Organization:
    org = Organization.get_by_id(org_id)
    if not org:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")
    return org


def _get_org_sub_or_404(org_id: str) -> OrgSubscription:
    sub = OrgSubscription.get_by_org_id(org_id)
    if not sub:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subscription not found")
    return sub


# ── Org subscriptions ─────────────────────────────────────────────────────────

@router.get("/orgs", response_model=List[OrgSubscriptionOut])
async def list_org_subscriptions(current_user: CurrentUser):
    """
    Finance/SuperAdmin → all org subscriptions.
    org_admin → own org subscription only.
    """
    with tracer.start_as_current_span("subscriptions.orgs.list"):
        if current_user.role in _FINANCE_ADMIN:
            subs = OrgSubscription.list_all().select_related()
            return [_org_sub_out(s) for s in subs]
        elif current_user.role == Role.org_admin:
            sub = OrgSubscription.get_by_org(current_user.org)
            if not sub:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Subscription not found")
            return [_org_sub_out(sub)]
        else:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")


@router.get("/orgs/{org_id}", response_model=OrgSubscriptionOut)
async def get_org_subscription(org_id: str, current_user: CurrentUser):
    """Get an org's subscription. org_admin can only see their own."""
    _get_org_or_404(org_id)
    if (
        current_user.role not in _FINANCE_ADMIN
        and current_user.role != Role.org_admin
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")
    if current_user.role == Role.org_admin and str(current_user.org.id) != org_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cannot view another org's subscription")
    return _org_sub_out(_get_org_sub_or_404(org_id))


@router.post("/orgs/{org_id}/upgrade", response_model=PaystackInitResponse)
async def upgrade_org_to_pro(
    org_id: str,
    body: OrgUpgradeRequest,
    current_user: CurrentUser,
):
    """
    Initiate a Paystack payment to upgrade an org to Pro.
    Accessible by org_admin (own org) or Finance/SuperAdmin.
    Returns Paystack authorization_url for the client to redirect to.
    """
    org = _get_org_or_404(org_id)
    if (
        current_user.role not in _FINANCE_ADMIN
        and not (current_user.role == Role.org_admin and str(current_user.org.id) == org_id)
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

    sub = _get_org_sub_or_404(org_id)
    if sub.plan == SubscriptionPlan.enterprise:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Enterprise subscriptions are managed manually",
        )
    if sub.plan == SubscriptionPlan.pro and sub.status == SubscriptionStatus.active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Already on Pro plan")

    plan_code = settings.paystack_org_pro_plan_code
    if not plan_code:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Payment system not configured — contact support",
        )

    try:
        data = await paystack_svc.initialize_transaction(
            email=current_user.email,
            amount=SubscriptionPlan.org_pro_amount,
            callback_url=body.callback_url,
            plan_code=plan_code,
            metadata={"org_id": org_id, "type": "org_pro", "billing_cycle": body.billing_cycle},
        )
    except Exception as exc:
        logger.error("Paystack init failed", extra={"error": str(exc)})
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Payment gateway error")

    return PaystackInitResponse(
        authorization_url=data["authorization_url"],
        access_code=data["access_code"],
        reference=data["reference"],
    )


@router.post("/orgs/{org_id}/verify", response_model=OrgSubscriptionOut)
async def verify_org_upgrade(
    org_id: str,
    reference: str,
    current_user: CurrentUser,
):
    """
    Verify a Paystack payment reference and activate the Pro subscription.
    Called after user returns from Paystack checkout.
    """
    _get_org_or_404(org_id)
    if (
        current_user.role not in _FINANCE_ADMIN
        and not (current_user.role == Role.org_admin and str(current_user.org.id) == org_id)
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

    sub = _get_org_sub_or_404(org_id)

    try:
        tx = await paystack_svc.verify_transaction(reference)
    except Exception as exc:
        logger.error("Paystack verify failed", extra={"error": str(exc)})
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Payment verification failed")

    if tx.get("status") != "success":
        raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED, "Payment not completed")

    # Activate Pro
    sub.plan = SubscriptionPlan.pro
    sub.status = SubscriptionStatus.active
    sub.seat_limit = SubscriptionPlan.seat_limits["pro"]
    sub.billing_cycle = "monthly"

    # Extract Paystack subscription info if present
    subscription_data = tx.get("subscription", {}) or {}
    if subscription_data.get("subscription_code"):
        sub.paystack_subscription_code = subscription_data["subscription_code"]
        sub.paystack_email_token = subscription_data.get("email_token")

    if tx.get("paid_at"):
        sub.current_period_start = datetime.fromisoformat(
            tx["paid_at"].replace("Z", "+00:00")
        )

    sub.touch()
    sub.save()
    logger.info("Org upgraded to Pro", extra={"org_id": org_id})
    return _org_sub_out(sub)


@router.post("/orgs/{org_id}/apply-enterprise", response_model=OrgSubscriptionOut)
async def apply_for_enterprise(
    org_id: str,
    body: OrgEnterpriseApplyRequest,
    current_user: CurrentUser,
):
    """Submit an enterprise upgrade application for Finance review."""
    _get_org_or_404(org_id)
    if (
        current_user.role not in _FINANCE_ADMIN
        and not (current_user.role == Role.org_admin and str(current_user.org.id) == org_id)
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

    sub = _get_org_sub_or_404(org_id)
    if sub.plan == SubscriptionPlan.enterprise:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Already on Enterprise plan")
    if sub.status == SubscriptionStatus.enterprise_pending:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Enterprise application already pending")

    sub.status = SubscriptionStatus.enterprise_pending
    sub.enterprise_note = body.note
    sub.enterprise_applied_at = datetime.now(timezone.utc)
    sub.touch()
    sub.save()
    logger.info("Enterprise application submitted", extra={"org_id": org_id})
    return _org_sub_out(sub)


@router.post("/orgs/{org_id}/cancel", response_model=OrgSubscriptionOut)
async def cancel_org_subscription(org_id: str, current_user: CurrentUser):
    """
    Cancel an org's Pro subscription.
    Enterprise can only be cancelled by Finance/SuperAdmin.
    """
    _get_org_or_404(org_id)
    sub = _get_org_sub_or_404(org_id)

    is_finance_admin = current_user.role in _FINANCE_ADMIN
    is_own_org_admin = (
        current_user.role == Role.org_admin and str(current_user.org.id) == org_id
    )

    if not is_finance_admin and not is_own_org_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

    # Enterprise subscriptions are Finance/SuperAdmin-only to cancel
    if sub.plan == SubscriptionPlan.enterprise and not is_finance_admin:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Enterprise subscriptions can only be cancelled by Finance or Super Admin",
        )

    if sub.status == SubscriptionStatus.cancelled:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Subscription already cancelled")

    # Cancel in Paystack if a subscription code exists
    if sub.paystack_subscription_code and sub.paystack_email_token:
        try:
            await paystack_svc.disable_subscription(
                sub.paystack_subscription_code, sub.paystack_email_token
            )
        except Exception as exc:
            logger.warning("Paystack cancel failed", extra={"error": str(exc)})

    sub.status = SubscriptionStatus.cancelled
    sub.touch()
    sub.save()
    logger.info("Org subscription cancelled", extra={"org_id": org_id})
    return _org_sub_out(sub)


@router.put("/orgs/{org_id}", response_model=OrgSubscriptionOut,
            dependencies=[Depends(require_roles(*_FINANCE_ADMIN))])
async def update_org_subscription(
    org_id: str,
    body: OrgSubscriptionManualUpdate,
    current_user: CurrentUser,
):
    """Manual subscription management — Finance/SuperAdmin only."""
    _get_org_or_404(org_id)
    sub = _get_org_sub_or_404(org_id)

    if body.plan is not None:
        sub.plan = body.plan
        if body.seat_limit is None:
            # Auto-set seat limit when plan changes
            limit = SubscriptionPlan.seat_limits.get(body.plan, 50)
            sub.seat_limit = limit if limit is not None else -1
    if body.status is not None:
        sub.status = body.status
    if body.seat_limit is not None:
        sub.seat_limit = body.seat_limit
    if body.billing_cycle is not None:
        sub.billing_cycle = body.billing_cycle
    if body.current_period_start is not None:
        sub.current_period_start = body.current_period_start
    if body.current_period_end is not None:
        sub.current_period_end = body.current_period_end
    if body.note is not None:
        sub.enterprise_note = body.note

    sub.managed_by = str(current_user.id)
    sub.managed_at = datetime.now(timezone.utc)
    sub.touch()
    sub.save()
    logger.info(
        "Org subscription manually updated",
        extra={"org_id": org_id, "by": str(current_user.id)},
    )
    return _org_sub_out(sub)


# ── Student subscriptions ─────────────────────────────────────────────────────

@router.get("/students/me", response_model=StudentSubscriptionOut)
async def get_my_subscription(current_user: CurrentUser):
    """A student retrieves their own subscription."""
    if current_user.role != Role.student:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Students only")
    sub = StudentSubscription.get_by_user(current_user)
    if not sub:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subscription not found")
    return _student_sub_out(sub)


@router.post("/students/me/upgrade", response_model=PaystackInitResponse)
async def upgrade_student_subscription(
    body: StudentUpgradeRequest, current_user: CurrentUser
):
    """
    Initiate a Paystack payment for an individual student Pro subscription.
    Only applicable for students with kind='individual'.
    """
    if current_user.role != Role.student:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Students only")

    sub = StudentSubscription.get_by_user(current_user)
    if sub and sub.kind != StudentSubKind.individual:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Your access is covered by your organization's subscription",
        )
    if sub and sub.plan == "pro" and sub.status == SubscriptionStatus.active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Already on Pro plan")

    plan_code = settings.paystack_student_pro_plan_code
    if not plan_code:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Payment system not configured — contact support",
        )

    try:
        data = await paystack_svc.initialize_transaction(
            email=current_user.email,
            amount=SubscriptionPlan.student_pro_amount,
            callback_url=body.callback_url,
            plan_code=plan_code,
            metadata={
                "user_id": str(current_user.id),
                "type": "student_pro",
                "billing_cycle": body.billing_cycle,
            },
        )
    except Exception as exc:
        logger.error("Paystack init failed", extra={"error": str(exc)})
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Payment gateway error")

    return PaystackInitResponse(
        authorization_url=data["authorization_url"],
        access_code=data["access_code"],
        reference=data["reference"],
    )


@router.post("/students/me/verify", response_model=StudentSubscriptionOut)
async def verify_student_upgrade(reference: str, current_user: CurrentUser):
    """Verify Paystack payment and activate student Pro subscription."""
    if current_user.role != Role.student:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Students only")

    sub = StudentSubscription.get_by_user(current_user)

    try:
        tx = await paystack_svc.verify_transaction(reference)
    except Exception as exc:
        logger.error("Paystack verify failed", extra={"error": str(exc)})
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Payment verification failed")

    if tx.get("status") != "success":
        raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED, "Payment not completed")

    if not sub:
        sub = StudentSubscription(user=current_user, kind=StudentSubKind.individual)

    sub.plan = "pro"
    sub.status = SubscriptionStatus.active
    sub.billing_cycle = "monthly"

    subscription_data = tx.get("subscription", {}) or {}
    if subscription_data.get("subscription_code"):
        sub.paystack_subscription_code = subscription_data["subscription_code"]
        sub.paystack_email_token = subscription_data.get("email_token")

    if tx.get("paid_at"):
        sub.current_period_start = datetime.fromisoformat(
            tx["paid_at"].replace("Z", "+00:00")
        )

    sub.touch()
    sub.save()
    logger.info("Student upgraded to Pro", extra={"user_id": str(current_user.id)})
    return _student_sub_out(sub)


@router.post("/students/me/cancel", response_model=StudentSubscriptionOut)
async def cancel_student_subscription(current_user: CurrentUser):
    """Cancel an individual student's Pro subscription."""
    if current_user.role != Role.student:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Students only")

    sub = StudentSubscription.get_by_user(current_user)
    if not sub:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subscription not found")
    if sub.kind != StudentSubKind.individual:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Your access is managed by your organization",
        )
    if sub.status == SubscriptionStatus.cancelled:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Already cancelled")

    if sub.paystack_subscription_code and sub.paystack_email_token:
        try:
            await paystack_svc.disable_subscription(
                sub.paystack_subscription_code, sub.paystack_email_token
            )
        except Exception as exc:
            logger.warning("Paystack cancel failed", extra={"error": str(exc)})

    sub.status = SubscriptionStatus.cancelled
    sub.touch()
    sub.save()
    return _student_sub_out(sub)


@router.get("/students", response_model=List[StudentSubscriptionOut],
            dependencies=[Depends(require_roles(*_FINANCE_ADMIN))])
async def list_student_subscriptions():
    """Finance/SuperAdmin: list all student subscriptions."""
    subs = StudentSubscription.list_all().select_related()
    return [_student_sub_out(s) for s in subs]


@router.get("/students/{user_id}", response_model=StudentSubscriptionOut)
async def get_student_subscription(
    user_id: str,
    current_user: CurrentUser,
):
    """Finance/SuperAdmin can view any; student can view their own."""
    if current_user.role not in _FINANCE_ADMIN:
        if current_user.role != Role.student or str(current_user.id) != user_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

    sub = StudentSubscription.get_by_user_id(user_id)
    if not sub:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subscription not found")
    return _student_sub_out(sub)


@router.put("/students/{user_id}", response_model=StudentSubscriptionOut,
            dependencies=[Depends(require_roles(*_FINANCE_ADMIN))])
async def update_student_subscription(
    user_id: str,
    body: StudentSubscriptionManualUpdate,
    current_user: CurrentUser,
):
    """Finance/SuperAdmin manual override of a student subscription."""
    sub = StudentSubscription.get_by_user_id(user_id)
    if not sub:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subscription not found")

    if body.plan is not None:
        sub.plan = body.plan
    if body.status is not None:
        sub.status = body.status
    if body.billing_cycle is not None:
        sub.billing_cycle = body.billing_cycle
    if body.current_period_start is not None:
        sub.current_period_start = body.current_period_start
    if body.current_period_end is not None:
        sub.current_period_end = body.current_period_end

    sub.touch()
    sub.save()
    logger.info(
        "Student subscription manually updated",
        extra={"user_id": user_id, "by": str(current_user.id)},
    )
    return _student_sub_out(sub)


# ── Paystack webhook ──────────────────────────────────────────────────────────

@router.post("/webhooks/paystack", status_code=status.HTTP_200_OK)
async def paystack_webhook(request: Request):
    """
    Receives Paystack event webhooks for recurring billing management.
    Handles: charge.success, subscription.disable, invoice.payment_failed.
    """
    payload = await request.body()
    signature = request.headers.get("x-paystack-signature", "")

    if not paystack_svc.verify_webhook_signature(payload, signature):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid signature")

    import json
    try:
        event = json.loads(payload)
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid payload")

    event_type = event.get("event")
    data = event.get("data", {})

    logger.info("Paystack webhook received", extra={"event": event_type})

    if event_type == "charge.success":
        meta = data.get("metadata", {}) or {}
        sub_data = data.get("subscription", {}) or {}
        sub_code = sub_data.get("subscription_code")

        if meta.get("type") == "org_pro" and meta.get("org_id"):
            # Recurring charge for org Pro
            sub = OrgSubscription.get_by_org_id(meta["org_id"])
            if sub:
                sub.plan = SubscriptionPlan.pro
                sub.status = SubscriptionStatus.active
                sub.seat_limit = SubscriptionPlan.seat_limits["pro"]
                if sub_code:
                    sub.paystack_subscription_code = sub_code
                    sub.paystack_email_token = sub_data.get("email_token")
                sub.touch()
                sub.save()

        elif meta.get("type") == "student_pro" and meta.get("user_id"):
            # Recurring charge for student Pro
            sub = StudentSubscription.get_by_user_id(meta["user_id"])
            if sub:
                sub.plan = "pro"
                sub.status = SubscriptionStatus.active
                if sub_code:
                    sub.paystack_subscription_code = sub_code
                    sub.paystack_email_token = sub_data.get("email_token")
                sub.touch()
                sub.save()

    elif event_type == "subscription.disable":
        sub_code = data.get("subscription_code")
        if sub_code:
            # Check org subscriptions
            org_sub = OrgSubscription.get_by_paystack_code(sub_code)
            if org_sub:
                org_sub.status = SubscriptionStatus.cancelled
                org_sub.touch()
                org_sub.save()
                return {"status": "ok"}

            # Check student subscriptions
            student_sub = StudentSubscription.get_by_paystack_code(sub_code)
            if student_sub:
                student_sub.status = SubscriptionStatus.cancelled
                student_sub.touch()
                student_sub.save()

    elif event_type == "invoice.payment_failed":
        sub_code = (data.get("subscription") or {}).get("subscription_code")
        if sub_code:
            org_sub = OrgSubscription.get_by_paystack_code(sub_code)
            if org_sub:
                org_sub.status = SubscriptionStatus.expired
                org_sub.touch()
                org_sub.save()
                return {"status": "ok"}

            student_sub = StudentSubscription.get_by_paystack_code(sub_code)
            if student_sub:
                student_sub.status = SubscriptionStatus.expired
                student_sub.touch()
                student_sub.save()

    return {"status": "ok"}
