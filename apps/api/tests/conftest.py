import os
import tempfile
from pathlib import Path

root = Path(tempfile.mkdtemp(prefix="scholarai-tests-"))
os.environ.update(
    DATABASE_URL=f"sqlite:///{root / 'test.db'}",
    STORAGE_PATH=str(root / "objects"),
    TASK_MODE="eager",
    LLM_PROVIDER="mock",
    ENVIRONMENT="test",
    REDIS_URL="",
    STORAGE_BACKEND="local",
)
import pytest
from fastapi.testclient import TestClient

from app.core.limits import local_buckets
from app.db.session import Base, engine
from app.main import app


@pytest.fixture(autouse=True)
def database():
    Base.metadata.create_all(engine)
    local_buckets.clear()
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture
def client():
    with TestClient(app) as client:
        yield client


@pytest.fixture
def signed_in(client):
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Test Student",
            "email": "student@example.com",
            "password": "StrongPassword!2027",
        },
    )
    assert response.status_code == 201, response.text
    client.headers["x-csrf-token"] = response.json()["csrf_token"]
    return client
