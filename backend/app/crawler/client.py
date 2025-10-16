from __future__ import annotations

import json
import logging
from dataclasses import dataclass
import math
from typing import Iterable, List, Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from .models import ItemSummary, ProjectDetail, Region

logger = logging.getLogger(__name__)


DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Origin": "https://tzxm.zjzwfw.gov.cn",
    "Referer": "https://tzxm.zjzwfw.gov.cn/tzxmweb/zwtpages/resultsPublicity/notice_of_publicity_new.html",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
}


@dataclass
class ItemPage:
    items: List[ItemSummary]
    total_pages: int


class PublicAnnouncementClient:
    BASE_URL = "https://tzxm.zjzwfw.gov.cn/publicannouncement.do"
    PAGE_SIZE = 10  # 官方接口每页固定返回 10 条

    def __init__(self, timeout: float = 30.0, headers: Optional[dict] = None) -> None:
        self.timeout = timeout
        self.headers = dict(DEFAULT_HEADERS)
        if headers:
            self.headers.update(headers)

    def _post(self, params: dict, data: Optional[dict] = None) -> list:
        query = urlencode(params)
        url = f"{self.BASE_URL}?{query}" if query else self.BASE_URL
        encoded_data = urlencode(data).encode("utf-8") if data else None
        request = Request(url, data=encoded_data, headers=self.headers, method="POST")
        try:
            with urlopen(request, timeout=self.timeout) as response:
                raw = response.read()
                content_type = response.headers.get("Content-Type", "")
        except HTTPError as exc:
            logger.error("HTTP error %s for %s", exc.code, url)
            raise
        except URLError as exc:
            logger.error("Network error for %s: %s", url, exc.reason)
            raise

        text = raw.decode("utf-8", errors="replace")
        if content_type.startswith("application/json"):
            return json.loads(text)
        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            logger.error("Failed to parse JSON response: %s", text[:200])
            raise ValueError("Unexpected response format") from exc

    def get_regions(self) -> List[Region]:
        payload = self._post({"method": "getxzTreeNodes"})
        return [Region.from_dict(item) for item in payload]

    def get_item_page(self, area_code: str, page_no: int) -> ItemPage:
        # 接口 pageNo 实测支持从 0 开始（0..N-1）。
        # 保持与服务层一致传入的页码语义（不强行更改）。
        data = {
            "pageFlag": "",
            "pageNo": str(page_no),
            "area_code": str(area_code),
            "area_flag": "0",
            "deal_code": "",
            "item_name": "",
        }
        payload = self._post({"method": "itemList"}, data=data)
        if not payload:
            raise ValueError("Empty response when requesting item list")
        content = payload[0]
        raw_items: Iterable[dict] = content.get("itemList", [])
        # 注意：接口返回的 counts 实际是总记录数，而非总页数
        total_count = int(content.get("counts") or 0)
        # 官方一页 10 条，计算总页数（至少为 1，当 total_count>0）
        total_pages = math.ceil(total_count / self.PAGE_SIZE) if total_count > 0 else 0
        items = [ItemSummary.from_dict(item) for item in raw_items]
        return ItemPage(items=items, total_pages=total_pages)

    def get_project_detail(self, projectuuid: str) -> Optional[ProjectDetail]:
        params = {"method": "projectDetail", "projectuuid": projectuuid}
        payload = self._post(params)
        if not payload:
            return None
        return ProjectDetail.from_dict(payload[0])

    def close(self) -> None:
        return None


__all__ = ["PublicAnnouncementClient", "ItemPage"]
