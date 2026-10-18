# Proposed policy operations runbook

Status: internal proposal, prepared 18 September 2026. These are proposed assignments and targets, not claims that staffing, automatic deletion or a service-level guarantee already exists. Adopt alongside the reviewed public documents.

## Owners and handling standards

| Responsibility | Accountable person to appoint | Proposed handling target |
| --- | --- | --- |
| General support and listing reports | Operations owner and backup | Triage each business day; acknowledge within two business days |
| Payment and engagement reviews | Operations owner without a material conflict | Check parties and record; ask for specific evidence; send a progress update within five business days |
| Moderation reconsideration | Different administrator where available | Review reasons, proportionality and new evidence; document a decision or next step |
| Privacy requests and account closure | Privacy lead and backup | Log immediately; acknowledge within two business days; assess applicable legal deadline, identity and scope |
| Suspected breach, fraud or account compromise | Security incident owner and privacy lead | Escalate immediately; do not leave in the ordinary support queue |
| Corporate instruments and equity questions | Venture's authorized company officers and their counsel | Verify a signed instrument and approvals; never promise issuance through a platform action |

The targets above are internal proposals. Applicable legal duties can require earlier action. Set holiday coverage and an escalation route before publishing promises. If one person has several roles, record conflicts and obtain an independent review for a dispute involving that person.

## Support and moderation procedure

1. Confirm the case category, linked record, reporter identity and immediate risks. Do not request passwords or unnecessarily copy sensitive attachments.
2. Assign an owner in `/admin`, start review and keep investigative notes internal. Do not expose the reporter's unrelated personal data to the subject of a report.
3. Seek proportionate evidence and a response where safe. For a listing, preserve the state and reason before hiding it; restoration should restore its prior published/development status. The moderation hold must prevent self-republication while hidden.
4. State the facts considered, the decision, what the platform has actually changed and the reconsideration route. A case outcome is not a court ruling or a debt release.
5. For a compensation dispute, reconcile the claim separately. Do not confuse 'case resolved' with 'claim paid'. Keep the parties' externally agreed settlement and proof; partial refunds/settlements need documented manual reconciliation.
6. Reopen when warranted. Retain the original outcome and subsequent reasons. Preserve access to necessary contractual records even when a member's ordinary access is restricted, subject to identity and privacy checks.

## Privacy request and closure procedure

1. Accept requests through Support and the confirmed privacy email, including from people unable to sign in. Log request, receipt time, scope, owner and legal deadline.
2. Verify identity proportionately using existing account access where possible. Verify representative authority when applicable. Avoid collecting an ID copy by default.
3. Map data across the application database, object storage, email, real-time messaging, logs, providers, backups and linked external documents. Distinguish data controlled by Counterpart from another participant's independent records.
4. Determine the applicable right, lawful exceptions and required response period. Separate necessary contract/claim evidence from irrelevant profile or attachment content. Preserve another person's rights without using that as a blanket refusal.
5. Revoke sessions and remove unnecessary access for a confirmed closure. Coordinate deletion/anonymization/restriction through controlled operational work; the current request form does not perform these actions automatically.
6. Provide the response securely. Redact third-party details where appropriate, explain any partial refusal and the complaint route, and record the basis and actions. Keep only the minimum evidence of handling.
7. Track downstream provider requests and backup expiry. Legal holds must name the reason, scope, owner and review date; reassess at least every 90 days and release when no longer justified.

## Proposed retention schedule for approval

These are starting points for necessity and proportionality review, not statements of statutory retention periods. An applicable legal obligation or substantiated claim hold may justify a different period for specified records. Do not keep all personal data merely because one document must remain.

| Data | Proposed normal review/deletion trigger | Controls to implement |
| --- | --- | --- |
| Expired sessions and reset/verification tokens | Purge within 30 days after expiry or use | Scheduled purge; security-incident hold only where necessary; expiry currently prevents use but does not prove deletion |
| Unsuccessful applications without an engagement | Review for deletion/anonymization 12 months after role closure | Notify owner of active holds; remove unnecessary proof links and attachments |
| Account profile after closure | Remove/anonymize unnecessary fields within 90 days of verified closure | Restrict retained evidence; revoke sessions promptly; track backups separately |
| Accepted agreements, compensation and related dispute evidence | Review at engagement closure; proposed restricted archive up to six years, subject to counsel determining actual tax, contract and claim requirements | Document per-category justification; do not assume six years satisfies every duty; extend only with recorded reason and review date |
| Unrelated support tickets | Review 24 months after resolution | Retain minimum handling record where justified; remove sensitive copies sooner |
| Chat without continuing contractual/evidential need | Review 12 months after engagement ends | Preserve only relevant held messages rather than all chat indefinitely |
| Routine security/application logs | Target 90 days | Confirm each provider's settings; minimize identifiers and exclude message bodies, tokens and raw identity payloads |
| Email content and delivery history | Target 90 days after delivery or resolution; retain necessary transactional proof separately | Implement queue/provider deletion safely; do not destroy unresolved delivery evidence |
| Verification metadata | Review on account closure or expiry of the verification purpose | Provider document/biometric retention requires a separately verified policy and deletion capability |
| Backups | Target a documented rolling window no longer than 90 days unless justified | Verify actual provider backup retention; restrict restoration; reapply deletion records after restore |

Before adoption: inventory existing records, choose the minimum justified periods, add purge/restriction jobs or a staffed manual process, test provider deletion, and keep an auditable deletion record without reproducing deleted content. Update the privacy notice with substantiated criteria and any promised periods only after they are workable.

## Incident response

1. Record when the team first knew or reasonably suspected an incident. Assign an incident lead and privacy decision-maker immediately.
2. Contain exposure, revoke affected access, preserve necessary evidence and determine affected systems, people, data and potential harm. Do not erase evidence or log additional sensitive payloads while debugging.
3. Assess notification duties promptly with the privacy lead/counsel. The NPC's breach framework includes a 72-hour notification requirement for qualifying breaches; not every incident has the same notification result. Do not wait for perfect forensic certainty or an ordinary support target when the notification threshold is met. Use the current NPC reporting procedure and assess duties in other applicable jurisdictions. [NPC breach reporting](https://privacy.gov.ph/pips-and-pics/breach-reporting/).
4. Record the assessment, notification decision, available facts, mitigations, responsible contacts and subsequent updates. Communicate clearly to affected people where required. Do not claim the incident is harmless without evidence.
5. Correct the cause, verify recovery, review provider cooperation, and document follow-up controls and retention of incident evidence.

## Provider and access review

Maintain a register for Vercel, Northflank, DigitalOcean, Cloudflare/R2, Upstash, Ably, ZeptoMail and Didit if enabled: purposes, actual data fields, controller/processor roles, regions, contractual safeguards, retention, subprocessor changes, deletion method and incident contacts. Review administrator access quarterly and on departure. Record the privacy impact and specific notice/consent before turning on sensitive identity checks or adding optional tracking.

## Policy release procedure

Use [the adoption record](REVIEW-AND-ADOPTION.md). The operator signs off business facts and operational commitments; qualified counsel reviews the legal allocation and jurisdiction-specific documents. Release immutable versions with the required notice and exact-version acceptance. Archive old text and never overwrite existing snapshots. A completed draft library is preparation, not proof of operational or legal readiness.
