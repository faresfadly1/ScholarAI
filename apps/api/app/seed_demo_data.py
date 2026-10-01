"""Explicit synthetic fixtures only. Run: python -m app.seed_demo_data."""

import secrets
from datetime import date, timedelta

import fitz
from sqlalchemy import select

from app.auth.security import hasher
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.entities import Analysis, Document, Profile, Scholarship, User, uid
from app.services.analysis import build_snapshot
from app.services.storage import storage
from app.tasks.pipeline import process

SAMPLES = {
    "alex-cv.pdf": (
        "CV",
        "Alex Morgan — SYNTHETIC DEMO\nBachelor in Computer Engineering\nSkills: Python, Machine Learning, Scikit-learn, Docker\nProjects: Network Intrusion Detection; Image Classification\nResearch: Computer Vision graduation project\nInternship: software intern at Fictional Labs\nExpected Graduation Date: 2027-06-01",
    ),
    "alex-transcript.pdf": (
        "Transcript",
        "SYNTHETIC DEMO — Academic Transcript\nAlex Morgan\nInstitution: Northbridge Institute of Technology (fictional)\nMajor: Computer Engineering\nCumulative GPA: 3.62/4\nCourses: Machine Learning, Algorithms, Linear Algebra, Probability",
    ),
    "alex-toefl.pdf": (
        "TOEFL certificate",
        "SYNTHETIC DEMO — NOT A VALID CERTIFICATE\nAlex Morgan\nTOEFL iBT Total Score: 96\nTest Date: 2026-06-01\nReading: 25; Listening: 25; Speaking: 23; Writing: 23",
    ),
    "alex-sop.pdf": (
        "Statement of Purpose",
        "SYNTHETIC DEMO — Statement of Purpose\nAlex Morgan\nI am interested in machine learning systems and research in computer vision.\nMy graduation project explores image classification.",
    ),
    "alex-recommendation.pdf": (
        "Recommendation letter",
        "SYNTHETIC TEST FIXTURE — NOT A REAL RECOMMENDATION\nPlaceholder document used exclusively to exercise document-count logic.\nNo actual endorsement or academic credential is represented.",
    ),
}
BASE = """Master's applicant
Bachelor's degree in Computer Science or Computer Engineering
GPA >= 3.0/4
TOEFL >= 90 OR IELTS >= 6.5
CV required
Transcript required
2 recommendation letters required
Statement of Purpose required
Graduation before 2027-09-01
Computer Vision research preferred
Python and Machine Learning preferred
Internship experience preferred"""


def create_sample_pdf(text):
    pdf = fitz.open()
    page = pdf.new_page()
    page.insert_textbox(
        fitz.Rect(50, 50, 545, 780), text, fontsize=12, fontname="helv", lineheight=1.5
    )
    return pdf.tobytes()


def main():
    if settings.environment == "production" and not settings.free_deployment_mode:
        raise RuntimeError("Demo seeding is disabled in production")
    if (
        not settings.demo_password
        and not (settings.environment == "production" and settings.free_deployment_mode)
    ) or (settings.demo_password and len(settings.demo_password) < 12):
        raise ValueError("Set DEMO_PASSWORD to at least 12 characters")
    demo_password = settings.demo_password or secrets.token_urlsafe(32)
    with SessionLocal() as db:
        if db.scalar(select(User).where(User.email == "alex@scholarai.demo")):
            print("Demo already exists. No existing data changed.")
            return
        user = User(
            name="Alex Morgan",
            email="alex@scholarai.demo",
            password_hash=hasher.hash(demo_password),
            email_verified=True,
        )
        db.add(user)
        db.flush()
        db.add(
            Profile(
                user_id=user.id,
                data={
                    "full_name": "Alex Morgan",
                    "nationality": "Canadian",
                    "country_of_residence": "Canada",
                    "university": "Northbridge Institute of Technology (fictional)",
                    "degree": "Bachelor",
                    "field_of_study": "Computer Engineering",
                    "gpa": 3.62,
                    "gpa_scale": 4,
                    "graduation_date": "2027-06-01",
                    "english_test": "TOEFL",
                    "english_score": 96,
                    "skills": ["Python", "Machine Learning", "Scikit-learn", "Docker"],
                    "research": ["Computer Vision graduation project"],
                    "experience": ["Software internship at Fictional Labs"],
                    "target_degree": "Master's",
                    "preferred_countries": ["Germany", "Netherlands", "Sweden"],
                    "ai_enabled": False,
                },
            )
        )
        db.commit()
        for name, (kind, text) in SAMPLES.items():
            content = create_sample_pdf(text)
            key = f"{user.id}/{uid()}"
            storage.put(key, content, "application/pdf")
            doc = Document(
                user_id=user.id,
                document_type=kind,
                filename=name,
                storage_key=key,
                file_size=len(content),
                mime_type="application/pdf",
            )
            db.add(doc)
            db.commit()
            process("document", doc.id)
        opportunities = [
            ("Global AI Excellence Scholarship", "Northbridge University", "Germany", BASE, 92),
            (
                "Future Leaders in Data Science",
                "Westhaven Institute of Technology",
                "Netherlands",
                BASE.replace("TOEFL >= 90", "TOEFL >= 100").replace(
                    "Computer Vision research", "Data science research"
                ),
                120,
            ),
            (
                "Intelligent Systems Research Fellowship",
                "Nordhaven University",
                "Sweden",
                BASE.replace("GPA >= 3.0/4", "GPA >= 3.5/4").replace(
                    "Python and Machine Learning preferred",
                    "Python, Deep Learning and PyTorch preferred",
                ),
                150,
            ),
        ]
        for name, university, country, text, days in opportunities:
            scholarship = Scholarship(
                user_id=user.id,
                name=name,
                source_text=text,
                source_type="Fictional demo source",
                data={
                    "university": university + " (fictional)",
                    "country": country,
                    "degree_level": "Master's",
                    "field": "Artificial Intelligence",
                    "deadline": (date.today() + timedelta(days=days)).isoformat(),
                    "funding_type": "Fully funded",
                },
            )
            db.add(scholarship)
            db.commit()
            process("scholarship", scholarship.id)
            db.refresh(scholarship)
            analysis = Analysis(
                user_id=user.id,
                scholarship_id=scholarship.id,
                snapshot=build_snapshot(db, user.id, scholarship),
            )
            db.add(analysis)
            db.commit()
            process("analysis", analysis.id)
    print("Synthetic demo created. Sign in as alex@scholarai.demo using DEMO_PASSWORD.")


if __name__ == "__main__":
    main()
