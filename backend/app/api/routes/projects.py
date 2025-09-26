from __future__ import annotations

import csv
import io
from typing import List

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ...db import get_db
from ...models import ValuableProject
from ...schemas import PaginatedProjects, ProjectItem

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=PaginatedProjects)
def list_projects(
    region: str | None = Query(default=None),
    regions: List[str] = Query(default_factory=list),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=200),
    db: Session = Depends(get_db),
) -> PaginatedProjects:
    selected = regions or ([region] if region else [])
    query = select(ValuableProject)
    count_query = select(func.count()).select_from(ValuableProject)
    if selected:
        query = query.where(ValuableProject.region_code.in_(selected))
        count_query = count_query.where(ValuableProject.region_code.in_(selected))
    query = query.order_by(ValuableProject.discovered_at.desc()).offset((page - 1) * size).limit(size)
    items = db.scalars(query).all()
    total = int(db.scalar(count_query) or 0)
    return PaginatedProjects(
        items=[
            ProjectItem(
                projectuuid=item.projectuuid,
                project_name=item.project_name,
                region_code=item.region_code,
                discovered_at=item.discovered_at,
            )
            for item in items
        ],
        total=total,
        page=page,
        size=size,
    )


@router.get("/export")
def export_projects(
    region: str | None = Query(default=None),
    regions: List[str] = Query(default_factory=list),
    db: Session = Depends(get_db),
) -> Response:
    selected = regions or ([region] if region else [])
    query = select(ValuableProject).order_by(ValuableProject.discovered_at.desc())
    if selected:
        query = query.where(ValuableProject.region_code.in_(selected))
    projects = db.scalars(query).all()
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["projectuuid", "project_name", "region_code", "discovered_at"])
    for project in projects:
        writer.writerow([
            project.projectuuid,
            project.project_name,
            project.region_code,
            project.discovered_at.isoformat(),
        ])
    headers = {"Content-Disposition": "attachment; filename=valuable_projects.csv"}
    return Response(content=buffer.getvalue(), media_type="text/csv", headers=headers)
