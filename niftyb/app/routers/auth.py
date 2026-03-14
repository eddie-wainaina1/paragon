"""Authentication endpoints: login, organization self-registration, and impersonation."""
import asyncio
import re
import logging
from fastapi import APIRouter, HTTPException, Query, status, Depends
from fastapi.responses import RedirectResponse

from app.models.organization import Organization
from app.models.user import User
from app.schemas.user import (
    LoginRequest, RegisterOrgRequest, RegisterIndividualRequest, TokenResponse, UserOut,
    ForgotPasswordRequest, ResetPasswordRequest,
)
from app.utils.security import (
    hash_password, verify_password, create_access_token,
    create_verification_token, create_password_reset_token,
    decode_token,
)
from app.utils.deps import require_roles
from app.email import send_welcome_email, send_reset_password_email, send_tutor_application_email
from app.telemetry import get_tracer
from app.constants import Role, OrgType
from app.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)
tracer = get_tracer(__name__)


def _user_out(user: User) -> UserOut:
    return UserOut.model_validate(user.to_dict())


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    with tracer.start_as_current_span("auth.login") as span:
        span.set_attribute("user.email", body.email)

        user = User.get_by_email(body.email)
        if not user or not verify_password(body.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        if not user.verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Please verify your email address before logging in",
            )

        token = create_access_token(
            {"sub": str(user.id), "role": user.role, "org": str(user.org.id)}
        )
        logger.info("User logged in", extra={"user_id": str(user.id), "role": user.role})
        span.set_attribute("user.role", user.role)

        return TokenResponse(access_token=token, user=_user_out(user))


@router.post("/register-org", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register_org(body: RegisterOrgRequest):
    with tracer.start_as_current_span("auth.register_org") as span:
        span.set_attribute("org.name", body.org_name)
        span.set_attribute("user.email", body.email)

        if User.get_by_email(body.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

        slug = re.sub(r"[^a-z0-9]+", "-", body.org_name.lower()).strip("-")
        base_slug = slug
        counter = 1
        while Organization.slug_exists(slug):
            slug = f"{base_slug}-{counter}"
            counter += 1

        org = Organization(name=body.org_name, slug=slug, type=OrgType.school)
        org.save()

        name = f"{body.admin_first} {body.admin_last}".strip()
        avatar = (body.admin_first[0] + (body.admin_last[0] if body.admin_last else "")).upper()

        user = User(
            name=name,
            email=body.email,
            password_hash=hash_password(body.password),
            role=Role.org_admin,
            org=org,
            avatar=avatar,
            # verified remains False — user must click the verification link
        )
        user.save()

        verification_token = create_verification_token(str(user.id))
        verification_url = f"{settings.frontend_url}/api/v1/auth/verify-email?token={verification_token}"
        asyncio.create_task(send_welcome_email(user, verification_url))

        token = create_access_token(
            {"sub": str(user.id), "role": user.role, "org": str(org.id)}
        )
        logger.info("New org registered", extra={"org_id": str(org.id), "user_id": str(user.id)})
        return TokenResponse(access_token=token, user=_user_out(user))


@router.post("/register-individual", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register_individual(body: RegisterIndividualRequest):
    with tracer.start_as_current_span("auth.register_individual") as span:
        span.set_attribute("user.email", body.email)

        if User.get_by_email(body.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

        academy = Organization.objects(slug="nifty-academy").first()
        if not academy:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Individual sign-up is not available right now",
            )

        name = f"{body.first_name} {body.last_name}".strip()
        avatar = (body.first_name[0] + (body.last_name[0] if body.last_name else "")).upper()

        user = User(
            name=name,
            email=body.email,
            password_hash=hash_password(body.password),
            role=Role.student,
            org=academy,
            avatar=avatar,
            phone=body.phone if body.apply_as_tutor else None,
            tutor_application_pending=body.apply_as_tutor,
        )
        user.save()

        verification_token = create_verification_token(str(user.id))
        verification_url = f"{settings.frontend_url}/api/v1/auth/verify-email?token={verification_token}"
        asyncio.create_task(send_welcome_email(user, verification_url))

        if body.apply_as_tutor:
            asyncio.create_task(send_tutor_application_email(user, body.phone))

        token = create_access_token(
            {"sub": str(user.id), "role": user.role, "org": str(academy.id)}
        )
        logger.info(
            "Individual registered",
            extra={"user_id": str(user.id), "tutor_application": body.apply_as_tutor},
        )
        return TokenResponse(access_token=token, user=_user_out(user))


@router.get("/verify-email")
async def verify_email(token: str = Query()):
    """
    Consume a one-time JWT verification token.
    On success: marks the user verified and redirects to the frontend.
    On failure: raises HTTP 400 (avoids token enumeration via 404).
    """
    with tracer.start_as_current_span("auth.verify_email"):
        from jose import JWTError

        try:
            payload = decode_token(token)
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification link",
            )

        if payload.get("purpose") != "email_verify":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification link",
            )

        user = User.get_by_id(payload.get("sub", ""))
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification link",
            )

        if user.verified:
            # Already verified — redirect to login rather than error
            return RedirectResponse(
                url=f"{settings.frontend_url}/?verified=already",
                status_code=status.HTTP_302_FOUND,
            )

        user.verified = True
        user.save()
        logger.info("Email verified", extra={"user_id": str(user.id)})

        login_token = create_access_token(
            {"sub": str(user.id), "role": user.role, "org": str(user.org.id)}
        )
        return RedirectResponse(
            url=f"{settings.frontend_url}/?verified=true&token={login_token}",
            status_code=status.HTTP_302_FOUND,
        )


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(body: ForgotPasswordRequest):
    """
    Request a password-reset email.
    Always returns 200 regardless of whether the email exists — prevents user enumeration.
    """
    user = User.get_by_email(body.email)
    if user:
        reset_token = create_password_reset_token(str(user.id))
        reset_url = f"{settings.frontend_url}/reset-password?token={reset_token}"
        asyncio.create_task(send_reset_password_email(user, reset_url))
    return {"message": "If an account with that email exists, a reset link has been sent."}


