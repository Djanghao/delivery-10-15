from __future__ import annotations

import os
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ...auth import get_current_user
from ...crawler.client import PublicAnnouncementClient
from ...crawler.models import TARGET_ITEM_NAMES
from ...db import get_db
from ...models import User, ValuableProject
from ...schemas import (
    ParseCaptchaStartRequest,
    ParseCaptchaStartResponse,
    ParseCaptchaVerifyRequest,
    ParseCaptchaVerifyResponse,
    ParseDetailItem,
    ParseDetailResponse,
    ParseDownloadRequest,
    ParseDownloadResponse,
)
from ...services.parse_service import (
    download_with_session,
    establish_session_and_get_captcha,
    save_to_project_dir,
    session_manager,
    to_base64_image,
    verify_captcha,
)
from ...services.pdf_extractor import extract_from_pdf


router = APIRouter(prefix="/api/parse", tags=["parse"])


@router.get("/detail/{projectuuid}", response_model=ParseDetailResponse)
def get_project_parse_detail(projectuuid: str, _: User = Depends(get_current_user)) -> ParseDetailResponse:
    client = PublicAnnouncementClient()
    detail = client.get_project_detail(projectuuid)
    if not detail:
        raise HTTPException(status_code=404, detail="项目详情不存在")
    items: List[ParseDetailItem] = []
    for it in detail.items:
        items.append(ParseDetailItem(sendid=it.sendid, item_name=it.item_name, url=it.url))
    return ParseDetailResponse(projectuuid=detail.projectuuid, project_name=detail.project_name, items=items)


@router.post("/captcha/start", response_model=ParseCaptchaStartResponse)
def start_captcha(payload: ParseCaptchaStartRequest, _: User = Depends(get_current_user)) -> ParseCaptchaStartResponse:
    client = PublicAnnouncementClient()
    cookies, img_bytes = establish_session_and_get_captcha(client, payload.projectuuid, payload.sendid)
    s = session_manager.create(payload.projectuuid, payload.sendid, cookies)
    return ParseCaptchaStartResponse(parse_session_id=s.id, captcha_image_base64=to_base64_image(img_bytes))


@router.post("/captcha/verify", response_model=ParseCaptchaVerifyResponse)
def verify_captcha_code(payload: ParseCaptchaVerifyRequest, _: User = Depends(get_current_user)) -> ParseCaptchaVerifyResponse:
    s = session_manager.get(payload.parse_session_id)
    if not s:
        raise HTTPException(status_code=404, detail="会话不存在或已过期")
    client = PublicAnnouncementClient()
    ok = verify_captcha(client, s.cookies, s.referer, payload.code)
    if ok:
        s.verified_captcha_code = payload.code
        return ParseCaptchaVerifyResponse(ok=True)
    # 失败则返回新验证码图片，便于前端刷新
    cookies, img_bytes = establish_session_and_get_captcha(client, s.projectuuid, s.sendid)
    s.cookies = cookies
    return ParseCaptchaVerifyResponse(ok=False, captcha_image_base64=to_base64_image(img_bytes))


@router.post("/download", response_model=ParseDownloadResponse)
def download_and_extract(payload: ParseDownloadRequest, db: Session = Depends(get_db), _: User = Depends(get_current_user)) -> ParseDownloadResponse:
    s = session_manager.get(payload.parse_session_id)
    if not s:
        raise HTTPException(status_code=404, detail="会话不存在或已过期")
    if not s.verified_captcha_code:
        raise HTTPException(status_code=400, detail="验证码未验证")

    # Use sendid from payload if provided, otherwise use session's sendid
    sendid = payload.sendid or s.sendid

    client = PublicAnnouncementClient()
    content = download_with_session(client, s.cookies, s.referer, sendid, payload.flag, s.verified_captcha_code)

    # Extract filename from url if provided, otherwise use sendid
    if payload.url:
        filename = os.path.basename(payload.url)
    else:
        filename = f"{sendid}.pdf"

    saved_path = save_to_project_dir(s.projectuuid, filename, content)

    extracted_fields = None
    # If not download-only and file is a PDF, try to parse
    if not payload.download_only and filename.lower().endswith(".pdf"):
        try:
            extracted_fields = extract_from_pdf(saved_path)
        except Exception:
            # PDF 无法解析则略过提取，仍返回保存路径
            extracted_fields = None

    project = db.get(ValuableProject, payload.projectuuid)
    if not project:
        raise HTTPException(status_code=404, detail="项目记录不存在")
    if extracted_fields:
        project.pdf_extract_json = __import__("json").dumps(extracted_fields, ensure_ascii=False)
        project.parsed_pdf = True
        project.parsed_at = datetime.utcnow()
        # 删除临时PDF文件以节省空间
        try:
            if os.path.exists(saved_path):
                os.remove(saved_path)
        except Exception:
            pass
        project.pdf_file_path = None
        db.add(project)
        db.commit()
    else:
        # 仅保存文件路径（download_only 或非PDF或解析失败）
        project.pdf_file_path = saved_path
        db.add(project)
        db.commit()

    return ParseDownloadResponse(ok=True, saved_path=saved_path, parsed_fields=extracted_fields)


@router.post("/download-file")
def download_file_to_client(payload: ParseDownloadRequest, _: User = Depends(get_current_user)) -> Response:
    """
    Directly stream the file bytes to client for download.
    Requires a verified captcha session.
    This does not store the file on server nor parse it.
    """
    s = session_manager.get(payload.parse_session_id)
    if not s:
        raise HTTPException(status_code=404, detail="会话不存在或已过期")
    if not s.verified_captcha_code:
        raise HTTPException(status_code=400, detail="验证码未验证")

    # Use sendid from payload if provided, otherwise session's sendid
    sendid = payload.sendid or s.sendid
    client = PublicAnnouncementClient()
    content = download_with_session(client, s.cookies, s.referer, sendid, payload.flag, s.verified_captcha_code)

    # Determine filename and media type
    if payload.url:
        filename = os.path.basename(payload.url)
    else:
        filename = f"{sendid}.pdf"
    media_type = "application/pdf" if filename.lower().endswith(".pdf") else "application/octet-stream"
    headers = {"Content-Disposition": f"attachment; filename={filename}"}
    return Response(content=content, media_type=media_type, headers=headers)
