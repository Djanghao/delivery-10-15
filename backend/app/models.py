from __future__ import annotations

import json
from datetime import datetime
from typing import List

from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.types import Boolean

from .db import Base


class ValuableProject(Base):
    __tablename__ = "valuable_projects"

    projectuuid = Column(String(64), primary_key=True)
    project_name = Column(String(255), nullable=False)
    region_code = Column(String(20), nullable=False)
    discovered_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    # PDF 解析状态及结果
    parsed_pdf = Column(Boolean, default=False, nullable=False)
    parsed_at = Column(DateTime, nullable=True)
    pdf_extract_json = Column(Text, nullable=True)
    pdf_file_path = Column(Text, nullable=True)


class CrawlProgress(Base):
    __tablename__ = "crawl_progress"

    region_code = Column(String(20), primary_key=True)
    last_pivot_sendid = Column(String(64), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CrawlRun(Base):
    __tablename__ = "crawl_runs"

    id = Column(String(36), primary_key=True)
    mode = Column(String(20), nullable=False)
    regions_json = Column(Text, nullable=False)
    total_items = Column(Integer, default=0, nullable=False)
    valuable_projects = Column(Integer, default=0, nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    finished_at = Column(DateTime, nullable=True)

    def region_codes(self) -> List[str]:
        return json.loads(self.regions_json)
