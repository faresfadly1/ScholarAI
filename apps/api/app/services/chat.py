import json
import re

from pgvector.sqlalchemy import Vector
from pydantic import BaseModel
from sqlalchemy import select, type_coerce

from app.ai.providers import get_provider
from app.core.config import settings
from app.models.entities import Document, DocumentChunk
from app.services.preferences import external_ai_allowed


class ChatAnswer(BaseModel):
    answer: str
    source_ids: list[str]


def retrieve(db, analysis, question):
    provider = get_provider()
    vector = provider.embed([question])[0]
    # Query is always tenant-scoped. Old analyses do not retrieve newer document versions.
    snapshot_versions = {d["id"]: d["version"] for d in analysis.snapshot["documents"]}
    valid_docs = [
        d.id
        for d in db.scalars(
            select(Document).where(
                Document.user_id == analysis.user_id, Document.id.in_(snapshot_versions)
            )
        )
        if snapshot_versions[d.id] == d.version
        and d.extraction.get("embedding_provider", settings.llm_provider) == settings.llm_provider
    ]
    query = select(DocumentChunk).where(
        DocumentChunk.user_id == analysis.user_id, DocumentChunk.document_id.in_(valid_docs)
    )
    if db.bind.dialect.name == "postgresql":
        query = query.order_by(
            type_coerce(
                DocumentChunk.embedding, Vector(settings.embedding_dimensions)
            ).cosine_distance(vector)
        ).limit(5)
        return list(db.scalars(query))
    chunks = list(db.scalars(query))
    return sorted(
        chunks, key=lambda c: -sum(a * b for a, b in zip(c.embedding, vector, strict=True))
    )[:5]


def answer_question(db, analysis, question):
    evaluations = analysis.result["evaluations"]
    words = set(re.findall(r"\w{3,}", question.lower()))
    missing = bool(words & {"missing", "improve", "first", "gaps", "documents"})
    ranked = sorted(
        evaluations,
        key=lambda e: (
            -(
                len(
                    words
                    & set(
                        re.findall(
                            r"\w{3,}",
                            (e["criterion"]["title"] + " " + e["criterion"]["category"]).lower(),
                        )
                    )
                )
                + (2 if missing and e["status"] != "SATISFIED" else 0)
            )
        ),
    )[:5]
    sources = [
        {
            "id": e["criterion"]["id"],
            "title": e["criterion"]["title"],
            "requirement": e["criterion"]["source_text"],
            "evidence": e["evidence"],
            "status": e["status"],
            "reason": e["reason"],
        }
        for e in ranked
    ]
    if re.search(r"probability|chance|guarantee|accepted", question, re.I):
        return {
            "answer": "ScholarAI does not predict or guarantee admission. Your Fit Score describes alignment with the supplied requirements. I can explain the evidence and identify gaps you can address.",
            "sources": [],
            "mode": "evidence",
        }
    if settings.llm_provider == "mock" or not external_ai_allowed(db, analysis.user_id):
        answer = "Based on this analysis snapshot:\n\n" + "\n\n".join(
            f"{e['criterion']['title']}: {e['status'].replace('_', ' ').lower()}. {e['reason']}"
            for e in ranked
        )
        return {
            "answer": answer,
            "sources": sources,
            "mode": "Local evidence assistant (no generative AI)",
        }
    chunks = retrieve(db, analysis, question)
    supplemental = [
        {"id": c.id, "title": f"Document excerpt · page {c.page}", "text": c.text} for c in chunks
    ]
    context = {
        "question": question,
        "evaluations": sources,
        "excerpts": supplemental,
        "instructions": "Use only these sources. Cite source_ids. Preserve deterministic statuses. If not found, say Not found in supplied scholarship source.",
    }
    result = get_provider().generate_structured_output(json.dumps(context), ChatAnswer)
    allowed = {s["id"]: s for s in sources + supplemental}
    if any(s not in allowed for s in result.source_ids) or not result.source_ids:
        raise ValueError("Assistant response did not include valid source references")
    return {
        "answer": result.answer,
        "sources": [allowed[s] for s in result.source_ids],
        "mode": "AI with cited evidence",
    }
