# Counterpart delivery record

## Fresh production deployment - 29 September 2026

Commit `c7aa317` was pushed to `main`. Vercel project `sumnora/counterpart` deployed it to `counterpart.ph`; the new Northflank `counterpart` project in Singapore deployed separate `api` and `worker` services from the same commit. Both Northflank builds succeeded and both deployments completed. `https://api.counterpart.ph/health`, `/jobs`, and the website homepage, login, and privacy pages returned HTTP 200 with valid HTTPS certificates.

The owner chose a fresh DigitalOcean Managed PostgreSQL database rather than a Neon data migration. Database `counterpart` and dedicated user `counterpart_app` were created on the existing Singapore PostgreSQL cluster. The app connects with full TLS certificate verification. Migration `g365_operations` and the reference agreement template were installed; the new database has 28 public tables and zero users. No previous production account or venture records were copied.

The release passed 176 backend tests after the fixed-clock offer test was corrected, 111 frontend tests, and the frontend and API production builds. Read-only checks confirmed authentication to Ably, R2, ZeptoMail, Upstash Redis, and QStash. Didit remains disabled. Credentials and service definitions remain in ignored local files; only the database's public CA certificate was committed.

QStash's resolver could not resolve the newly provisioned `api.counterpart.ph` route, although public DNS resolvers and browser requests succeeded. The maintenance schedule and API signature audience were switched to Northflank's stable service hostname `http--api--x48kynmw6w6z.code.run`. A signed QStash probe was delivered with HTTP 200, and its receipt was recorded in the new database. The schedule remains active every five minutes. `api.counterpart.ph` remains attached as the public API domain.

The sections below record the earlier 18 September release on Neon and its then-current data. They do not describe the fresh DigitalOcean database.

---

Verified 18 September 2026 (Asia/Singapore).

## Release verification - 18 September 2026, 10:05 UTC

Feature commit `9358ede` was pushed to `main` and deployed successfully to the production website, API and email worker. Vercel deployment `dpl_25FRiqzDttGnivFmkxqPXcnaddou` serves `counterpart.ph`; both Northflank services reported the same commit with completed deployments.

The production database was migrated from `f254_commercial_agreements` to `g365_operations` before the push. A private snapshot of the affected tables was saved, and every original field and row count was verified unchanged after migration. All six ventures and the existing user were preserved. No QA records were imported.

The release passed 176 backend tests, 111 frontend tests, TypeScript, ESLint and production builds. Live checks covered admin login and authorization, operations overview/cases, support, email delivery administration, development application links, both refreshed OG images, all seven legal draft pages/downloads, and logout invalidation. The legal library remains draft-only; Didit verification remains disabled pending provider setup and a real callback test.

The smoke script's expected email page heading was corrected to the existing "Email delivery" heading during live verification. Release evidence and database snapshots are retained in ignored `.local/release-*` files.

## Launch decisions and external email check — 18 September 2026

- The owner confirmed that payments and signed cofounder documents remain external. Integrated payments and electronic signing are outside the launch scope.
- An owner-authorized test email was submitted through the production admin queue. Job `mail_f8f2e2fb40ec` was marked delivered at `2026-09-18T08:42:37.116070Z`, on its first attempt, with no recorded error.
- The owner confirmed receipt in the Gmail inbox. The production queue-to-SMTP send path and inbox delivery passed for this test; production verification and password-reset journeys remain separate checks.
- Recipient and detailed test evidence are stored in ignored `.local/email-delivery-test.json`.

## Development applications

Development ventures now accept applications before commercial terms are published. Their development label remains visible. Builders can review and shortlist applications; complete paid terms are still required to send an offer, and acceptance is required before work starts. Drafts and ventures with live pairings remain closed to applications.

Release validation: 176 backend tests, 111 frontend tests, TypeScript, ESLint and the production frontend build passed. The isolated Docker QA stack was used for browser checks.

