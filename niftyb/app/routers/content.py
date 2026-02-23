"""Content CRUD + GridFS file upload."""

import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request, status, Depends, UploadFile, File, Query
from fastapi.responses import Response, StreamingResponse

from app.models.content import Content
from app.models.user import User
from app.schemas.content import ContentCreate, ContentUpdate, ContentOut
from app.utils.deps import CurrentUser, StreamUser, require_roles
from app.db import gridfs_put, gridfs_get, gridfs_delete
from app.cache import cache_get, cache_set, cache_delete, cache_delete_pattern
from app.telemetry import get_tracer
from app.constants import Role, ContentScope

router = APIRouter(prefix="/content", tags=["content"])
logger = logging.getLogger(__name__)
tracer = get_tracer(__name__)


def _can_access(content: Content, user: User) -> bool:
    if user.role == Role.super_admin:
        return True
    if content.scope == ContentScope.global_scope:
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
    with tracer.start_as_current_span("content.list"):
        cache_key = f"content:list:{current_user.role}:{current_user.org.id}:{type}:{scope}"
        cached = await cache_get(cache_key)
        if cached:
            return cached

        qs = Content.list_visible_to(current_user)
        if type:
            qs = qs.filter(type=type)
        if scope:
            qs = qs.filter(scope=scope)

        result = [_content_out(c).model_dump() for c in qs.order_by("-created_at").select_related()]
        await cache_set(cache_key, result, ttl=300)
        return result


@router.post("", response_model=ContentOut, status_code=status.HTTP_201_CREATED)
async def create_content(
    body: ContentCreate,
    current_user: User = Depends(require_roles(*Role.creator)),
):
    with tracer.start_as_current_span("content.create") as span:
        span.set_attribute("content.type", body.type)
        span.set_attribute("content.scope", body.scope)

        scope = body.scope
        if scope == ContentScope.global_scope and current_user.role not in Role.global_scope:
            scope = ContentScope.org

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
            Content.increment_views(content_id)
            await cache_delete(f"content:{content_id}")
            return cached

        content = Content.get_by_id(content_id)
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
async def update_content(content_id: str, body: ContentUpdate, current_user: CurrentUser):
    content = Content.get_by_id(content_id)
    if not content:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Content not found")

    if str(content.author.id) != str(current_user.id) and current_user.role not in Role.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorised to edit this content")

    if body.title is not None:
        content.title = body.title
    if body.type is not None:
        content.type = body.type
    if body.scope is not None:
        if body.scope == ContentScope.global_scope and current_user.role not in Role.global_scope:
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
    content = Content.get_by_id(content_id)
    if not content:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Content not found")

    if str(content.author.id) != str(current_user.id) and current_user.role not in Role.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorised")

    if content.file_id:
        gridfs_delete(content.file_id)

    content.delete()
    await cache_delete(f"content:{content_id}")
    await cache_delete_pattern("content:list:*")


@router.post("/{content_id}/upload", response_model=ContentOut)
async def upload_file(
    content_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles(*Role.creator)),
):
    """Upload a file to GridFS and attach it to the content item."""
    with tracer.start_as_current_span("content.upload") as span:
        span.set_attribute("content.id", content_id)
        span.set_attribute("file.content_type", file.content_type or "")

        content = Content.get_by_id(content_id)
        if not content:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Content not found")
        if str(content.author.id) != str(current_user.id) and current_user.role != Role.super_admin:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorised")

        if content.file_id:
            gridfs_delete(content.file_id)

        file_data = await file.read()
        file_id = gridfs_put(file_data, file.filename, file.content_type)

        content.file_id = file_id
        content.file_name = file.filename
        content.file_content_type = file.content_type
        content.updated_at = datetime.now(timezone.utc)
        content.save()

        await cache_delete(f"content:{content_id}")
        await cache_delete_pattern("content:list:*")
        return _content_out(content)


@router.get("/{content_id}/file")
async def stream_file(content_id: str, request: Request, current_user: StreamUser):
    """Stream the GridFS file with HTTP Range support for video/audio playback.

    Accepts authentication via Bearer header or ``?token=`` query param so
    that <video>/<audio> src attributes can point directly to this endpoint.
    """
    content = Content.get_by_id(content_id)
    if not content:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Content not found")
    if not _can_access(content, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")
    if not content.file_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No file attached")

    grid_out = gridfs_get(content.file_id)
    file_size = grid_out.length
    media_type = content.file_content_type or "application/octet-stream"
    disposition = f'inline; filename="{content.file_name}"'

    range_header = request.headers.get("range")
    if range_header:
        try:
            raw = range_header.strip().removeprefix("bytes=")
            start_s, _, end_s = raw.partition("-")
            start = int(start_s) if start_s else 0
            end = int(end_s) if end_s else file_size - 1
            end = min(end, file_size - 1)
        except ValueError:
            raise HTTPException(
                status_code=416,
                detail="Invalid Range header",
                headers={"Content-Range": f"bytes */{file_size}"},
            )

        if start > end or start >= file_size:
            raise HTTPException(
                status_code=416,
                detail="Range Not Satisfiable",
                headers={"Content-Range": f"bytes */{file_size}"},
            )

        length = end - start + 1
        grid_out.seek(start)
        data = grid_out.read(length)
        return Response(
            content=data,
            status_code=206,
            media_type=media_type,
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(length),
                "Content-Disposition": disposition,
            },
        )

    def _iter():
        while chunk := grid_out.read(65536):
            yield chunk

    return StreamingResponse(
        _iter(),
        media_type=media_type,
        headers={
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
            "Content-Disposition": disposition,
        },
    )
