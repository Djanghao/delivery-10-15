from __future__ import annotations

from typing import List

from fastapi import APIRouter, Query

from ...schemas import LogEntry
from ...services.logs import append_log, clear_logs, load_logs

router = APIRouter(prefix="/api/logs", tags=["logs"])


def _should_show_in_simple_mode(log: LogEntry) -> bool:
    msg = log.message
    return (
        "🚨" in msg
        or (log.level == "ERROR" and ("已重试50次" in msg or "爬取中断" in msg))
        or "✓ 地区" in msg
        or ("任务" in msg and ("开始" in msg or "完成" in msg))
    )


@router.get("", response_model=List[LogEntry])
def get_logs(limit: int = 200, mode: str = Query("detailed", regex="^(detailed|simple)$")) -> List[LogEntry]:
    logs = load_logs(limit=500 if mode == "simple" else limit)
    if mode == "simple":
        return [log for log in logs if _should_show_in_simple_mode(log)]
    return logs


@router.delete("")
def purge_logs() -> None:
    clear_logs()
    append_log("INFO", "日志已清空")
