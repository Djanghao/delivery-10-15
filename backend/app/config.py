from __future__ import annotations

import os
from pathlib import Path


# Determine repository root based on this file location (backend/app/config.py)
REPO_ROOT = Path(__file__).resolve().parents[2]

# Data directory can be overridden by env var GOV_STATS_DATA_DIR
DATA_DIR = Path(os.getenv("GOV_STATS_DATA_DIR", (REPO_ROOT / "data").as_posix()))
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Logs
LOGS_DIR = DATA_DIR / "logs"
LOGS_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOGS_DIR / "crawler.log"

# Database URL can be overridden by env var GOV_STATS_DATABASE_URL
DATABASE_URL = os.getenv("GOV_STATS_DATABASE_URL", f"sqlite:///{(DATA_DIR / 'app.db').as_posix()}")


__all__ = [
    "REPO_ROOT",
    "DATA_DIR",
    "LOGS_DIR",
    "LOG_FILE",
    "DATABASE_URL",
]

