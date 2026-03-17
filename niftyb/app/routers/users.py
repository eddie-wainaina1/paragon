"""User CRUD endpoints."""

import asyncio
import logging
from typing import List
from fastapi import APIRouter, HTTPException, status, Depends

from app.models.user import User
from app.models.organization import Organization
from app.models.subscription import OrgSubscription, StudentSubscription
from datetime import datetime, timezone
from app.schemas.user import UserCreate, UserUpdate, UserOut, AcceptTermsRequest
from app.utils.security import hash_password, create_verification_token
from app.utils.deps import CurrentUser, require_roles
from app.email import send_welcome_email, send_account_updated_email
from app.config import settings
from app.cache import cache_get, cache_set, cache_delete
from app.telemetry import get_tracer
from app.constants import Role, StudentSubKind

router = APIRouter(prefix="/users", tags=["users"])
logger = logging.getLogger(__name__)
tracer = get_tracer(__name__)


def _check_role_org_compat(role: str, org: Organization) -> None:
    """Raise 403 if a role is incompatible with the org's internal flag."""
    if role in Role.internal and not org.internal:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"Role '{role}' can only be assigned within an internal organization",
        )
    if role not in Role.internal and org.internal:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"Role '{role}' cannot be assigned within an internal organization",
        )


def _user_out(user: User) -> UserOut:
    return UserOut.model_validate(user.to_dict())


@router.get("/me", response_model=UserOut)
async def get_me(current_user: CurrentUser):
    return _user_out(current_user)


@router.put("/me", response_model=UserOut)
async def update_me(body: UserUpdate, current_user: CurrentUser):
    """Allow any authenticated user to update their own profile (name, email, password)."""
    user = User.get_by_id(str(current_user.id))
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    changes: list[str] = []
    original_email = user.email  # capture before any email change

    if body.name:
        changes.append(f"Your display name was updated to \"{body.name}\".")
        user.name = body.name
        user.avatar = "".join(w[0] for w in body.name.split() if w)[:2].upper()
    if body.email:
        if User.email_exists(body.email, exclude_id=str(user.id)):
            raise HTTPException(status.HTTP_409_CONFLICT, "Email already taken")
        changes.append(f"Your email address was updated to \"{body.email}\".")
        user.email = body.email
    if body.password:
        changes.append("Your password was changed.")
        user.password_hash = hash_password(body.password)
    # Role changes are not permitted via self-update

    user.save()
    await cache_delete(f"users:list:{user.org.id}")
    await cache_delete("users:list:all")
    await cache_delete(f"user:{str(user.id)}")

    if changes:
        # Notify original address; use updated name if it changed, otherwise original
        asyncio.create_task(send_account_updated_email(user.name, original_email, changes))

    return _user_out(user)


@router.post("/me/accept-terms", response_model=UserOut)
async def accept_terms(body: AcceptTermsRequest, current_user: CurrentUser):
    """Record that the current user has accepted the Terms of Service."""
    if not body.accept:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You must accept the terms")
    user = User.get_by_id(str(current_user.id))
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    user.terms_accepted_at = datetime.now(timezone.utc)
    user.save()
    await cache_delete(f"users:list:{user.org.id}")
    await cache_delete("users:list:all")
    return _user_out(user)