**Commercial redesign update:** The earlier delivery results below describe the original release. The current release uses accepted paid commercial engagements and separately documented cofounder grants. See [the audit and remediation record](PLATFORM-AUDIT-2026-09-18.md#authorized-remediation-delivered). Current checks: 159 backend tests, 107 frontend tests, TypeScript, ESLint, production build, additive PostgreSQL migration, and the real browser offer/payment flow passed. Password recovery, email verification, privacy terms and exact-version commercial acceptance are now implemented. Legal equity issuance and external electronic signing remain outside the platform. Production data must never be replaced with QA fixtures.

## Deployment

### Admin operations

`/admin` brings support, listing reports, account requests and existing engagement disputes into one administrator-only queue. Cases support assignment, internal notes, review status, documented outcomes and reopening, with version checks and an append-only activity history. `/support` lets signed-in users submit and track their own requests. Resolutions are visible to the requester; internal notes are not. Listing reports can hide and restore a venture, preserving its original published/development status and existing records. A moderation hold prevents builders from republishing a hidden listing. Account requests do not automatically delete accounts, and review outcomes do not change compensation claims or transfer money.

Apply the additive `g365_operations` migration before deploying the updated API and frontend. It preserves existing review cases and adds operations fields and listing moderation holds. The migration passed on the isolated QA database. Validation: 176 backend tests, 111 frontend tests, ESLint, TypeScript and production builds passed. Argent browser checks verified support submission, starting review, recording a resolution, requester visibility, and non-admin redirection. The dashboard was also checked in a 390px browser frame. These checks were performed against the isolated QA stack before deployment.

- Website: https://counterpart.ph — Vercel, Sumnora team, `counterpart` project.
- API: https://api.counterpart.ph — Northflank, `sumnoras-team/counterpart`, Singapore.
- API and durable queue worker are separate Northflank services.
- Neon holds production records. Existing data was preserved; no local fixtures were imported.
- R2 bucket `counterpart` and https://cdn.counterpart.ph are configured for public product images.
- ZeptoMail SMTP authenticated successfully over STARTTLS. Actual delivery was tested through Mailpit locally and the owner-confirmed Gmail inbox test recorded above.
- QStash maintenance runs every five minutes; real signed deliveries were received and recorded in production.
- Cloudflare DNS and Northflank/Vercel domain verification are configured. At verification time this workstation's upstream DNS still cached the previous apex result. Production frontend checks used the verified Vercel edge address with normal TLS hostname verification; API hostname resolution and TLS worked directly.

The production Bench contains Creatorz, Hire From PH, Jinnie, Gimik, Phriend and KYP, all marked **In development**. Metadata supplies images/logos where available. No traction, equity, milestones or hiring claims were invented. Development listings can accept applications. Builders must complete paid commercial terms before sending offers.

## Historical verification evidence (original release)

| Check | Result |
| --- | --- |
| Backend suite | 149 passed, including permissions, transactions, lifecycle, immutable vesting, queue retries, webhook signatures and uploads |
| Frontend suite | 92 passed, including chat reconnect pagination |
| TypeScript, ESLint, production Docker build | Passed |
| Isolated real Next → FastAPI → PostgreSQL workflow | Passed registration, draft/publish, application/invitation, ledger/vesting, comments, notifications, paid hiring, release, restart persistence, logout and SMTP delivery |
| All four local account roles | Builder, counterpart, investor and admin login passed |
| Five lifecycle states | Local inspectable proving run, active, completed, released and lapsed fixtures created through domain services |
| Live integrations | Real Ably event delivery, private chat authorization, actual MinIO upload and scheduled Mailpit delivery passed |
| Production login | Existing admin login, Secure/HttpOnly/SameSite cookie, admin queue and logout invalidation passed |
| Cloud dependencies | Neon connection, R2 bucket access, Upstash PING and ZeptoMail TLS authentication passed |
| Browser checks | Chat sends/persists and receives live updates; URL metadata loads; custom wide logo upload preserves aspect ratio |
| Responsive checks | Bench, project form and verification page fit a 390px frame without horizontal overflow |

Final fixes prevent completed ventures from accepting another pairing on an already fully vested schedule, and fetch missed chat pages after reconnecting. An exhausted chat history cursor stays exhausted during polling.

## Access and local operation

Local site: http://localhost:3010. API: http://localhost:8010. Mailpit: http://localhost:8027. MinIO console: http://localhost:9011.

Private credentials are in ignored files, never committed:

- `.local/test-accounts.json`: local builder, counterpart, investor and admin accounts.
- `.local/production-admin.json`: production `support@counterpart.ph` admin.
- `.env`: local configuration and supplied provider credentials.

`docker compose up -d` starts the main stack. Do not delete its volumes. `docker-compose.qa.yml` is a separate acceptance stack with a disposable tmpfs database.

Admin email scheduling, retry and cancellation are at `/admin/email-queue`. Failed deliveries retry with exponential backoff, up to ten attempts; exhausted jobs remain available for manual retry. Delivery is at least once, with a stable Message-ID.

## Remaining external dependency and scope

Didit remains disabled. The user explicitly required MCP for Didit operations, and the connector was unavailable. Optional verification never blocks ordinary account use. Enabling it requires the Didit MCP connector, configuring/verifying the workflow and webhook, and then testing the real provider callback before enabling the feature flag.

Production R2 bucket access was checked; the actual upload flow was exercised against local MinIO. Password recovery and email verification are implemented. Social login, electronic agreement signing and legal equity transfers remain outside the implemented scope. Agreement templates remain marked for counsel review.

Use `scripts/production-smoke.py` for non-destructive production checks with the existing private admin credentials. Set `COUNTERPART_EDGE_IP` only when testing through the verified Vercel address during DNS propagation.

## Agreement and policy review library

`/legal` contains seven downloadable drafts for platform terms, privacy, conduct and complaints, paid engagements, confidentiality/IP, cofounder terms and employment offers. They remain explicitly not in force; existing acceptance versions and agreement snapshots are preserved. See [the review and adoption record](legal/REVIEW-AND-ADOPTION.md) and [the operations runbook](legal/OPERATIONS-RUNBOOK.md).

## Venture OG refresh

Creatorz and Hire From PH now use their current website OG images in production. Both were verified in the live Bench at 1200 x 630. Only the previously empty screenshot fields were updated; the two original records were saved in ignored `.local/og-refresh-before.json`.
