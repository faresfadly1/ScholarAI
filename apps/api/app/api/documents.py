from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import RedirectResponse, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.security import current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.entities import AuditLog, Document, DocumentFact, utcnow
from app.parsers.documents import TYPES, detect_mime
from app.schemas.contracts import FactCorrection
from app.services.repository import owned, serialize
from app.services.storage import storage
from app.tasks.queue import enqueue

router = APIRouter(prefix="/api/documents", tags=["Documents"])


@router.get("")
def list_documents(user=Depends(current_user), db: Session = Depends(get_db)):
    return [
        serialize(d)
        for d in db.scalars(
            select(Document).where(Document.user_id == user.id).order_by(Document.created_at.desc())
        )
    ]


@router.post("", status_code=202)
async def upload(
    document_type: str = Form(...),
    file: UploadFile = File(...),
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    if document_type not in TYPES:
        raise HTTPException(422, "Unknown document type")
    content = await file.read(settings.max_upload_mb * 1024 * 1024 + 1)
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"Maximum file size is {settings.max_upload_mb} MB")
    try:
        mime = detect_mime(content)
    except ValueError as exc:
        raise HTTPException(415, str(exc)) from exc
    if file.content_type and file.content_type not in {mime, "application/octet-stream"}:
        raise HTTPException(415, "Declared file type does not match file contents")
    key = f"{user.id}/{uuid4()}"
    storage.put(key, content, mime)
    document = Document(
        user_id=user.id,
        filename=(file.filename or "document").replace("/", "_").replace("\\", "_")[:255],
        document_type=document_type,
        storage_key=key,
        file_size=len(content),
        mime_type=mime,
    )
    db.add(document)
    db.commit()
    enqueue("document", document.id)
    db.refresh(document)
    return serialize(document)


@router.get("/{document_id}")
def detail(document_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    document = owned(db, Document, document_id, user.id)
    return {
        **serialize(document),
        "facts": [
            serialize(f)
            for f in db.scalars(
                select(DocumentFact).where(
                    DocumentFact.document_id == document.id, DocumentFact.user_id == user.id
                )
            )
        ],
    }


@router.get("/{document_id}/download")
def download(document_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    document = owned(db, Document, document_id, user.id)
    signed_url = storage.signed_url(
        document.storage_key, document.mime_type, document.filename
    )
    if signed_url:
        return RedirectResponse(
            signed_url,
            status_code=307,
            headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"},
        )
    return Response(
        storage.get(document.storage_key),
        media_type=document.mime_type,
        headers={
            "Content-Disposition": 'attachment; filename="document"',
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.delete("/{document_id}")
def remove(document_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    document = owned(db, Document, document_id, user.id)
    storage.delete(document.storage_key)
    db.delete(document)
    db.add(AuditLog(user_id=user.id, action="document.deleted", resource_id=document_id))
    db.commit()
    return {
        "ok": True,
        "message": "Document deleted. Existing analysis snapshots remain until you delete those analyses or your account.",
    }


@router.post("/{document_id}/reprocess", status_code=202)
def reprocess(document_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    document = owned(db, Document, document_id, user.id)
    if document.status in {"Processing", "Uploaded"}:
        raise HTTPException(409, "This document is already processing")
    document.status, document.error = "Uploaded", None
    document.version += 1
    db.commit()
    enqueue("document", document.id)
    return {"id": document.id, "status": "Uploaded"}


@router.patch("/{document_id}/facts/{fact_id}")
def correct_fact(
    document_id: str,
    fact_id: str,
    body: FactCorrection,
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    document = owned(db, Document, document_id, user.id)
    fact = owned(db, DocumentFact, fact_id, user.id)
    if fact.document_id != document.id:
        raise HTTPException(404, "Fact not found")
    if fact.key in {"toefl", "ielts", "gpa", "gpa_scale"}:
        try:
            value = float(body.value)
        except (ValueError, TypeError):
            raise HTTPException(422, "This fact must be numeric") from None
        maximum = {"toefl": 120, "ielts": 9, "gpa": 100, "gpa_scale": 100}[fact.key]
        if not 0 <= value <= maximum:
            raise HTTPException(422, "Score is outside the valid range")
        fact.value = value
    else:
        fact.value = body.value
    fact.verified, fact.corrected_at = True, utcnow()
    document.version += 1
    db.add(AuditLog(user_id=user.id, action="fact.corrected", resource_id=fact.id))
    db.commit()
    return serialize(fact)
