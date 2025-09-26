from __future__ import annotations

from typing import List

from fastapi import APIRouter

from ...schemas import LogEntry
from ...services.logs import append_log, clear_logs, load_logs

router = APIRouter(prefix="/api/logs", tags=["logs"])


@router.get("", response_model=List[LogEntry])
def get_logs(limit: int = 200) -> List[LogEntry]:
    return load_logs(limit=limit)


@router.delete("")
def purge_logs() -> None:
    clear_logs()
    append_log("INFO", "日志已清空")
