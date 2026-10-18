"""Real Next server forms -> FastAPI -> PostgreSQL acceptance checks.

Run only against docker-compose.qa.yml. All credentials are generated in memory.
The application's normal database is never connected to or cleared.
"""
import http.cookiejar
import json
import secrets
import subprocess
import time
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from urllib.error import HTTPError
from urllib.request import Request, build_opener, HTTPCookieProcessor, urlopen

WEB = "http://127.0.0.1:3011"
API = "http://127.0.0.1:8011"


class Forms(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.forms, self.current = [], None
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "form":
            self.current = {"fields": [], "names": set()}
            self.forms.append(self.current)
        if self.current is not None and tag in ("input", "select", "textarea") and attrs.get("name"):
            self.current["names"].add(attrs["name"])
            if tag == "input" and attrs.get("type") == "hidden":
                self.current["fields"].append((attrs["name"], attrs.get("value", "")))

    def handle_endtag(self, tag):
        if tag == "form":
            self.current = None


class Browser:
    def __init__(self):
        self.cookies = http.cookiejar.CookieJar()
        self.http = build_opener(HTTPCookieProcessor(self.cookies))

    def page(self, path, expected=None):
        with self.http.open(WEB + path, timeout=30) as response:
            html = response.read().decode()
            assert response.status == 200, path
            assert "We could not load this page" not in html, path
            if expected:
                assert expected in html, (path, expected)
            return html

    def form(self, path, marker, values, expected=None):
        html = self.page(path)
        forms = Forms(html).forms
        candidates = [f for f in forms if marker in f["names"]]
        assert candidates, (path, marker, [list(f["names"]) for f in forms])
        matching = [f for f in candidates if all(k not in values or str(values[k]) == v for k, v in f["fields"])]
        form = (matching or candidates)[-1]
        fields = [(k, v) for k, v in form["fields"] if k not in values]
        for k, value in values.items():
            fields.extend((k, str(v)) for v in (value if isinstance(value, list) else [value]))
        boundary = "counterpart-" + secrets.token_hex(16)
        body = "".join(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n' for k, v in fields)
        body += f"--{boundary}--\r\n"
        request = Request(WEB + path, data=body.encode(), headers={"Origin": WEB, "Content-Type": "multipart/form-data; boundary=" + boundary})
        with self.http.open(request, timeout=45) as response:
            text = response.read().decode()
            assert "We could not load this page" not in text, path
            if expected:
                assert expected in text, (path, expected, response.url)
            return text

    def api(self, path, data=None, status=200):
        token = next((c.value for c in self.cookies if c.name == "cp_session"), None)
        request = Request(API + path, data=None if data is None else json.dumps(data).encode(), headers={"Content-Type": "application/json", **({"Authorization": "Bearer " + token} if token else {})})
        try:
            with urlopen(request, timeout=30) as r:
                assert r.status == status, (path, r.status)
                return json.load(r) if r.status != 204 else None
        except HTTPError as e:
            detail = e.read().decode()
            assert e.code == status, (path, e.code, detail)
            return json.loads(detail) if detail else None


def run():
    anon, builder, partner = Browser(), Browser(), Browser()
    for route in ["/", "/about", "/how-it-works", "/faq", "/builders", "/counterparts", "/investors", "/bench", "/jobs", "/terms/terms_v0", "/login"]:
        anon.page(route)
    anon.page("/dashboard", "Welcome back.")
    suffix = secrets.token_hex(5)
    credentials = {}
    for browser, role in [(builder, "builder"), (partner, "counterpart")]:
        account = {"name": f"QA {role}", "email": f"{role}-{suffix}@example.test", "password": secrets.token_urlsafe(24), "role": role, "mode": "register", "next": "/dashboard"}
        credentials[role] = account
        browser.form("/login?mode=register", "email", account, "Good ")
        session_cookie = next(cookie for cookie in browser.cookies if cookie.name == "cp_session")
        assert session_cookie.has_nonstandard_attr("HttpOnly")
        assert browser.api("/me")["roles"] == [role]
    print("PASS public routes, guarded routes, registration, HttpOnly sessions")

    name = f"QA Venture {suffix}"
    builder.form("/ventures/new", "ms_title", {
        "name": name, "oneLiner": "A working product for integration acceptance checks.",
        "description": "This isolated acceptance venture verifies the complete builder and counterpart workflow against PostgreSQL.",
        "category": "saas", "stage": "live", "productUrl": "https://example.com",
        "screenshots": "https://example.com/product.png", "tractionSummary": "Acceptance check",
        "equityMinPct": 8, "equityMaxPct": 12, "hoursPerWeek": 20,
        "builderHasDone": "Built a working product", "counterpartWouldOwn": "Customer acquisition",
        "vestingTerms": "Equity is earned per milestone.", "unitLabel": "customer",
        "revenuePerUnitPhpMonthly": 100, "variableCostPerUnitPhpMonthly": 10,
        "monthlyContributionPhp": 1000, "withinDays": 90,
        "ms_title": ["First customers", "More customers"], "ms_metricKey": ["customers_live", "customers_live"],
        "ms_metricLabel": ["Customers", "Customers"], "ms_unit": ["count", "count"], "ms_aggregation": ["latest", "latest"],
        "ms_targetValue": [3, 10], "ms_tranchePct": [2, 8], "ms_windowDays": [45, 90],
    }, name)
    state = builder.api("/workspace")
    venture = next(v for v in state["ventures"] if v["name"] == name)
    vid, slug = venture["id"], venture["slug"]
    assert venture["unit_economics"]["revenue_per_unit_php_monthly"] == 100
    assert venture["status"] == "draft"
    assert not any(v["id"] == vid for v in anon.api("/workspace")["ventures"])
    builder.form("/ventures", "ventureId", {"ventureId": vid})
    assert next(v for v in builder.api("/workspace")["ventures"] if v["id"] == vid)["status"] == "published"
    anon.page("/bench/" + slug, name)
    print("PASS web venture creation, private draft, URL verification and publication")

    partner.form(f"/bench/{slug}/apply", "evidence", {
        "evidence": "I grew customer acquisition through direct outreach and measured weekly follow-ups. " * 4,
        "proofLinks": "https://example.com/proof", "nm_metric": "Customers", "nm_before": "0", "nm_after": "30", "nm_timeframe": "6 months",
        "hoursPerWeek": 20, "compensation": "equity_only", "track": "counterpart", "requestedEquityPct": 10,
        "templateId": "growth", "commitments": "Own resources",
        "whyThisVenture": "I know the customers and can grow distribution.",
    }, "Application received")
    application = next(a for a in partner.api("/workspace")["applications"] if a["venture_id"] == vid)
    queue = f"/ventures/{slug}/applications"
    builder.page(queue, "QA counterpart")
    builder.form(queue, "applicationId", {"applicationId": application["id"], "action": "invite"})
    p = next(p for p in partner.api("/workspace")["pairings"] if p["venture_id"] == vid)
    pid = p["id"]
    assert p["state"] == "proving_run"
    for route in [f"/pairings/{pid}", f"/pairings/{pid}/log", f"/pairings/{pid}/agreement", f"/pairings/{pid}/review", "/pairings", "/dashboard", "/notifications"]:
        partner.page(route)
    monday = (datetime.now(timezone.utc).date() - timedelta(days=datetime.now(timezone.utc).weekday())).isoformat()
    partner.form(f"/pairings/{pid}/log", "weekStarting", {"weekStarting": monday, "value_customers_live": 3, "note": "First real milestone in isolated QA", "evidenceLinks": ""})
    state = partner.api("/workspace")
    assert next(x for x in state["pairings"] if x["id"] == pid)["state"] == "active"
    assert sum(v["tranche_pct"] for v in state["vesting"] if v["pairing_id"] == pid) == 2
    entry = next(e for e in state["ledger_entries"] if e["pairing_id"] == pid)
    builder.form(f"/pairings/{pid}", "entryId", {"pairingId": pid, "entryId": entry["id"], "body": "Evidence reviewed."})
    builder.page(f"/pairings/{pid}", "Evidence reviewed.")
    partner.form(f"/pairings/{pid}/review", "message", {"pairingId": pid, "message": "Please review our next milestone."})
    builder.page("/notifications", "Please review our next milestone.")
    print("PASS applications, invitation, ledger, milestone vesting, comments, notifications")

    builder.form("/jobs/new", "fundedBy", {"ventureId": vid, "title": "QA sales role", "team": "Growth", "type": "part_time", "arrangement": "remote", "location": "Philippines", "summary": "An isolated QA role with documented external funding.", "responsibilities": "Sales", "lookingFor": "Experience", "salaryMinPhpMonthly": 5000, "salaryMaxPhpMonthly": 8000, "fundedBy": "outside_funding"})
    opening = next(o for o in builder.api("/workspace")["openings"] if o["venture_id"] == vid)
    outsider = Browser()
    outsider.form("/login?mode=register", "email", {"mode": "register", "name": "QA Applicant", "email": f"job-{suffix}@example.test", "password": secrets.token_urlsafe(24), "role": "counterpart"}, "Good ")
    outsider.api(f"/pairings/{pid}", status=403)
    outsider.form(f"/jobs/{opening['id']}/apply", "availableFrom", {"evidence": "I can demonstrate relevant commercial results and direct selling experience. " * 4, "proofLinks": "https://example.com/proof", "availableFrom": monday, "expectedSalaryPhpMonthly": 6000, "whyThisRole": "I know these customers and want to help."})
    job = next(j for j in outsider.api("/workspace")["job_applications"] if j["opening_id"] == opening["id"])
    builder.page(f"/jobs/{opening['id']}/applicants", "QA Applicant")
    builder.form(f"/jobs/{opening['id']}/applicants", "applicationId", {"openingId": opening["id"], "applicationId": job["id"], "action": "hire"})
    outsider.page("/dashboard", "hired")
    partner.form(f"/pairings/{pid}", "reason", {"pairingId": pid, "reason": "QA completed"})
    assert sum(v["tranche_pct"] for v in partner.api("/workspace")["vesting"] if v["pairing_id"] == pid) == 2
    print("PASS paid roles, hiring, ownership checks, release preserves vested equity")

    subprocess.run(["docker", "compose", "-f", "docker-compose.qa.yml", "restart", "api", "web"], check=True, stdout=subprocess.DEVNULL)
    for attempt in range(30):
        try:
            state = builder.api("/workspace")
            builder.page("/dashboard", name)
            break
        except Exception:
            if attempt == 29:
                raise
            time.sleep(1)
    assert any(v["id"] == vid for v in state["ventures"])
    print("PASS database data and sessions survive API/web restart")
    builder.api("/auth/logout", {}, 204)
    builder.api("/me", status=401)
    builder.page("/dashboard", "Welcome back.")
    builder.form("/login", "email", {"email": credentials['builder']['email'], "password": credentials['builder']['password'], "mode": "login"}, "Good ")
    print("PASS logout invalidation and password sign-in")

    for attempt in range(15):
        with urlopen("http://127.0.0.1:8026/api/v1/messages", timeout=10) as response:
            messages = json.load(response)
        if any(suffix in json.dumps(message) for message in messages.get("messages", [])):
            break
        if attempt == 14:
            raise AssertionError("No workflow email reached the isolated SMTP inbox")
        time.sleep(1)
    print("PASS queued email delivered through SMTP to isolated local inbox")


if __name__ == "__main__":
    run()
