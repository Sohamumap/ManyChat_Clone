from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import IGAccount, User
from app.security import SESSION_COOKIE, decode_session_token

SessionDep = Annotated[AsyncSession, Depends(get_session)]


async def current_user(
    session: SessionDep,
    token: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> User:
    user_id = decode_session_token(token) if token else None
    user = await session.get(User, user_id) if user_id else None
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not logged in")
    return user


UserDep = Annotated[User, Depends(current_user)]


async def get_account_or_404(session: AsyncSession, account_id: int) -> IGAccount:
    account = await session.get(IGAccount, account_id)
    if account is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Instagram account not found")
    return account
