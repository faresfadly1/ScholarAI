from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.security import admin_user, current_user
from app.core.limits import limit
from app.db.session import get_db
from app.models.entities import AuditLog, Document, Requirement, Scholarship
from app.schemas.contracts import Criterion, ScholarshipInput, ScholarshipUpdate, UrlInput
from app.services.repository import owned, serialize
from app.services.url_fetcher import validate_url
from app.tasks.queue import enqueue

router = APIRouter(prefix="/api", tags=["Scholarships"])


def submit(db, item):
    db.add(item)
    db.commit()
    enqueue("scholarship", item.id)
    db.refresh(item)
    return serialize(item)


@router.post("/scholarships/manual", status_code=202)
def manual(
    body: ScholarshipInput,
    request: Request,
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    limit(request, "scholarship", 10, user.id)
    return submit(
        db,
        Scholarship(
            user_id=user.id,
            name=body.name,
            source_text=body.text,
            data=body.model_dump(mode="json", exclude={"text", "name"}),
        ),
    )


@router.post("/scholarships/from-url", status_code=202)
def from_url(
    body: UrlInput, request: Request, user=Depends(current_user), db: Session = Depends(get_db)
):
    limit(request, "scholarship", 10, user.id)
    try:
        validate_url(body.url)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return submit(
        db,
        Scholarship(
            user_id=user.id,
            name=body.name,
            source_url=body.url,
            source_text="",
            source_type="Unverified public webpage",
        ),
    )


@router.post("/scholarships/from-document", status_code=202)
def from_document(
    document_id: str,
    name: str,
    request: Request,
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    limit(request, "scholarship", 10, user.id)
    doc = owned(db, Document, document_id, user.id)
    if doc.status != "Processed":
        raise HTTPException(409, "Wait for document processing to finish")
    if not 3 <= len(name) <= 250:
        raise HTTPException(422, "Name must be 3–250 characters")
    return submit(
        db,
        Scholarship(
            user_id=user.id,
            name=name,
            source_text=doc.parsed_text,
            source_document_id=doc.id,
            source_type="Uploaded document (unverified)",
        ),
    )


@router.get("/scholarships")
def listing(user=Depends(current_user), db: Session = Depends(get_db)):
    return [
        serialize(s)
        for s in db.scalars(
            select(Scholarship)
            .where(Scholarship.user_id == user.id)
            .order_by(Scholarship.created_at.desc())
        )
    ]


@router.get("/scholarships/{scholarship_id}")
def detail(scholarship_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    item = owned(db, Scholarship, scholarship_id, user.id)
    return {
        **serialize(item),
        "requirements": [
            serialize(r)
            for r in db.scalars(select(Requirement).where(Requirement.scholarship_id == item.id))
        ],
    }


@router.put("/scholarships/{scholarship_id}")
def update(
    scholarship_id: str,
    body: ScholarshipUpdate,
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    item = owned(db, Scholarship, scholarship_id, user.id)
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(item, key, value)
    item.version += 1
    db.commit()
    return serialize(item)


@router.post("/scholarships/{scholarship_id}/retry", status_code=202)
def retry(scholarship_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    item = owned(db, Scholarship, scholarship_id, user.id)
    if item.status == "Processing":
        raise HTTPException(409, "Scholarship is already processing")
    item.status = "Processing"
    item.version += 1
    db.commit()
    enqueue("scholarship", item.id)
    return {"id": item.id}


@router.get("/admin/scholarships")
def admin_list(user=Depends(admin_user), db: Session = Depends(get_db)):
    return [
        {
            **serialize(s),
            "requirements": [
                serialize(r)
                for r in db.scalars(select(Requirement).where(Requirement.scholarship_id == s.id))
            ],
        }
        for s in db.scalars(select(Scholarship))
    ]


@router.patch("/admin/requirements/{requirement_id}")
def admin_update(
    requirement_id: str, body: Criterion, user=Depends(admin_user), db: Session = Depends(get_db)
):
    item = db.get(Requirement, requirement_id)
    if not item:
        raise HTTPException(404, "Requirement not found")
    scholarship = db.get(Scholarship, item.scholarship_id)
    if body.source_text not in scholarship.source_text:
        raise HTTPException(422, "Requirement must quote its source")
    item.data = body.model_dump(mode="json")
    item.admin_verified = body.admin_verified
    item.version += 1
    scholarship.version += 1
    db.add(AuditLog(user_id=user.id, action="requirement.reviewed", resource_id=item.id))
    db.commit()
    return serialize(item)


@router.patch("/admin/scholarships/{scholarship_id}")
def admin_deactivate(
    scholarship_id: str,
    body: ScholarshipUpdate,
    user=Depends(admin_user),
    db: Session = Depends(get_db),
):
    item = db.get(Scholarship, scholarship_id)
    if not item:
        raise HTTPException(404, "Scholarship not found")
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(item, key, value)
    item.version += 1
    db.commit()
    return serialize(item)


@router.get("/admin/health")
def admin_health(user=Depends(admin_user)):
    from app.main import ready

    return ready()
