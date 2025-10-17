from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from .api.routes import auth, crawl, logs, parse, projects, regions, users
from .auth import get_password_hash
from .db import Base, SessionLocal, engine
from .migrations import ensure_migrations
from .models import User

Base.metadata.create_all(bind=engine)

with SessionLocal() as _session:
    try:
        ensure_migrations(_session)
    except Exception:
        pass

    stmt = select(User).where(User.username == "admin")
    admin_user = _session.scalar(stmt)
    if not admin_user:
        admin_user = User(
            username="admin",
            password_hash=get_password_hash("imadmin"),
            role="admin",
            is_active=True,
        )
        _session.add(admin_user)
        _session.commit()

app = FastAPI(title="审批管理系统爬取平台 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(regions.router)
app.include_router(crawl.router)
app.include_router(projects.router)
app.include_router(logs.router)
app.include_router(parse.router)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
