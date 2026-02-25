"""Password hashing and JWT utilities."""

from datetime import datetime, timedelta, timezone
from hashlib import sha256
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _hash_password_for_bcrypt(password: str) -> str:
    """Pre-hash password with SHA-256 to handle long passwords.

    Bcrypt has a 72-byte limit, so we use SHA-256 to create a fixed-length digest
    that's then passed to bcrypt. This avoids truncation issues while staying
    well under the 72-byte limit (SHA-256 produces 64 hex chars = 64 bytes).
    """
    return sha256(password.encode("utf-8")).hexdigest()


def hash_password(password: str) -> str:
    """Hash a password using SHA-256 pre-hashing + bcrypt."""
    prehash = _hash_password_for_bcrypt(password)
    return pwd_context.hash(prehash)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain password against a bcrypt hash."""
    prehash = _hash_password_for_bcrypt(plain)
    return pwd_context.verify(prehash, hashed)


def create_access_token(data: dict[str, Any]) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    payload["exp"] = expire
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])


def create_verification_token(user_id: str) -> str:
    """Create a short-lived JWT for email verification (72-hour expiry)."""
    payload = {
        "sub": user_id,
        "purpose": "email_verify",
        "exp": datetime.now(timezone.utc) + timedelta(hours=72),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def create_password_reset_token(user_id: str) -> str:
    """Create a short-lived JWT for password reset (1-hour expiry)."""
    payload = {
        "sub": user_id,
        "purpose": "password_reset",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)
