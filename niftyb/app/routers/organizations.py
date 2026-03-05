"""Organization CRUD — super_admin only (except GET for own org)."""
import asyncio
import re
import secrets
import logging
from typing import List
from fastapi import APIRouter, HTTPException, status, Depends

from app.models.organization import Organization
from app.models.user import User
from app.models.content import Content
from app.schemas.organization import OrgCreate, OrgUpdate, OrgOut
from app.utils.deps import CurrentUser, require_roles
from app.utils.security import hash_password, create_verification_token
from app.email import send_invite_email
from app.cache import cache_get, cache_set, cache_delete
from app.telemetry import get_tracer
from app.constants import Role, OrgType
from app.config import settings

router = APIRouter(prefix="/organizations", tags=["organizations"])
logger = logging.getLogger(__name__)
tracer = get_tracer(__name__)


def _org_out(org: Organization) -> OrgOut:
    return OrgOut.model_validate(org.to_dict())


@router.get("", response_model=List[OrgOut])
async def list_orgs(current_user: CurrentUser):
    with tracer.start_as_current_span("orgs.list"):
        if current_user.role == Role.super_admin:
            cached = await cache_get("orgs:list:all")
            if cached:
                return cached
            orgs = Organization.list_all()
            result = [_org_out(o).model_dump() for o in orgs]
            await cache_set("orgs:list:all", result, ttl=600)
            return result
        else:
            # Return only own org
            return [_org_out(current_user.org)]


@router.post("", response_model=OrgOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_roles(Role.super_admin))])
async def create_org(body: OrgCreate):
    slug = re.sub(r"[^a-z0-9]+", "-", body.name.lower()).strip("-")
    base_slug = slug
    counter = 1
    while Organization.slug_exists(slug):
        slug = f"{base_slug}-{counter}"
        counter += 1

    org = Organization(name=body.name, slug=slug, type=body.type, internal=body.internal)
    org.save()
    await cache_delete("orgs:list:all")
    logger.info("Org created", extra={"org_id": str(org.id)})

    if body.admin_email:
        if User.get_by_email(body.admin_email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Email {body.admin_email} is already registered",
            )
        admin_temp_password = secrets.token_urlsafe(12)
        admin_name = f"Admin · {body.name}"
        avatar = (admin_name[0] + (admin_name.split()[-1][0] if len(admin_name.split()) > 1 else "")).upper()
        admin_user = User(
            name=admin_name,
            email=body.admin_email,
            password_hash=hash_password(admin_temp_password),
            role=Role.org_admin,
            org=org,
            avatar=avatar,
            # verified remains False — admin must click the invite link
        )
        admin_user.save()

        verification_token = create_verification_token(str(admin_user.id))
        verification_url = f"{settings.frontend_url}/api/v1/auth/verify-email?token={verification_token}"
        asyncio.create_task(send_invite_email(admin_user, admin_temp_password, verification_url))
        logger.info("Org admin created", extra={"org_id": str(org.id), "email": body.admin_email})

    return _org_out(org)


@router.put("/{org_id}", response_model=OrgOut,
            dependencies=[Depends(require_roles(Role.super_admin))])
async def update_org(org_id: str, body: OrgUpdate):
    org = Organization.get_by_id(org_id)
    if not org:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")

    if body.name:
        org.name = body.name
    if body.type:
        org.type = body.type
    if body.internal is not None:
        org.internal = body.internal
    org.save()
    await cache_delete("orgs:list:all")
    return _org_out(org)


@router.delete("/{org_id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(require_roles(Role.super_admin))])
async def delete_org(org_id: str, current_user: CurrentUser):
    org = Organization.get_by_id(org_id)
    if not org:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")

    if org.internal:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot delete an internal organization")

    # Cascade-delete users and content belonging to this org
    User.delete_by_org(org)
    Content.delete_by_org(org)
    org.delete()
    await cache_delete("orgs:list:all")
    logger.info("Org deleted", extra={"org_id": org_id})
