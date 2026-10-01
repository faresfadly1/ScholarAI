import re
from datetime import date


def quality_warnings(pages, document_type):
    text = "\n".join(page["text"] for page in pages)
    warnings = []
    page_totals = [int(n) for n in re.findall(r"Page\s+\d+\s+of\s+(\d+)", text, re.I)]
    if page_totals and max(page_totals) > len(pages):
        warnings.append("Possibly missing pages: source pagination exceeds extracted page count.")
    if (
        document_type == "CV"
        and re.search(r"TOEFL.*(?:Score|Certificate)|IELTS.*(?:Score|Certificate)", text, re.I)
        and not re.search(r"education|experience|skills", text, re.I)
    ):
        warnings.append("Possible wrong category: language certificate uploaded as CV.")
    for expiry in re.findall(
        r"(?:Expir(?:y|ation) Date|Valid Until)\s*:\s*(\d{4}-\d{2}-\d{2})", text, re.I
    ):
        try:
            if date.fromisoformat(expiry) < date.today():
                warnings.append(
                    f"Document indicates an expired validity date: {expiry}. Verify current evidence."
                )
        except ValueError:
            warnings.append("Unclear expiry date requires review.")
    return warnings
