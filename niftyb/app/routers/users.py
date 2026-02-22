"""User CRUD endpoints."""
import logging
from typing import List
from fastapi import APIRouter, HTTPException, status, Depends

from app.models.user import User
from app.models.organization import Organization
from app.schemas.user import UserCreate, UserUpdate, UserOut
from app.utils.security import hash_password
from app.utils.deps import CurrentUser, require_roles
from app.cache import cache_get, cache_set, cache_delete
from app.telemetry import get_tracer

router = APIRouter(prefix="/users", tags=["users"])
logger = logging.getLogger(__name__)
tracer = get_tracer(__name__)


def _user_out(user: User) -> UserOut:
    return UserOut(**user.to_dict())


@router.get("/me", response_model=UserOut)
async def get_me(current_user: CurrentUser):
    return _user_out(current_user)


@router.put("/me", response_model=UserOut)
async def update_me(body: UserUpdate, current_user: CurrentUser):
    """Allow any authenticated user to update their own profile (name, email, password)."""
    user = User.objects(id=current_user.id).first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    if body.name:
        user.name = body.name
        user.avatar = "".join(w[0] for w in body.name.split() if w)[:2].upper()
    if body.email:
        if User.objects(email=body.email, id__ne=user.id).first():
            raise HTTPException(status.HTTP_409_CONFLICT, "Email already taken")
        user.email = body.email
    if body.password:
        user.password_hash = hash_password(body.password)
    # Role changes are not permitted via self-update

    user.save()
    await cache_delete(f"users:list:{user.org.id}")
    await cache_delete("users:list:all")
    await cache_delete(f"user:{str(user.id)}")
    return _user_out(user)


@router.get("", response_model=List[UserOut])
async def list_users(current_user: CurrentUser):
    with tracer.start_as_current_span("users.list"):
        cache_key = f"users:list:{current_user.org.id}"
        if current_user.role == "super_admin":
            cache_key = "users:list:all"

        cached = await cache_get(cache_key)
        if cached:
            return cached

        if current_user.role == "super_admin":
            users = User.objects().select_related()
        else:
            users = User.objects(org=current_user.org).select_related()

        result = [_user_out(u).model_dump() for u in users]
        await cache_set(cache_key, result, ttl=300)
        return result


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    current_user: User = Depends(require_roles("super_admin", "org_admin")),
):
    with tracer.start_as_current_span("users.create") as span:
        span.set_attribute("user.email", body.email)

        if User.objects(email=body.email).first():
            raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

        org = Organization.objects(id=body.org_id).first()
        if not org:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")

        # org_admin can only add users to their own org
        if current_user.role == "org_admin" and str(org.id) != str(current_user.org.id):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Cannot add users to another org")

        # org_admin cannot create super_admin / tutor / finance
        if current_user.role == "org_admin" and body.role in ("super_admin", "tutor", "finance"):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions for that role")

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
        await cache_delete(f"users:list:{org.id}")
        await cache_delete("users:list:all")
        logger.info("User created", extra={"user_id": str(user.id)})
        return _user_out(user)


@router.put("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: str,
    body: UserUpdate,
    current_user: User = Depends(require_roles("super_admin", "org_admin")),
):
    user = User.objects(id=user_id).first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    if current_user.role == "org_admin" and str(user.org.id) != str(current_user.org.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cannot modify user from another org")

    if body.name:
        user.name = body.name
        user.avatar = "".join(w[0] for w in body.name.split() if w)[:2].upper()
    if body.email:
        if User.objects(email=body.email, id__ne=user.id).first():
            raise HTTPException(status.HTTP_409_CONFLICT, "Email already taken")
        user.email = body.email
    if body.password:
        user.password_hash = hash_password(body.password)
    if body.role:
        user.role = body.role

    user.save()
    await cache_delete(f"users:list:{user.org.id}")
    await cache_delete("users:list:all")
    await cache_delete(f"user:{user_id}")
    return _user_out(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    current_user: User = Depends(require_roles("super_admin", "org_admin")),
):
    user = User.objects(id=user_id).first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    if str(user.id) == str(current_user.id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot delete yourself")

    if current_user.role == "org_admin" and str(user.org.id) != str(current_user.org.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cannot delete user from another org")

    org_id = str(user.org.id)
    user.delete()
    await cache_delete(f"users:list:{org_id}")
    await cache_delete("users:list:all")
    await cache_delete(f"user:{user_id}")
