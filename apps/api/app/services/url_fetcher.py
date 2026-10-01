import http.client
import ipaddress
import socket
import ssl
from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup


class FetchError(ValueError):
    pass


def validate_url(url):
    parsed = urlsplit(url)
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username
        or parsed.password
    ):
        raise FetchError("Only public HTTP/HTTPS URLs are supported")
    if parsed.port and parsed.port not in {80, 443}:
        raise FetchError("Only standard HTTP/HTTPS ports are allowed")
    host = parsed.hostname.rstrip(".")
    if host.lower() == "localhost" or host.lower().endswith((".local", ".internal", ".localhost")):
        raise FetchError("Internal addresses are blocked")
    try:
        ips = {
            info[4][0]
            for info in socket.getaddrinfo(
                host,
                parsed.port or (443 if parsed.scheme == "https" else 80),
                type=socket.SOCK_STREAM,
            )
        }
    except OSError as exc:
        raise FetchError("Could not resolve this website") from exc
    if not ips or any(not ipaddress.ip_address(ip).is_global for ip in ips):
        raise FetchError("Private, loopback and metadata addresses are blocked")
    return parsed, sorted(ips)[0]


def fetch_public_page(url):
    """Pin each connection to the validated IP, including every redirect (DNS-rebinding safe)."""
    for _ in range(4):
        parsed, ip = validate_url(url)
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        conn = http.client.HTTPConnection(parsed.hostname, port, timeout=12)
        sock = socket.create_connection((ip, port), timeout=12)
        if parsed.scheme == "https":
            sock = ssl.create_default_context().wrap_socket(sock, server_hostname=parsed.hostname)
        conn.sock = sock
        try:
            path = parsed.path or "/"
            if parsed.query:
                path += "?" + parsed.query
            conn.request(
                "GET",
                path,
                headers={
                    "Host": parsed.netloc,
                    "User-Agent": "ScholarAI/0.1 (public scholarship reader)",
                    "Accept": "text/html,text/plain",
                },
            )
            response = conn.getresponse()
            if response.status in {301, 302, 303, 307, 308}:
                location = response.getheader("Location")
                if not location:
                    raise FetchError("Invalid redirect")
                url = urljoin(url, location)
                continue
            if response.status != 200:
                raise FetchError(
                    "Website unavailable or restricted. Paste the official text instead."
                )
            if not any(
                t in response.getheader("Content-Type", "") for t in ["text/html", "text/plain"]
            ):
                raise FetchError(
                    "URL must return a public text page. Upload PDF guides separately."
                )
            raw = response.read(2000001)
            if len(raw) > 2000000:
                raise FetchError("Webpage exceeds the 2 MB limit")
            soup = BeautifulSoup(raw, "html.parser")
            for tag in soup(["script", "style", "nav", "footer", "noscript"]):
                tag.decompose()
            return soup.get_text("\n", strip=True)[:100000]
        finally:
            conn.close()
    raise FetchError("Too many redirects. Paste the scholarship text instead.")
