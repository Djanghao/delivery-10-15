from __future__ import annotations

import logging
from typing import Iterable, List, Optional, Callable

from ..db import insert_project, project_exists, upsert_progress
from .client import PublicAnnouncementClient


logger = logging.getLogger(__name__)

TARGET_ITEM_NAMES = {
    "企业投资（含外商投资）项目备案（基本建设）",
    "企业投资（含外商投资）项目备案（技术改造）",
    "企业投资（含外商投资）项目核准（基本建设）",
    "企业投资（含外商投资）项目核准（技术改造）",
}


def _scan_items_and_save(client: PublicAnnouncementClient, area_code: str, items: Iterable) -> Optional[str]:
    last_pivot: Optional[str] = None
    for item in items:
        last_pivot = item.sendid or last_pivot
        if not item.projectuuid or project_exists(item.projectuuid):
            upsert_progress(area_code, last_pivot or "")
            continue
        detail = client.get_project_detail(item.projectuuid)
        if not detail:
            upsert_progress(area_code, last_pivot or "")
            continue
        hit = any(pi.item_name in TARGET_ITEM_NAMES for pi in detail.items)
        if hit:
            insert_project(detail.projectuuid or item.projectuuid, detail.project_name, area_code)
        upsert_progress(area_code, last_pivot or "")
    return last_pivot


def crawl_history(area_code: str, log: Optional[Callable[[str], None]] = None) -> None:
    client = PublicAnnouncementClient()
    try:
        meta = client.get_item_page(area_code, 0)
        total_pages = meta.total_pages
        if log:
            log(f"地区 {area_code} 历史爬取，共 {total_pages} 页")
        for page_no in range(total_pages, 0, -1):
            page = client.get_item_page(area_code, page_no)
            if log:
                log(f"地区 {area_code} 扫描第 {page_no}/{total_pages} 页，{len(page.items)} 条")
            _scan_items_and_save(client, area_code, page.items)
    finally:
        client.close()


def crawl_incremental(area_code: str, last_pivot: Optional[str], log: Optional[Callable[[str], None]] = None) -> None:
    client = PublicAnnouncementClient()
    try:
        meta = client.get_item_page(area_code, 0)
        total_pages = meta.total_pages
        if log:
            log(f"地区 {area_code} 增量爬取，目标 pivot={last_pivot}，共 {total_pages} 页")

        found_page = None
        for page_no in range(1, total_pages + 1):
            page = client.get_item_page(area_code, page_no)
            if any(it.sendid == last_pivot for it in page.items):
                found_page = page_no
                break
        if found_page is None:
            found_page = total_pages
        if log:
            log(f"定位 pivot 于第 {found_page} 页，开始从 pivot→新 扫描")

        page = client.get_item_page(area_code, found_page)
        started = False if last_pivot else True
        buf: List = []
        for it in page.items:
            if started:
                buf.append(it)
            elif it.sendid == last_pivot:
                started = True
        if buf:
            _scan_items_and_save(client, area_code, buf)

        if found_page < total_pages:
            for page_no in range(found_page - 1, 0, -1):
                page = client.get_item_page(area_code, page_no)
                if log:
                    log(f"扫描第 {page_no}/{total_pages} 页，{len(page.items)} 条")
                _scan_items_and_save(client, area_code, page.items)
    finally:
        client.close()
