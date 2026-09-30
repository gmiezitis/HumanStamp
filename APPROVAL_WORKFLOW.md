# Approval communication and exact-file workflow

## Release setup

1. Apply Prisma migrations with `pnpm --filter @human-stamp/web exec prisma migrate deploy`.
2. Configure `SMTP_HOST` and `SMTP_FROM`, and your provider's `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER` and `SMTP_PASS` as appropriate. Review requests fail clearly when host/from are missing. Production secrets belong in deployment settings, never in Git.
3. Run the existing worker with `pnpm --filter @human-stamp/web worker`. The Render startup already starts this worker when `RUN_WORKER_IN_PROCESS=true`. Email delivery does not depend on keeping a dashboard open.
4. Verify real email delivery using your own controlled test address before inviting customers. Configure your provider's domain authentication and monitor its bounce reports. SMTP acceptance is not proof of inbox delivery.

## Approval rules

- **Draft:** no active client review request for this exact file. Internal approval alone is not final approval.
- **Awaiting review:** client review requested; one or more client decisions or internal approval still pending. An expired unanswered request never becomes an approval.
- **Changes requested:** an active client review asks for changes. Additional internal approvals cannot override that decision; upload the revised file.
- **Approved:** at least one internal approval and all active client review requests approved this exact file.
- **Superseded:** a newer version exists. Historical decisions are preserved, but cannot approve the newer file.

Uploaded replacements and label-burned outputs are new drafts with new identifiers. Unanswered older requests become inactive. Old links continue to identify the old file; they never redirect to the newest file. Final receipt creation requires the current version to be approved. Receipts include only that version's decisions and record the status at issuance. The public receipt also shows the current workflow state, separately from the signed historical record.

Historical project-wide links without a valid version binding fail closed. No migration guesses which file was approved. Completed legacy decisions are retained in the database.

## Email behavior

Invitations and a single automatic reminder (24 hours later) are written in the same database transaction as the review request. Decisions atomically save the client response, cancel outstanding invitations/reminders, and queue a notification to the agency account that requested the review. Clients may reopen completed links, including after their submission window expires.

The durable outbox is polled every five seconds. Atomic leases prevent concurrent workers from normally sending the same job twice. Abandoned jobs are recoverable after two minutes. Sending failures retry up to five times with exponential backoff, then become visibly failed. A workspace member can retry a failed email, including a failed agency notification. Manual reminders are limited to once per 24 hours. Expired unused links can be renewed for the same file; expired tokens remain inactive. Reminders are cancelled when a review expires, is completed or is superseded.

Statuses are queued, scheduled, sending, accepted by provider, failed, and cancelled. There is no delivered/opened status because no provider delivery webhook is installed. SMTP is at-least-once: a crash after acceptance but before saving the result may cause a duplicate email. Retries reuse a stable message identifier; decisions themselves are protected against duplicate submission.

Possession of a review link and a typed name are not independently verified identity. Email verification is a separate future feature. No customer emails are sent by automated tests; provider calls are stubbed or use a local capture server.

## Verification

Run the normal build/test/lint workflow against a dedicated PostgreSQL test database. The new tests cover state rules, invitation persistence, retry/backoff and abandoned leases, reminders, decision notification, completed/expired links, concurrent submissions, wrong-project IDs, cross-workspace email retries, upload/label supersession, and exact-version receipt scoping.

Run `pnpm --filter @human-stamp/web exec playwright test --config=playwright.approvals.config.ts` with Google Chrome installed. This browser smoke suite starts a local SMTP capture server on port 2525, submits a real invitation and client decision through the web UI, verifies provider acceptance and the agency notification, issues a signed receipt, and confirms a replacement file is a draft. It also captures mobile client and agency screenshots. This suite runs in GitHub Actions after the normal checks. No external recipient is contacted; real production delivery still requires deployment configuration and an end-to-end test.
