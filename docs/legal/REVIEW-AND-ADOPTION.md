# Counterpart: legal review and adoption record

Prepared 18 September 2026. Status: proposed drafts, not legal approval or production adoption.

## Deliverables

[Read the complete draft pack](COUNTERPART-LEGAL-PACK.md). The same seven documents are available in the local application at `/legal`, with individual Markdown downloads. The source of truth is `apps/web/src/lib/legal/documents.json`; regenerate this export using `node scripts/export-legal-pack.mjs` after editing.

1. Platform terms of service.
2. Privacy and cookie notice.
3. Conduct, moderation and complaints policy.
4. Paid commercial engagement agreement.
5. Mutual confidentiality and IP schedule for external signing.
6. Non-binding cofounder and equity term sheet for counsel to turn into company-specific instruments.
7. Employment offer schedule to accompany an appropriate employment contract.

The preparation assumes the Philippines-facing model described by the application. The legal operator, business address, country and legal/privacy contact were requested from the owner and remain unconfirmed. Existing `support@counterpart.ph` copy is not evidence that a legally accountable operator or monitored privacy role has been designated. Bracketed fields deliberately preserve those unknowns.

## Decisions carried forward

- Payments remain external. Counterpart records payer assertions, recipient acknowledgments and disputes; it does not hold funds or guarantee collection.
- Cofounder signatures and company documents remain external. Platform records do not issue securities or replace corporate approvals.
- Development ventures can accept applications. Required paid commercial terms must be complete before an offer; productive work starts after acceptance.
- No automatic KPI equity, forfeiture of accrued pay or blanket cancellation of validly acquired ownership on departure.
- Employment status depends on the actual arrangement. A commercial agreement must not disguise an employee relationship.
- Existing accepted agreements remain intact. The drafts are not selectable templates and do not change registration consent or existing agreement snapshots.

## Review findings and resulting provisions

| Finding | Draft treatment | Remaining adoption work |
| --- | --- | --- |
| Terms name a brand, not a confirmed accountable legal person | Explicit operator, address and contact fields | Owner supplies details; counsel confirms contracting identity |
| Existing public policies are brief | Detailed scope, license, moderation, remedies and privacy disclosures | Confirm practices and future effective date |
| Existing operator template leaves work-product ownership to another document | Express paid-deliverable assignment and background-IP license; separate IP schedule | Review formalities and commission-only payment allocation |
| Platform review could be mistaken for adjudication | Administrative outcomes expressly distinguished from settlement, refunds and legal ownership | Train reviewers; attach dated settlements; don't mark partial payments fully paid |
| Privacy notice does not define a tested retention program | Honest purpose-based public notice plus proposed internal schedule | Approve periods and implement deletion, restriction, backup expiry and legal holds |
| Registration records a server-selected terms version only | Adoption plan calls for exact presented version, hash and acceptance timestamp | Add acceptance-event storage and stale-version rejection before switching terms |
| `operator_v1` serves as both lifecycle protocol and template identifier | New draft has a distinct document version | Separate template version from lifecycle protocol; preserve old database templates |
| Optional Didit flow can process sensitive data | Separate advance disclosure/consent and current local metadata inventory | Confirm provider contract, configured checks, retention and consent before enabling |
| A company equity template cannot be universal | Non-binding term sheet with approval, capitalization and departure questions | Counsel creates definitive company-specific documents and records |
| Job offers need employment-specific protections | Separate employment schedule | Employer obtains role/location-specific advice and payroll compliance |

The proposed platform liability limit is the greater of PHP 25,000 or fees paid directly to Counterpart in the preceding 12 months, with explicit exceptions. This is a commercial drafting recommendation, not a statutory safe harbor. The owner and counsel must assess it against the actual business, insurance and non-excludable duties. There is no forced arbitration, remote exclusive venue, blanket indemnity, general non-compete or waiver of mandatory rights in the pack.

## Code checked against the drafts

- `apps/api/app/domain/contracts.py`: current `platform_2026_09` and `operator_v1`; validated commercial terms and current clauses.
- `apps/api/app/accounts.py`: affirmative registration checkbox required; server writes platform version; no separate historical acceptance event or presented-version check.
- `apps/api/app/services/commercial.py`: immutable offer snapshot/hash, acceptance, 14-day offer expiry and mutual continuation.
- `apps/api/app/routers/commercial.py`: external payment status flow, compensation review, separately documented cofounder grants and illustrative vesting.
- `apps/api/app/bootstrap.py`: templates inserted without replacing old rows. Reusing `operator_v1` for revised clauses would leave existing template rows stale and confuse version identity.
- `apps/api/app/routers/verification.py`: optional Didit session; local session metadata/status and webhook receipt references, not persisted raw ID images or full webhook payload. Provider retention is not established by this code review.
- `apps/api/app/routers/operations.py` and `services/operations.py`: support intake, restricted case notes, assignment, resolution, reopening and listing moderation from the preceding local implementation. Account deletion remains a manually fulfilled request, not a delete button.

