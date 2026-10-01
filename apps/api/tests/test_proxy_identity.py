from starlette.requests import Request

from app.core.config import settings
from app.core.limits import client_identity


def make_request(secret, identity):
    return Request(
        {
            "type": "http",
            "client": ("10.0.0.2", 1234),
            "headers": [
                (b"x-scholarai-proxy-secret", secret.encode()),
                (b"x-scholarai-client-ip", identity.encode()),
            ],
        }
    )


def test_proxy_identity_requires_the_server_secret(monkeypatch):
    monkeypatch.setattr(settings, "internal_proxy_secret", "server-secret")
    assert client_identity(make_request("wrong", "203.0.113.2")) == "10.0.0.2"
    assert client_identity(make_request("server-secret", "203.0.113.2")) == "203.0.113.2"
    assert client_identity(make_request("server-secret", "203.0.113.3")) == "203.0.113.3"
    assert client_identity(make_request("server-secret", "invalid")) == "10.0.0.2"


def test_direct_development_requests_do_not_trust_ip_headers(monkeypatch):
    monkeypatch.setattr(settings, "internal_proxy_secret", "")
    assert client_identity(make_request("", "203.0.113.2")) == "10.0.0.2"
