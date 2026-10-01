from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.security import current_user
from app.core.limits import limit
from app.db.session import get_db
from app.models.entities import (
    Analysis,
    ChatMessage,
    ChatThread,
    Document,
    RoadmapTask,
    Scholarship,
    SimulationRun,
)
from app.schemas.contracts import AnalysisInput, ChatInput, SimulationInput, TaskUpdate
from app.services.analysis import build_snapshot, simulate
from app.services.repository import owned, serialize
from app.tasks.queue import enqueue

router = APIRouter(prefix="/api", tags=["Analysis"])


def create_analysis(db, user_id, scholarship_id):
    scholarship = owned(db, Scholarship, scholarship_id, user_id)
    if scholarship.status != "Ready" or not scholarship.active:
        raise HTTPException(409, "Scholarship must be active and fully processed")
    pending = db.scalar(
        select(Document.id).where(
            Document.user_id == user_id, Document.status.in_(["Uploaded", "Processing"])
        )
    )
    if pending:
        raise HTTPException(409, "Wait for your documents to finish processing before analysis")
    version = (
        db.scalar(
            select(func.max(Analysis.version)).where(
                Analysis.user_id == user_id, Analysis.scholarship_id == scholarship.id
            )
        )
        or 0
    ) + 1
    analysis = Analysis(
        user_id=user_id,
        scholarship_id=scholarship.id,
        version=version,
        snapshot=build_snapshot(db, user_id, scholarship),
    )
    db.add(analysis)
    db.commit()
    enqueue("analysis", analysis.id)
    db.refresh(analysis)
    return serialize(analysis)


@router.post("/analyses", status_code=202)
def create(
    body: AnalysisInput, request: Request, user=Depends(current_user), db: Session = Depends(get_db)
):
    limit(request, "analysis", 10, user.id)
    return create_analysis(db, user.id, body.scholarship_id)


@router.get("/analyses")
def listing(user=Depends(current_user), db: Session = Depends(get_db)):
    return [
        serialize(a)
        for a in db.scalars(
            select(Analysis).where(Analysis.user_id == user.id).order_by(Analysis.created_at.desc())
        )
    ]


@router.get("/analyses/{analysis_id}")
def detail(analysis_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    return serialize(owned(db, Analysis, analysis_id, user.id))


@router.delete("/analyses/{analysis_id}")
def delete_analysis(analysis_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    item = owned(db, Analysis, analysis_id, user.id)
    db.delete(item)
    db.commit()
    return {"ok": True}


@router.post("/analyses/{analysis_id}/rerun", status_code=202)
def rerun(
    analysis_id: str, request: Request, user=Depends(current_user), db: Session = Depends(get_db)
):
    limit(request, "analysis", 10, user.id)
    old = owned(db, Analysis, analysis_id, user.id)
    return create_analysis(db, user.id, old.scholarship_id)


@router.post("/analyses/{analysis_id}/simulate")
def simulation(
    analysis_id: str,
    body: SimulationInput,
    request: Request,
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    limit(request, "simulation", 30, user.id)
    analysis = owned(db, Analysis, analysis_id, user.id)
    if analysis.status != "Completed":
        raise HTTPException(409, "Wait for the analysis to complete")
    result = simulate(analysis.snapshot, body.model_dump(mode="json", exclude_none=True))
    db.add(SimulationRun(user_id=user.id, analysis_id=analysis.id, data=result))
    db.commit()
    return result


@router.get("/analyses/{analysis_id}/roadmap")
def roadmap(analysis_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    owned(db, Analysis, analysis_id, user.id)
    return [
        serialize(t)
        for t in db.scalars(
            select(RoadmapTask).where(
                RoadmapTask.analysis_id == analysis_id, RoadmapTask.user_id == user.id
            )
        )
    ]


@router.get("/roadmap")
def all_roadmap(user=Depends(current_user), db: Session = Depends(get_db)):
    return [
        serialize(t)
        for t in db.scalars(
            select(RoadmapTask)
            .where(RoadmapTask.user_id == user.id)
            .order_by(RoadmapTask.created_at.desc())
        )
    ]


@router.patch("/roadmap/tasks/{task_id}")
def task_update(
    task_id: str, body: TaskUpdate, user=Depends(current_user), db: Session = Depends(get_db)
):
    item = owned(db, RoadmapTask, task_id, user.id)
    item.status = body.status
    db.commit()
    return serialize(item)


@router.post("/analyses/{analysis_id}/chat", status_code=202)
def chat(
    analysis_id: str,
    body: ChatInput,
    request: Request,
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    limit(request, "chat", 15, user.id)
    analysis = owned(db, Analysis, analysis_id, user.id)
    if analysis.status != "Completed":
        raise HTTPException(409, "Wait for analysis to complete")
    thread = db.scalar(
        select(ChatThread).where(
            ChatThread.analysis_id == analysis.id, ChatThread.user_id == user.id
        )
    )
    if not thread:
        db.add(ChatThread(user_id=user.id, analysis_id=analysis.id, data={}))
    message = ChatMessage(
        user_id=user.id,
        analysis_id=analysis.id,
        data={"question": body.message, "status": "Processing"},
    )
    db.add(message)
    db.commit()
    enqueue("chat", message.id)
    db.refresh(message)
    return serialize(message)


@router.get("/analyses/{analysis_id}/chat")
def history(analysis_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    owned(db, Analysis, analysis_id, user.id)
    return [
        serialize(m)
        for m in db.scalars(
            select(ChatMessage)
            .where(ChatMessage.analysis_id == analysis_id, ChatMessage.user_id == user.id)
            .order_by(ChatMessage.created_at)
        )
    ]


@router.post("/compare")
def compare(body: list[str], user=Depends(current_user), db: Session = Depends(get_db)):
    if not 1 <= len(body) <= 4:
        raise HTTPException(422, "Select between one and four analyses")
    return [serialize(owned(db, Analysis, analysis_id, user.id)) for analysis_id in body]
