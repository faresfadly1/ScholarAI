from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.security import (
    DUMMY_HASH,
    current_user,
    digest,
    hasher,
    new_session,
    password_matches,
    public_user,
    revoke_sessions,
)
from app.core.config import settings
from app.core.limits import limit
from app.db.session import get_db
from app.models.entities import AuthToken, Profile, User
from app.schemas.contracts import Credentials, EmailInput, Registration, ResetInput, TokenInput
from app.services.mail import send_token

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", status_code=201)
def register(
    body: Registration, request: Request, response: Response, db: Session = Depends(get_db)
):
    limit(request, "register", 5)
    user = User(
        name=body.name.strip(),
        email=str(body.email).lower(),
        password_hash=hasher.hash(body.password),
    )
    db.add(user)
    try:
        db.flush()
        db.add(Profile(user_id=user.id, data={"full_name": user.name}))
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "An account with this email already exists") from None
    send_token(db, user, "verify")
    return new_session(db, user, response)


@router.post("/login")
def login(body: Credentials, request: Request, response: Response, db: Session = Depends(get_db)):
    limit(request, "login", 10)
    user = db.scalar(select(User).where(User.email == str(body.email).lower()))
    valid = password_matches(user.password_hash if user else DUMMY_HASH, body.password)
    if not user or not valid:
        raise HTTPException(401, "Email or password is incorrect")
    return new_session(db, user, response)


@router.post("/demo")
def demo_login(request: Request, response: Response, db: Session = Depends(get_db)):
    """Open the synthetic workspace without exposing or requiring its password."""
    if not settings.free_deployment_mode:
        raise HTTPException(404, "Demo login is available on the hosted free application")
    limit(request, "demo-login", 5)
    user = db.scalar(select(User).where(User.email == "alex@scholarai.demo"))
    if not user:
        raise HTTPException(
            503, "The synthetic demo is still being prepared. Please retry shortly."
        )
    return new_session(db, user, response)


@router.get("/me")
def me(request: Request, user=Depends(current_user)):
    return {"user": public_user(user), "csrf_token": request.state.session.csrf_token}


@router.post("/logout")
def logout(
    request: Request, response: Response, user=Depends(current_user), db: Session = Depends(get_db)
):
    db.delete(request.state.session)
    db.commit()
    response.delete_cookie("scholarai_session")
    return {"ok": True}


@router.post("/forgot-password")
def forgot(body: EmailInput, request: Request, db: Session = Depends(get_db)):
    limit(request, "password-reset", 3)
    user = db.scalar(select(User).where(User.email == str(body.email).lower()))
    if user:
        send_token(db, user, "reset")
    return {"message": "If this account exists, a reset link has been sent."}


def consume_token(db, token, purpose):
    # Atomic DELETE RETURNING ensures a token is single-use even under concurrent requests.
    user_id = db.execute(
        delete(AuthToken)
        .where(
            AuthToken.token_hash == digest(token),
            AuthToken.purpose == purpose,
            AuthToken.expires_at > datetime.now(timezone.utc),
        )
        .returning(AuthToken.user_id)
    ).scalar_one_or_none()
    if not user_id:
        raise HTTPException(400, "This link is invalid or has expired")
    return db.get(User, user_id)


@router.post("/reset-password")
def reset(body: ResetInput, request: Request, db: Session = Depends(get_db)):
    limit(request, "reset", 5)
    user = consume_token(db, body.token, "reset")
    user.password_hash = hasher.hash(body.password)
    revoke_sessions(db, user.id)
    db.commit()
    return {"message": "Password updated. Please sign in."}


@router.post("/verify-email")
def verify(body: TokenInput, request: Request, db: Session = Depends(get_db)):
    limit(request, "verify", 5)
    user = consume_token(db, body.token, "verify")
    user.email_verified = True
    db.commit()
    return {"message": "Email verified"}
