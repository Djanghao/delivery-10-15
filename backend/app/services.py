from __future__ import annotations

import threading
import time
import uuid
from typing import Dict, List, Optional

from .crawler.logic import crawl_history, crawl_incremental
from .db import get_progress


class LogBuffer:
    def __init__(self, max_lines: int = 500) -> None:
        self.max_lines = max_lines
        self._lines: List[str] = []
        self._lock = threading.Lock()

    def write(self, line: str) -> None:
        s = line if line.endswith("\n") else line + "\n"
        with self._lock:
            self._lines.append(s)
            if len(self._lines) > self.max_lines:
                self._lines = self._lines[-self.max_lines :]

    def read(self) -> str:
        with self._lock:
            return "".join(self._lines)


class TaskManager:
    def __init__(self) -> None:
        self._jobs: Dict[str, LogBuffer] = {}

    def get_logs(self, job_id: str) -> str:
        buf = self._jobs.get(job_id)
        return buf.read() if buf else ""

    def start(self, mode: str, regions: List[str]) -> str:
        job_id = uuid.uuid4().hex[:12]
        logbuf = LogBuffer()
        self._jobs[job_id] = logbuf

        def run() -> None:
            log = logbuf.write
            log(f"任务 {job_id} 开始，模式={mode}，地区数={len(regions)}")
            try:
                for rc in regions:
                    if mode == "history":
                        log(f"[地区 {rc}] 历史阶段开始")
                        crawl_history(rc, log)
                        log(f"[地区 {rc}] 历史阶段完成")
                    else:
                        prog = get_progress(rc)
                        pivot = prog.get("last_pivot_sendid") if prog else None
                        log(f"[地区 {rc}] 增量阶段开始，last_pivot={pivot}")
                        crawl_incremental(rc, pivot, log)
                        log(f"[地区 {rc}] 增量阶段完成")
                log(f"任务 {job_id} 完成")
            except Exception as e:
                log(f"任务 {job_id} 失败：{e}")

        t = threading.Thread(target=run, daemon=True)
        t.start()
        return job_id


task_manager = TaskManager()

