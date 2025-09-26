from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import List

from ..schemas import LogEntry

LOG_FILE = Path(__file__).resolve().parents[2] / "data" / "logs" / "crawler.log"
LOG_FILE.parent.mkdir(parents=True, exist_ok=True)


def append_log(level: str, message: str) -> None:
    entry = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "level": level,
        "message": message,
    }
    with LOG_FILE.open("a", encoding="utf-8") as fp:
        fp.write(json.dumps(entry, ensure_ascii=False))
        fp.write("\n")


def load_logs(limit: int = 500) -> List[LogEntry]:
    if not LOG_FILE.exists():
        return []
    entries: List[LogEntry] = []
    with LOG_FILE.open("r", encoding="utf-8") as fp:
        for line in fp.readlines()[-limit:]:
            line = line.strip()
            if not line:
                continue
            try:
                payload = json.loads(line)
                entries.append(
                    LogEntry(
                        timestamp=datetime.fromisoformat(payload["timestamp"].replace("Z", "")),
                        level=payload.get("level", "INFO"),
                        message=payload.get("message", ""),
                    )
                )
            except json.JSONDecodeError:
                continue
    return entries


def clear_logs() -> None:
    if LOG_FILE.exists():
        LOG_FILE.write_text("", encoding="utf-8")
