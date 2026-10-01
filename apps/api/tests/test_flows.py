import fitz
import pytest

from app.auth.security import hasher
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.entities import User
from app.parsers.documents import detect_mime
from app.parsers.requirements import extract_requirements
from app.services.url_fetcher import validate_url


def pdf(text):
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), text)
    return doc.tobytes()


def test_end_to_end(signed_in):
    c = signed_in
    assert (
        c.put(
            "/api/profile",
            json={
                "full_name": "Test Student",
                "degree": "Bachelor",
                "field_of_study": "Computer Engineering",
                "gpa": 3.62,
                "gpa_scale": 4,
                "skills": ["Python"],
            },
        ).status_code
        == 200
    )
    files = [
        (
            "CV",
            "cv.pdf",
            "Bachelor in Computer Engineering\nSkills: Python, Machine Learning\nResearch: Computer Vision project",
        ),
        (
            "Transcript",
            "transcript.pdf",
            "Academic Transcript\nCumulative GPA: 3.62/4\nMajor: Computer Engineering",
        ),
        ("TOEFL certificate", "toefl.pdf", "TOEFL iBT Total Score: 96\nTest Date: 2026-06-01"),
    ]
    docs = []
    for category, name, text in files:
        r = c.post(
            "/api/documents",
            data={"document_type": category},
            files={"file": (name, pdf(text), "application/pdf")},
        )
        assert r.status_code == 202, r.text
        assert r.json()["status"] == "Processed", r.text
        docs.append(r.json())
    scholarship = c.post(
        "/api/scholarships/manual",
        json={
            "name": "Fictional AI Scholarship",
            "text": "GPA >= 3.0/4\nTOEFL >= 90\nCV required\nTranscript required\n2 recommendation letters required\nPython preferred",
        },
    ).json()
    assert scholarship["status"] == "Ready", scholarship
    r = c.post("/api/analyses", json={"scholarship_id": scholarship["id"]})
    assert r.status_code == 202, r.text
    analysis = r.json()
    assert analysis["status"] == "Completed", analysis
    evaluation = next(
        e for e in analysis["result"]["evaluations"] if e["criterion"]["key"] == "toefl"
    )
    assert evaluation["status"] == "SATISFIED"
    assert "96" in evaluation["evidence"][0]["snippet"]
    simulation = c.post(
        f"/api/analyses/{analysis['id']}/simulate", json={"toefl": 100, "recommendation_letters": 2}
    )
    assert simulation.status_code == 200, simulation.text
    assert c.get(f"/api/analyses/{analysis['id']}").json()["snapshot"] == analysis["snapshot"]
    roadmap = c.get(f"/api/analyses/{analysis['id']}/roadmap").json()
    assert roadmap
    assert (
        c.patch(f"/api/roadmap/tasks/{roadmap[0]['id']}", json={"status": "Completed"}).status_code
        == 200
    )
    chat = c.post(
        f"/api/analyses/{analysis['id']}/chat",
        json={"message": "Does my TOEFL satisfy this program?"},
    )
    assert chat.json()["data"]["sources"]
    rerun = c.post(f"/api/analyses/{analysis['id']}/rerun")
    assert rerun.json()["id"] != analysis["id"]
    assert rerun.json()["version"] == 2
    assert c.get("/api/account/export").status_code == 200
    assert c.delete(f"/api/documents/{docs[0]['id']}").status_code == 200
    assert c.delete("/api/account").status_code == 200
    assert c.get("/api/profile").status_code == 401


def test_synthetic_demo_login_is_available_only_in_free_deployment(client, monkeypatch):
    with SessionLocal() as db:
        db.add(
            User(
                name="Alex Morgan",
                email="alex@scholarai.demo",
                password_hash=hasher.hash("unshared-random-password"),
                email_verified=True,
            )
        )
        db.commit()
    response = client.post("/api/auth/demo")
    assert response.status_code == 404

    monkeypatch.setattr(settings, "free_deployment_mode", True)
    response = client.post("/api/auth/demo")
    assert response.status_code == 200
    assert response.json()["user"]["email"] == "alex@scholarai.demo"
    client.headers["x-csrf-token"] = response.json()["csrf_token"]
    blocked = client.put("/api/settings", json={"name": "Changed demo"})
    assert blocked.status_code == 403
    # Comparing the seeded analyses is read-only and must remain available in the demo.
    assert client.post("/api/compare", json=[]).status_code == 422
    assert client.get("/api/auth/me").status_code == 200


def test_tenant_and_csrf(signed_in):
    c = signed_in
    doc = c.post(
        "/api/documents",
        data={"document_type": "CV"},
        files={
            "file": ("cv.pdf", pdf("Skills: Python, Docker, Machine Learning"), "application/pdf")
        },
    ).json()
    response = c.post(
        "/api/auth/register",
        json={"name": "Other", "email": "other@example.com", "password": "OtherPassword!2027"},
    )
    c.headers["x-csrf-token"] = response.json()["csrf_token"]
    assert c.get(f"/api/documents/{doc['id']}").status_code == 404
    assert c.delete(f"/api/documents/{doc['id']}").status_code == 404
    assert c.get("/api/admin/scholarships").status_code == 403
    c.headers.pop("x-csrf-token")
    assert c.put("/api/profile", json={}).status_code == 403


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1",
        "http://localhost",
        "http://169.254.169.254",
        "http://10.0.0.1",
        "file:///etc/passwd",
        "http://[::1]",
        "http://example.com:22",
    ],
)
def test_ssrf(url):
    with pytest.raises(ValueError):
        validate_url(url)


def test_file_validation():
    with pytest.raises(ValueError):
        detect_mime(b"<script>alert('not a pdf')</script>")


def test_or_extraction():
    criteria = extract_requirements("TOEFL 90 OR IELTS 6.5 required")
    assert criteria[0].criterion_type == "any_of"
    assert len(criteria[0].children) == 2


def test_duplicate_letter_uploads_do_not_satisfy_two_letters(signed_in):
    c = signed_in
    for name in ["letter.pdf", "same-letter-renamed.pdf"]:
        uploaded = c.post(
            "/api/documents",
            data={"document_type": "Recommendation letter"},
            files={
                "file": (
                    name,
                    pdf("Synthetic recommendation letter. Referee: Example Person."),
                    "application/pdf",
                )
            },
        )
        assert uploaded.json()["status"] == "Processed"
    scholarship = c.post(
        "/api/scholarships/manual",
        json={"name": "Letter count test", "text": "2 recommendation letters required"},
    ).json()
    analysis = c.post("/api/analyses", json={"scholarship_id": scholarship["id"]}).json()
    evaluation = analysis["result"]["evaluations"][0]
    assert evaluation["status"] == "MISSING_EVIDENCE"
    assert evaluation["reason"].startswith("1 of 2")
