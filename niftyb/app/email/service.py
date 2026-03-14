"""High-level email sending functions."""
import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path

from app.email.client import get_sendgrid_client, jinja_env

logger = logging.getLogger(__name__)

_TMP_DIR = Path(__file__).parent.parent.parent / "tmp"


def _render(template_name: str, **ctx) -> str:
    from app.config import settings
    ctx.setdefault("year", datetime.now(timezone.utc).year)
    ctx.setdefault("frontend_url", settings.frontend_url.rstrip("/"))
    return jinja_env.get_template(template_name).render(**ctx)


def _save_to_tmp(to_email: str, subject: str, html_content: str) -> None:
    """Write the rendered email to tmp/ for local inspection."""
    _TMP_DIR.mkdir(exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")
    safe_to = to_email.replace("@", "_at_").replace(".", "_")
    path = _TMP_DIR / f"{timestamp}_{safe_to}.html"

    path.write_text(html_content, encoding="utf-8")
    logger.info("Email saved to %s (subject: %s)", path, subject)


def _send_sync(to_email: str, to_name: str, subject: str, html_content: str) -> None:
    """
    Blocking send.
    - Non-production: writes to tmp/
    - Production: sends via SendGrid
    """
    from app.config import settings

    if settings.app_env != "production":
        _save_to_tmp(to_email, subject, html_content)
        return

    from sendgrid.helpers.mail import Mail, From, To, Subject, HtmlContent

    client = get_sendgrid_client()
    if client is None:
        logger.warning("SendGrid client not configured.")
        return

    message = Mail(
        from_email=From(settings.sendgrid_from_email, settings.sendgrid_from_name),
        to_emails=To(to_email, to_name),
        subject=Subject(subject),
        html_content=HtmlContent(html_content),
    )

    try:
        response = client.send(message)
        logger.info(
            "Email sent",
            extra={
                "to": to_email,
                "subject": subject,
                "status": response.status_code,
            },
        )
    except Exception:
        logger.exception(
            "Email send failed",
            extra={"to": to_email, "subject": subject},
        )


def _dispatch(to_email: str, to_name: str, subject: str, html: str) -> None:
    """
    Fire-and-forget background send.
    Uses threadpool so we don't block the event loop.
    """
    loop = asyncio.get_running_loop()

    # Schedule sync email send in thread pool
    loop.run_in_executor(
        None,
        _send_sync,
        to_email,
        to_name,
        subject,
        html,
    )


async def send_welcome_email(user, verification_url: str) -> None:
    """Send the welcome + verify email to an admin-created user."""
    html = _render(
        "welcome.html",
        user_name=user.name,
        verification_url=verification_url,
    )

    _dispatch(
        user.email,
        user.name,
        "Verify your Nifty account",
        html,
    )


async def send_invite_email(user, temp_password: str, verification_url: str) -> None:
    """Send the org-admin invite email with temp credentials + verify link."""
    html = _render(
        "invite.html",
        user_name=user.name,
        temp_password=temp_password,
        verification_url=verification_url,
    )

    _dispatch(
        user.email,
        user.name,
        "You've been invited to Nifty",
        html,
    )


async def send_reset_password_email(user, reset_url: str) -> None:
    """Send a password reset email with a 1-hour reset link."""
    html = _render("reset_password.html", user_name=user.name, reset_url=reset_url)
    _dispatch(user.email, user.name, "Reset your Nifty password", html)


async def send_account_updated_email(to_name: str, to_email: str, changes: list[str]) -> None:
    """Notify a user that their account details were changed.

    ``to_email`` should be the address *before* any email change so the real
    account owner always receives the notification.
    """
    html = _render(
        "account_updated.html",
        user_name=to_name,
        changes=changes,
    )
    _dispatch(to_email, to_name, "Your Nifty account was updated", html)


async def send_tutor_application_email(user, phone: str | None) -> None:
    """Notify support of a new tutor application."""
    html = _render(
        "tutor_application.html",
        applicant_name=user.name,
        applicant_email=user.email,
        phone=phone or "Not provided",
    )
    _dispatch(
        "support@paragoneschool.com",
        "Nifty Support",
        f"New Tutor Application — {user.name}",
        html,
    )
