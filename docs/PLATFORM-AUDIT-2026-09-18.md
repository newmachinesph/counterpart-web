# Counterpart platform audit — 18 September 2026

Counterpart should default to **paid commercial engagements**, with a separate, deliberate route into cofounder equity. Its current promise—self-reported milestones automatically produce permanent equity—is poorly suited to short trials, sales contractors, and interns.

The findings below describe the original audited version. The authorized remediation is implemented; see the delivery notes at the end for the resulting behavior and verification. Existing agreements and historical equity records are preserved.

## Recommended commercial model

Keep Counterpart's useful proposition: a builder with a product finds someone who can grow it, agrees the work, and shares measurable results. Make the financial relationship explicit before either person starts.

| Relationship | Compensation | Ownership | Departure |
|---|---|---|---|
| Paid proving engagement | Agreed fee/retainer and/or commission on eligible collected sales; compensation must suit the actual working relationship | None | Pay accrued amounts and documented eligible pipeline commissions; complete handover |
| Continuing commercial partner | Renewable agreement with retainer, commission, or a precisely defined, time-limited revenue share | None by default | New earning eligibility ends under the contract; accrued payments and a bounded pipeline tail remain payable |
| Formal cofounder | Separately negotiated equity grant, with any cash compensation documented independently | Only under the actual equity instrument and required approvals | Future service vesting stops; vested rights remain subject to the agreed legal instrument and any valid transfer/buyback provisions |
| Employee or intern | Appropriate employment/internship arrangement and applicable compensation | Optional separate incentive plan, if suitable | Apply the applicable employment and incentive terms |

Keep the current **45 days as a configurable commercial-trial default**, not a legal classification or an equity cliff. A longer sales cycle may need a different agreed period. Start the clock only after both parties accept the same agreement. Reaching a KPI prompts a review; it does not silently create a cofounder or grant shares.

Do not make all marketing, onboarding, and operations work commission-only: those roles may deliver valuable work before attributable revenue appears. Specify the cash fee, expense budget, access, product support, and expected deliverables.

For a continuing operator, an illustrative contract could run six months, renewable by mutual agreement. Define eligible customers/deals, attribution, collected cash, exclusions such as taxes/refunds, payment dates, disputes, termination, and a bounded tail for registered pre-exit opportunities. For example, a 90-day collection tail may fit some businesses; it is a negotiable product choice, not a legal rule. Do not silently create commissions on all future renewals or all company revenue.

Example only: at a negotiated 10% commission on PHP 100,000 of eligible net collected sales, compensation is PHP 10,000. This is compensation for specified sales, not 10% company ownership. The commercial rate must fit each venture's margins; 10% is not a recommended universal rate.

## What equity actually means

