import math
import re
from datetime import date

from app.schemas.contracts import Criterion

SAT = "SATISFIED"
FAIL = "NOT_SATISFIED"
MISSING = "MISSING_EVIDENCE"
UNCERTAIN = "UNCERTAIN"
NA = "NOT_APPLICABLE"
CATEGORY_MAP = {
    "degree": "academic",
    "field_of_study": "academic",
    "graduation": "academic",
    "age": "academic",
    "nationality": "academic",
    "other": "academic",
}
DISCLAIMER = (
    "Fit Score measures alignment with published requirements. It is not an admission probability."
)


def evaluate(
    criterion: Criterion, facts: dict, as_of: str | None = None, semantic: dict | None = None
):
    result = {
        "criterion": criterion.model_dump(mode="json"),
        "status": MISSING,
        "reason": "No supporting evidence found.",
        "evidence": [],
        "confidence": 0.0,
        "score": 0.0,
    }

    def finish(status, reason, score=0, confidence=1):
        return {
            **result,
            "status": status,
            "reason": reason,
            "score": round(score, 2),
            "confidence": confidence,
        }

    if not criterion.source_text.strip():
        return finish(UNCERTAIN, "Not found in supplied scholarship source.")
    if criterion.criterion_type in {"any_of", "all_of"}:
        children = [evaluate(child, facts, as_of, semantic) for child in criterion.children]
        if not children:
            return finish(UNCERTAIN, "No alternatives supplied.")
        result["children"] = children
        result["evidence"] = [item for c in children for item in c["evidence"]]
        statuses = [c["status"] for c in children]
        if criterion.criterion_type == "any_of":
            status = (
                SAT
                if SAT in statuses
                else UNCERTAIN
                if UNCERTAIN in statuses
                else MISSING
                if MISSING in statuses
                else FAIL
            )
            score = max(c["score"] for c in children)
        else:
            status = (
                FAIL
                if FAIL in statuses
                else UNCERTAIN
                if UNCERTAIN in statuses
                else MISSING
                if MISSING in statuses
                else SAT
            )
            score = sum(c["score"] for c in children) / len(children)
        return finish(
            status,
            " OR ".join(c["reason"] for c in children)
            if criterion.criterion_type == "any_of"
            else " AND ".join(c["reason"] for c in children),
            score,
        )
    if criterion.criterion_type == "manual_review" or (
        criterion.confidence < 0.8 and not criterion.admin_verified
    ):
        return finish(
            UNCERTAIN,
            "Requirement needs human verification before an eligibility decision.",
            confidence=criterion.confidence,
        )
    entries = facts.get(criterion.key, [])
    if criterion.key == "age":
        entries = facts.get("date_of_birth", [])
        if entries:
            try:
                born = date.fromisoformat(str(entries[0]["value"]))
                today = date.fromisoformat(as_of) if as_of else date.today()
                entries = [
                    {
                        **entries[0],
                        "value": today.year
                        - born.year
                        - ((today.month, today.day) < (born.month, born.day)),
                    }
                ]
            except ValueError:
                return finish(UNCERTAIN, "Invalid birth date.")
    result["evidence"] = entries
    if criterion.criterion_type == "document_required":
        if any(e.get("warnings") for e in entries):
            return finish(
                UNCERTAIN,
                "A supporting document has quality or validity warnings. Review the original file.",
                confidence=0.5,
            )
        count = len(entries)
        needed = int(criterion.required_value)
        return finish(
            SAT if count >= needed else MISSING,
            f"{count} of {needed} required {criterion.key} document(s) available.",
            min(100, count / max(needed, 1) * 100),
            1,
        )
    if not entries:
        return finish(MISSING, "No supporting evidence found.", confidence=0)
    if any(e.get("confidence", 1) < 0.8 and not e.get("verified", False) for e in entries):
        return finish(
            UNCERTAIN,
            "Low-confidence extraction needs your verification.",
            confidence=min(e.get("confidence", 1) for e in entries),
        )
    if criterion.criterion_type == "semantic_match":
        if criterion.mandatory:
            return finish(
                UNCERTAIN,
                "A qualitative mandatory requirement needs human review; similarity alone cannot establish eligibility.",
                confidence=0.5,
            )
        required = (
            criterion.required_value
            if isinstance(criterion.required_value, list)
            else re.findall(r"\w{4,}", str(criterion.required_value).lower())
        )
        evidence_text = " ".join(str(e["value"]).lower() for e in entries)
        stop = {"preferred", "experience", "required", "recommended", "research"}
        terms = [str(v).lower() for v in required if str(v).lower() not in stop]
        matched = [term for term in terms if term in evidence_text]
        score = len(matched) / max(len(terms), 1) * 100 if terms else (100 if entries else 0)
        if semantic and criterion.id in semantic:
            score = semantic[criterion.id]["score"]
            result["semantic_assessment"] = semantic[criterion.id]
        result["matched_terms"] = matched
        return finish(
            UNCERTAIN,
            f"Evidence overlap: {', '.join(matched) or 'no specific themes'}. Qualitative alignment requires review.",
            score,
            0.7,
        )
    values = {str(e["value"]).lower() for e in entries}
    if len(values) > 1:
        return finish(
            UNCERTAIN,
            "Conflicting evidence values. Verify or remove outdated documents before rerunning.",
            confidence=0.5,
        )
    value = entries[0]["value"]
    try:
        if criterion.key == "gpa":
            scales = facts.get("gpa_scale", [])
            if (
                not criterion.unit
                or not scales
                or any(float(s["value"]) != float(criterion.unit) for s in scales)
            ):
                return finish(
                    UNCERTAIN,
                    "GPA scales differ or are unspecified. No automatic GPA conversion is applied.",
                )
            if not 0 <= float(value) <= float(criterion.unit):
                return finish(UNCERTAIN, "GPA evidence is outside its stated scale.")
        kind = criterion.criterion_type
        if kind in {"numeric_min", "numeric_max"}:
            actual, needed = float(value), float(criterion.required_value)
            if not math.isfinite(actual) or not math.isfinite(needed):
                return finish(UNCERTAIN, "Invalid numeric evidence")
            passed = (
                (actual > needed if criterion.operator == ">" else actual >= needed)
                if kind == "numeric_min"
                else actual < needed
                if criterion.operator == "<"
                else actual <= needed
            )
            score = (
                min(100, max(0, actual / needed * 100))
                if kind == "numeric_min" and needed
                else (100 if passed else 0)
            )
            reason = f"{actual:g} {criterion.operator or ('>=' if kind == 'numeric_min' else '<=')} {needed:g} is {'true' if passed else 'false'}."
        elif kind in {"date_before", "date_after"}:
            actual, needed = (
                date.fromisoformat(str(value)),
                date.fromisoformat(str(criterion.required_value)),
            )
            passed = (
                (actual <= needed if criterion.operator == "<=" else actual < needed)
                if kind == "date_before"
                else (actual >= needed if criterion.operator == ">=" else actual > needed)
            )
            score, reason = (
                (100 if passed else 0),
                f"{actual} {'before' if kind == 'date_before' else 'after'} {needed}: {'yes' if passed else 'no'}.",
            )
        elif kind == "boolean":
            if not isinstance(value, bool):
                return finish(UNCERTAIN, "Evidence is not an explicit true/false fact.")
            passed = value == criterion.required_value
            score, reason = (
                (100 if passed else 0),
                f"Evidence value: {value}; required: {criterion.required_value}.",
            )
        else:
            options = criterion.required_value if kind == "one_of" else [criterion.required_value]
            normalized = str(value).lower().strip()
            passed = any(normalized == str(option).lower().strip() for option in options)
            if criterion.key == "degree":
                passed = any(normalized.startswith(str(option).lower()) for option in options)
            # Related degrees/fields are not automatically equated.
            score, reason = (
                (100 if passed else 0),
                f"Evidence: {value}. Accepted: {', '.join(map(str, options))}.",
            )
        return finish(
            SAT if passed else FAIL, reason, score, min(e.get("confidence", 1) for e in entries)
        )
    except (ValueError, TypeError):
        return finish(UNCERTAIN, "Evidence format cannot be compared safely.")


