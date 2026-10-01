from fastapi import HTTPException
from sqlalchemy import select


def owned(db, model, resource_id, user_id):
    item = db.scalar(select(model).where(model.id == resource_id, model.user_id == user_id))
    if not item:
        raise HTTPException(404, "Resource not found")
    return item


def serialize(item):
    return {
        column.name: getattr(item, column.name)
        for column in item.__table__.columns
        if column.name not in {"password_hash", "storage_key", "embedding", "token_hash"}
    }
