from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Iterable, List, Optional

from sqlalchemy.orm import Session

from ..crawler.client import PublicAnnouncementClient
from ..crawler.models import ItemSummary, ProjectDetail
from ..models import CrawlProgress, CrawlRun, ValuableProject
from ..schemas import RegionNode
from .logs import append_log

logger = logging.getLogger(__name__)


@dataclass
class CrawlStats:
    total_items: int = 0
    valuable_projects: int = 0


class CrawlerService:
    def __init__(self, client: Optional[PublicAnnouncementClient] = None) -> None:
        self.client = client or PublicAnnouncementClient()

    def fetch_region_tree(self) -> List[RegionNode]:
        regions = self.client.get_regions()
        nodes: Dict[str, RegionNode] = {
            region.id: RegionNode(id=region.id, name=region.name, parent_id=region.parent_id)
            for region in regions
        }
        for node in nodes.values():
            if node.parent_id and node.parent_id in nodes:
                nodes[node.parent_id].children.append(node)
        return [node for node in nodes.values() if not node.parent_id]

    def run_task(self, session: Session, mode: str, region_codes: List[str]) -> CrawlRun:
        run_id = str(uuid.uuid4())
        crawl_run = CrawlRun(
            id=run_id,
            mode=mode,
            regions_json=json.dumps(region_codes),
            total_items=0,
            valuable_projects=0,
            started_at=datetime.utcnow(),
        )
        session.add(crawl_run)
        session.commit()
        append_log("INFO", f"任务 {run_id} 开始，模式 {mode}，地区 {','.join(region_codes)}")
        stats = CrawlStats()
        try:
            for region_code in region_codes:
                if mode == "history":
                    self._run_history_for_region(session, region_code, stats)
                else:
                    self._run_incremental_for_region(session, region_code, stats)
            crawl_run.total_items = stats.total_items
            crawl_run.valuable_projects = stats.valuable_projects
            crawl_run.finished_at = datetime.utcnow()
            session.commit()
            append_log("INFO", f"任务 {run_id} 完成，累计事项 {stats.total_items}，命中项目 {stats.valuable_projects}")
        except Exception as exc:
            crawl_run.finished_at = datetime.utcnow()
            session.commit()
            logger.exception("Crawl task failed")
            append_log("ERROR", f"任务 {run_id} 失败: {exc}")
            raise
        return crawl_run

    def _run_history_for_region(self, session: Session, region_code: str, stats: CrawlStats) -> None:
        append_log("INFO", f"地区 {region_code} 历史爬取开始")
        first_page = self.client.get_item_page(region_code, 0)
        total_pages = first_page.total_pages
        last_sendid = None
        for page_no in range(total_pages, 0, -1):
            current_page = self.client.get_item_page(region_code, page_no)
            self._process_items(session, region_code, reversed(current_page.items), stats)
            if current_page.items:
                last_sendid = current_page.items[0].sendid
        if last_sendid:
            self._update_progress(session, region_code, last_sendid)
        append_log("INFO", f"地区 {region_code} 历史爬取完成")

    def _run_incremental_for_region(self, session: Session, region_code: str, stats: CrawlStats) -> None:
        append_log("INFO", f"地区 {region_code} 增量爬取开始")
        progress = session.get(CrawlProgress, region_code)
        if not progress or not progress.last_pivot_sendid:
            append_log("INFO", f"地区 {region_code} 无历史 pivot，执行全量补齐")
            self._run_history_for_region(session, region_code, stats)
            return
        pivot = progress.last_pivot_sendid
        new_items = self._collect_items_after_pivot(region_code, pivot)
        if not new_items:
            append_log("INFO", f"地区 {region_code} 无新增事项")
            return
        self._process_items(session, region_code, new_items, stats)
        latest = next(iter(new_items[::-1]), None)
        if latest:
            self._update_progress(session, region_code, latest.sendid)
        append_log("INFO", f"地区 {region_code} 增量爬取完成")

    def _collect_items_after_pivot(self, region_code: str, pivot: str) -> List[ItemSummary]:
        items: List[ItemSummary] = []
        page_no = 1
        found = False
        while True:
            page = self.client.get_item_page(region_code, page_no)
            for entry in page.items:
                if entry.sendid == pivot:
                    found = True
                    break
                items.append(entry)
            if found or page_no >= page.total_pages:
                break
            page_no += 1
        if not found:
            append_log("WARNING", f"地区 {region_code} 未找到 pivot {pivot}，返回所有事项")
        return list(reversed(items))

    def _process_items(self, session: Session, region_code: str, items: Iterable[ItemSummary], stats: CrawlStats) -> None:
        for item in items:
            stats.total_items += 1
            append_log("DEBUG", f"处理事项 {item.sendid} 项目 {item.projectuuid}")
            project = session.get(ValuableProject, item.projectuuid)
            if project:
                self._update_progress(session, region_code, item.sendid)
                continue
            detail = self.client.get_project_detail(item.projectuuid)
            if not detail:
                append_log("WARNING", f"项目 {item.projectuuid} 无详情，忽略")
                self._update_progress(session, region_code, item.sendid)
                continue
            if self._is_target_project(detail):
                session.merge(
                    ValuableProject(
                        projectuuid=detail.projectuuid or item.projectuuid,
                        project_name=detail.project_name or "",
                        region_code=region_code,
                        discovered_at=datetime.utcnow(),
                    )
                )
                stats.valuable_projects += 1
                append_log("INFO", f"记录项目 {detail.projectuuid} - {detail.project_name}")
            self._update_progress(session, region_code, item.sendid)

    def _update_progress(self, session: Session, region_code: str, sendid: str) -> None:
        progress = session.get(CrawlProgress, region_code)
        if not progress:
            session.add(CrawlProgress(region_code=region_code, last_pivot_sendid=sendid))
        else:
            progress.last_pivot_sendid = sendid
        session.commit()

    @staticmethod
    def _is_target_project(detail: ProjectDetail) -> bool:
        return detail.is_target_project()
