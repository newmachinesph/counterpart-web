"""Probe public product URLs, pinning each connection to a validated IP address."""
import http.client
import ipaddress
import socket
from urllib.parse import urljoin, urlsplit


def public_address(host: str, port: int) -> str:
    addresses = [result[4][0] for result in socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)]
    if not addresses or any(not ipaddress.ip_address(address).is_global for address in addresses):
        raise ValueError("Product URL must resolve to a public internet address")
    return addresses[0]


def probe_url(url: str) -> tuple[bool, str]:
    try:
        for _ in range(5):
            parsed = urlsplit(url)
            if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password:
                return False, "Use a public http(s) product URL without credentials"
            port = parsed.port or (443 if parsed.scheme == "https" else 80)
            if port not in (80, 443):
                return False, "Product URLs must use port 80 or 443"
            address = public_address(parsed.hostname, port)
            connection_type = http.client.HTTPSConnection if parsed.scheme == "https" else http.client.HTTPConnection
            connection = connection_type(parsed.hostname, port, timeout=6)
            # Keep Host and TLS SNI as the original hostname, but never resolve it
            # again after validation (including redirects and DNS rebinding).
            connection._create_connection = lambda target, timeout, source_address=None: socket.create_connection((address, port), timeout, source_address)
            try:
                path = parsed.path or "/"
                if parsed.query:
                    path += "?" + parsed.query
                connection.request("HEAD", path, headers={"User-Agent": "counterpart.ph publish check"})
                response = connection.getresponse()
                if response.status in (301, 302, 303, 307, 308):
                    location = response.getheader("Location")
                    if not location:
                        return False, "Redirect has no destination"
                    url = urljoin(url, location)
                    continue
                # A HEAD-rejecting server still proves the product endpoint exists.
                ok = response.status < 400 or response.status in (401, 403, 405)
                return ok, f"Responded with HTTP {response.status}"
            finally:
                connection.close()
        return False, "Too many redirects"
    except (OSError, ValueError, http.client.HTTPException) as error:
        return False, f"Product URL check failed: {type(error).__name__}"
