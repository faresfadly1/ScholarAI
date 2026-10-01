import logging

from sqlalchemy import delete, select

from app.ai.providers import MockProvider, get_provider
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.entities import (
    Analysis,
    AnalysisGap,
    AnalysisStrength,
    CriterionEvaluation,
    Document,
    DocumentChunk,
    DocumentFact,
    DocumentPage,
    FitScore,
    Recommendation,
    Requirement,
    RoadmapTask,
    Scholarship,
    ScholarshipSource,
)
from app.parsers.documents import extract_facts, parse_pages
from app.parsers.metadata import extract_metadata
from app.parsers.quality import quality_warnings
from app.parsers.requirements import extract_requirements
from app.schemas.contracts import DocumentExtractionSchema, ScholarshipExtractionSchema
from app.scoring.engine import analyze
from app.services.preferences import external_ai_allowed
from app.services.storage import storage
from app.services.url_fetcher import fetch_public_page

logger = logging.getLogger(__name__)


def process(kind, resource_id):
    if kind == "chat":
        from app.models.entities import ChatMessage
        from app.services.chat import answer_question

        with SessionLocal() as db:
            message = db.get(ChatMessage, resource_id)
            if not message:
                return
            try:
                analysis = db.get(Analysis, message.analysis_id)
                response = answer_question(db, analysis, message.data["question"])
                message.data = {**message.data, **response, "status": "Completed"}
            except Exception as exc:
                logger.error("chat_task_failed", extra={"error_type": type(exc).__name__})
                message.data = {
                    **message.data,
                    "status": "Failed",
                    "answer": "Unable to answer with verified citations. Please retry.",
                }
            db.commit()
        return
    model = {"document": Document, "scholarship": Scholarship, "analysis": Analysis}[kind]
    with SessionLocal() as db:
        item = db.get(model, resource_id)
        if not item:
            return
        try:
            item.status = "Processing"
            db.commit()
            if kind == "document":
                process_document(db, item)
            elif kind == "scholarship":
                process_scholarship(db, item)
            else:
                process_analysis(db, item)
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.error(
                "background_task_failed",
                extra={"kind": kind, "resource_id": resource_id, "error_type": type(exc).__name__},
            )
            item = db.get(model, resource_id)
            if item:
                item.status = "Failed"
                item.error = (
                    str(exc)[:250]
                    if isinstance(exc, ValueError)
                    else "Processing failed. Check service configuration or upload a clearer file, then retry."
                )
                db.commit()


def chunks_for_pages(db, user_id, pages, document_id=None, scholarship_id=None):
    provider = get_provider() if external_ai_allowed(db, user_id) else MockProvider()
    chunks = [
        {"page": p["page"], "text": p["text"][i : i + 1200]}
        for p in pages
        for i in range(0, len(p["text"]), 1000)
    ]
    for start in range(0, len(chunks), 32):
        batch = chunks[start : start + 32]
        vectors = provider.embed([c["text"] for c in batch])
        for chunk, vector in zip(batch, vectors, strict=True):
            db.add(
                DocumentChunk(
                    user_id=user_id,
                    document_id=document_id,
                    scholarship_id=scholarship_id,
                    text=chunk["text"],
                    page=chunk["page"],
                    embedding=vector,
                )
            )


def process_document(db, item):
    pages = parse_pages(storage.get(item.storage_key), item.mime_type)
    item.progress = 35
    db.commit()
    extraction = extract_facts(pages, item.document_type)
    if settings.llm_provider != "mock" and external_ai_allowed(db, item.user_id):
        import json

        deterministic = extraction
        extraction = get_provider().generate_structured_output(
            "Extract explicit facts with exact source snippets and page numbers. Document category: "
            + item.document_type
            + "\n"
            + json.dumps(pages),
            DocumentExtractionSchema,
        )
        for fact in extraction.facts:
            page = next((p for p in pages if p["page"] == fact.page), None)
            if not page or fact.snippet not in page["text"]:
                raise ValueError(
                    "AI extraction returned a fact without a verifiable source snippet"
                )
        protected = {
            "gpa",
            "gpa_scale",
            "toefl",
            "ielts",
            "test_date",
            "graduation_date",
            "degree",
            "field_of_study",
        }
        extraction.facts = [fact for fact in extraction.facts if fact.key not in protected] + [
            fact for fact in deterministic.facts if fact.key in protected
        ]
    for model in [DocumentPage, DocumentFact, DocumentChunk]:
        db.execute(delete(model).where(model.document_id == item.id))
    for page in pages:
        db.add(DocumentPage(user_id=item.user_id, document_id=item.id, **page))
    for fact in extraction.facts:
        db.add(
            DocumentFact(
                user_id=item.user_id,
                document_id=item.id,
                **fact.model_dump(),
                original_value=fact.value,
            )
        )
    item.parsed_text = "\n\n".join(p["text"] for p in pages)
    item.extraction = {
        **extraction.model_dump(mode="json"),
        "warnings": quality_warnings(pages, item.document_type),
        "embedding_provider": settings.llm_provider
        if external_ai_allowed(db, item.user_id)
        else "local",
    }
    item.page_count = len(pages)
    item.progress = 75
    chunks_for_pages(db, item.user_id, pages, document_id=item.id)
    item.progress, item.status, item.error = 100, "Processed", None


