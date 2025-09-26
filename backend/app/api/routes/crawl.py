from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...db import get_db
from ...models import CrawlRun
from ...schemas import CrawlRunItem, CrawlStartRequest, CrawlStartResponse, TaskStatus
from ...services.task_manager import TaskManager

router = APIRouter(prefix="/api/crawl", tags=["crawl"])

task_manager = TaskManager()


@router.post("/start", response_model=CrawlStartResponse)
def start_crawl(payload: CrawlStartRequest) -> CrawlStartResponse:
    if not payload.regions:
        raise HTTPException(status_code=400, detail="必须选择至少一个地区")
    task_id = task_manager.submit(payload.mode, payload.regions)
    return CrawlStartResponse(task_id=task_id)


@router.get("/status/{task_id}", response_model=TaskStatus)
def get_status(task_id: str) -> TaskStatus:
    status = task_manager.get_status(task_id)
    if not status:
        raise HTTPException(status_code=404, detail="任务不存在")
    return status


@router.get("/status", response_model=List[TaskStatus])
def list_status() -> List[TaskStatus]:
    return task_manager.list_status()


@router.get("/runs", response_model=List[CrawlRunItem])
def list_runs(db: Session = Depends(get_db)) -> List[CrawlRunItem]:
    runs = db.scalars(select(CrawlRun).order_by(CrawlRun.started_at.desc())).all()
    items: List[CrawlRunItem] = []
    for run in runs:
        regions = run.region_codes()
        items.append(
            CrawlRunItem(
                id=run.id,
                mode=run.mode,
                regions=regions,
                region_count=len(regions),
                total_items=run.total_items,
                valuable_projects=run.valuable_projects,
                started_at=run.started_at,
                finished_at=run.finished_at,
            )
        )
    return items
