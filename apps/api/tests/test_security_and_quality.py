import io
import json
import zipfile
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.auth.security import digest
from app.db.session import SessionLocal
from app.models.entities import AuthToken, User
from app.parsers.documents import detect_mime
from app.parsers.metadata import extract_metadata
from app.parsers.quality import quality_warnings
from app.parsers.requirements import extract_requirements
from app.services.url_fetcher import validate_url


def test_login_logout_and_reset(signed_in):
    client = signed_in
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == "student@example.com"))
        assert user.password_hash.startswith("$argon2")
        db.add(
            AuthToken(
                user_id=user.id,
                token_hash=digest("single-use-token"),
                purpose="reset",
                expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
            )
        )
        db.commit()
    reset = client.post(
        "/api/auth/reset-password",
        json={"token": "single-use-token", "password": "NewPassword!2027"},
    )
    assert reset.status_code == 200
    assert client.get("/api/profile").status_code == 401
    assert (
        client.post(
            "/api/auth/reset-password",
            json={"token": "single-use-token", "password": "NewPassword!2027"},
        ).status_code
        == 400
    )
    logged = client.post(
        "/api/auth/login", json={"email": "student@example.com", "password": "NewPassword!2027"}
    )
    assert logged.status_code == 200
    assert "HttpOnly" in logged.headers["set-cookie"]
    assert "SameSite=lax" in logged.headers["set-cookie"]
    client.headers["x-csrf-token"] = logged.json()["csrf_token"]
    assert client.post("/api/auth/logout").status_code == 200
    assert client.get("/api/auth/me").status_code == 401


def test_origin_and_limits(client):
    body = {"email": "unknown@example.com", "password": "WrongPassword!2027"}
    assert (
        client.post(
            "/api/auth/login", json=body, headers={"origin": "https://evil.example"}
        ).status_code
        == 403
    )
    for _ in range(10):
        assert client.post("/api/auth/login", json=body).status_code == 401
    response = client.post("/api/auth/login", json=body)
    assert response.status_code == 429
    assert response.headers["retry-after"] == "60"


def test_ai_preference(signed_in):
    response = signed_in.put("/api/settings", json={"ai_enabled": False})
    assert response.status_code == 200
    assert signed_in.get("/api/profile").json()["data"]["ai_enabled"] is False


def test_external_ai_opt_out_never_calls_provider(signed_in, monkeypatch):
    from app.tasks.pipeline import chunks_for_pages

    signed_in.put("/api/settings", json={"ai_enabled": False})

    def forbidden():
        raise AssertionError("External provider must not be called")

    monkeypatch.setattr("app.tasks.pipeline.get_provider", forbidden)
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == "student@example.com"))
        chunks_for_pages(db, user.id, [{"page": 1, "text": "Personal evidence that stays local"}])
        db.rollback()


@pytest.mark.parametrize(
    "text",
    [
        "TOEFL 90 unless exempt",
        "CV or statement of purpose required",
        "Maximum GPA 3.0/4",
        "IELTS not required",
    ],
)
def test_ambiguous_rules_require_review(text):
    assert extract_requirements(text)[0].criterion_type == "manual_review"


def test_quality_warnings():
    warnings = quality_warnings(
        [
            {
                "page": 1,
                "text": "TOEFL Certificate Total Score: 96\nPage 1 of 2\nExpiration Date: 2020-01-01",
            }
        ],
        "CV",
    )
    assert len(warnings) == 3


def test_metadata_does_not_invent_deadline():
    metadata = extract_metadata(
        "University: Example University\nCountry: Germany\nGraduation before 2027-09-01"
    )
    assert metadata["university"] == "Example University"
    assert "deadline" not in metadata
    assert extract_metadata("Deadline: 2027-02-20")["deadline"] == "2027-02-20"


def test_dns_checks_every_address(monkeypatch):
    import socket

    monkeypatch.setattr(
        socket,
        "getaddrinfo",
        lambda *a, **kw: [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("8.8.8.8", 443)),
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.0.0.1", 443)),
        ],
    )
    with pytest.raises(ValueError):
        validate_url("https://scholarship.example")


def test_macro_docx_is_rejected():
    data = io.BytesIO()
    with zipfile.ZipFile(data, "w") as archive:
        archive.writestr("word/document.xml", "<document/>")
        archive.writestr("word/vbaProject.bin", "not executable")
    with pytest.raises(ValueError):
        detect_mime(data.getvalue())


def test_api_schema_has_expected_routes(client):
    paths = client.get("/openapi.json").json()["paths"]
    for route in [
        "/api/auth/register",
        "/api/documents",
        "/api/analyses/{analysis_id}/simulate",
        "/api/analyses/{analysis_id}/chat",
        "/api/admin/requirements/{requirement_id}",
    ]:
        assert route in paths


def test_account_export_excludes_session_secrets(signed_in):
    data = signed_in.get("/api/account/export").json()
    assert "sessions" not in data and "auth_tokens" not in data
    assert "password_hash" not in json.dumps(data)
