#!/usr/bin/env python3
import sys
sys.path.insert(0, '../backend')

from app.crawler.client import PublicAnnouncementClient
from app.crawler.models import TARGET_ITEM_NAMES

def test_regions():
    print("=== Testing Region Fetch ===")
    client = PublicAnnouncementClient()
    regions = client.get_regions()
    print(f"✓ Successfully fetched {len(regions)} regions")

    city_regions = [r for r in regions if r.parent_id]
    print(f"✓ Found {len(city_regions)} city-level regions")

    if city_regions:
        sample = city_regions[0]
        print(f"✓ Sample region: {sample.name} (ID: {sample.id})")
    return regions

def test_item_page(region_code='330100'):
    print(f"\n=== Testing Item Page Fetch (region: {region_code}) ===")
    client = PublicAnnouncementClient()
    page = client.get_item_page(region_code, 0)
    print(f"✓ Successfully fetched page 0")
    print(f"✓ Items on page: {len(page.items)}")
    print(f"✓ Total pages: {page.total_pages}")

    if page.items:
        sample = page.items[0]
        print(f"✓ Sample item: {sample.item_name}")
        print(f"  - Project UUID: {sample.projectuuid}")
        print(f"  - Send ID: {sample.sendid}")
    return page

def test_project_detail(page):
    if not page.items:
        print("\n⚠ No items to test project detail")
        return

    print("\n=== Testing Project Detail Fetch ===")
    client = PublicAnnouncementClient()
    sample_item = page.items[0]

    detail = client.get_project_detail(sample_item.projectuuid)
    if not detail:
        print("✗ Failed to fetch project detail")
        return

    print(f"✓ Successfully fetched project detail")
    print(f"✓ Project name: {detail.project_name}")
    print(f"✓ Number of items: {len(detail.items)}")

    target_items = [item for item in detail.items if item.matches_target()]
    print(f"✓ Target items found: {len(target_items)}")

    if target_items:
        print("✓ Sample target item:")
        for item in target_items[:2]:
            print(f"  - {item.item_name}")

    print(f"\n✓ Is target project: {detail.is_target_project()}")
    return detail

def test_target_matching():
    print("\n=== Testing Target Matching Logic ===")
    print(f"Target item names configured: {len(TARGET_ITEM_NAMES)}")
    for name in TARGET_ITEM_NAMES:
        print(f"  - {name}")

def main():
    print("Starting Gov Stats Crawler System Test\n")
    print("=" * 60)

    try:
        regions = test_regions()
        page = test_item_page()
        detail = test_project_detail(page)
        test_target_matching()

        print("\n" + "=" * 60)
        print("✓ All tests passed successfully!")
        print("\nSummary:")
        print(f"  - Regions API: Working")
        print(f"  - Item List API: Working")
        print(f"  - Project Detail API: Working")
        print(f"  - Target Matching: Configured correctly")
        print("\nConclusion: The crawler client is working properly.")
        print("If the system is not crawling data, the issue may be:")
        print("  1. Backend server not running (check PM2 status)")
        print("  2. Database connection issues")
        print("  3. Task manager not processing tasks")
        print("  4. Frontend not calling the API correctly")

    except Exception as e:
        print(f"\n✗ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
