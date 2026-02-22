"""Organization CRUD — super_admin only (except GET for own org)."""
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
from app.utils.security import hash_password
from app.cache import cache_get, cache_set, cache_delete
from app.telemetry import get_tracer

router = APIRouter(prefix="/organizations", tags=["organizations"])
logger = logging.getLogger(__name__)
tracer = get_tracer(__name__)


def _org_out(org: Organization) -> OrgOut:
    return OrgOut(**org.to_dict())


@router.get("", response_model=List[OrgOut])
async def list_orgs(current_user: CurrentUser):
    with tracer.start_as_current_span("orgs.list"):
        if current_user.role == "super_admin":
            cached = await cache_get("orgs:list:all")
            if cached:
                return cached
            orgs = Organization.objects()
            result = [_org_out(o).model_dump() for o in orgs]
            await cache_set("orgs:list:all", result, ttl=600)
            return result
        else:
            # Return only own org
            return [_org_out(current_user.org)]


@router.post("", response_model=OrgOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_roles("super_admin"))])
async def create_org(body: OrgCreate):
    slug = re.sub(r"[^a-z0-9]+", "-", body.name.lower()).strip("-")
    base_slug = slug
    counter = 1
    while Organization.objects(slug=slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    org = Organization(name=body.name, slug=slug, type=body.type)
    org.save()
    await cache_delete("orgs:list:all")
    logger.info("Org created", extra={"org_id": str(org.id)})

    admin_temp_password = None
    if body.admin_email:
        if User.objects(email=body.admin_email).first():
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
            role="org_admin",
            org=org,
            avatar=avatar,
        )
        admin_user.save()
        logger.info("Org admin created", extra={"org_id": str(org.id), "email": body.admin_email})

    out = _org_out(org)
    out.admin_temp_password = admin_temp_password
    return out


@router.put("/{org_id}", response_model=OrgOut,
            dependencies=[Depends(require_roles("super_admin"))])
async def update_org(org_id: str, body: OrgUpdate):
    org = Organization.objects(id=org_id).first()
    if not org:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")

    if body.name:
        org.name = body.name
    if body.type:
        org.type = body.type
    org.save()
    await cache_delete("orgs:list:all")
    return _org_out(org)


@router.delete("/{org_id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(require_roles("super_admin"))])
async def delete_org(org_id: str, current_user: CurrentUser):
    org = Organization.objects(id=org_id).first()
    if not org:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")

    if org.type == "platform":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot delete the platform organization")

    # Cascade-delete users and content belonging to this org
    User.objects(org=org).delete()
    Content.objects(org=org).delete()
    org.delete()
    await cache_delete("orgs:list:all")
    logger.info("Org deleted", extra={"org_id": org_id})
