"""Best-effort public website metadata, with bounded reads and pinned public IPs."""
import http.client
import socket
import time
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit

from app.services.url_probe import public_address


class Tags(HTMLParser):
    def __init__(self):
        super().__init__()
        self.meta, self.icons = {}, []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "meta":
            key = (attrs.get("property") or attrs.get("name") or "").lower()
            self.meta.setdefault(key, attrs.get("content", ""))
        if tag == "link" and set((attrs.get("rel") or "").lower().split()) & {"icon", "apple-touch-icon"}:
            if attrs.get("href"):
                self.icons.append(("apple-touch-icon" in attrs.get("rel", ""), attrs["href"]))


def safe_url(base, value):
    if not value:
        return None
    url = urljoin(base, value)
    parsed = urlsplit(url)
    try:
        if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password:
            return None
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        if port not in (80, 443) or len(url) > 2000:
            return None
        public_address(parsed.hostname, port)
    except (OSError, ValueError):
        return None
    return url


def parse_metadata(html, url):
    tags = Tags()
    tags.feed(html)
    meta = tags.meta
    image = safe_url(url, meta.get("og:image") or meta.get("twitter:image"))
    icons = sorted(tags.icons, reverse=True)
    logo = next((value for _, href in icons if (value := safe_url(url, href))), None)
    return {"title": (meta.get("og:title") or "")[:200],
        "description": (meta.get("og:description") or meta.get("description") or "")[:1000],
        "image": image, "logo": logo, "source_url": url}


def fetch_metadata(url):
    deadline = time.monotonic() + 15
    for _ in range(5):
        parsed = urlsplit(url)
        if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError("Use a public website URL")
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        if port not in (80, 443):
            raise ValueError("Use port 80 or 443")
        address = public_address(parsed.hostname, port)
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise ValueError("Website took too long to respond")
        kind = http.client.HTTPSConnection if parsed.scheme == "https" else http.client.HTTPConnection
        connection = kind(parsed.hostname, port, timeout=min(5, remaining))
        connection._create_connection = lambda target, timeout, source_address=None: socket.create_connection((address, port), timeout, source_address)
        try:
            connection.request("GET", (parsed.path or "/") + ("?" + parsed.query if parsed.query else ""),
                headers={"User-Agent": "Counterpart metadata preview (+https://counterpart.ph)", "Accept": "text/html", "Accept-Encoding": "identity"})
            response = connection.getresponse()
            if response.status in (301, 302, 303, 307, 308):
                location = response.getheader("Location")
                if not location:
                    raise ValueError("Redirect has no destination")
                url = urljoin(url, location)
                continue
            if response.status >= 400 or "html" not in (response.getheader("Content-Type") or ""):
                raise ValueError("Website preview is unavailable")
            chunks, size = [], 0
            while size < 512 * 1024 and time.monotonic() < deadline:
                chunk = response.read1(min(8192, 512 * 1024 - size))
                if not chunk:
                    break
                chunks.append(chunk); size += len(chunk)
                if b"</head>" in b"".join(chunks[-2:]).lower():
                    break
            return parse_metadata(b"".join(chunks).decode("utf-8", errors="replace"), url)
        finally:
            connection.close()
    raise ValueError("Too many redirects")