@router.get("", response_model=List[UserOut])
async def list_users(current_user: User = Depends(require_roles(*Role.admin))):
    with tracer.start_as_current_span("users.list"):
        cache_key = f"users:list:{current_user.org.id}"
        if current_user.role == Role.super_admin:
            cache_key = "users:list:all"

        cached = await cache_get(cache_key)
        if cached:
            return cached

        if current_user.role == Role.super_admin:
            users = User.list_all()
        else:
            users = User.list_by_org(current_user.org)

        result = [_user_out(u).model_dump() for u in users.select_related()]
        await cache_set(cache_key, result, ttl=300)
        return result


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    current_user: User = Depends(require_roles(*Role.admin)),
):
    with tracer.start_as_current_span("users.create") as span:
        span.set_attribute("user.email", body.email)

        if User.get_by_email(body.email):
            raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

        org = Organization.get_by_id(body.org_id)
        if not org:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")

        # org_admin can only add users to their own org
        if current_user.role == Role.org_admin and str(org.id) != str(current_user.org.id):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Cannot add users to another org"
            )

        # org_admin cannot create internal-only roles
        if current_user.role == Role.org_admin and body.role in Role.internal:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Insufficient permissions for that role"
            )

        # Enforce internal org ↔ role compatibility
        _check_role_org_compat(body.role, org)

        # Seat enforcement: check org subscription capacity before adding a student
        if body.role == Role.student:
            org_sub = OrgSubscription.get_by_org(org)
            if org_sub and not org_sub.has_available_seat():
                from app.constants import SubscriptionPlan
                limit = org_sub.seat_limit
                raise HTTPException(
                    status.HTTP_402_PAYMENT_REQUIRED,
                    f"Seat limit reached ({limit} students). Upgrade your plan to add more students.",
                )

        av = "".join(w[0] for w in body.name.split() if w)[:2].upper()
        user = User(
            name=body.name,
            email=body.email,
            password_hash=hash_password(body.password),
            role=body.role,
            org=org,
            avatar=av,
        )
        user.save()

        # Create StudentSubscription and update seat count
        if body.role == Role.student:
            org_sub = OrgSubscription.get_by_org(org)
            # Determine if this is an individual student (nifty-academy) or org-covered
            is_individual = org.slug == "nifty-academy"
            StudentSubscription(
                user=user,
                kind=StudentSubKind.individual if is_individual else StudentSubKind.org_covered,
            ).save()
            if org_sub:
                org_sub.seat_used = (org_sub.seat_used or 0) + 1
                org_sub.touch()
                org_sub.save()

        verification_token = create_verification_token(str(user.id))
        verification_url = f"{settings.frontend_url}/api/v1/auth/verify-email?token={verification_token}"
        asyncio.create_task(send_welcome_email(user, verification_url))

        await cache_delete(f"users:list:{org.id}")
        await cache_delete("users:list:all")
        logger.info("User created", extra={"user_id": str(user.id)})
        return _user_out(user)


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: str,
    current_user: User = Depends(require_roles(*Role.admin)),
):
    user = User.get_by_id(user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if current_user.role == Role.org_admin and str(user.org.id) != str(current_user.org.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cannot view user from another org")
    return _user_out(user)


@router.put("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: str,
    body: UserUpdate,
    current_user: User = Depends(require_roles(*Role.admin)),
):
    user = User.get_by_id(user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    if current_user.role == Role.org_admin and str(user.org.id) != str(current_user.org.id):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Cannot modify user from another org"
        )

    if current_user.role == Role.org_admin and body.role in Role.internal:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Insufficient permissions for that role"
        )

    changes: list[str] = []
    original_name = user.name
    original_email = user.email  # capture before any email change

    if body.name:
        changes.append(f"Your display name was updated to \"{body.name}\".")
        user.name = body.name
        user.avatar = "".join(w[0] for w in body.name.split() if w)[:2].upper()
    if body.email:
        if User.email_exists(body.email, exclude_id=user_id):
            raise HTTPException(status.HTTP_409_CONFLICT, "Email already taken")
        changes.append(f"Your email address was updated to \"{body.email}\".")
        user.email = body.email
    if body.password:
        changes.append("Your password was changed.")
        user.password_hash = hash_password(body.password)
    if body.role:
        _check_role_org_compat(body.role, user.org)
        changes.append(f"Your account role was changed to \"{body.role}\".")
        user.role = body.role
        user.tutor_application_pending = False  # clear pending flag on any role change

    user.save()
    await cache_delete(f"users:list:{user.org.id}")
    await cache_delete("users:list:all")
    await cache_delete(f"user:{user_id}")

    if changes:
        asyncio.create_task(send_account_updated_email(original_name, original_email, changes))

    return _user_out(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    current_user: User = Depends(require_roles(*Role.admin)),
):
    user = User.get_by_id(user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    if str(user.id) == str(current_user.id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot delete yourself")

    if current_user.role == Role.org_admin and str(user.org.id) != str(current_user.org.id):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Cannot delete user from another org"
        )

    org_id = str(user.org.id)
    is_student = user.role == Role.student

    # Clean up student subscription and decrement seat count before deleting user
    if is_student:
        org_sub = OrgSubscription.get_by_org(user.org)
        StudentSubscription.objects(user=user).delete()
        if org_sub and org_sub.seat_used > 0:
            org_sub.seat_used -= 1
            org_sub.touch()
            org_sub.save()

    user.delete()
    await cache_delete(f"users:list:{org_id}")
    await cache_delete("users:list:all")
    await cache_delete(f"user:{user_id}")
