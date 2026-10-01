import re

from app.parsers.documents import SKILLS
from app.schemas.contracts import Criterion

DOC_NAMES = {
    "cv": "CV",
    "curriculum vitae": "CV",
    "transcript": "Transcript",
    "recommendation letter": "Recommendation letter",
    "statement of purpose": "Statement of Purpose",
    "sop": "Statement of Purpose",
    "passport": "Passport",
    "diploma": "Diploma",
    "graduation certificate": "Graduation certificate",
}


def numeric_comparison(prefix):
    """Preserve explicit comparison direction and strictness from the source."""
    if re.search(r"<=|≤|at most|no more than|maximum", prefix, re.I):
        return "numeric_max", "<="
    if re.search(r"<|below|less than", prefix, re.I) and not re.search(
        r"no less than", prefix, re.I
    ):
        return "numeric_max", "<"
    if re.search(r">=|≥|at least|no less than|minimum", prefix, re.I):
        return "numeric_min", ">="
    if re.search(r">|above|greater than|more than", prefix, re.I):
        return "numeric_min", ">"
    return "numeric_min", ">="


def extract_requirements(text):
    criteria = []
    for raw in text.splitlines():
        line = raw.strip(" •-\t")
        if len(line) < 4:
            continue
        low = line.lower()
        optional = bool(re.search(r"preferred|recommended|optional", low))
        base = {
            "source_text": line,
            "mandatory": not optional,
            "title": line[:160],
            "description": line,
        }

        def criterion(category, kind, key="", value=None, **kwargs):
            return Criterion(
                **base,
                category=category,
                criterion_type=kind,
                key=key,
                required_value=value,
                **kwargs,
            )

        # Never flatten exceptions, conditional clauses, or heterogeneous OR rules.
        ambiguous = re.search(
            r"unless|except|waiv|exempt|not required|at most|no more than|maximum.*(?:gpa|toefl|ielts)",
            low,
        )
        heterogeneous_or = (
            re.search(r"\bor\b", low)
            and not ("toefl" in low and "ielts" in low)
            and "bachelor" not in low
        )
        if ambiguous or heterogeneous_or:
            criteria.append(criterion("other", "manual_review", confidence=0.5))
            continue
        languages = []
        for test, pattern in [
            ("toefl", r"TOEFL(?:\s+iBT)?[^\d\n]{0,45}(\d{2,3})"),
            ("ielts", r"IELTS[^\d\n]{0,45}(\d(?:\.\d)?)"),
        ]:
            match = re.search(pattern, line, re.I)
            if match:
                kind, operator = numeric_comparison(line[match.start() : match.start(1)])
                languages.append(
                    criterion("language", kind, test, float(match.group(1)), operator=operator)
                )
        if languages:
            if len(languages) > 1:
                criteria.append(
                    criterion(
                        "language",
                        "any_of" if re.search(r"\bor\b", low) else "all_of",
                        children=languages,
                    )
                )
            else:
                criteria += languages
            continue
        gpa = re.search(
            r"GPA[^\d\n]{0,30}(\d+(?:\.\d+)?)(?:\s*(?:/|out of)\s*(\d+(?:\.\d+)?))?", line, re.I
        )
        if gpa:
            kind, operator = numeric_comparison(line[: gpa.start(1)])
            criteria.append(
                criterion(
                    "academic",
                    kind,
                    "gpa",
                    float(gpa.group(1)),
                    unit=gpa.group(2) or "",
                    operator=operator,
                )
            )
            continue
        date = re.search(r"(\d{4}-\d{2}-\d{2})", line)
        if "graduat" in low and date:
            if "after" in low:
                kind, operator = "date_after", ">=" if "on or after" in low else ">"
            elif re.search(r"before|by", low):
                kind, operator = (
                    "date_before",
                    "<=" if re.search(r"on or before|\bby\b", low) else "<",
                )
            else:
                criteria.append(criterion("graduation", "manual_review", confidence=0.5))
                continue
            criteria.append(
                criterion("graduation", kind, "graduation_date", date.group(1), operator=operator)
            )
            continue
        age = re.search(
            r"(?:age\s*(?:under|below|≤|<=|maximum|:)?\s*|under\s+)(\d{1,2})\s*(?:years)?", low
        )
        if age:
            criteria.append(
                criterion(
                    "age",
                    "numeric_max",
                    "age",
                    int(age.group(1)),
                    operator="<" if "under" in low or "below" in low else "<=",
                )
            )
            continue
        found_doc = False
        for term, doc_type in DOC_NAMES.items():
            if re.search(r"\b" + term + r"s?\b", low):
                count = re.search(r"\b(\d+|two|three|one)\s+(?:academic\s+)?recommendation", low)
                value = (
                    {"two": 2, "three": 3, "one": 1}.get(
                        count.group(1), int(count.group(1)) if count.group(1).isdigit() else 1
                    )
                    if count
                    else 1
                )
                criteria.append(criterion("documents", "document_required", doc_type, value))
                found_doc = True
        if found_doc:
            continue
        if "bachelor" in low and re.search(r"\bin\b", low):
            fields = []
            for alias, normalized in [
                ("computer science", "Computer Science"),
                ("computer engineering", "Computer Engineering"),
                ("engineering", "Engineering"),
                ("cs/", "Computer Science"),
            ]:
                if alias in low and not (alias == "engineering" and "computer engineering" in low):
                    fields.append(normalized)
            if fields:
                criteria.append(criterion("field_of_study", "one_of", "field_of_study", fields))
            criteria.append(criterion("degree", "exact_match", "degree", "Bachelor"))
            continue
        if "master" in low and "applicant" in low:
            criteria.append(criterion("degree", "exact_match", "target_degree", "Master's"))
            continue
        if re.search(r"research|publication|thesis", low):
            criteria.append(criterion("research", "semantic_match", "research", line))
            continue
        skills = [
            skill
            for skill in SKILLS
            if re.search(r"(?<!\w)" + re.escape(skill.lower()) + r"(?!\w)", low)
        ]
        if skills:
            criteria.append(criterion("technical", "semantic_match", "skills", skills))
            continue
        if re.search(r"experience|internship", low):
            criteria.append(criterion("experience", "semantic_match", "experience", line))
            continue
        if re.search(
            r"must|required|minimum|maximum|only|eligible|citizen|nationality|shall|need to", low
        ):
            criteria.append(criterion("other", "manual_review", confidence=0.5))
    if not criteria:
        criteria.append(
            Criterion(
                category="other",
                title="Review supplied requirements",
                criterion_type="manual_review",
                source_text=text[:1000],
                confidence=0.4,
            )
        )
    return criteria
