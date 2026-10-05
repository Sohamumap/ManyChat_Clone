import time
from collections import defaultdict, deque

from fastapi import APIRouter, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy import func, select

from app.api.deps import SessionDep, UserDep
from app.config import get_settings
from app.models import User
from app.security import SESSION_COOKIE, create_session_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Simple in-memory brute-force protection (single API process)
MAX_FAILED_LOGINS = 10
FAILED_LOGIN_WINDOW = 15 * 60
_failed_logins: dict[str, deque[float]] = defaultdict(deque)


def _too_many_attempts(ip: str) -> bool:
    attempts = _failed_logins[ip]
    cutoff = time.monotonic() - FAILED_LOGIN_WINDOW
    while attempts and attempts[0] < cutoff:
        attempts.popleft()
    return len(attempts) >= MAX_FAILED_LOGINS


class LoginIn(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    email: str


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str


@router.post("/login", response_model=UserOut)
async def login(body: LoginIn, request: Request, response: Response, session: SessionDep) -> User:
    ip = request.client.host if request.client else "unknown"
    if _too_many_attempts(ip):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, "Too many failed logins. Try again in 15 minutes."
        )
    user = await session.scalar(select(User).where(func.lower(User.email) == body.email.lower()))
    if user is None or not verify_password(body.password, user.password_hash):
        _failed_logins[ip].append(time.monotonic())
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong email or password")
    _failed_logins.pop(ip, None)
    settings = get_settings()
    response.set_cookie(
        SESSION_COOKIE,
        create_session_token(user.id),
        max_age=settings.session_days * 86400,
        httponly=True,
        secure=settings.public_base_url.startswith("https://"),
        samesite="lax",
    )
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE)


@router.get("/me", response_model=UserOut)
async def me(user: UserDep) -> User:
    return user


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(body: ChangePasswordIn, user: UserDep, session: SessionDep) -> None:
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is wrong")
    if len(body.new_password) < 8:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Use at least 8 characters")
    user.password_hash = hash_password(body.new_password)
    await session.commit()
