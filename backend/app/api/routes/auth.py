from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...auth import create_access_token, get_current_user, get_password_hash, verify_password
from ...db import get_db
from ...models import User
from ...schemas import ChangePasswordRequest, LoginRequest, LoginResponse, UserInfo

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)) -> LoginResponse:
    stmt = select(User).where(User.username == payload.username)
    user = db.scalar(stmt)

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled. No permission to access.")

    token = create_access_token(data={"sub": user.username})
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        max_age=86400,
        samesite="lax",
    )

    return LoginResponse(username=user.username, role=user.role)


@router.post("/logout")
def logout(response: Response) -> dict[str, str]:
    response.delete_cookie(key="access_token")
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserInfo)
def get_me(current_user: User = Depends(get_current_user)) -> UserInfo:
    return UserInfo(
        id=current_user.id,
        username=current_user.username,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
    )


@router.post("/change-password", response_model=UserInfo)
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserInfo:
    if not verify_password(payload.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Old password is incorrect")

    current_user.password_hash = get_password_hash(payload.new_password)
    db.commit()
    db.refresh(current_user)

    return UserInfo(
        id=current_user.id,
        username=current_user.username,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
    )