def analyze(snapshot):
    requirements = [Criterion.model_validate(c) for c in snapshot["requirements"]]
    evaluations = [
        evaluate(c, snapshot["facts"], snapshot["as_of"], snapshot.get("semantic_assessments"))
        for c in requirements
    ]
    mandatory = [e for e in evaluations if e["criterion"]["mandatory"]]
    statuses = {e["status"] for e in mandatory}
    eligibility = (
        "Eligibility issue detected"
        if FAIL in statuses
        else "Manual review required"
        if UNCERTAIN in statuses or not mandatory
        else "Potentially eligible — missing evidence"
        if MISSING in statuses
        else "Eligible based on available evidence"
    )
    categories = {}
    for category, weight in snapshot["weights"].items():
        relevant = [
            e
            for e in evaluations
            if CATEGORY_MAP.get(e["criterion"]["category"], e["criterion"]["category"]) == category
            and e["status"] != NA
        ]
        total_weight = sum(e["criterion"]["weight"] for e in relevant)
        score = (
            sum(e["score"] * e["criterion"]["weight"] for e in relevant) / total_weight
            if total_weight
            else None
        )
        categories[category] = {
            "score": round(score, 1) if score is not None else None,
            "weight": weight,
            "evaluated": len(relevant),
            "method": "Evidence overlap; review needed"
            if category in {"research", "technical", "experience"}
            else "Deterministic requirement fulfillment",
        }
    available_weight = sum(c["weight"] for c in categories.values() if c["score"] is not None)
    overall = (
        round(
            sum((c["score"] or 0) * c["weight"] for c in categories.values()) / available_weight, 1
        )
        if available_weight
        else 0
    )
    gaps, strengths, recommendations = [], [], []
    deadline = snapshot["scholarship"].get("deadline")
    days = (
        (date.fromisoformat(deadline) - date.fromisoformat(snapshot["as_of"])).days
        if deadline
        else None
    )
    for evaluation in evaluations:
        criterion = evaluation["criterion"]
        if evaluation["status"] == SAT:
            strengths.append(
                {
                    "title": criterion["title"],
                    "description": evaluation["reason"],
                    "criterion_id": criterion["id"],
                    "evidence": evaluation["evidence"],
                }
            )
            continue
        priority = "Critical" if criterion["mandatory"] else "Medium"
        title = (
            "Provide evidence: "
            if evaluation["status"] == MISSING
            else "Review: "
            if evaluation["status"] == UNCERTAIN
            else "Resolve: "
        ) + criterion["title"]
        gap = {
            "title": title,
            "description": evaluation["reason"],
            "priority": priority,
            "category": criterion["category"],
            "criterion_id": criterion["id"],
            "evidence": evaluation["evidence"],
        }
        gaps.append(gap)
        impact = 100 if criterion["mandatory"] else 50
        urgency = (
            0
            if days is not None and days < 0
            else max(10, 100 - max(days if days is not None else 60, 0))
        )
        description = f"{'Historical application: ' if days is not None and days < 0 else ''}{evaluation['reason']} Check the source requirement and upload genuine supporting evidence."
        recommendations.append(
            {
                **gap,
                "description": description,
                "impact": impact,
                "urgency": urgency,
                "feasibility": 80,
                "priority_score": round(impact * 0.5 + urgency * 0.3 + 80 * 0.2, 1),
                "deadline": deadline,
                "historical": days is not None and days < 0,
            }
        )
    documents = [e for e in evaluations if e["criterion"]["criterion_type"] == "document_required"]
    required_count = sum(int(e["criterion"]["required_value"]) for e in documents)
    complete = sum(
        min(len(e["evidence"]), int(e["criterion"]["required_value"])) for e in documents
    )
    return {
        "eligibility": eligibility,
        "overall_score": overall,
        "categories": categories,
        "evaluations": evaluations,
        "strengths": strengths,
        "gaps": gaps,
        "recommendations": sorted(recommendations, key=lambda r: -r["priority_score"]),
        "documents_complete": complete,
        "documents_required": required_count,
        "critical_gaps": sum(g["priority"] == "Critical" for g in gaps),
        "scoring_coverage": available_weight,
        "days_remaining": days,
        "closed": days is not None and days < 0,
        "disclaimer": DISCLAIMER,
        "score_method": "Weighted requirement fulfillment. Missing evidence scores zero; categories without criteria are excluded and remaining weights normalized. Semantic overlap is advisory.",
    }
