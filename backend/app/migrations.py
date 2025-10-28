from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session


def _column_exists(session: Session, table: str, column: str) -> bool:
    rows = session.execute(text(f"PRAGMA table_info('{table}')")).fetchall()
    return any(r[1] == column for r in rows)


def ensure_migrations(session: Session) -> None:
    """Lightweight, idempotent migrations for SQLite.

    Adds new columns introduced after initial table creation without requiring Alembic.
    """
    alters: list[tuple[str, str]] = []
    if not _column_exists(session, "valuable_projects", "parsed_pdf"):
        alters.append(("valuable_projects", "ALTER TABLE valuable_projects ADD COLUMN parsed_pdf INTEGER NOT NULL DEFAULT 0"))
    if not _column_exists(session, "valuable_projects", "parsed_at"):
        alters.append(("valuable_projects", "ALTER TABLE valuable_projects ADD COLUMN parsed_at DATETIME NULL"))
    if not _column_exists(session, "valuable_projects", "pdf_extract_json"):
        alters.append(("valuable_projects", "ALTER TABLE valuable_projects ADD COLUMN pdf_extract_json TEXT NULL"))
    if not _column_exists(session, "valuable_projects", "pdf_file_path"):
        alters.append(("valuable_projects", "ALTER TABLE valuable_projects ADD COLUMN pdf_file_path TEXT NULL"))
    if not _column_exists(session, "valuable_projects", "is_invalid"):
        alters.append(("valuable_projects", "ALTER TABLE valuable_projects ADD COLUMN is_invalid INTEGER NOT NULL DEFAULT 0"))

    for _, sql in alters:
        session.execute(text(sql))
    if alters:
        session.commit()

