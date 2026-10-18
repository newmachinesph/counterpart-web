import pytest

from app.services import url_probe


@pytest.mark.parametrize("address", ["127.0.0.1", "10.0.0.1", "169.254.169.254", "::1", "fc00::1"])
def test_private_addresses_are_rejected(monkeypatch, address):
    monkeypatch.setattr(url_probe.socket, "getaddrinfo", lambda *a, **kw: [(None, None, None, None, (address, 80))])
    assert not url_probe.probe_url("http://product.example")[0]


def test_redirect_destination_is_revalidated(monkeypatch):
    seen = []
    def address(host, port):
        seen.append(host)
        if host == "internal":
            raise ValueError("Private")
        return "8.8.8.8"
    class Connection:
        def __init__(self, *args, **kwargs): pass
        def request(self, *args, **kwargs): pass
        def getresponse(self): return self
        status = 302
        def getheader(self, name): return "http://internal/"
        def close(self): pass
    monkeypatch.setattr(url_probe, "public_address", address)
    monkeypatch.setattr(url_probe.http.client, "HTTPConnection", Connection)
    assert not url_probe.probe_url("http://product.example")[0]
    assert seen == ["product.example", "internal"]
