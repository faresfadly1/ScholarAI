"""Read explicitly labeled metadata without inventing missing details."""

import re
from datetime import date


def extract_metadata(text):
    data = {}
    labels = {
        "provider": "Provider",
        "university": "University",
        "country": "Country",
        "degree_level": "Degree(?: level)?",
        "field": "Field(?: of study)?",
        "funding_type": "Funding(?: type)?",
        "currency": "Currency",
        "description": "Description",
        "application_process": "Application process",
    }
    for key, label in labels.items():
        match = re.search(rf"^{label}\s*:\s*(.+)$", text, re.I | re.M)
        if match:
            data[key] = match.group(1).strip()
    match = re.search(r"^(?:Application )?Deadline\s*:\s*(\d{4}-\d{2}-\d{2})", text, re.I | re.M)
    if match:
        try:
            data["deadline"] = date.fromisoformat(match.group(1)).isoformat()
        except ValueError:
            pass
    stipend = re.search(r"^Stipend\s*:\s*(\d+(?:\.\d+)?)", text, re.I | re.M)
    if stipend:
        data["stipend"] = float(stipend.group(1))
    for kind in ["tuition", "housing", "flight", "insurance"]:
        match = re.search(rf"^{kind}\s*(?:covered)?\s*:\s*(yes|no|true|false)\b", text, re.I | re.M)
        if match:
            data[f"{kind}_covered"] = match.group(1).lower() in {"yes", "true"}
    return data
