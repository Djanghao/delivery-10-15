"""Quick smoke-test for Zhejiang approval public announcement APIs."""

from __future__ import annotations

import logging
from typing import Optional

from client import PublicAnnouncementClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

TARGET_AREA_CODE = "330354"  # 温州生态园


def pick_first_projectuuid(client: PublicAnnouncementClient, area_code: str) -> Optional[str]:
    # pageNo=0 returns total pages; we fetch page 1 afterwards
    logger.info("Fetching page metadata for area %s", area_code)
    meta = client.get_item_page(area_code, 0)
    logger.info("Total pages reported: %s", meta.total_pages)
    logger.info("Fetching first page of item list (page 1)")
    page = client.get_item_page(area_code, 1)
    if not page.items:
        logger.warning("No items returned for area %s", area_code)
        return None
    first_item = page.items[0]
    logger.info(
        "First item: projectuuid=%s, item_name=%s, deal_code=%s",
        first_item.projectuuid,
        first_item.item_name,
        first_item.deal_code,
    )
    return first_item.projectuuid


def main() -> None:
    client = PublicAnnouncementClient()
    try:
        logger.info("Fetching region tree")
        regions = client.get_regions()
        logger.info("Total regions fetched: %s", len(regions))
        region = next((r for r in regions if r.id == TARGET_AREA_CODE), None)
        if region:
            logger.info("Target region located: %s -> %s", region.id, region.name)
        else:
            logger.warning("Target region %s not found in region list", TARGET_AREA_CODE)

        projectuuid = pick_first_projectuuid(client, TARGET_AREA_CODE)
        if not projectuuid:
            logger.warning("No projectuuid retrieved; skipping project detail fetch")
            return

        logger.info("Fetching project detail for %s", projectuuid)
        detail = client.get_project_detail(projectuuid)
        if not detail:
            logger.warning("No detail payload returned for project %s", projectuuid)
            return
        target_items = [item for item in detail.items if item.item_name]
        logger.info(
            "Project name: %s, total recorded items: %s",
            detail.project_name,
            len(target_items),
        )
        for item in target_items:
            logger.info(
                "- %s | sendid=%s | deal_time=%s",
                item.item_name,
                item.sendid,
                item.deal_time,
            )
    finally:
        client.close()


if __name__ == "__main__":
    main()
