# Counterpart API

FastAPI, SQLAlchemy, Alembic and PostgreSQL. Run from the repository root:

```sh
docker compose up -d --build
docker compose run --rm api pytest -q
```

OpenAPI: http://localhost:8010/docs. `/health` checks database connectivity.
Startup runs migrations and installs reference agreement content without seeding
users or venture activity. Existing database records remain intact.

Authentication uses `/auth/register`, `/auth/login` and revocable Bearer sessions.
`X-User-Id` is not accepted. `/workspace` returns a permission-filtered snapshot
for the web application; domain-specific POST endpoints own every mutation.

`python -m app.manage_user EMAIL` sets an existing account's password interactively.
Add `--name "Name" --role admin` (or investor/builder/counterpart) for new accounts.
The command preserves existing data and revokes prior sessions.

The separate `python -m app.mail_worker` process dispatches new transactional
outbox messages via SMTP. Compose defaults to a project-specific local Mailpit
inbox, not external delivery. See the root README for provider configuration.

Tests use `counterpart_test`, separate from the application database. The root
`docker-compose.qa.yml` and `scripts/web-e2e.py` verify actual website forms with
a disposable database and SMTP inbox.
