"""Find projects in a given region that contain target regulatory item types."""

from __future__ import annotations

import json
import logging
import os
from typing import Dict, List, Set

from client import PublicAnnouncementClient

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=getattr(logging, LOG_LEVEL, logging.INFO))
logger = logging.getLogger(__name__)

TARGET_ITEM_NAMES = {
    "企业投资（含外商投资）项目备案（基本建设）",
    "企业投资（含外商投资）项目备案（技术改造）",
    "企业投资（含外商投资）项目核准（基本建设）",
    "企业投资（含外商投资）项目核准（技术改造）",
}


def find_projects(area_code: str) -> List[Dict[str, object]]:
    client = PublicAnnouncementClient()
    try:
        metadata = client.get_item_page(area_code, 0)
        total_pages = metadata.total_pages
        logger.info("Area %s reports %s pages", area_code, total_pages)

        matched_projects: List[Dict[str, object]] = []
        checked_projects: Set[str] = set()

        for page_no in range(1, total_pages + 1):
            page = client.get_item_page(area_code, page_no)
            if not page.items:
                logger.info("Page %s returned no items, stopping scan", page_no)
                break

            for item in page.items:
                if not item.projectuuid or item.projectuuid in checked_projects:
                    continue
                checked_projects.add(item.projectuuid)

                detail = client.get_project_detail(item.projectuuid)
                if not detail:
                    logger.warning("No detail for project %s", item.projectuuid)
                    continue

                hits = [
                    project_item
                    for project_item in detail.items
                    if project_item.item_name in TARGET_ITEM_NAMES
                ]
                if hits:
                    matched_projects.append(
                        {
                            "projectuuid": detail.projectuuid or item.projectuuid,
                            "project_name": detail.project_name,
                            "project_code": detail.project_code,
                            "matches": [
                                {
                                    "item_name": hit.item_name,
                                    "sendid": hit.sendid,
                                    "deal_time": hit.deal_time,
                                }
                                for hit in hits
                            ],
                        }
                    )
                    logger.info(
                        "Hit: %s | %s | %s matches", detail.project_name, detail.projectuuid, len(hits)
                    )
        return matched_projects
    finally:
        client.close()


def main() -> None:
    area_code = "330354"  # 温州生态园
    matches = find_projects(area_code)
    logger.info("Total matching projects: %s", len(matches))
    report = {
        "area_code": area_code,
        "total_projects": len(matches),
        "projects": matches,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
