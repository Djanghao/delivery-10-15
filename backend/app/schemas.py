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
    parsed_pdf: bool | None = None


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


class DeleteProjectsRequest(BaseModel):
    projectuuids: List[str]


class DeleteByRegionsResponse(BaseModel):
    deleted: int


# Detailed project info
class ProjectFull(BaseModel):
    projectuuid: str
    project_name: str
    region_code: str
    discovered_at: datetime
    parsed_pdf: bool
    parsed_at: datetime | None = None
    pdf_extract: dict | None = None
    pdf_file_path: str | None = None


# Parse endpoints
class ParseDetailItem(BaseModel):
    sendid: str
    item_name: str
    url: str | None = None


class ParseDetailResponse(BaseModel):
    projectuuid: str
    project_name: str
    items: List[ParseDetailItem]


class ParseCaptchaStartRequest(BaseModel):
    projectuuid: str
    sendid: str


class ParseCaptchaStartResponse(BaseModel):
    parse_session_id: str
    captcha_image_base64: str


class ParseCaptchaVerifyRequest(BaseModel):
    parse_session_id: str
    code: str


class ParseCaptchaVerifyResponse(BaseModel):
    ok: bool
    captcha_image_base64: str | None = None


class ParseDownloadRequest(BaseModel):
    parse_session_id: str
    url: str
    projectuuid: str


class ParseDownloadResponse(BaseModel):
    ok: bool
    saved_path: str | None = None
    parsed_fields: dict | None = None
