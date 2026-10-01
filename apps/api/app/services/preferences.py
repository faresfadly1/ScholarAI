from sqlalchemy import select

from app.models.entities import Profile


def external_ai_allowed(db, user_id):
    profile = db.scalar(select(Profile).where(Profile.user_id == user_id))
    return bool(profile and profile.data.get("ai_enabled", True))
