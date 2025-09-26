from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator, Optional


DB_DIR = Path(__file__).resolve().parent.parent / "data"
DB_PATH = DB_DIR / "app.db"


def init_db() -> None:
    DB_DIR.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS valuable_projects (
                projectuuid TEXT PRIMARY KEY,
                project_name TEXT,
                region_code TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS crawl_progress (
                region_code TEXT PRIMARY KEY,
                last_pivot_sendid TEXT,
                updated_at TEXT
            )
            """
        )
        conn.commit()


@contextmanager
def get_conn() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(DB_PATH)
    try:
        yield conn
    finally:
        conn.close()


def upsert_progress(region_code: str, pivot: str) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO crawl_progress(region_code, last_pivot_sendid, updated_at)
            VALUES(?, ?, datetime('now'))
            ON CONFLICT(region_code) DO UPDATE SET
              last_pivot_sendid=excluded.last_pivot_sendid,
              updated_at=datetime('now')
            """,
            (region_code, pivot),
        )
        conn.commit()


def get_progress(region_code: str) -> Optional[dict]:
    with get_conn() as conn:
        cur = conn.execute(
            "SELECT region_code, last_pivot_sendid, updated_at FROM crawl_progress WHERE region_code=?",
            (region_code,),
        )
        row = cur.fetchone()
        if not row:
            return None
        return {
            "region_code": row[0],
            "last_pivot_sendid": row[1],
            "updated_at": row[2],
        }


def project_exists(projectuuid: str) -> bool:
    with get_conn() as conn:
        cur = conn.execute(
            "SELECT 1 FROM valuable_projects WHERE projectuuid=? LIMIT 1",
            (projectuuid,),
        )
        return cur.fetchone() is not None


def insert_project(projectuuid: str, project_name: str, region_code: str) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            INSERT OR IGNORE INTO valuable_projects(projectuuid, project_name, region_code)
            VALUES(?, ?, ?)
            """,
            (projectuuid, project_name, region_code),
        )
        conn.commit()


from typing import Optional, Tuple, List as _List


def list_projects(region: Optional[str], offset: int, limit: int) -> tuple[list[dict], int]:
    with get_conn() as conn:
        if region:
            total = conn.execute(
                "SELECT COUNT(*) FROM valuable_projects WHERE region_code=?",
                (region,),
            ).fetchone()[0]
            cur = conn.execute(
                """
                SELECT projectuuid, project_name, region_code
                FROM valuable_projects WHERE region_code=?
                ORDER BY rowid DESC
                LIMIT ? OFFSET ?
                """,
                (region, limit, offset),
            )
        else:
            total = conn.execute("SELECT COUNT(*) FROM valuable_projects").fetchone()[0]
            cur = conn.execute(
                """
                SELECT projectuuid, project_name, region_code
                FROM valuable_projects
                ORDER BY rowid DESC
                LIMIT ? OFFSET ?
                """,
                (limit, offset),
            )
        rows = cur.fetchall()
        items = [
            {"projectuuid": r[0], "project_name": r[1], "region_code": r[2]}
            for r in rows
        ]
        return items, total


def region_project_count(region: Optional[str] = None) -> list[dict]:
    with get_conn() as conn:
        if region:
            cur = conn.execute(
                "SELECT region_code, COUNT(*) FROM valuable_projects WHERE region_code=? GROUP BY region_code",
                (region,),
            )
        else:
            cur = conn.execute(
                "SELECT region_code, COUNT(*) FROM valuable_projects GROUP BY region_code"
            )
        rows = cur.fetchall()
        return [{"region_code": r[0], "count": r[1]} for r in rows]
