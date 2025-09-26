from __future__ import annotations

from pydantic import BaseModel, Field
from typing import List, Literal, Optional


class StartCrawlRequest(BaseModel):
    mode: Literal["history", "incremental"]
    regions: List[str] = Field(default_factory=list)


class StartCrawlResponse(BaseModel):
    job_id: str
    message: str


class ProjectItem(BaseModel):
    projectuuid: str
    project_name: str
    region_code: str


class ProjectListResponse(BaseModel):
    items: List[ProjectItem]
    total: int
    page: int
    size: int


class ProgressResponse(BaseModel):
    region_code: str
    last_pivot_sendid: Optional[str] = None
    updated_at: Optional[str] = None


class RegionNode(BaseModel):
    id: str
    pId: Optional[str] = None
    name: str

