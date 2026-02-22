"""Authentication endpoints: login and organization self-registration."""
import re
import logging
from fastapi import APIRouter, HTTPException, status

from app.models.organization import Organization
from app.models.user import User
from app.schemas.user import LoginRequest, RegisterOrgRequest, TokenResponse, UserOut
from app.utils.security import hash_password, verify_password, create_access_token
from app.telemetry import get_tracer

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)
tracer = get_tracer(__name__)


def _user_out(user: User) -> UserOut:
    d = user.to_dict()
    return UserOut(**d)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    with tracer.start_as_current_span("auth.login") as span:
        span.set_attribute("user.email", body.email)

        user = User.objects(email=body.email).first()
        if not user or not verify_password(body.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
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

        if User.objects(email=body.email).first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

        slug = re.sub(r"[^a-z0-9]+", "-", body.org_name.lower()).strip("-")
        # Ensure slug uniqueness
        base_slug = slug
        counter = 1
        while Organization.objects(slug=slug).first():
            slug = f"{base_slug}-{counter}"
            counter += 1

        org = Organization(name=body.org_name, slug=slug, type="school")
        org.save()

        name = f"{body.admin_first} {body.admin_last}".strip()
        avatar = (body.admin_first[0] + (body.admin_last[0] if body.admin_last else "")).upper()

        user = User(
            name=name,
            email=body.email,
            password_hash=hash_password(body.password),
            role="org_admin",
            org=org,
            avatar=avatar,
        )
        user.save()

        token = create_access_token(
            {"sub": str(user.id), "role": user.role, "org": str(org.id)}
        )
        logger.info("New org registered", extra={"org_id": str(org.id), "user_id": str(user.id)})
        return TokenResponse(access_token=token, user=_user_out(user))
