from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional


def _strip_nullable(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    return value.strip() or None


@dataclass
class Region:
    id: str
    parent_id: Optional[str]
    name: str

    @classmethod
    def from_dict(cls, payload: dict) -> "Region":
        return cls(
            id=str(payload.get("id", "")).strip(),
            parent_id=_strip_nullable(payload.get("pId")),
            name=str(payload.get("name", "")).strip(),
        )


@dataclass
class ItemSummary:
    deal_code: str
    deal_time: Optional[str]
    project_name: str
    item_name: str
    deal_name: Optional[str]
    dept_name: Optional[str]
    projectuuid: str
    sendid: str

    @classmethod
    def from_dict(cls, payload: dict) -> "ItemSummary":
        return cls(
            deal_code=str(payload.get("deal_code", "")).strip(),
            deal_time=_strip_nullable(payload.get("DEAL_TIME")),
            project_name=str(payload.get("apply_project_name", "")).strip(),
            item_name=str(payload.get("ITEM_NAME", "")).strip(),
            deal_name=_strip_nullable(payload.get("DEAL_NAME")),
            dept_name=_strip_nullable(payload.get("DEPT_NAME")),
            projectuuid=str(payload.get("projectuuid", "")).strip(),
            sendid=str(payload.get("SENDID", "")).strip(),
        )


@dataclass
class ProjectItem:
    item_name: str
    sendid: str
    deal_time: Optional[str]
    dept_name: Optional[str]
    deal_name: Optional[str]
    url: Optional[str]

    @classmethod
    def from_dict(cls, payload: dict) -> "ProjectItem":
        return cls(
            item_name=str(payload.get("item_name", "")).strip(),
            sendid=str(payload.get("sendid", "")).strip(),
            deal_time=_strip_nullable(payload.get("deal_time")),
            dept_name=_strip_nullable(payload.get("dept_name")),
            deal_name=_strip_nullable(payload.get("deal_name")),
            url=_strip_nullable(payload.get("url")),
        )


@dataclass
class ProjectDetail:
    projectuuid: str
    project_name: str
    project_code: Optional[str]
    audit_type: Optional[str]
    project_dept: Optional[str]
    items: List[ProjectItem] = field(default_factory=list)

    @classmethod
    def from_dict(cls, payload: dict) -> "ProjectDetail":
        items_raw = payload.get("itemListInfoVo") or []
        projectuuid = payload.get("projectuuid") or payload.get("PROJECTUUID") or ""
        return cls(
            projectuuid=str(projectuuid).strip(),
            project_name=str(payload.get("apply_project_name", "")).strip(),
            project_code=_strip_nullable(payload.get("deal_code")),
            audit_type=_strip_nullable(payload.get("audit_type")),
            project_dept=_strip_nullable(payload.get("project_dept")),
            items=[ProjectItem.from_dict(item) for item in items_raw],
        )

