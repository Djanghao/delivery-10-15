from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import crawl, logs, projects, regions
from .db import Base, engine

Base.metadata.create_all(bind=engine)

app = FastAPI(title="审批管理系统爬取平台 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"]
    ,
    allow_headers=["*"],
)

app.include_router(regions.router)
app.include_router(crawl.router)
app.include_router(projects.router)
app.include_router(logs.router)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
