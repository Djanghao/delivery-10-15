from __future__ import annotations

import json
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from ...auth import get_current_user
from ...config import DATA_DIR
from ...models import User
from ...schemas import RegionNode
from ...services.crawler_service import CrawlerService

router = APIRouter(prefix="/api/regions", tags=["regions"])
service = CrawlerService()


CACHE_FILE: Path = DATA_DIR / "regions.json"


def _load_cached_regions() -> Optional[List[RegionNode]]:
    if not CACHE_FILE.exists():
        return None
    try:
        payload = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        if not isinstance(payload, list):
            return None
        return [RegionNode.model_validate(item) for item in payload]
    except Exception:
        # 缓存损坏或不兼容，忽略并返回 None
        return None


def _save_regions_cache(regions: List[RegionNode]) -> None:
    # 将树结构完整写入缓存文件
    data = [r.model_dump() for r in regions]
    CACHE_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


@router.get("", response_model=List[RegionNode])
def get_regions(_: User = Depends(get_current_user)) -> List[RegionNode]:
    # 先尝试读取缓存，若无则实时抓取并落盘
    cached = _load_cached_regions()
    if cached is not None:
        return cached
    try:
        regions = service.fetch_region_tree()
        try:
            _save_regions_cache(regions)
        except Exception:
            # 缓存失败不影响接口返回
            pass
        return regions
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"地区数据获取失败: {exc}") from exc


@router.post("/refresh", response_model=List[RegionNode])
def refresh_regions(_: User = Depends(get_current_user)) -> List[RegionNode]:
    # 强制刷新：调用现有爬取逻辑并更新缓存
    try:
        regions = service.fetch_region_tree()
        try:
            _save_regions_cache(regions)
        except Exception:
            pass
        return regions
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"地区数据刷新失败: {exc}") from exc
