"""Advisory semantic alignment; never determines mandatory eligibility."""

from app.ai.providers import get_provider


def semantic_assessments(snapshot):
    provider = get_provider()
    results = {}
    for criterion in snapshot["requirements"]:
        if criterion["criterion_type"] != "semantic_match" or criterion["mandatory"]:
            continue
        evidence = snapshot["facts"].get(criterion["key"], [])
        if not evidence:
            continue
        text = "\n".join(str(item["value"]) for item in evidence)[:5000]
        vectors = provider.embed([str(criterion["required_value"]), text])
        dot = sum(x * y for x, y in zip(vectors[0], vectors[1], strict=True))
        norm = (sum(x * x for x in vectors[0]) * sum(x * x for x in vectors[1])) ** 0.5
        similarity = max(0, min(1, dot / norm)) if norm else 0
        results[criterion["id"]] = {
            "score": round(similarity * 100, 2),
            "method": "Embedding cosine similarity (advisory, uncalibrated)",
            "source_evidence": evidence,
            "similarity": similarity,
        }
    return results
