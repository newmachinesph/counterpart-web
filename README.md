# Counterpart

![License: MIT](https://img.shields.io/badge/license-MIT-blue) ![Next.js](https://img.shields.io/badge/Next.js-16-black) ![FastAPI](https://img.shields.io/badge/FastAPI-009688) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1)

Philippine venture platform: builders list working products, operators apply with
evidence, and pairings earn equity through measurable milestones.

The Next.js frontend is connected to FastAPI and PostgreSQL. Accounts, ventures,
applications, weekly ledgers, vesting, hiring and notifications persist in the
database. There is no runtime demo seed or in-memory write store.

## Run with Docker

```sh
docker compose up -d --build
docker compose ps
```

- Website: http://localhost:3010
- API and OpenAPI: http://localhost:8010/docs
- Local email inbox: http://localhost:8027
- PostgreSQL: localhost:5432 (development credentials in Compose)

Ports are bound to localhost. API startup applies additive Alembic migrations
and inserts the agreement reference template only if it is missing. The named
`pgdata` volume preserves accounts and application data across rebuilds and
restarts. No users, ventures, applications or ledger entries are seeded.

```sh
docker compose down             # stop; database volume remains
docker compose up -d            # restart with the same database
```

Do not use `down -v` on the main stack if you want to retain its database.
Existing records are preserved, including any records created by an older seed.
The cleanup removes demo code and assets, not existing database rows.

## Accounts

Choose **Create account** on `/login`. Public registration allows Builder and
Counterpart roles. Passwords are salted with scrypt; opaque session tokens are
stored hashed in PostgreSQL and carried by HttpOnly, SameSite=Lax cookies.
Sessions expire after 14 days and logout revokes them.

Existing users from the previous header-auth implementation keep their IDs and
data. Assign them a password with the local operator command. It also creates
privileged investor/admin accounts; public registration cannot grant those roles.

```sh
docker compose exec api python -m app.manage_user existing@example.com
docker compose exec api python -m app.manage_user admin@example.com --name "Your Name" --role admin
docker compose exec api python -m app.manage_user investor@example.com --name "Your Name" --role investor
```

Passwords are entered interactively, never supplied on the command line. Existing
roles are retained, supplied roles are added, and password changes revoke old sessions.

## Email

Domain events write email records transactionally with their business changes.
The worker delivers new records over SMTP, tracks delivery attempts, and retries
failures up to ten times. Historical outbox records are never replayed. Delivery
is at least once; retries share a stable Message-ID.

The default SMTP target is the project's local [Mailpit inbox](https://mailpit.axllent.org/docs/install/docker/).
It captures mail for inspection and does not send it to real recipients.
To enable external delivery, configure your provider in a local `.env`:

```dotenv
SMTP_HOST=smtp.your-provider.example
SMTP_PORT=587
SMTP_STARTTLS=true
SMTP_USERNAME=your-account
SMTP_PASSWORD=your-provider-password
SMTP_FROM=Counterpart <notifications@your-domain.example>
```

Recreate the worker after changing its environment: `docker compose up -d worker`.
For deployment behind HTTPS, also set the web service's `COOKIE_SECURE` to `true`
and configure your real origin, database credentials and reverse proxy.

## Development and verification

```sh
npm ci
npm run dev                    # localhost:3000; API defaults to localhost:8010
npm test
npm run typecheck
npm run lint
npm run build
docker compose run --rm api pytest -q
```

The backend suite uses a separate `counterpart_test` database, clearing only its
test tables. The web suite covers the shared domain calculations and API boundary.

Full acceptance checks use a separate Compose project with a temporary database.
They submit the real Next.js forms, verify resulting API state, test ownership,
restart API/web to verify persistence, and check SMTP delivery in an isolated inbox.

```sh
docker compose build api web
docker compose -f docker-compose.qa.yml up -d --wait
python scripts/web-e2e.py
docker compose -f docker-compose.qa.yml down
```

QA binds website/API/mail to ports 3011/8011/8026. Its database is tmpfs; stopping
that database discards QA fixtures. It never mounts the main stack's volume.

## Structure

```text
apps/web/src/lib/api/          Authenticated server-side API client and field mapping
apps/web/src/lib/data/         Request-scoped API snapshot (no mutable singleton)
apps/web/src/lib/services/     API commands and pure presentation selectors
apps/web/src/lib/domain/       Shared display calculations and validation
apps/api/app/                 Authoritative domain services, permissions and persistence
apps/api/alembic/             Database migrations
scripts/web-e2e.py            Isolated web/API/database/SMTP acceptance test
```

All writes go through backend services. The workspace endpoint scopes private
applications, pairings, ledgers, notifications and email addresses to authorized
users. Product URL verification rejects private network destinations and validates
redirects. Concurrent milestone synchronization locks the pairing before vesting.

## Brand and scope

The supplied mark is traced as editable vector paths in `apps/web/public/logo.svg`,
with matching navigation, footer, login and favicon assets. Cobalt and mango
remain the brand colors; Instrument Serif and Inter remain the typefaces.

Screenshots and logos support PNG/JPEG/WebP uploads (4 MB, 16 MP), sanitized to
WebP and stored in MinIO locally or R2 in production. Website metadata can suggest
Open Graph images and logos; builders can replace either. Logos preserve their
aspect ratio. Email verification and self-service password recovery are implemented. Social login is not implemented. The agreement
template remains explicitly marked for counsel review; this app records pairing
activity and does not provide electronic signing or execute equity transfers.

## Local integrations and accounts

Copy `.env.example` to `.env` and set a random MinIO password before starting
Docker. Local services: web **3010**, API **8010**, Mailpit **8027**, MinIO API
**9010**, MinIO console **9011**, QStash dev **9012**. Redis is private to Docker.
The main PostgreSQL and MinIO volumes persist across container restarts.

```sh
python scripts/local-accounts.py
docker compose cp scripts/local-scenarios.py api:/app/local-scenarios.py
docker compose exec -T api python local-scenarios.py
node scripts/live-integrations.mjs
```

Local builder, counterpart, investor and admin credentials are saved in ignored
`.local/test-accounts.json`. The scenarios create all five pairing states through
the domain services; these scripts explicitly reject remote/production databases.
These are requested local test fixtures, never application startup data.

Chat persists before a durable event is published through Ably. Browser tokens
expire in 15 minutes and grant subscribe access only to the signed-in user's
notification channel and their authorized pairing. Investors cannot read chat.
The web client renews tokens and falls back to polling. Ended conversations are
read-only. Redis/Upstash enforces bounded login, upload, chat and token rates.

Email jobs commit alongside business changes. A separate worker locks ready jobs,
delivers over SMTP, and records the result. `send_at` schedules UTC delivery;
failures retry with exponential backoff up to one hour, for at most 10 attempts.
Admins can schedule, inspect, cancel and manually retry jobs at `/admin/email-queue`.
The operations dashboard at `/admin` handles support requests, listing reports,
account requests and engagement disputes. Administrators assign owners, add private
notes, record outcomes and moderate reported listings. Users submit requests and
view their outcomes at `/support`; internal notes remain administrator-only.
SMTP is at-least-once: a crash after acceptance can duplicate mail; retries use a
stable Message-ID. Historical records without a dispatch time are not replayed.
Local mail always goes to Mailpit; production uses ZeptoMail with STARTTLS.

QStash calls `/webhooks/qstash/maintenance` to advance time-based lifecycle states.
The receiver verifies issuer, audience URL, timestamp, signature and body digest,
accepts current/next keys, and records completed jobs. Pairing row locks protect
vesting against duplicate and overlapping deliveries.

## Production operations

Frontend: Vercel team `sumnora`, project `counterpart`, root `apps/web`.
Backend and queue worker: Northflank project `counterpart`, Singapore region.
Database: DigitalOcean Managed PostgreSQL. Screenshots: existing R2 bucket `counterpart` at `cdn.counterpart.ph`.
`scripts/prepare-deployment.py` renders ignored service definitions with an explicit
environment allowlist; Cloudflare management tokens are not sent to services.
Never use database reset commands or local test scripts against production.

The six owner-requested project listings are imported once with
`python -m app.catalog --owner support@counterpart.ph`. Existing listings are left
untouched. They are **in development**, with no invented traction, equity offers,
or milestones. Development listings can accept applications; paid terms are required before an offer can be sent. This import never runs during application startup.

Identity verification is optional at `/settings/verification`. The integration is
disabled until the required Didit MCP connector configures and verifies the workflow
and webhook. No direct provider operations are performed as an MCP fallback.
The application integration checks signed webhook bodies, metadata, event ordering
and duplicate IDs; callback query strings cannot set verification status. Only the
provider session reference and status are stored, never identity documents.

Agreement and policy drafts are available at `/legal`. They are not in force and do not replace accepted contracts. Review [the draft pack](docs/legal/COUNTERPART-LEGAL-PACK.md) and [adoption requirements](docs/legal/REVIEW-AND-ADOPTION.md) before activating a new version.

## License

MIT. See [LICENSE](LICENSE). Copyright (c) 2026 Counterpart.
