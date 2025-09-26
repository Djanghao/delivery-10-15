from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class RegionNode(BaseModel):
    id: str
    name: str
    parent_id: Optional[str] = Field(None, alias="pId")
    children: List["RegionNode"] = Field(default_factory=list)

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
    }


class CrawlStartRequest(BaseModel):
    mode: Literal["history", "incremental"]
    regions: List[str]


class CrawlStartResponse(BaseModel):
    task_id: str


class TaskStatus(BaseModel):
    task_id: str
    status: Literal["pending", "running", "succeeded", "failed", "cancelled"]
    message: Optional[str] = None
    # Optional enriched fields for frontend task view
    run_id: Optional[str] = None
    mode: Optional[str] = None
    regions: Optional[List[str]] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None


class ProjectItem(BaseModel):
    projectuuid: str
    project_name: str
    region_code: str
    discovered_at: datetime


class PaginatedProjects(BaseModel):
    items: List[ProjectItem]
    total: int
    page: int
    size: int


class CrawlRunItem(BaseModel):
    id: str
    mode: str
    regions: List[str]
    region_count: int
    total_items: int
    valuable_projects: int
    started_at: datetime
    finished_at: Optional[datetime]


class LogEntry(BaseModel):
    timestamp: datetime
    level: str
    message: str
