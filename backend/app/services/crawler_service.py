from __future__ import annotations

import json
import logging
import time
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

    def _build_region_name_map(self, region_codes: List[str]) -> Dict[str, str]:
        from ..config import DATA_DIR

        cache_file = DATA_DIR / "regions.json"
        if not cache_file.exists():
            return {code: code for code in region_codes}

        try:
            data = json.loads(cache_file.read_text(encoding="utf-8"))
        except Exception:
            return {code: code for code in region_codes}

        mapping: Dict[str, str] = {}
        parent_map: Dict[str, str] = {}

        def traverse(node: dict, parent_name: Optional[str] = None) -> None:
            node_id = node.get("id")
            node_name = node.get("name", node_id)
            if node_id:
                if parent_name and parent_name != node_name:
                    mapping[node_id] = f"{parent_name}/{node_name}"
                else:
                    mapping[node_id] = node_name
                parent_map[node_id] = parent_name or ""
            for child in node.get("children", []):
                traverse(child, node_name)

        for region in data:
            traverse(region)

        return {code: mapping.get(code, code) for code in region_codes}

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
        exclude_keywords: str = "",
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
        region_name_map = self._build_region_name_map(region_codes)
        region_names = [region_name_map.get(code, code) for code in region_codes]
        append_log("INFO", f"任务 {run_id} 开始，模式 {mode}，地区 {','.join(region_names)}")
        stats = CrawlStats()
        keywords_list = [kw.strip() for kw in exclude_keywords.split(",") if kw.strip()] if exclude_keywords else []
        if keywords_list:
            append_log("INFO", f"任务 {run_id} 过滤关键词: {', '.join(keywords_list)}")
        try:
            for region_code in region_codes:
                if should_stop and should_stop():
                    append_log("INFO", f"任务 {run_id} 已请求终止，停止后续处理")
                    break
                if mode == "history":
                    self._run_history_for_region(session, region_code, stats, region_name_map, should_stop=should_stop, exclude_keywords=keywords_list)
                else:
                    self._run_incremental_for_region(session, region_code, stats, region_name_map, should_stop=should_stop, exclude_keywords=keywords_list)
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
        self,
        session: Session,
        region_code: str,
        stats: CrawlStats,
        region_name_map: Dict[str, str],
        *,
        should_stop: Optional[Callable[[], bool]] = None,
        exclude_keywords: Optional[List[str]] = None,
    ) -> None:
        region_name = region_name_map.get(region_code, region_code)
        append_log("INFO", f"地区 {region_name} 历史爬取开始")
        # 先探测总页数（接口 pageNo 支持从 0 开始）
        first_page = self.client.get_item_page(region_code, 0)
        total_pages = first_page.total_pages
        last_sendid = None
        before_region_total = stats.total_items
        before_region_matched = stats.matched_projects
        before_region_saved = stats.valuable_projects
        # 倒序抓取：从最后一页索引(total_pages-1)到第 0 页
        for page_no in range(total_pages - 1, -1, -1):
            if should_stop and should_stop():
                append_log("INFO", f"地区 {region_name} 历史爬取中止")
                break
            current_page = self.client.get_item_page(region_code, page_no)
            before_total = stats.total_items
            before_matched = stats.matched_projects
            before_saved = stats.valuable_projects
            self._process_items(session, region_code, reversed(current_page.items), stats, region_name_map, should_stop=should_stop, exclude_keywords=exclude_keywords)
            page_items = len(current_page.items)
            delta_total = stats.total_items - before_total
            delta_matched = stats.matched_projects - before_matched
            delta_saved = stats.valuable_projects - before_saved
            display_idx = page_no + 1
            if page_items or total_pages:
                append_log(
                    "INFO",
                    (
                        f"地区 {region_name} 历史爬取 - 第 {display_idx}/{total_pages} 页，"
                        f"事项 {page_items} 条，命中 {delta_matched} 个，新入库 {delta_saved} 个"
                    ),
                )
            if current_page.items:
                last_sendid = current_page.items[0].sendid
        if last_sendid:
            self._update_progress(session, region_code, last_sendid)
        region_total = stats.total_items - before_region_total
        region_matched = stats.matched_projects - before_region_matched
        region_saved = stats.valuable_projects - before_region_saved
        append_log("INFO", f"✓ 地区 {region_name} 历史爬取完成：累计事项 {region_total} 条，命中 {region_matched} 个，新入库 {region_saved} 个")

    def _run_incremental_for_region(
        self,
        session: Session,
        region_code: str,
        stats: CrawlStats,
        region_name_map: Dict[str, str],
        *,
        should_stop: Optional[Callable[[], bool]] = None,
        exclude_keywords: Optional[List[str]] = None,
    ) -> None:
        region_name = region_name_map.get(region_code, region_code)
        append_log("INFO", f"地区 {region_name} 增量爬取开始")
        progress = session.get(CrawlProgress, region_code)
        if not progress or not progress.last_pivot_sendid:
            append_log("INFO", f"地区 {region_name} 无历史 pivot，执行全量补齐")
            self._run_history_for_region(session, region_code, stats, region_name_map, should_stop=should_stop, exclude_keywords=exclude_keywords)
            return
        pivot = progress.last_pivot_sendid
        new_items = self._collect_items_after_pivot(region_code, pivot, region_name_map)
        if not new_items:
            append_log("INFO", f"✓ 地区 {region_name} 增量爬取完成：无新增事项")
            return
        before_matched = stats.matched_projects
        before_saved = stats.valuable_projects
        before_total = stats.total_items
        self._process_items(session, region_code, new_items, stats, region_name_map, should_stop=should_stop, exclude_keywords=exclude_keywords)
        delta_total = stats.total_items - before_total
        delta_matched = stats.matched_projects - before_matched
        delta_saved = stats.valuable_projects - before_saved
        latest = next(iter(new_items[::-1]), None)
        if latest:
            self._update_progress(session, region_code, latest.sendid)
        append_log("INFO", f"✓ 地区 {region_name} 增量爬取完成：累计事项 {delta_total} 条，命中 {delta_matched} 个，新入库 {delta_saved} 个")

    def _collect_items_after_pivot(self, region_code: str, pivot: str, region_name_map: Dict[str, str]) -> List[ItemSummary]:
        region_name = region_name_map.get(region_code, region_code)
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
                f"地区 {region_name} 增量扫描 - 第 {display_idx}/{total_pages} 页，新增事项 {new_items_count} 条"
                + (f"，找到 pivot" if found else "")
            )
            if found or page_no >= (page.total_pages - 1):
                break
            page_no += 1
        if not found:
            append_log("WARNING", f"地区 {region_name} 未找到 pivot {pivot}，返回所有事项")
        return list(reversed(items))

    def _process_items(
        self,
        session: Session,
        region_code: str,
        items: Iterable[ItemSummary],
        stats: CrawlStats,
        region_name_map: Dict[str, str],
        *,
        should_stop: Optional[Callable[[], bool]] = None,
        exclude_keywords: Optional[List[str]] = None,
    ) -> None:
        region_name = region_name_map.get(region_code, region_code)
        empty_items_count = 0
        MAX_CONSECUTIVE_EMPTY = 10

        for item in items:
            if should_stop and should_stop():
                append_log("INFO", f"地区 {region_name} 项目处理被中止")
                break
            stats.total_items += 1
            project = session.get(ValuableProject, item.projectuuid)
            if project:
                stats.matched_projects += 1
                self._update_progress(session, region_code, item.sendid)
                empty_items_count = 0
                continue
            retry_count = 0
            detail = None
            MAX_RETRIES = 50
            while retry_count < MAX_RETRIES:
                if should_stop and should_stop():
                    append_log("INFO", f"地区 {region_name} 项目处理被中止（项目 {item.projectuuid}）")
                    return
                try:
                    detail = self.client.get_project_detail(item.projectuuid)
                    if retry_count > 0:
                        append_log("INFO", f"✓ 项目 {item.projectuuid} 获取成功（重试 {retry_count} 次后）")
                    break
                except Exception as exc:
                    retry_count += 1
                    if retry_count >= MAX_RETRIES:
                        append_log("ERROR", f"🚨 CRITICAL - 项目 {item.projectuuid} 获取失败（已重试50次），跳过")
                        detail = None
                        break
                    append_log("WARNING", f"⚠️ 项目 {item.projectuuid} 获取失败（第 {retry_count}/{MAX_RETRIES} 次重试）: {exc}")
                    time.sleep(2)
            if not detail:
                append_log("WARNING", f"项目 {item.projectuuid} 无详情，忽略")
                self._update_progress(session, region_code, item.sendid)
                continue

            if exclude_keywords:
                project_name = detail.project_name or ""
                should_skip = False
                for keyword in exclude_keywords:
                    if keyword in project_name:
                        append_log("INFO", f"🚫 过滤项目: {project_name} (匹配关键词: {keyword})")
                        self._update_progress(session, region_code, item.sendid)
                        should_skip = True
                        break
                if should_skip:
                    continue

            if len(detail.items) == 0:
                empty_items_count += 1
                if empty_items_count >= MAX_CONSECUTIVE_EMPTY:
                    append_log("ERROR", f"🚨 爬取中断 - 地区 {region_name} 连续{MAX_CONSECUTIVE_EMPTY}个项目返回空事项列表，原网站可能出现问题")
                    return
            else:
                empty_items_count = 0
            if self._is_target_project(detail):
                project_uuid = detail.projectuuid or item.projectuuid
                session.merge(
                    ValuableProject(
                        projectuuid=project_uuid,
                        project_name=detail.project_name or "",
                        region_code=region_code,
                        discovered_at=datetime.utcnow(),
                    )
                )
                stats.valuable_projects += 1
                stats.matched_projects += 1
                append_log("INFO", f"记录项目 {detail.project_name}")
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