@router.post("/reset-password", response_model=TokenResponse, status_code=status.HTTP_200_OK)
async def reset_password(body: ResetPasswordRequest):
    """Consume a password-reset JWT, update the user's password, and return a session token."""
    from jose import JWTError

    try:
        payload = decode_token(body.token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset link",
        )

    if payload.get("purpose") != "password_reset":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset link",
        )

    user = User.get_by_id(payload.get("sub", ""))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset link",
        )

    user.password_hash = hash_password(body.new_password)
    user.save()
    logger.info("Password reset", extra={"user_id": str(user.id)})

    token = create_access_token(
        {"sub": str(user.id), "role": user.role, "org": str(user.org.id)}
    )
    return TokenResponse(access_token=token, user=_user_out(user))


@router.post("/impersonate/{user_id}", response_model=TokenResponse)
async def impersonate_user(
    user_id: str,
    current_user: User = Depends(require_roles(Role.super_admin)),
):
    """Allow a super_admin to obtain a token scoped to another user's identity."""
    with tracer.start_as_current_span("auth.impersonate") as span:
        span.set_attribute("impersonator.id", str(current_user.id))
        span.set_attribute("target.id", user_id)

        target = User.get_by_id(user_id)
        if not target:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

        if target.role == Role.super_admin:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Cannot impersonate another super_admin",
            )

        token = create_access_token({
            "sub": str(target.id),
            "role": target.role,
            "org": str(target.org.id),
            "imp": str(current_user.id),
        })
        logger.info(
            "Impersonation started",
            extra={"impersonator": str(current_user.id), "target": str(target.id)},
        )
        return TokenResponse(access_token=token, user=_user_out(target))
