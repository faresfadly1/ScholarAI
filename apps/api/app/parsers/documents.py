import io
import re
import zipfile

import fitz
import pytesseract
from docx import Document as Docx
from PIL import Image

from app.schemas.contracts import DocumentExtractionSchema, ExtractedFact

TYPES = [
    "CV",
    "Transcript",
    "Diploma",
    "Enrollment certificate",
    "Graduation certificate",
    "TOEFL certificate",
    "IELTS certificate",
    "GRE certificate",
    "GMAT certificate",
    "Recommendation letter",
    "Statement of Purpose",
    "Research paper",
    "Passport",
    "Scholarship guide",
    "Other",
]
Image.MAX_IMAGE_PIXELS = 25000000


def detect_mime(data: bytes):
    if data.startswith(b"%PDF-"):
        return "application/pdf"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"PK"):
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                if sum(i.file_size for i in z.infolist()) > 50000000 or len(z.infolist()) > 2000:
                    raise ValueError("Document archive exceeds safe extraction limits")
                if "word/document.xml" in z.namelist() and not any(
                    "vbaProject" in n for n in z.namelist()
                ):
                    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        except zipfile.BadZipFile:
            pass
    raise ValueError("Only valid PDF, DOCX, PNG and JPG files are supported")


def parse_pages(data, mime):
    pages = []
    if mime == "application/pdf":
        with fitz.open(stream=data, filetype="pdf") as pdf:
            if pdf.is_encrypted or len(pdf) > 100:
                raise ValueError("PDF must be unencrypted and at most 100 pages")
            for i, page in enumerate(pdf):
                text = page.get_text()
                if len(text.strip()) < 25:
                    pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5))
                    text = pytesseract.image_to_string(
                        Image.open(io.BytesIO(pix.tobytes("png"))), timeout=30
                    )
                pages.append({"page": i + 1, "text": normalize(text)})
    elif "wordprocessingml" in mime:
        document = Docx(io.BytesIO(data))
        text = "\n".join(p.text for p in document.paragraphs)
        for table in document.tables:
            text += "\n" + "\n".join(" | ".join(c.text for c in row.cells) for row in table.rows)
        # DOCX layout is not paginated reliably; page 1 denotes the extracted text section.
        pages = [{"page": 1, "text": normalize(text)}]
    else:
        with Image.open(io.BytesIO(data)) as image:
            text = pytesseract.image_to_string(image, timeout=30)
        pages = [{"page": 1, "text": normalize(text)}]
    if not any(p["text"].strip() for p in pages):
        raise ValueError("No readable text found. Upload a clearer file.")
    if sum(len(p["text"]) for p in pages) > 500000:
        raise ValueError("Extracted text exceeds processing limit")
    return pages


def normalize(text):
    return re.sub(r"[ \t]+", " ", text.replace("\x00", "")).strip()


PATTERNS = {
    "gpa": r"(?:cumulative\s+)?GPA\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:/|out of)\s*(\d+(?:\.\d+)?)",
    "toefl": r"(?:TOEFL(?:\s+iBT)?(?:\s+Total)?\s*(?:Score)?|Total\s+Score)\s*[:=]?\s*(\d{2,3})",
    "ielts": r"(?:IELTS(?:\s+Overall)?(?:\s+Band)?(?:\s+Score)?|Overall Band Score)\s*[:=]?\s*(\d(?:\.\d)?)",
    "graduation_date": r"(?:Expected\s+)?Graduation(?:\s+Date)?\s*:\s*(\d{4}-\d{2}-\d{2})",
    "test_date": r"Test Date\s*:\s*(\d{4}-\d{2}-\d{2})",
    "field_of_study": r"(?:Major|Field of Study|Bachelor(?:'s)?(?: of (?:Science|Engineering))? in)\s*:?\s*([^\n]+)",
    "degree": r"(Bachelor(?:'s)?(?: of (?:Science|Engineering))?)",
}
SKILLS = [
    "Python",
    "Machine Learning",
    "Deep Learning",
    "Computer Vision",
    "PyTorch",
    "TensorFlow",
    "Scikit-learn",
    "Pandas",
    "Docker",
    "Kubernetes",
    "SQL",
    "Java",
    "C++",
    "Cybersecurity",
    "AWS",
    "Azure",
]


def extract_facts(pages, document_type):
    facts = []
    for page in pages:
        for key, pattern in PATTERNS.items():
            if key == "toefl" and document_type != "TOEFL certificate":
                continue
            if key == "ielts" and document_type != "IELTS certificate":
                continue
            for match in re.finditer(pattern, page["text"], re.I):
                value = (
                    float(match.group(1))
                    if key in {"gpa", "toefl", "ielts"}
                    else match.group(1).strip()
                )
                if (
                    key == "toefl"
                    and not 0 <= value <= 120
                    or key == "ielts"
                    and not 0 <= value <= 9
                ):
                    continue
                facts.append(
                    ExtractedFact(
                        key=key,
                        value=value,
                        page=page["page"],
                        snippet=match.group(0),
                        confidence=0.96,
                    )
                )
                if key == "gpa":
                    facts.append(
                        ExtractedFact(
                            key="gpa_scale",
                            value=float(match.group(2)),
                            page=page["page"],
                            snippet=match.group(0),
                            confidence=0.96,
                        )
                    )
        skills = [
            skill
            for skill in SKILLS
            if re.search(r"(?<!\w)" + re.escape(skill) + r"(?!\w)", page["text"], re.I)
        ]
        for key, values in [
            ("skills", skills),
            (
                "research",
                [
                    line
                    for line in page["text"].splitlines()
                    if re.search(r"research|thesis|graduation project|publication", line, re.I)
                ],
            ),
            (
                "experience",
                [
                    line
                    for line in page["text"].splitlines()
                    if re.search(r"internship|intern at|employed|work experience", line, re.I)
                ],
            ),
        ]:
            for value in values:
                snippet = next(
                    (line for line in page["text"].splitlines() if value.lower() in line.lower()),
                    value,
                )
                facts.append(
                    ExtractedFact(
                        key=key, value=value, page=page["page"], snippet=snippet, confidence=0.9
                    )
                )
    return DocumentExtractionSchema(
        facts=facts,
        skills=[str(f.value) for f in facts if f.key == "skills"],
        education=[
            {"field": f.value, "source_page": f.page} for f in facts if f.key == "field_of_study"
        ],
        research=[str(f.value) for f in facts if f.key == "research"],
        experience=[str(f.value) for f in facts if f.key == "experience"],
    )
