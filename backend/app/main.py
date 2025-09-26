from __future__ import annotations

import csv
import io
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse, StreamingResponse

from .crawler.client import PublicAnnouncementClient
from .db import get_conn, get_progress, init_db, list_projects, region_project_count
from .schemas import (
    ProgressResponse,
    ProjectItem,
    ProjectListResponse,
    RegionNode,
    StartCrawlRequest,
    StartCrawlResponse,
)
from .services import task_manager


app = FastAPI(title="审批管理系统爬取平台 API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/api/regions", response_model=list[RegionNode])
def api_regions() -> list[RegionNode]:
    client = PublicAnnouncementClient()
    try:
        nodes = client.get_regions()
        return [RegionNode(id=n.id, pId=n.parent_id, name=n.name) for n in nodes]
    finally:
        client.close()


@app.post("/api/crawl/start", response_model=StartCrawlResponse)
def api_crawl_start(payload: StartCrawlRequest) -> StartCrawlResponse:
    if not payload.regions:
        raise HTTPException(400, "必须选择至少一个地区")
    job_id = task_manager.start(payload.mode, payload.regions)
    return StartCrawlResponse(job_id=job_id, message="任务已启动")


@app.get("/api/crawl/logs")
def api_crawl_logs(job_id: str = Query(..., description="任务ID")) -> PlainTextResponse:
    logs = task_manager.get_logs(job_id)
    return PlainTextResponse(logs)


@app.get("/api/progress/{region}", response_model=ProgressResponse)
def api_progress(region: str) -> ProgressResponse:
    row = get_progress(region)
    if not row:
        return ProgressResponse(region_code=region)
    return ProgressResponse(**row)


@app.get("/api/projects", response_model=ProjectListResponse)
def api_projects(
    region: Optional[str] = None,
    page: int = 1,
    size: int = 20,
) -> ProjectListResponse:
    page = max(1, page)
    size = min(100, max(1, size))
    offset = (page - 1) * size
    items, total = list_projects(region, offset, size)
    return ProjectListResponse(
        items=[ProjectItem(**it) for it in items], total=total, page=page, size=size
    )


@app.get("/api/projects/export")
def api_projects_export(region: Optional[str] = None):
    items, _ = list_projects(region, 0, 100000)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["projectuuid", "project_name", "region_code"]) 
    for it in items:
        writer.writerow([it["projectuuid"], it["project_name"], it["region_code"]])
    buf.seek(0)
    headers = {
        "Content-Disposition": "attachment; filename=valuable_projects.csv",
        "Content-Type": "text/csv; charset=utf-8",
    }
    return StreamingResponse(buf, headers=headers, media_type="text/csv")


@app.get("/api/metrics/regions")
def api_region_metrics():
    return JSONResponse(region_project_count())

