import logging
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings

log = logging.getLogger("app.notify")


def notify_admin_of_contact(name: str, email: str | None, phone: str | None, subject: str | None, message: str) -> None:
    """Email the admin about a new contact message. No-op unless SMTP and ADMIN_NOTIFY_EMAIL are configured.

    Runs as a FastAPI background task; failures are logged, never raised to the visitor.
    """
    settings = get_settings()
    if not settings.smtp_host or not settings.admin_notify_email:
        log.info("New contact message from %s (email notifications not configured)", name)
        return
    msg = EmailMessage()
    msg["Subject"] = f"New contact message: {subject or 'No subject'}"
    msg["From"] = settings.smtp_from
    msg["To"] = settings.admin_notify_email
    if email:
        msg["Reply-To"] = email
    msg.set_content(f"Name: {name}\nEmail: {email or '-'}\nPhone: {phone or '-'}\n\n{message}")
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            smtp.starttls()
            if settings.smtp_user:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(msg)
    except (smtplib.SMTPException, OSError):
        log.exception("Failed to send contact notification email")
