"""Non-destructive production checks using the existing private admin credential file.

No accounts, ventures, messages or email deliveries are created.
Set COUNTERPART_EDGE_IP only to test through verified DNS during propagation.
"""
import importlib.util
import json
import os
import socket
from html.parser import HTMLParser
from pathlib import Path

spec = importlib.util.spec_from_file_location("web_acceptance", Path(__file__).with_name("web-e2e.py"))
acceptance = importlib.util.module_from_spec(spec)
spec.loader.exec_module(acceptance)
acceptance.WEB = "https://counterpart.ph"
acceptance.API = "https://api.counterpart.ph"

if edge := os.getenv("COUNTERPART_EDGE_IP"):
    original = socket.getaddrinfo
    socket.getaddrinfo = lambda host, *args, **kwargs: original(edge if host == "counterpart.ph" else host, *args, **kwargs)
    print("Using explicit Vercel edge address; HTTPS hostname verification remains enabled")

admin = json.loads(Path(".local/production-admin.json").read_text())
browser = acceptance.Browser()
bench = browser.page("/bench")
for name in ("Creatorz", "Hire From PH", "Jinnie", "Gimik", "Phriend", "KYP"):
    assert name in bench, name
assert "In development" in bench
for image in ("https://creatorz.ph/og-image.png", "https://hirefrom.ph/coming-soon/og-image.png"):
    assert image in bench
print("PASS production Bench renders all six development projects")
browser.page("/legal", "Drafts for review")
browser.page("/legal/paid-engagement", "Not in force")
browser.api("/admin/overview", status=401)
browser.form("/login", "email", {"email": admin["email"], "password": admin["password"], "mode": "login"}, "Welcome back, ")

class NavigationCheck(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.nav_labels = []
        self.has_avatar = False
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "nav":
            self.nav_labels.append(attrs.get("aria-label"))
        if tag == "button" and attrs.get("aria-controls") == "account-menu":
            self.has_avatar = True

dashboard = NavigationCheck(browser.page("/dashboard", "Your engagements"))
assert dashboard.has_avatar and "Workspace" in dashboard.nav_labels
assert "Explore Counterpart" not in dashboard.nav_labels
assert "Workspace resources" in dashboard.nav_labels
assert "Explore Counterpart" in NavigationCheck(browser.page("/bench")).nav_labels
print("PASS dashboard workspace navigation, avatar menu trigger, compact footer and public navigation")
cookie = next(cookie for cookie in browser.cookies if cookie.name == "cp_session")
assert cookie.secure and cookie.has_nonstandard_attr("HttpOnly")
assert cookie.get_nonstandard_attr("SameSite").lower() == "lax"
assert "admin" in browser.api("/me")["roles"]
browser.page("/admin/email-queue", "Email delivery")
browser.page("/admin", "Keep things moving.")
overview = browser.api("/admin/overview")
assert {"open_cases", "unassigned_cases", "categories", "admins"} <= overview.keys()
browser.api("/admin/cases")
browser.page("/support", "Support")
browser.api("/support/requests")
verification = browser.api("/verification")
assert verification["optional"] and not verification["configured"]
print("PASS production admin login, Secure/HttpOnly/SameSite session, admin queue, optional verification disabled")
print("PASS operations dashboard, support, legal draft library, OG images and anonymous admin protection")
browser.api("/auth/logout", {}, 204)
browser.api("/me", status=401)
print("PASS production logout invalidates the session")
