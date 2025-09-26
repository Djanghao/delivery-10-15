from __future__ import annotations

from typing import List

from fastapi import APIRouter, HTTPException

from ...schemas import RegionNode
from ...services.crawler_service import CrawlerService

router = APIRouter(prefix="/api/regions", tags=["regions"])
service = CrawlerService()


@router.get("", response_model=List[RegionNode])
def get_regions() -> List[RegionNode]:
    try:
        return service.fetch_region_tree()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"地区数据获取失败: {exc}") from exc