def process_scholarship(db, item):
    if item.source_url:
        item.source_text = fetch_public_page(item.source_url)
    if item.source_document_id:
        doc = db.scalar(
            select(Document).where(
                Document.id == item.source_document_id, Document.user_id == item.user_id
            )
        )
        if not doc or doc.status != "Processed":
            raise ValueError("Scholarship document is not processed yet")
        item.source_text = doc.parsed_text
    item.data = {
        **extract_metadata(item.source_text),
        **{k: v for k, v in item.data.items() if v not in (None, "", "Not specified")},
    }
    criteria = extract_requirements(item.source_text)
    if settings.llm_provider != "mock" and external_ai_allowed(db, item.user_id):
        extracted = get_provider().generate_structured_output(
            "Extract requirements. Every source_text must be an exact excerpt. Use manual_review for ambiguous requirements. Never assume a minimum or invent a missing criterion.\n"
            + item.source_text,
            ScholarshipExtractionSchema,
        )
        criteria = extracted.requirements
    db.execute(delete(Requirement).where(Requirement.scholarship_id == item.id))
    db.execute(delete(DocumentChunk).where(DocumentChunk.scholarship_id == item.id))

    def validate_source(criterion):
        if not criterion.source_text.strip() or criterion.source_text not in item.source_text:
            raise ValueError("Requirement is not grounded in the supplied source")
        for child in criterion.children:
            validate_source(child)

    for criterion in criteria:
        validate_source(criterion)
        criterion.source_url = item.source_url
        if item.source_document_id:
            for page in db.scalars(
                select(DocumentPage).where(
                    DocumentPage.document_id == item.source_document_id,
                    DocumentPage.user_id == item.user_id,
                )
            ):
                if criterion.source_text in page.text:
                    criterion.source_page = page.page
                    break
        db.add(
            Requirement(
                user_id=item.user_id, scholarship_id=item.id, data=criterion.model_dump(mode="json")
            )
        )
    db.add(
        ScholarshipSource(
            user_id=item.user_id,
            scholarship_id=item.id,
            data={
                "source_text": item.source_text,
                "source_url": item.source_url,
                "type": item.source_type,
                "version": item.version,
            },
        )
    )
    chunks_for_pages(
        db, item.user_id, [{"page": 1, "text": item.source_text}], scholarship_id=item.id
    )
    item.status, item.error = "Ready", None


def process_analysis(db, item):
    if (
        settings.llm_provider != "mock"
        and item.snapshot["profile"].get("ai_enabled", True)
        and external_ai_allowed(db, item.user_id)
    ):
        from app.services.alignment import semantic_assessments

        item.snapshot = {
            **item.snapshot,
            "semantic_assessments": semantic_assessments(item.snapshot),
        }
    result = analyze(item.snapshot)
    item.result = result
    for model, rows in [
        (CriterionEvaluation, result["evaluations"]),
        (AnalysisStrength, result["strengths"]),
        (AnalysisGap, result["gaps"]),
        (Recommendation, result["recommendations"]),
        (RoadmapTask, result["recommendations"]),
    ]:
        db.execute(delete(model).where(model.analysis_id == item.id))
        for row in rows:
            db.add(model(user_id=item.user_id, analysis_id=item.id, data=row))
    db.execute(delete(FitScore).where(FitScore.analysis_id == item.id))
    db.add(
        FitScore(
            user_id=item.user_id,
            analysis_id=item.id,
            data={"overall": result["overall_score"], "categories": result["categories"]},
        )
    )
    item.status, item.progress, item.error = "Completed", 100, None
