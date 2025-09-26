from __future__ import annotations

import threading
import uuid
from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional
import threading

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
    mode: Optional[str] = None
    regions: List[str] = field(default_factory=list)
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    future: Optional[Future] = None


class TaskManager:
    def __init__(self, max_workers: int = 2) -> None:
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.crawler = CrawlerService()
        self._tasks: Dict[str, TaskInfo] = {}
        self._lock = threading.Lock()
        self._cancel_events: Dict[str, threading.Event] = {}

    def submit(self, mode: str, regions: List[str]) -> str:
        task_id = str(uuid.uuid4())
        # Pre-allocate a run_id so UI can reference run immediately
        run_id = str(uuid.uuid4())
        info = TaskInfo(task_id=task_id, run_id=run_id, mode=mode, regions=list(regions))
        with self._lock:
            self._tasks[task_id] = info
            cancel_event = threading.Event()
            self._cancel_events[task_id] = cancel_event

        def runner() -> None:
            self._mark_running(task_id)
            try:
                with session_scope() as session:
                    # Pass in run_id and a stop-check for cooperative cancellation
                    run = self.crawler.run_task(
                        session, mode, regions, run_id=run_id, should_stop=self._cancel_events[task_id].is_set
                    )
                    info.run_id = run.id
                # If cancellation was requested, mark as cancelled
                if self._cancel_events[task_id].is_set():
                    self._mark_cancelled(task_id)
                else:
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
        return TaskStatus(
            task_id=task_id,
            status=info.status,
            message=info.message,
            run_id=info.run_id,
            mode=info.mode,
            regions=info.regions,
            started_at=info.started_at,
            finished_at=info.finished_at,
        )

    def list_status(self) -> List[TaskStatus]:
        with self._lock:
            infos = list(self._tasks.values())
        return [
            TaskStatus(
                task_id=info.task_id,
                status=info.status,
                message=info.message,
                run_id=info.run_id,
                mode=info.mode,
                regions=info.regions,
                started_at=info.started_at,
                finished_at=info.finished_at,
            )
            for info in infos
        ]

    def _mark_running(self, task_id: str) -> None:
        with self._lock:
            if task_id in self._tasks:
                self._tasks[task_id].status = "running"
                self._tasks[task_id].started_at = datetime.utcnow()

    def _mark_succeeded(self, task_id: str) -> None:
        with self._lock:
            if task_id in self._tasks:
                self._tasks[task_id].status = "succeeded"
                self._tasks[task_id].finished_at = datetime.utcnow()

    def _mark_failed(self, task_id: str, message: str) -> None:
        with self._lock:
            if task_id in self._tasks:
                self._tasks[task_id].status = "failed"
                self._tasks[task_id].message = message
                self._tasks[task_id].finished_at = datetime.utcnow()

    def _mark_cancelled(self, task_id: str) -> None:
        with self._lock:
            if task_id in self._tasks:
                self._tasks[task_id].status = "cancelled"
                self._tasks[task_id].finished_at = datetime.utcnow()

    def cancel(self, task_id: str) -> bool:
        """Request cooperative cancellation. Returns True if task existed."""
        with self._lock:
            event = self._cancel_events.get(task_id)
            info = self._tasks.get(task_id)
        if not event or not info:
            return False
        event.set()
        # Try to cancel future if not started
        if info.future and info.future.cancel():
            self._mark_cancelled(task_id)
        return True
