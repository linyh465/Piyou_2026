"""
Bug 回報路由 / Bug Report Router
POST /report-error — 接收前端錯誤並透過 Email 通知開發者
Receives frontend errors and notifies the developer via email.

設定方式（Railway 環境變數）/ Configuration (Railway environment variables):
  BUG_REPORT_EMAIL  — 收件人信箱 / Recipient email
  SMTP_HOST         — SMTP 伺服器 / SMTP server (default: smtp.gmail.com)
  SMTP_PORT         — SMTP 埠號 / SMTP port (default: 587)
  SMTP_USER         — SMTP 帳號 / SMTP username
  SMTP_PASSWORD     — SMTP 密碼 / SMTP password
"""
import os
import smtplib
import asyncio
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone
from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/report-error", tags=["Bug 回報 / Bug Report"])
logger = logging.getLogger(__name__)


class ErrorReport(BaseModel):
    """前端錯誤回報資料 / Frontend error report payload"""
    message: str
    stack: Optional[str] = None
    component_stack: Optional[str] = None
    url: Optional[str] = None
    user_agent: Optional[str] = None


def _send_email(report: ErrorReport, client_ip: str) -> None:
    """使用 smtplib 同步傳送錯誤信件 / Send error email synchronously via smtplib"""
    recipient = os.getenv("BUG_REPORT_EMAIL", "")
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    try:
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
    except ValueError:
        smtp_port = 587
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASSWORD", "")

    if not recipient or not smtp_user or not smtp_pass:
        logger.warning("Bug report email not configured — skipping email send")
        return

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    body = f"""披呦 Bug 回報 / Piyou Bug Report
時間 / Time: {now}
URL: {report.url or 'N/A'}
IP: {client_ip}
User-Agent: {report.user_agent or 'N/A'}

錯誤訊息 / Error Message:
{report.message}

Stack Trace:
{report.stack or 'N/A'}

Component Stack:
{report.component_stack or 'N/A'}
"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"[Piyou Bug] {report.message[:80]}"
    msg["From"] = smtp_user
    msg["To"] = recipient
    msg.attach(MIMEText(body, "plain", "utf-8"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.ehlo()
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, [recipient], msg.as_string())
        logger.info("Bug report email sent successfully")
    except Exception as exc:
        logger.error("Failed to send bug report email: %s", exc)


@router.post("", status_code=202)
async def report_error(payload: ErrorReport, request: Request):
    """
    接收前端錯誤並非同步寄送 Email。
    Receives frontend error and sends an email asynchronously.
    回傳 202 Accepted，不阻塞前端。
    Returns 202 Accepted without blocking the frontend.
    """
    forwarded = request.headers.get("x-forwarded-for")
    client_ip = forwarded.split(",")[0].strip() if forwarded else (
        request.client.host if request.client else "unknown"
    )

    # 非同步執行避免阻塞 event loop / Run in thread pool to avoid blocking the event loop
    loop = asyncio.get_running_loop()
    asyncio.ensure_future(loop.run_in_executor(None, _send_email, payload, client_ip))

    return {"status": "received"}
