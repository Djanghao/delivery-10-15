from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Callable, Dict, Iterable, List, Optional

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
    matched_projects: int = 0  # 命中的符合条件项目（含重复）


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
        # 返回市级作为顶层（去掉省级）。
        roots = [node for node in nodes.values() if not node.parent_id]
        if not roots:
            # 兜底：如果没有根结点，按原结构返回全部根（保持兼容）
            return [node for node in nodes.values() if not node.parent_id]
        city_level: List[RegionNode] = []
        for root in roots:
            # 仅返回根结点（省级）的子结点（市级）
            city_level.extend(root.children)
        return city_level

    def run_task(
        self,
        session: Session,
        mode: str,
        region_codes: List[str],
        *,
        run_id: Optional[str] = None,
        should_stop: Optional[Callable[[], bool]] = None,
    ) -> CrawlRun:
        run_id = run_id or str(uuid.uuid4())
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
                if should_stop and should_stop():
                    append_log("INFO", f"任务 {run_id} 已请求终止，停止后续处理")
                    break
                if mode == "history":
                    self._run_history_for_region(session, region_code, stats, should_stop=should_stop)
                else:
                    self._run_incremental_for_region(session, region_code, stats, should_stop=should_stop)
            crawl_run.total_items = stats.total_items
            crawl_run.valuable_projects = stats.valuable_projects
            crawl_run.finished_at = datetime.utcnow()
            session.commit()
            append_log(
                "INFO",
                f"任务 {run_id} 完成：累计事项 {stats.total_items}，命中 {stats.matched_projects}，新入库 {stats.valuable_projects}"
            )
        except Exception as exc:
            crawl_run.finished_at = datetime.utcnow()
            session.commit()
            logger.exception("Crawl task failed")
            append_log("ERROR", f"任务 {run_id} 失败: {exc}")
            raise
        return crawl_run

    def _run_history_for_region(
        self, session: Session, region_code: str, stats: CrawlStats, *, should_stop: Optional[Callable[[], bool]] = None
    ) -> None:
        append_log("INFO", f"地区 {region_code} 历史爬取开始")
        # 先探测总页数（接口 pageNo 支持从 0 开始）
        first_page = self.client.get_item_page(region_code, 0)
        total_pages = first_page.total_pages
        last_sendid = None
        # 倒序抓取：从最后一页索引(total_pages-1)到第 0 页
        for page_no in range(total_pages - 1, -1, -1):
            if should_stop and should_stop():
                append_log("INFO", f"地区 {region_code} 历史爬取中止")
                break
            current_page = self.client.get_item_page(region_code, page_no)
            before_total = stats.total_items
            before_matched = stats.matched_projects
            before_saved = stats.valuable_projects
            self._process_items(session, region_code, reversed(current_page.items), stats, should_stop=should_stop)
            page_items = len(current_page.items)
            delta_total = stats.total_items - before_total
            delta_matched = stats.matched_projects - before_matched
            delta_saved = stats.valuable_projects - before_saved
            display_idx = page_no + 1
            if page_items or total_pages:
                append_log(
                    "INFO",
                    (
                        f"地区 {region_code} 历史爬取 - 第 {display_idx}/{total_pages} 页，"
                        f"事项 {page_items} 条，命中 {delta_matched} 个，新入库 {delta_saved} 个"
                    ),
                )
            if current_page.items:
                last_sendid = current_page.items[0].sendid
        if last_sendid:
            self._update_progress(session, region_code, last_sendid)
        append_log("INFO", f"地区 {region_code} 历史爬取完成")

    def _run_incremental_for_region(
        self, session: Session, region_code: str, stats: CrawlStats, *, should_stop: Optional[Callable[[], bool]] = None
    ) -> None:
        append_log("INFO", f"地区 {region_code} 增量爬取开始")
        progress = session.get(CrawlProgress, region_code)
        if not progress or not progress.last_pivot_sendid:
            append_log("INFO", f"地区 {region_code} 无历史 pivot，执行全量补齐")
            self._run_history_for_region(session, region_code, stats, should_stop=should_stop)
            return
        pivot = progress.last_pivot_sendid
        new_items = self._collect_items_after_pivot(region_code, pivot)
        if not new_items:
            append_log("INFO", f"地区 {region_code} 无新增事项")
            return
        before_matched = stats.matched_projects
        before_saved = stats.valuable_projects
        before_total = stats.total_items
        self._process_items(session, region_code, new_items, stats, should_stop=should_stop)
        delta_total = stats.total_items - before_total
        delta_matched = stats.matched_projects - before_matched
        delta_saved = stats.valuable_projects - before_saved
        append_log(
            "INFO",
            f"地区 {region_code} 增量处理完成：事项 {delta_total} 条，命中 {delta_matched} 个，新入库 {delta_saved} 个",
        )
        latest = next(iter(new_items[::-1]), None)
        if latest:
            self._update_progress(session, region_code, latest.sendid)
        append_log("INFO", f"地区 {region_code} 增量爬取完成")

    def _collect_items_after_pivot(self, region_code: str, pivot: str) -> List[ItemSummary]:
        items: List[ItemSummary] = []
        page_no = 0
        found = False
        total_pages = 0
        while True:
            page = self.client.get_item_page(region_code, page_no)
            total_pages = page.total_pages
            new_items_count = 0
            for entry in page.items:
                if entry.sendid == pivot:
                    found = True
                    break
                items.append(entry)
                new_items_count += 1
            display_idx = page_no + 1
            append_log(
                "INFO",
                f"地区 {region_code} 增量扫描 - 第 {display_idx}/{total_pages} 页，新增事项 {new_items_count} 条"
                + (f"，找到 pivot" if found else "")
            )
            if found or page_no >= (page.total_pages - 1):
                break
            page_no += 1
        if not found:
            append_log("WARNING", f"地区 {region_code} 未找到 pivot {pivot}，返回所有事项")
        return list(reversed(items))

    def _process_items(
        self,
        session: Session,
        region_code: str,
        items: Iterable[ItemSummary],
        stats: CrawlStats,
        *,
        should_stop: Optional[Callable[[], bool]] = None,
    ) -> None:
        for item in items:
            if should_stop and should_stop():
                append_log("INFO", f"地区 {region_code} 项目处理被中止")
                break
            stats.total_items += 1
            project = session.get(ValuableProject, item.projectuuid)
            if project:
                # 已在库中，视为再次命中，不再重复拉详情
                stats.matched_projects += 1
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
                stats.matched_projects += 1
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
