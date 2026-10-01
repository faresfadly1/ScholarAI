import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError
from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session as DBSession

from app.core.config import settings
from app.db.session import get_db
from app.models.entities import Session, User

hasher = PasswordHasher()
DUMMY_HASH = hasher.hash(secrets.token_urlsafe(32))


def digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def password_matches(encoded: str, password: str):
    try:
        return hasher.verify(encoded, password)
    except VerificationError:
        return False


def new_session(db: DBSession, user: User, response: Response):
    token, csrf = secrets.token_urlsafe(48), secrets.token_urlsafe(32)
    db.add(
        Session(
            user_id=user.id,
            token_hash=digest(token),
            csrf_token=csrf,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        )
    )
    db.commit()
    response.set_cookie(
        "scholarai_session",
        token,
        httponly=True,
        secure=settings.environment == "production",
        samesite="lax",
        max_age=604800,
        path="/",
    )
    return {"user": public_user(user), "csrf_token": csrf}


def public_user(user):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "email_verified": user.email_verified,
    }


def current_user(request: Request, db: DBSession = Depends(get_db)):
    token = request.cookies.get("scholarai_session", "")
    session = db.scalar(
        select(Session).where(
            Session.token_hash == digest(token), Session.expires_at > datetime.now(timezone.utc)
        )
    )
    if not session:
        raise HTTPException(401, "Please sign in to continue")
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        if not secrets.compare_digest(request.headers.get("x-csrf-token", ""), session.csrf_token):
            raise HTTPException(403, "Invalid CSRF token. Refresh and try again.")
    request.state.session = session
    return db.get(User, session.user_id)


def admin_user(user: User = Depends(current_user)):
    if user.role != "admin":
        raise HTTPException(403, "Administrator access required")
    return user


def revoke_sessions(db, user_id):
    db.execute(delete(Session).where(Session.user_id == user_id))
