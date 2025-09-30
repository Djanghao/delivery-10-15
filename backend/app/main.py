from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import crawl, logs, projects, regions, parse
from .db import Base, engine, SessionLocal
from .migrations import ensure_migrations

Base.metadata.create_all(bind=engine)

# Run lightweight migrations on startup
with SessionLocal() as _session:
    try:
        ensure_migrations(_session)
    except Exception:
        # Do not block app startup; migrations are best-effort.
        pass

app = FastAPI(title="审批管理系统爬取平台 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(regions.router)
app.include_router(crawl.router)
app.include_router(projects.router)
app.include_router(logs.router)
app.include_router(parse.router)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
