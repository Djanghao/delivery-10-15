from __future__ import annotations

import base64
import os
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional, Tuple
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from ..config import DATA_DIR
from ..crawler.client import PublicAnnouncementClient


CAPTCHA_IMG_URL = (
    "https://tzxm.zjzwfw.gov.cn/publicannouncement.do?method=publicCheckContent&t={ts}"
)
CHECK_RANDOM_URL = (
    "https://tzxm.zjzwfw.gov.cn/publicannouncement.do?method=CheckRandom"
)
BASE_HOST = "https://tzxm.zjzwfw.gov.cn/"


@dataclass
class ParseSession:
    id: str
    projectuuid: str
    sendid: str
    cookies: str
    referer: str
    created_at: float
    updated_at: float
    verified_captcha_code: Optional[str] = None


class ParseSessionManager:
    def __init__(self) -> None:
        self._sessions: Dict[str, ParseSession] = {}

    def create(self, projectuuid: str, sendid: str, cookies: str) -> ParseSession:
        sid = str(uuid.uuid4())
        referer = (
            "https://tzxm.zjzwfw.gov.cn/tzxmweb/zwtpages/resultsPublicity/"
            f"notice_of_publicity_content_new.html?pUid={projectuuid}&sendid={sendid}"
        )
        now = time.time()
        session = ParseSession(
            id=sid,
            projectuuid=projectuuid,
            sendid=sendid,
            cookies=cookies,
            referer=referer,
            created_at=now,
            updated_at=now,
        )
        self._sessions[sid] = session
        self.cleanup()
        return session

    def get(self, sid: str) -> Optional[ParseSession]:
        s = self._sessions.get(sid)
        if s:
            s.updated_at = time.time()
        return s

    def cleanup(self, ttl_sec: int = 900) -> None:
        now = time.time()
        expired = [sid for sid, s in self._sessions.items() if now - s.updated_at > ttl_sec]
        for sid in expired:
            self._sessions.pop(sid, None)


session_manager = ParseSessionManager()


def _extract_cookies_from_headers(headers) -> str:
    # urllib response headers mapping supports get_all for Set-Cookie
    # Fallback to get for single header.
    set_cookies = []
    try:
        set_cookies = headers.get_all("Set-Cookie") or []
    except Exception:
        v = headers.get("Set-Cookie")
        if v:
            set_cookies = [v]
    # Only need JSESSIONID and SERVERID
    pairs: Dict[str, str] = {}
    for sc in set_cookies:
        parts = sc.split(";")
        if parts:
            name, _, value = parts[0].partition("=")
            if name in ("JSESSIONID", "SERVERID"):
                pairs[name] = value
    return "; ".join(f"{k}={v}" for k, v in pairs.items() if v)


def establish_session_and_get_captcha(client: PublicAnnouncementClient, projectuuid: str, sendid: str) -> Tuple[str, bytes]:
    # Step 1: establish session by calling projectDetail (POST)
    params = {"method": "projectDetail", "projectuuid": projectuuid}
    query = urlencode(params)
    url = f"{client.BASE_URL}?{query}"
    req = Request(url, data=urlencode({}).encode("utf-8"), headers=client.headers, method="POST")
    with urlopen(req, timeout=client.timeout) as resp:
        cookies = _extract_cookies_from_headers(resp.headers)
        # consume body to complete request
        _ = resp.read()

    # Step 2: fetch captcha image (GET)
    ts = int(time.time() * 1000)
    cap_url = CAPTCHA_IMG_URL.format(ts=ts)
    headers = dict(client.headers)
    headers.update(
        {
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            "Cookie": cookies,
            "Referer": (
                "https://tzxm.zjzwfw.gov.cn/tzxmweb/zwtpages/resultsPublicity/"
                f"notice_of_publicity_content_new.html?pUid={projectuuid}&sendid={sendid}"
            ),
        }
    )
    img_req = Request(cap_url, headers=headers, method="GET")
    with urlopen(img_req, timeout=client.timeout) as img_resp:
        img_bytes = img_resp.read()
    return cookies, img_bytes


def verify_captcha(client: PublicAnnouncementClient, cookies: str, referer: str, code: str) -> bool:
    headers = dict(client.headers)
    headers.update(
        {
            "Cookie": cookies,
            "Referer": referer,
        }
    )
    form = urlencode({"Txtidcode": code}).encode("utf-8")
    req = Request(CHECK_RANDOM_URL, data=form, headers=headers, method="POST")
    with urlopen(req, timeout=client.timeout) as resp:
        payload = resp.read().decode("utf-8", errors="replace")
    return '"random_flag":"1"' in payload


def download_with_session(client: PublicAnnouncementClient, cookies: str, referer: str, sendid: str, flag: str, captcha_code: str) -> bytes:
    # Build the correct download URL according to the API specification
    download_url = f"{BASE_HOST}publicannouncement.do?method=downFile&sendid={sendid}&flag={flag}&Txtidcode={captcha_code}"
    headers = dict(client.headers)
    headers.update({"Cookie": cookies, "Referer": referer})
    req = Request(download_url, headers=headers, method="GET")
    with urlopen(req, timeout=client.timeout) as resp:
        return resp.read()


def to_base64_image(data: bytes) -> str:
    return "data:image/jpeg;base64," + base64.b64encode(data).decode("ascii")


def save_to_project_dir(projectuuid: str, filename: str, data: bytes) -> str:
    base = Path(DATA_DIR) / "downloads" / projectuuid
    base.mkdir(parents=True, exist_ok=True)
    path = base / filename
    with open(path, "wb") as f:
        f.write(data)
    return path.as_posix()

