from __future__ import annotations

import threading
import uuid
from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import dataclass
from typing import Dict, List, Optional

from ..db import session_scope
from ..schemas import TaskStatus
from .crawler_service import CrawlerService
from .logs import append_log


@dataclass
class TaskInfo:
    task_id: str
    status: str = "pending"
    message: Optional[str] = None
    run_id: Optional[str] = None
    future: Optional[Future] = None


class TaskManager:
    def __init__(self, max_workers: int = 2) -> None:
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.crawler = CrawlerService()
        self._tasks: Dict[str, TaskInfo] = {}
        self._lock = threading.Lock()

    def submit(self, mode: str, regions: List[str]) -> str:
        task_id = str(uuid.uuid4())
        info = TaskInfo(task_id=task_id)
        with self._lock:
            self._tasks[task_id] = info

        def runner() -> None:
            self._mark_running(task_id)
            try:
                with session_scope() as session:
                    run = self.crawler.run_task(session, mode, regions)
                    info.run_id = run.id
                self._mark_succeeded(task_id)
            except Exception as exc:
                append_log("ERROR", f"任务 {task_id} 执行失败: {exc}")
                self._mark_failed(task_id, str(exc))

        future = self.executor.submit(runner)
        info.future = future
        return task_id

    def get_status(self, task_id: str) -> Optional[TaskStatus]:
        with self._lock:
            info = self._tasks.get(task_id)
        if not info:
            return None
        return TaskStatus(task_id=task_id, status=info.status, message=info.message)

    def list_status(self) -> List[TaskStatus]:
        with self._lock:
            infos = list(self._tasks.values())
        return [TaskStatus(task_id=info.task_id, status=info.status, message=info.message) for info in infos]

    def _mark_running(self, task_id: str) -> None:
        with self._lock:
            if task_id in self._tasks:
                self._tasks[task_id].status = "running"

    def _mark_succeeded(self, task_id: str) -> None:
        with self._lock:
            if task_id in self._tasks:
                self._tasks[task_id].status = "succeeded"

    def _mark_failed(self, task_id: str, message: str) -> None:
        with self._lock:
            if task_id in self._tasks:
                self._tasks[task_id].status = "failed"
                self._tasks[task_id].message = message
