"""Content CRUD + GridFS file upload."""
import logging
from datetime import datetime, timezone
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Query
from fastapi.responses import StreamingResponse

from app.models.content import Content
from app.models.user import User
from app.schemas.content import ContentCreate, ContentUpdate, ContentOut
from app.utils.deps import CurrentUser, require_roles
from app.db import get_gridfs
from app.cache import cache_get, cache_set, cache_delete, cache_delete_pattern
from app.telemetry import get_tracer

router = APIRouter(prefix="/content", tags=["content"])
logger = logging.getLogger(__name__)
tracer = get_tracer(__name__)

CREATOR_ROLES = ("super_admin", "tutor", "org_admin", "teacher")


def _can_access(content: Content, user: User) -> bool:
    if user.role == "super_admin":
        return True
    if content.scope == "global":
        return True
    return str(content.org.id) == str(user.org.id)


def _content_out(c: Content) -> ContentOut:
    return ContentOut(**c.to_dict())


@router.get("", response_model=List[ContentOut])
async def list_content(
    current_user: CurrentUser,
    type: Optional[str] = Query(None),
    scope: Optional[str] = Query(None),
):
    with tracer.start_as_current_span("content.list") as span:
        cache_key = f"content:list:{current_user.role}:{current_user.org.id}:{type}:{scope}"
        cached = await cache_get(cache_key)
        if cached:
            return cached

        qs = Content.objects().select_related()
        if current_user.role != "super_admin":
            from mongoengine.queryset.visitor import Q
            qs = qs.filter(Q(scope="global") | Q(org=current_user.org))

        if type:
            qs = qs.filter(type=type)
        if scope:
            qs = qs.filter(scope=scope)

        result = [_content_out(c).model_dump() for c in qs.order_by("-created_at")]
        await cache_set(cache_key, result, ttl=300)
        return result


@router.post("", response_model=ContentOut, status_code=status.HTTP_201_CREATED)
async def create_content(
    body: ContentCreate,
    current_user: User = Depends(require_roles(*CREATOR_ROLES)),
):
    with tracer.start_as_current_span("content.create") as span:
        span.set_attribute("content.type", body.type)
        span.set_attribute("content.scope", body.scope)

        # Only super_admin/tutor can set global scope
        scope = body.scope
        if scope == "global" and current_user.role not in ("super_admin", "tutor"):
            scope = "org"

        content = Content(
            title=body.title,
            type=body.type,
            scope=scope,
            org=current_user.org,
            author=current_user,
            subject=body.subject,
            body=body.body,
            emoji=body.emoji,
        )
        content.save()
        await cache_delete_pattern("content:list:*")
        logger.info("Content created", extra={"content_id": str(content.id)})
        return _content_out(content)


@router.get("/{content_id}", response_model=ContentOut)
async def get_content(content_id: str, current_user: CurrentUser):
    with tracer.start_as_current_span("content.get") as span:
        span.set_attribute("content.id", content_id)

        cached = await cache_get(f"content:{content_id}")
        if cached:
            # Increment view in background
            Content.objects(id=content_id).update_one(inc__views=1)
            await cache_delete(f"content:{content_id}")
            return cached

        content = Content.objects(id=content_id).select_related().first()
        if not content:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Content not found")
        if not _can_access(content, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

        content.views += 1
        content.save()
        result = _content_out(content).model_dump()
        await cache_set(f"content:{content_id}", result, ttl=300)
        return result


@router.put("/{content_id}", response_model=ContentOut)
async def update_content(
    content_id: str,
    body: ContentUpdate,
    current_user: CurrentUser,
):
    content = Content.objects(id=content_id).select_related().first()
    if not content:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Content not found")

    # Only author or admin can edit
    if str(content.author.id) != str(current_user.id) and current_user.role not in (
        "super_admin",
        "org_admin",
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorised to edit this content")

    if body.title is not None:
        content.title = body.title
    if body.type is not None:
        content.type = body.type
    if body.scope is not None:
        if body.scope == "global" and current_user.role not in ("super_admin", "tutor"):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Cannot set global scope")
        content.scope = body.scope
    if body.subject is not None:
        content.subject = body.subject
    if body.body is not None:
        content.body = body.body
    if body.locked is not None:
        content.locked = body.locked
    if body.emoji is not None:
        content.emoji = body.emoji

    content.updated_at = datetime.now(timezone.utc)
    content.save()
    await cache_delete(f"content:{content_id}")
    await cache_delete_pattern("content:list:*")
    return _content_out(content)


@router.delete("/{content_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_content(content_id: str, current_user: CurrentUser):
    content = Content.objects(id=content_id).select_related().first()
    if not content:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Content not found")

    if str(content.author.id) != str(current_user.id) and current_user.role not in (
        "super_admin",
        "org_admin",
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorised")

    # Remove GridFS file if present
    if content.file_id:
        fs = get_gridfs()
        try:
            fs.delete(content.file_id)
        except Exception:
            pass

    content.delete()
    await cache_delete(f"content:{content_id}")
    await cache_delete_pattern("content:list:*")


@router.post("/{content_id}/upload", response_model=ContentOut)
async def upload_file(
    content_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles(*CREATOR_ROLES)),
):
    """Upload a file to GridFS and attach it to the content item."""
    with tracer.start_as_current_span("content.upload") as span:
        span.set_attribute("content.id", content_id)
        span.set_attribute("file.content_type", file.content_type or "")

        content = Content.objects(id=content_id).select_related().first()
        if not content:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Content not found")
        if str(content.author.id) != str(current_user.id) and current_user.role != "super_admin":
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorised")

        fs = get_gridfs()

        # Remove previous file if exists
        if content.file_id:
            try:
                fs.delete(content.file_id)
            except Exception:
                pass

        file_data = await file.read()
        file_id = fs.put(
            file_data,
            filename=file.filename,
            content_type=file.content_type,
        )

        content.file_id = file_id
        content.file_name = file.filename
        content.file_content_type = file.content_type
        content.updated_at = datetime.now(timezone.utc)
        content.save()

        await cache_delete(f"content:{content_id}")
        await cache_delete_pattern("content:list:*")
        return _content_out(content)


@router.get("/{content_id}/file")
async def download_file(content_id: str, current_user: CurrentUser):
    """Stream the GridFS file attached to a content item."""
    content = Content.objects(id=content_id).select_related().first()
    if not content:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Content not found")
    if not _can_access(content, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")
    if not content.file_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No file attached")

    fs = get_gridfs()
    grid_out = fs.get(content.file_id)

    def _iter():
        while chunk := grid_out.read(65536):
            yield chunk

    return StreamingResponse(
        _iter(),
        media_type=content.file_content_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{content.file_name}"'},
    )
