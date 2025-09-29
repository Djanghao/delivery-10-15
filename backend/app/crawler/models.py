from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Iterable, List, Optional

TARGET_ITEM_NAMES = {
    "企业投资（含外商投资）项目备案（基本建设）",
    "企业投资（含外商投资）项目备案（技术改造）",
    "企业投资（含外商投资）项目核准（基本建设）",
    "企业投资（含外商投资）项目核准（技术改造）",
}


@dataclass
class Region:
    id: str
    name: str
    parent_id: Optional[str]

    @classmethod
    def from_dict(cls, data: dict) -> "Region":
        return cls(id=str(data.get("id")), name=str(data.get("name")), parent_id=data.get("pId"))


@dataclass
class ItemSummary:
    sendid: str
    projectuuid: str
    item_name: str
    deal_time: Optional[datetime]

    @classmethod
    def from_dict(cls, data: dict) -> "ItemSummary":
        deal_time_raw = data.get("DEAL_TIME")
        deal_time = None
        if deal_time_raw:
            deal_time = datetime.fromisoformat(str(deal_time_raw).replace(" ", "T").split(".")[0])
        return cls(
            sendid=str(data.get("SENDID")),
            projectuuid=str(data.get("projectuuid")),
            item_name=str(data.get("ITEM_NAME")),
            deal_time=deal_time,
        )


@dataclass
class ProjectItem:
    sendid: str
    item_name: str
    url: str | None = None

    @classmethod
    def from_dict(cls, data: dict) -> "ProjectItem":
        url = data.get("url")
        return cls(
            sendid=str(data.get("sendid")),
            item_name=str(data.get("item_name")),
            url=(str(url) if url else None),
        )

    def matches_target(self) -> bool:
        return self.item_name in TARGET_ITEM_NAMES


@dataclass
class ProjectDetail:
    projectuuid: str
    project_name: str
    items: List[ProjectItem]

    @classmethod
    def from_dict(cls, data: dict) -> "ProjectDetail":
        raw_items: Iterable[dict] = data.get("itemListInfoVo", [])
        items = [ProjectItem.from_dict(item) for item in raw_items]
        return cls(
            projectuuid=str(data.get("projectuuid", data.get("projectUUID", ""))),
            project_name=str(data.get("apply_project_name", "")),
            items=items,
        )

    def is_target_project(self) -> bool:
        return any(item.matches_target() for item in self.items)
