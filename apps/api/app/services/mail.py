import json
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from pathlib import Path

from app.auth.security import digest
from app.core.config import settings
from app.models.entities import AuthToken


def send_token(db, user, purpose):
    token = secrets.token_urlsafe(40)
    db.add(
        AuthToken(
            user_id=user.id,
            token_hash=digest(token),
            purpose=purpose,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
    )
    db.commit()
    route = "reset-password" if purpose == "reset" else "verify-email"
    link = f"{settings.app_url}/{route}?token={token}"
    subject = (
        "Reset your ScholarAI password" if purpose == "reset" else "Verify your ScholarAI email"
    )
    if settings.smtp_host:
        message = EmailMessage()
        message["Subject"], message["From"], message["To"] = subject, settings.smtp_from, user.email
        message.set_content(f"{subject}\n\n{link}\n\nThis link expires in one hour.")
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as client:
            client.starttls()
            if settings.smtp_user:
                client.login(settings.smtp_user, settings.smtp_password)
            client.send_message(message)
    elif settings.environment != "production":
        directory = Path(".data/mail")
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        path = directory / f"{secrets.token_hex(12)}.json"
        path.write_text(json.dumps({"to": user.email, "subject": subject, "url": link}))
        path.chmod(0o600)
    else:
        raise RuntimeError("SMTP is required in production")