Graph evidence was checked against direct source because indexed file metadata had changed. This was a bounded policy/workflow review, not a security certification or a complete legal compliance audit.

## Before adopting an operative version

1. Confirm operator name, business address, country, legal/privacy contacts and a named accountable privacy lead. Confirm that contacts are monitored and that any registration or appointment duties are met.
2. Obtain counsel review of the actual marketplace role, employment model, corporate instruments, privacy practices and applicable jurisdictions. In particular, assess Internet Transactions Act and related DTI obligations for this business; external payments alone do not establish exemption.
3. Review vendor agreements, cross-border arrangements, data locations, access, backups and deletion capability. Inventory logs and any analytics. Do not adopt a notice that claims an unverified control or deletion period.
4. Decide and implement the operations runbook and retention schedule. Test a privacy request, account closure, legal hold, provider deletion request and incident escalation in QA.
5. Finalize the public text and effective date, then assign new immutable operative IDs. Archive the old terms and privacy notice. Never relabel the old text with a new ID or silently replace an accepted version.
6. For platform terms, serve a canonical version/hash to the client, submit that version with explicit acceptance, reject mismatches, and record user, server timestamp, version, document hash and acceptance action in an append-only event. Keep privacy-notice acknowledgment separate from optional consent. Collect only proportionate evidence; storing an IP address is not automatically necessary.
7. Give existing users appropriate notice and collect renewed acceptance where required. Do not automatically update every user's stored version. Existing engagement rights continue under their accepted snapshots.
8. For the commercial agreement, retain lifecycle protocol compatibility while introducing a separate template ID. Seed the new record, retain the old one, update previews and validators coherently, save all completed values in the offer, and require acceptance of its exact hash. Added identity/IP schedule fields must be saved and shown before acceptance, not inserted only into a later download.
9. Reconcile revised clauses with claims, departure, continuation and grant behavior. Any different notice period, payment trigger or equity condition must be implemented or expressly handled outside the platform with the record identifying the limitation.
10. Deploy only after the text, notices, acceptance record and operational process agree. This task does not deploy, activate legal drafts, amend contracts or send policy-change emails.

## Research basis and limits

The sources support specific drafting issues, not a claim that the pack has legal approval:

- A privacy notice informs people about processing; it is distinct from consent. [NPC Advisory Opinion 2018-013](https://privacy.gov.ph/wp-content/uploads/2022/01/AdOpNo.2018-013.pdf).
- Purpose, proportionality, rights, security and limited retention are relevant to the privacy design. [Data Privacy Act](https://privacy.gov.ph/data-privacy-act/), [implementing rules](https://privacy.gov.ph/implementing-rules-regulations-data-privacy-act-2012/), [data subject rights](https://privacy.gov.ph/data-subject-rights/).
- Employment classification depends on facts, not the chosen label. [DOLE explanation of relationship tests](https://dole.gov.ph/news/delivery-riders-protected-by-labor-law-contract-dole/).
- Ownership of a commissioned work and copyright require careful distinction and an express written stipulation where rights are to be transferred. [IP Code, section 178.4](https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/2/4371).
- Electronic records can have legal significance, but a click or hash alone does not establish every required legal element. [Electronic Commerce Act](https://www.gppb.gov.ph/wp-content/uploads/2023/06/Republic-Act-No.-8792.pdf).
- Contractual freedom is limited by mandatory law and public policy. [Civil Code](https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/2/53360).
- Company grants need company-specific authorization and instruments. [Revised Corporation Code](https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/2/86463).
- Marketplace obligations require a separate applicability assessment. [DTI legal resources](https://ecommerce.dti.gov.ph/related-laws-policy-issuance/).

Some Supreme Court pages were available through indexed official search excerpts but failed direct retrieval. Do not treat those excerpts as a full verification of every provision or later amendment. Sources were consulted on 18 September 2026; counsel should confirm the operative rules at adoption.

## Implementation verification

- TypeScript, ESLint, the production Docker frontend build and all 111 existing frontend tests passed.
- All seven document pages and seven downloads returned successfully from the isolated QA stack. Downloads contain every canonical paragraph, the draft version and status, attachment headers and noindex instructions. Unknown document and download routes return 404.
- The exported pack was checked against every paragraph in the canonical corpus.
- Argent browser QA verified library-to-document navigation, complete section anchors and noindex metadata. The library and paid-engagement document fit a 390px browser frame without horizontal overflow; desktop layout was visually inspected.
- The current operative terms, privacy page, registration version and accepted commercial snapshots were not replaced. No backend or production data changes were made for this drafting task. Local QA preview: `http://localhost:3011/legal`.
