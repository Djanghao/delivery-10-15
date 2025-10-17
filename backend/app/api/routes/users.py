from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...auth import get_admin_user, get_password_hash
from ...db import get_db
from ...models import User
from ...schemas import CreateUserRequest, ResetPasswordRequest, UpdateUserRequest, UserInfo

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=List[UserInfo])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> List[UserInfo]:
    stmt = select(User).order_by(User.created_at.desc())
    users = db.scalars(stmt).all()
    return [
        UserInfo(
            id=user.id,
            username=user.username,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at,
        )
        for user in users
    ]


@router.post("", response_model=UserInfo, status_code=201)
def create_user(
    payload: CreateUserRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> UserInfo:
    stmt = select(User).where(User.username == payload.username)
    existing_user = db.scalar(stmt)
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")

    new_user = User(
        username=payload.username,
        password_hash=get_password_hash(payload.password),
        role=payload.role,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return UserInfo(
        id=new_user.id,
        username=new_user.username,
        role=new_user.role,
        is_active=new_user.is_active,
        created_at=new_user.created_at,
    )


@router.patch("/{user_id}", response_model=UserInfo)
def update_user(
    user_id: int,
    payload: UpdateUserRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> UserInfo:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.username == "admin":
        raise HTTPException(status_code=400, detail="Cannot modify admin user")

    user.is_active = payload.is_active
    db.commit()
    db.refresh(user)

    return UserInfo(
        id=user.id,
        username=user.username,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
    )


@router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> Response:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.username == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete admin user")

    db.delete(user)
    db.commit()
    return Response(status_code=204)


@router.post("/{user_id}/reset-password", response_model=UserInfo)
def reset_user_password(
    user_id: int,
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> UserInfo:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = get_password_hash(payload.new_password)
    db.commit()
    db.refresh(user)

    return UserInfo(
        id=user.id,
        username=user.username,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
    )
