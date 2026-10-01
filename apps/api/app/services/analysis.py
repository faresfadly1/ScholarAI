from copy import deepcopy
from datetime import date
from hashlib import sha256

from sqlalchemy import select

from app.core.config import settings
from app.models.entities import Document, DocumentFact, Profile, Requirement
from app.scoring.engine import analyze


def build_snapshot(db, user_id, scholarship):
    profile = db.scalar(select(Profile).where(Profile.user_id == user_id))
    documents = list(
        db.scalars(
            select(Document).where(
                Document.user_id == user_id,
                Document.status == "Processed",
                Document.document_type != "Scholarship guide",
            )
        )
    )
    facts = {}
    for key, value in profile.data.items():
        if (
            key
            in {
                "gpa",
                "gpa_scale",
                "english_score",
                "english_test",
                "test_date",
                "degree",
                "field_of_study",
            }
            or value is None
            or value == ""
        ):
            continue
        for entry in value if isinstance(value, list) else [value]:
            facts.setdefault(key, []).append(
                {
                    "value": entry,
                    "source": "Profile (self-reported)",
                    "page": None,
                    "snippet": str(entry),
                    "confidence": 1,
                    "verified": True,
                }
            )
    seen_documents = set()
    for doc in documents:
        # Identical parsed documents cannot satisfy multiple required letters.
        fingerprint = (doc.document_type, sha256(doc.parsed_text.strip().encode()).hexdigest())
        if doc.parsed_text.strip() and fingerprint in seen_documents:
            continue
        seen_documents.add(fingerprint)
        facts.setdefault(doc.document_type, []).append(
            {
                "value": doc.filename,
                "source": doc.filename,
                "document_id": doc.id,
                "page": 1,
                "snippet": f"Processed {doc.document_type}",
                "confidence": 0.5 if doc.extraction.get("warnings") else 1,
                "warnings": doc.extraction.get("warnings", []),
            }
        )
        for fact in db.scalars(
            select(DocumentFact).where(
                DocumentFact.document_id == doc.id, DocumentFact.user_id == user_id
            )
        ):
            facts.setdefault(fact.key, []).append(
                {
                    "value": fact.value,
                    "original_value": fact.original_value,
                    "source": doc.filename,
                    "document_id": doc.id,
                    "page": fact.page,
                    "snippet": fact.snippet,
                    "confidence": min(fact.confidence, 0.5)
                    if doc.extraction.get("warnings")
                    else fact.confidence,
                    "verified": fact.verified,
                    "corrected_at": fact.corrected_at.isoformat() if fact.corrected_at else None,
                }
            )
    requirements = [
        {**r.data, "id": r.id, "admin_verified": r.admin_verified}
        for r in db.scalars(
            select(Requirement).where(
                Requirement.scholarship_id == scholarship.id, Requirement.user_id == user_id
            )
        )
    ]
    return {
        "profile": deepcopy(profile.data),
        "profile_version": profile.version,
        "documents": [
            {"id": d.id, "version": d.version, "filename": d.filename} for d in documents
        ],
        "scholarship": {
            "id": scholarship.id,
            "name": scholarship.name,
            **scholarship.data,
            "source_url": scholarship.source_url,
            "source_type": scholarship.source_type,
        },
        "scholarship_version": scholarship.version,
        "requirements": requirements,
        "requirement_versions": {
            r.id: r.version
            for r in db.scalars(
                select(Requirement).where(Requirement.scholarship_id == scholarship.id)
            )
        },
        "weights": scholarship.weights,
        "scoring_version": "1.0",
        "model_metadata": {
            "provider": settings.llm_provider,
            "chat_model": settings.llm_chat_model,
            "embedding_model": settings.llm_embedding_model,
            "embedding_dimensions": settings.embedding_dimensions,
        },
        "as_of": date.today().isoformat(),
        "facts": facts,
    }


def simulate(snapshot, changes):
    scenario = deepcopy(snapshot)
    for key, value in changes.items():
        if value is None:
            continue
        if key == "recommendation_letters":
            scenario["facts"]["Recommendation letter"] = [
                {
                    "value": f"Hypothetical letter {i + 1}",
                    "source": "SIMULATION ONLY",
                    "snippet": "Hypothetical document",
                    "confidence": 1,
                    "verified": True,
                }
                for i in range(value)
            ]
            continue
        values = value if isinstance(value, list) else [value]
        scenario["facts"][key] = [
            {
                "value": v,
                "source": "SIMULATION ONLY",
                "snippet": str(v),
                "confidence": 1,
                "verified": True,
            }
            for v in values
        ]
    # Hypothetical qualitative changes are evaluated locally, with their method labeled.
    # No provider call is made from a synchronous simulation request.
    if any(key in changes for key in ["skills", "research"]):
        scenario.pop("semantic_assessments", None)
    current = analyze(snapshot)
    simulated = analyze(scenario)
    return {
        "label": "SIMULATION ONLY",
        "qualitative_method": "Changed qualitative scenarios use literal evidence overlap; no external model call.",
        "changes": changes,
        "current_score": current["overall_score"],
        "simulated_score": simulated["overall_score"],
        "difference": round(simulated["overall_score"] - current["overall_score"], 1),
        "categories": simulated["categories"],
        "current_categories": current["categories"],
        "eligibility": simulated["eligibility"],
        "evaluations": simulated["evaluations"],
        "disclaimer": current["disclaimer"],
    }