Leaving normally stops future vesting; it does not automatically turn vested shares into commission or cancel them. Genuine vested ownership can survive departure. That does not mean receiving new shares forever, an unchanged percentage despite dilution, or guaranteed monthly payments. The actual instrument and shareholder arrangements matter. Founder vesting commonly protects against early departure through restrictions on the **unvested** portion. [Cooley founder stock guidance](https://www.cooleygo.com/founder-basics-founders-stock/).

For a formal cofounder, consider a four-year schedule with a one-year cliff and monthly vesting thereafter as a starting point for counsel and negotiation. This is common US startup practice, not Philippine law. Start-date credit for trial work must be explicit. KPI achievement can inform selection and grant size; it should not automatically accelerate the whole award. [Y Combinator on founder vesting](https://www.ycombinator.com/blog/splitting-equity-among-founders).

Illustration: a grant representing 10% at its defined capitalization basis, over 48 months with a 12-month cliff, produces 0 vested before the cliff, 2.5 percentage points at month 12, and 3.75 at month 18. Departing at month 18 generally stops the remaining 6.25 points from vesting. The vested interest is not automatically erased. Actual grants should use share/unit counts and a defined capitalization basis; financing may dilute the resulting percentage.

If “departed contributors must never retain ownership” is an absolute requirement, choose contractual cash compensation for that relationship. Do not market it as ordinary cofounder equity. A pre-agreed buyback is another possible mechanism, but requires an identified buyer, valuation, funding, timing, and legally valid documentation. Do not assume the company can always repurchase shares: the Philippine Revised Corporation Code places conditions on ordinary corporate own-share acquisitions. Dividends and stock issuance also have their own statutory requirements; future services alone are not consideration for issuing stock. [RA 11232, sections 40, 42 and 61](https://lawphil.net/statutes/repacts/ra2019/ra_11232_2019.html).

Protect both sides. A builder should not be able to evade earned commissions by delaying collections, removing access, or terminating immediately before a milestone. An operator should not be able to generate ownership through unsupported figures. Define notice, evidence, cure opportunities where appropriate, and an impartial dispute route. Do not replace already-agreed rights retroactively.

## Audit evidence and limits

- Baseline: repository commit `f36a85c`; live `counterpart.ph` and public API checked on 18 September 2026.
- Inventoried all **30 Next page routes**, examined public copy and central forms/components, and traced the API's application, pairing, ledger, milestone, departure, jobs, agreement, and access behavior.
- Live read-only requests: 17 public content URLs returned HTTP 200, eight protected paths redirected to login, and `/privacy` plus `/terms` returned 404. The 17 include the six current venture pages. Dynamic authenticated pages were reviewed through source, not exercised with live accounts.
- Live `/stats`: zero published ventures, applications, running pairings, logged weeks, and vested percentage. Public workspace lists six development ventures: Creatorz, Hire From PH, Jinnie, Gimik, Phriend, KYP. These figures do not establish that no historical or off-platform obligations exist.
- Public workspace serves `terms_v0` with two sections; the public editor serves a separate 12-section draft under that same ID.
- Ran isolated domain/schema examples using the actual Python implementation. Reproduce with `python scripts/audit_compensation.py`. They do not connect to a database, send messages, or write business records.
- Graph discovery used project `D-Projects-counterpart-web`, generation `2026-09-18T03:32:51Z`; relevant search pagination and bounded coverage checks were completed. Exact-path metadata was marked changed, so material claims were checked against source. The reported partial parse at `agreement-editor.tsx:98` was read directly. Graph coverage is not proof of completeness.
- This is a site-wide product, compensation, and source audit, with limited access-control review. It is not a penetration test, accessibility certification, full browser/device regression, verification of third-party delivery, or legal opinion. No live account was created and no live business transaction was submitted. The local Docker database was unavailable; database integration and concurrency behavior were not re-tested in this audit.

## Findings to resolve before real financial commitments

### 1. Permanent milestone equity is the current product, not an incidental wording issue — critical model mismatch

Home, builders, counterparts, FAQ, about, investor copy, the footer, dashboards, notifications, terms, and the database model promise or encode retained vested equity. Ending the engagement preserves vesting records. This directly conflicts with treating provisional contributions as commission.

Changing one agreement paragraph would leave the actual product inconsistent. Introduce separate compensation modes and carry the selected mode through listing, application, offer, agreement, ledger, notifications, and departure.

Evidence: [home](../apps/web/src/app/page.tsx#L12), [pairing departure](../apps/api/app/services/pairings.py#L111), [vesting model](../apps/api/app/models.py#L130), [public agreement](../apps/web/src/lib/domain/agreement-template.ts#L31).

### 2. One self-reported entry can vest the entire offer immediately — critical financial-integrity risk

The operator writes the ledger; evidence links are optional. Saving invokes synchronization immediately. Each newly opened milestone scans the same entries, without a minimum service duration or a separate evidence-confirmation stage. A single entry reporting ten customers cleared both a 2% trial milestone and an 8% growth milestone one hour after the pairing started.

Multiple clears are explicitly supported by existing tests; this is current design, not an accidental violation of those tests. It is nevertheless unsuitable for the proposed cofounder model. Separate reported performance, verified eligibility, contractual vesting, and completed legal issuance. A trial deadline is not a minimum-service cliff.

Evidence: [ledger save](../apps/api/app/services/ledger.py#L15), [evaluator](../apps/api/app/domain/milestones.py#L69), [synchronization](../apps/api/app/services/pairings.py#L61).

### 3. A failed proving run can still generate a later equity tranche — critical logic defect

When the first milestone misses, evaluation continues into later milestones. Older entries can satisfy those later targets because there is no lower bound at the milestone opening. Synchronization then marks the pairing lapsed but still writes every returned vesting event.

Reproduction: the trial requires three customers; the ledger reports two customers and revenue of 100. On day 46, the trial misses while the later revenue milestone records 8% vested. Stop downstream eligibility on a failed trial, and enforce the defined measurement window/baseline for each milestone.

Evidence: [miss continuation](../apps/api/app/domain/milestones.py#L108), [unconditional vesting writes](../apps/api/app/services/pairings.py#L74).

### 4. Equity can exceed the advertised allocation, including across successive operators — critical allocation defect

The advertised maximum is capped at 40%, but each milestone permits up to 100%, and the creation service never reconciles the sum with that maximum or an accepted grant. A schema fixture with an advertised 20% maximum and two 100% tranches is accepted. Source inspection confirms the creation service lacks the missing total check; this fixture was not submitted to production.

Departure also resets the venture's whole schedule while preserving earlier vesting records. A 10% schedule can award 2% to one operator and then all 10% to a replacement: 12% against the original 10% offer. There is no venture-wide grant budget/depletion model governing that reuse.

Use an authorized pool, reservations, per-engagement grants, exact share/unit amounts or fixed precision, and transactional checks across all outstanding/earned grants. Never recycle earned allocations automatically.

Evidence: [schema](../apps/api/app/schemas.py#L82), [creation](../apps/api/app/services/ventures.py#L114), [reset](../apps/api/app/services/pairings.py#L111), [milestone reset](../apps/api/app/domain/milestones.py#L131).

### 5. The application bargain does not become the pairing bargain — critical agreement-integrity gap

The application stores requested percentage, compensation choice, track, template, and commitments. Invitation creates a pairing using the venture's existing milestones and global proving-run setting, without copying an agreed percentage, application link, selected track, or a financial agreement snapshot. Deliverables start empty. Thus a requested intern allocation does not define the actual vesting schedule.

The form's default advertised range is 8–12%, while its two default tranches total only 4%. The API also accepts a 20% request under the closer template despite that template's narrower advertised range. The pairing's displayed trial duration and the first milestone's editable `window_days` are independent, so the displayed clock can disagree with the deadline the engine enforces.

An accepted offer must specify exact compensation, schedule, responsibilities, duration, and instrument. Snapshot those terms per engagement; validate all layers against one policy.

Evidence: [invitation](../apps/api/app/services/applications.py#L54), [pairing model](../apps/api/app/models.py#L88), [form defaults](../apps/web/src/app/(app)/ventures/new/venture-form.tsx#L12), [equity validation](../apps/api/app/domain/equity.py).

### 6. “Invite” starts work without acceptance; the same agreement ID represents different documents — critical consent/versioning gap

The builder's invite action immediately starts the pairing and clock. There is no separate pending offer/accept/decline sequence or accepted terms snapshot in that flow. The public `terms_v0` editor contains 12 sections, but a pairing's agreement page uses the two-section database template with the same ID.

The editor added in the preceding work expanded only the public drafting reference. It did not update the pairing agreement source. Its preview-only notice is useful, but reusing the same version ID remains a real gap.

Create immutable template versions and populated agreement snapshots, with both parties' acceptance and any company signatory/approvals. Public preview, downloaded document, accepted document, and dashboard must identify the same version and values. Use a new version rather than overwriting historical terms.

Evidence: [invite](../apps/api/app/services/applications.py#L76), [public route](../apps/web/src/app/(app)/terms/[id]/page.tsx#L10), [pairing agreement](../apps/web/src/app/(app)/pairings/[id]/agreement/page.tsx#L11), live workspace template.

### 7. Evidence can change after vesting, while review is only a notification — high

In an active pairing, an open-week entry can be reduced from three customers to zero after its 2% tranche was recorded. Cleared milestones are skipped on reevaluation, and the vesting record references the same mutable entry. This loses a reliable snapshot of what justified the award. It does not establish that earned legal shares can simply be revoked.

Request review sends notifications; it does not create a case, preserve disputed evidence, suspend a pending award, or record a resolution. Add evidence versions and a pending/verified/disputed process before an irreversible award, plus lawful correction/adjustment events. Avoid allowing either party an unlimited unilateral veto over legitimate earned compensation.

Evidence: [mutable entry](../apps/api/app/services/ledger.py#L28), [cleared skip](../apps/api/app/domain/milestones.py#L76), [review](../apps/api/app/services/pairings.py#L135).

### 8. Deadlines are week-based, not the exact date users may infer — high

Eligibility compares the entry's Monday with the deadline, not when the result was actually achieved, submitted, or verified. An entry updated July 19 can clear a July 16 deadline because its week starts July 13, if the milestone has not already been marked missed by another sync. Older entries can also clear newly opened milestones. Page reads and scheduled maintenance can materialize transitions, so timing matters.

Choose and explain a single rule: measurement window, event date, submission cutoff, and any correction grace period. Enforce it consistently and test boundaries and maintenance ordering.

Evidence: [deadline comparison](../apps/api/app/domain/milestones.py#L95), [workspace synchronization](../apps/api/app/routers/workspace.py#L28).

### 9. Historical schedules are shared and overwritten; full vesting ends the working relationship — high

Milestones belong to a venture rather than an individual engagement. Resetting them on release changes the schedule state that previous pairings' dashboards and agreement references read. Retained vesting rows do not restore the historical schedule.

Clearing every milestone changes the pairing to terminal `completed`, sets its end date, and prevents further ledger entries and chat messages. The venture is also blocked from another pairing after a completed pairing. Full vesting is not the same thing as ending a cofounder relationship.

Separate engagement state, award state, and venture recruitment availability. Preserve a per-engagement schedule and event history.

Evidence: [milestone ownership](../apps/api/app/models.py#L68), [completion](../apps/api/app/services/pairings.py#L81), [terminal states](../apps/api/app/domain/pairing.py#L12), [chat rules](../apps/api/app/routers/chat.py#L74), [venture guards](../apps/api/app/services/ventures.py).

### 10. Unpaid trial, internship, and full-time founder language need distinct legal treatment — high

The site advertises unpaid proving work, supervised 12-week internships, and substantial weekly commitments within one equity workflow. Calling someone a counterpart, contractor, or cofounder does not by itself determine employment status. Philippine decisions consider the actual relationship, including control and economic dependence. [Ditiangkin v. Lazada, Supreme Court](https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/1/68763).

Have Philippine employment counsel review the actual tracks and compensation before opening them. A commission label does not cure an employment-law problem. Replace broad “no obligation” language with the precise exit rule; earned compensation, confidentiality, applicable employment duties, and other surviving obligations do not disappear merely because the trial ends.

Evidence: [about vocabulary](../apps/web/src/app/about/page.tsx#L7), [application tracks](../apps/web/src/app/(app)/bench/[slug]/apply/apply-form.tsx), [home trial claims](../apps/web/src/app/page.tsx#L12).

### 11. Investor access is global; privacy disclosures are missing from the reviewed public flow — high

The investor role can view every pairing. Workspace serialization includes the relevant parties' email addresses, ledger entries, notes, and evidence links. Chat is separately restricted to participants/admins. This is a deliberate authorization rule, not a demonstrated anonymous access bypass, but it needs much narrower and clearly disclosed sharing choices.

Neither `/privacy` nor `/terms` exists, and the reviewed signup/footer flow does not provide a platform privacy notice or platform-use agreement. The venture agreement template is a different document. Accounts, applications, chats, and optional identity verification all process personal data. The NPC describes required transparency about purposes, recipients, retention, and rights. [NPC right to be informed](https://privacy.gov.ph/the-right-to-be-informed/).

Use per-venture investor access, explicit sharing scope, least-necessary fields, access history, and a privacy notice. Distinguish public venture metrics, participant records, and investor disclosures.

Evidence: [investor access](../apps/api/app/services/pairings.py#L16), [workspace user fields](../apps/api/app/routers/workspace.py#L46), [signup](../apps/web/src/app/(app)/login/page.tsx), [footer](../apps/web/src/components/footer.tsx).

### 12. The ledger is presented too strongly as a cap table — high

Investor copy claims the ledger reflects the cap table. The model records percentage events, not share issuance, share class, company capitalization, signatures, approvals, or legal transfer completion. The new draft correctly says legal issuance/transfer documents must be completed separately; the investor and dashboard wording must match that limitation.

Use distinct labels such as “reported result,” “verified result,” “contractual award earned,” and “issuance confirmed.” Do not represent the performance ledger as legal ownership evidence without the necessary documents and reconciliation.

Evidence: [investor claim](../apps/web/src/app/investors/page.tsx#L15), [vesting data](../apps/api/app/models.py#L130), [draft distinction](../apps/web/src/lib/domain/agreement-template.ts#L40).

### 13. Commission-only jobs have no structured commission agreement; funding claims overreach — high

Jobs support a `commission_only` funding label but do not store the rate, attribution basis, payment schedule, collection rules, or departure tail. Marking an applicant hired is also a unilateral reviewer action, not a recorded accepted employment/contract offer.

For ledger-funded salaries, validation compares one role's maximum salary with recorded recent gross revenue. That does not establish available cash, recurring affordability, margins, or capacity after other salaries and expenses. Display it as reported revenue context, not guaranteed funding. Add a real compensation schedule and employer/contract acceptance where the product promises them.

Evidence: [opening data](../apps/api/app/models.py#L173), [funding validation](../apps/api/app/domain/openings.py#L26), [hire flow](../apps/api/app/services/openings.py#L185).

### 14. Financial summaries can mislead — medium

Public stats and dashboards sum ownership percentages across unrelated companies. A 5% holding in one venture plus 10% in another is not a meaningful 15% ownership metric. Report grants/ventures or per-venture ownership instead.

“Profitability” is calculated from contribution assumptions excluding items such as salaries/infrastructure, not full net profit or a verified bank balance. A last-four-weeks revenue sum is also not inherently MRR. Label these measures precisely and publish the formula; do not use them as automatic compensation funding guarantees.

Evidence: [aggregate percentage](../apps/api/app/routers/workspace.py#L79), [economic formulas](../apps/api/app/domain/equity.py), [form definition](../apps/web/src/app/(app)/ventures/new/venture-form.tsx#L85).

### 15. Public marketing contradicts current inventory and shipped features — medium

The Bench itself correctly distinguishes development ventures and disables their pairing applications. Home/about/investor copy still describes every listed venture as a working product; the counterparts count describes Bench entries as open opportunities. The live six entries are all development projects.

About/FAQ say in-app messaging is not built, although pairing chat exists. Unqualified “forever,” “no clawback anywhere,” “no obligation,” and “not binding” claims should be replaced with descriptions tied to the actual agreement and legal status. A platform cannot determine all legal consequences by a marketing label.

Evidence: [home counts and copy](../apps/web/src/app/page.tsx#L81), [about feature list](../apps/web/src/app/about/page.tsx#L18), [FAQ](../apps/web/src/app/faq/page.tsx), [chat](../apps/api/app/routers/chat.py), [card states](../apps/web/src/components/venture-card.tsx#L8).

### 16. Account recovery and counterparty assurance are incomplete in the reviewed flow — medium

The available account routes/UI implement registration, login, and logout; the reviewed flow contains no password recovery or email-ownership verification. Optional identity verification is a separate feature and must not imply that all platform users or business claims are verified.

Before commercial launch, provide a recoverable account flow and verified contact channel, and define when legal entity/signatory checks are required. Authentication and financial eligibility are different assurances.

Evidence: [account endpoints](../apps/api/app/accounts.py), [login UI](../apps/web/src/app/(app)/login/page.tsx), [optional verification](../apps/api/app/routers/verification.py#L28).

### 17. The draft editor needs agreement-aware validation and persistence when promoted to a real contract flow — medium

Its values are intentionally temporary browser state and its download is a text draft. A 100% equity field limit differs from the app's 40% offer cap; free-text Schedule A cannot enforce tranche totals or timing; changing the preview does not affect any pairing. These are material boundaries, even though preview-only behavior is disclosed.

Keep this as a clearly versioned drafting tool until it can persist a structured offer and reconcile it with the actual contract workflow. Add commission variables for the operator track and vesting variables for the founder track; do not cram both into ambiguous generic equity wording.

Evidence: [editor state/download](../apps/web/src/components/agreement-editor.tsx#L10), [variables](../apps/web/src/lib/domain/agreement-template.ts#L5).

## Entire page-route change map

This inventory covers every current Next page route. “Source” means route/form/service inspection rather than a successful authenticated browser interaction. Live redirects verify the anonymous gate only.

| Route | Evidence | Required treatment |
|---|---|---|
| `/` | Live + source | Replace automatic ownership promise; distinguish open versus development counts; remove summed equity percentage |
| `/about` | Live + source | Define operator/cofounder separately; correct unpaid-trial and no-messaging claims |
| `/builders` | Live + source | Explain cash obligations, trial exit, and optional formal founder selection |
| `/counterparts` | Live + source | Show compensation choices, protections, and real eligibility; split internships from founder grants |
| `/how-it-works` | Live + source | Show offer acceptance, paid trial, review, operator renewal or separate equity grant |
| `/investors` | Live + source | Scope access; distinguish performance evidence from legal ownership and verified finance |
| `/faq` | Live + source | Reconcile all new rules and shipped features; avoid blanket legal conclusions |
| `/bench` | Live + source | Keep development distinction; add compensation-mode filters and open-opportunity counts |
| `/bench/[slug]` | Six live pages + source | Publish exact compensation basis, engagement stage, approved offer version, and application availability |
| `/bench/[slug]/apply` | Source | Apply to the stated compensation track; preserve requested terms through negotiation and acceptance |
| `/login` | Live + source | Link platform terms/privacy; add account recovery and contact verification |
| `/terms/[id]` | Live draft + source | Immutable versions; structured variables; populated saved snapshots for real offers |
| `/dashboard` | Login redirect + source | Separate compensation due/paid, performance, and actual equity; scope investor data |
| `/ventures` | Login redirect + source | Show available budget and engagement availability independently of grant completion |
| `/ventures/new` | Login redirect + source | Compensation selector, balanced duties, valid schedule totals, consistent limits |
| `/ventures/[slug]/applications` | Source | Negotiated offer, counterpart acceptance, exact scope/compensation; no immediate clock start |
| `/pairings` | Login redirect + source | Clear engagement stage and historical terms; no automatic awards from display reads |
| `/pairings/[id]` | Source | Split performance, compensation, contract, and equity states; preserve history |
| `/pairings/[id]/agreement` | Source | Display the exact populated document both parties accepted |
| `/pairings/[id]/log` | Source | Evidence versions, valid dates, corrections, and independent confirmation before financial finality |
| `/pairings/[id]/review` | Source | Case status, owner, evidence, disputed amount, deadlines, and recorded outcome |
| `/pairings/[id]/chat` | Source | Keep private; tie write access to engagement state, not full vesting; retain appropriate handover access |
| `/jobs` | Live + source | Distinguish salaried and contingent compensation; avoid presenting all openings as salary-paid |
| `/jobs/[id]` | Source | Publish commission specifics and qualified funding claims |
| `/jobs/[id]/apply` | Source | Carry exact offered terms and expectations into later acceptance |
| `/jobs/[id]/applicants` | Source | Separate offer from hire/acceptance; notify truthfully |
| `/jobs/new` | Login redirect + source | Require complete compensation schedule and actual contracting/employing party |
| `/notifications` | Login redirect + source | Differentiate submitted, verified, earned, paid, granted, and issued events |
| `/settings/verification` | Login redirect + source | Explain optional verification scope and provider/data handling |
| `/admin/email-queue` | Login redirect + source | Retain admin gate; replace inaccurate business-event email text |

Shared surfaces also need reconciliation: navigation, footer, page metadata, equity templates, application validators, dashboard read models, illustrations/journey labels, seed templates, and corresponding tests. Preserve the requested OG-ratio card images and three-line descriptions; those presentation choices do not require compensation redesign.

## Suggested data and state changes

Separate an `Engagement` from its `CompensationAgreement` and optional `EquityGrant`.

An engagement needs proposed/accepted dates, immutable agreement version and populated values, parties and legal entity, scope, start/end, handover, and dispute references. Its stages can be offer pending → accepted trial → continuing operator or cofounder engagement → ended. Cofounder selection requires explicit mutual agreement and the necessary company approvals.

A commission schedule needs rate, currency, eligible revenue definition, customer/deal attribution, collection/refund treatment, payment frequency, expenses, term, termination cutoff, and post-exit tail. Store earning, adjustment, due, and paid events with evidence; use money precision rather than floats. Payment records can initially reconcile external payments without pretending the platform processes them.

An equity grant needs issuing entity, instrument/share class, unit amount and capitalization basis, grant approval, vesting start, cliff/duration, service conditions, termination rules, and documentary status. Performance eligibility, vesting, issuance, transfer, dilution, and repurchase are different events. Do not add a button that simply zeroes vested ownership when someone leaves.

Proposed editor fields include `[TRIAL_DAYS]`, `[FEE_PHP]`, `[COMMISSION_RATE_PCT]`, `[ELIGIBLE_REVENUE_DEFINITION]`, `[ATTRIBUTION_RULE]`, `[PAYMENT_FREQUENCY]`, `[POST_EXIT_TAIL_DAYS]`, `[CONTRACT_END_DATE]`, and `[NOTICE_DAYS]`. The cofounder document separately uses `[GRANT_UNITS]`, `[CAPITALIZATION_BASIS]`, `[VESTING_START_DATE]`, `[VESTING_MONTHS]`, `[CLIFF_MONTHS]`, and legally reviewed departure/transfer provisions. These are recommendations, not implemented fields.

## Implementation order

1. Agree the commercial model and have the operator/founder/employment instruments reviewed for the intended Philippine relationships. Before real onboarding, gate automated equity awards and misleading financial claims; do not silently rewrite historical obligations.
2. Reconcile any existing/off-platform commitments. Preserve the old records and snapshots. Introduce new agreement versions and explicit migration/acceptance only where appropriate.
3. Implement offer acceptance, per-engagement terms/schedules, allocation checks, evidence states, and disputes. Fix failed-trial downstream vesting and schedule reuse regardless of the chosen commercial model.
4. Implement the operator compensation ledger and departure settlement. Then add the optional legally documented founder grant workflow.
5. Update every surface in the route map together, including email/notification language, public templates, seed data, investor permissions, and privacy/platform terms.
6. Run isolated integration, permission, boundary, and concurrency tests, then browser QA of all three actor journeys. Deploy only the coherent implementation.

## Acceptance scenarios for that implementation

- An invitation alone does not start a clock or earn money/equity; both parties accept the same immutable populated terms.
- A trial participant can earn the agreed commission but cannot receive an equity grant by entering a KPI.
- A failed trial cannot generate downstream equity events.
- A 1% intern/employee award cannot inherit the venture's 10% founder schedule.
- No grant exceeds its authorized units or available venture pool, including simultaneous acceptances and replacement operators.
- Corrections preserve original evidence and adjustments; disputes do not delete history or cancel undisputed earned fees.
- Deadline tests cover before/on/after boundaries, timezone, late collections, corrections, scheduled jobs, and repeated requests.
- At departure, no new service vesting occurs after the contractual cutoff; accrued commission and a defined pipeline tail reconcile to settlement.
- Full vesting does not automatically terminate employment, cofounder work, or active collaboration.
- Historical agreements and milestones are unchanged when the venture creates another offer.
- Investor access requires the intended venture permission and does not expose unrelated emails, notes, or documents.
- Public preview, accepted contract, dashboard numbers, emails, and exported records agree on compensation, dates, and version.

## Controls worth preserving

Source review found useful existing safeguards: server-side party/role checks, admin-only email queue, participant-only chat, hashed passwords and session tokens, an HTTP-only session cookie, logout revocation, URL probes restricted to validated public destinations with pinned connections, signed maintenance/identity webhooks, and locking around pairing updates. The public Bench also correctly blocks development-stage applications. These are observed controls, not a blanket security certification.

The audit's main conclusion is a product and agreement redesign plus specific financial-integrity fixes. The visual site can remain recognizable. Its promises, accepted contracts, and accounting behavior need to become one consistent system before money or ownership depends on it.

## Authorized remediation delivered

The implementation replaces automatic KPI equity with versioned commercial offers. A positive fee or commission is required before publication. Both parties accept before work starts; the offer stores its template, responsibilities, metrics, schedule, compensation, parties and fingerprint. Trial continuation requires another recorded mutual decision. Pending offers expire after 14 days. Default durations are negotiable product defaults, not legal classifications.

Performance goals no longer issue equity, convert a trial automatically, or terminate a fully vested cofounder. Historical automatic awards are paused for documented review, without deleting prior records or determining their legal validity. The migration preserves existing rows and snapshots the schedule available at migration time; it cannot reconstruct evidence overwritten before the audit.

Commission claims require registered deals, receipt evidence and unique references. Decimal calculations and two-decimal displays preserve centavos. Monthly fees are prorated to calendar service days. Leaving stops new deal registration and future service accrual; accrued claims and a finite agreed collection tail survive. Builders confirm payable amounts and report external payment; operators acknowledge receipt. Disputes create review cases and retain event history. The platform does not transfer funds, adjudicate legal rights, or automate refunds and partial settlements; those require documented reconciliation through the agreed process.

Cofounder records require a separately signed instrument, company and share class, unit counts, capitalization basis, approvals, vesting, cliff and departure terms. The default is 48 months with a 12-month cliff. Acceptance explicitly continues the engagement beyond the original commercial expiry. Departed cofounders stop future vesting while calculated vested units remain visible under the instrument. Reserved, accepted and historical awards count toward the 40% platform allocation. Reallocation or capitalization changes require legal reconciliation; this is not an authoritative company cap table or issuance system.

The marketing pages, Bench, application forms, dashboard, agreement pages and job flow now describe these rules. The actual API template is the editable public preview; `/terms/terms_v0` redirects to `/terms/operator_v1` while historical private agreements remain accessible. Original OG image proportions and three-line card descriptions are preserved. Jobs require salary and written working terms; an employer's offer does not mark someone hired until the applicant accepts its fingerprint.

Investor status no longer grants private pairing access. Ledger edits preserve revisions, reviews have durable cases, registration records platform-terms consent, and email verification gates commercial offers. Verification and password-reset links are hashed, expire, and are single-use. Password reset revokes existing sessions. New privacy and platform-terms pages explain the service and participant responsibilities.

Verification: 159 backend tests and 107 frontend tests passed; TypeScript, ESLint and the production frontend build passed. The additive migration ran against isolated PostgreSQL. Argent browser checks exercised the real Next/FastAPI/PostgreSQL offer acceptance and compensation-payment flow, editable template variables, and a 390px mobile viewport. Fourteen public routes returned HTTP 200 locally. These checks do not substitute for independent legal review, a penetration test, or verification of provider-delivered external email. Didit remains disabled as previously instructed.

Legal implementation must reflect the actual relationship. The commercial template does not waive employment protections or make a contractor classification conclusive. Official references: [DOLE Labor Code](https://dole.gov.ph/labor-code-of-the-philippines-2/) and [Revised Corporation Code](https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/2/86463). The signed company instruments and required approvals remain external work for the parties and their advisers.
