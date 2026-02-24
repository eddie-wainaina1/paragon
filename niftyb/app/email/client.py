"""SendGrid client and Jinja2 template environment setup."""
import logging
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

logger = logging.getLogger(__name__)

_TEMPLATES_DIR = Path(__file__).parent / "templates"

jinja_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATES_DIR)),
    autoescape=select_autoescape(["html"]),
)


def get_sendgrid_client():
    """
    Return a configured SendGridAPIClient or None if SENDGRID_API_KEY is unset.
    Import of the sendgrid package is deferred so a missing package only fails
    at send time, not at startup.
    """
    from app.config import settings
    from sendgrid import SendGridAPIClient

    if not settings.sendgrid_api_key:
        logger.warning("SENDGRID_API_KEY is not configured — email sending disabled")
        return None

    return SendGridAPIClient(api_key=settings.sendgrid_api_key)
