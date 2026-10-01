from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.auth.security import current_user, hasher, password_matches, revoke_sessions
from app.core.config import settings
from app.db.session import get_db
from app.models.entities import (
    AuditLog,
    Document,
    EducationRecord,
    ExperienceRecord,
    Profile,
    ResearchRecord,
    Skill,
    UserSkill,
)
from app.schemas.contracts import ProfileInput, SettingsInput
from app.services.repository import serialize

router = APIRouter(prefix="/api", tags=["Profile and privacy"])


@router.get("/profile")
def get_profile(user=Depends(current_user), db: Session = Depends(get_db)):
    profile = db.scalar(select(Profile).where(Profile.user_id == user.id))
    return {
        "data": profile.data,
        "version": profile.version,
        "gemini_available": settings.llm_provider == "gemini" and bool(settings.gemini_api_key),
    }


@router.put("/profile")
def update_profile(body: ProfileInput, user=Depends(current_user), db: Session = Depends(get_db)):
    profile = db.scalar(select(Profile).where(Profile.user_id == user.id))
    profile.data = body.model_dump(mode="json")
    profile.version += 1
    for model in (EducationRecord, ResearchRecord, ExperienceRecord, UserSkill):
        db.execute(delete(model).where(model.user_id == user.id))
    db.add(
        EducationRecord(
            user_id=user.id,
            data={
                k: profile.data[k]
                for k in [
                    "university",
                    "degree",
                    "field_of_study",
                    "gpa",
                    "gpa_scale",
                    "graduation_date",
                ]
            },
        )
    )
    for model, values in [(ResearchRecord, body.research), (ExperienceRecord, body.experience)]:
        for value in values:
            db.add(model(user_id=user.id, data={"description": value}))
    for name in sorted(set(body.skills)):
        skill = db.scalar(select(Skill).where(Skill.name == name))
        if not skill:
            skill = Skill(name=name)
            db.add(skill)
            db.flush()
        db.add(UserSkill(user_id=user.id, skill_id=skill.id))
    db.add(AuditLog(user_id=user.id, action="profile.updated", resource_id=profile.id))
    db.commit()
    return {"data": profile.data, "version": profile.version}


@router.put("/settings")
def settings_update(body: SettingsInput, user=Depends(current_user), db: Session = Depends(get_db)):
    if body.ai_enabled is not None:
        profile = db.scalar(select(Profile).where(Profile.user_id == user.id))
        profile.data = {**profile.data, "ai_enabled": body.ai_enabled}
        profile.version += 1
    if body.name:
        user.name = body.name
    if body.new_password:
        if not body.current_password or not password_matches(
            user.password_hash, body.current_password
        ):
            raise HTTPException(400, "Current password is incorrect")
        user.password_hash = hasher.hash(body.new_password)
        revoke_sessions(db, user.id)
    db.commit()
    return {"ok": True, "login_required": bool(body.new_password)}


@router.get("/account/export")
def export_account(user=Depends(current_user), db: Session = Depends(get_db)):
    from app.db.session import Base

    output = {"account": {"name": user.name, "email": user.email}}
    for mapper in Base.registry.mappers:
        model = mapper.class_
        if hasattr(model, "user_id") and model.__tablename__ not in {"sessions", "auth_tokens"}:
            output[model.__tablename__] = [
                serialize(item)
                for item in db.scalars(select(model).where(model.user_id == user.id))
            ]
    return output


@router.delete("/account")
def delete_account(user=Depends(current_user), db: Session = Depends(get_db)):
    from app.services.storage import storage

    for document in db.scalars(select(Document).where(Document.user_id == user.id)):
        storage.delete(document.storage_key)
    db.delete(user)
    db.commit()
    return {"ok": True}
