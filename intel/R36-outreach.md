# R36 — Outreach access and subscriber sender, 2026-10-16

## Decision

The project already has the email access it needs: root's current read-only account checks are recorded in `docs/OUTREACH_RESEND_SETUP.md`. No account creation or paid tool is required. Its verified sending configuration is not proof of inbox delivery.

Use Resend for requested subscriber mail and customer transactions. Its [acceptable-use policy](https://resend.com/legal/acceptable-use) requires explicit opt-in and prohibits cold outreach. Public contact details are not consent. Existing directory/community research remains manual; nothing was emailed, posted, commented or DMed by the subscriber sender work. Root separately submitted the new matcher through the invited free mcpservers.org listing form; its receipt is in data/r36_directory_submission.json and review is pending.

The useful next input is a real subscription request with evidence, a current mailbox check, and reconciled unsubscribes/bounces/complaints. An API key alone does not authorize a campaign. The public form and production customer mail are distinct from this local batch sender; this change does not connect new subscriber data or add a delivery webhook.

## Changes

`scripts/outreach_send.mjs` now defaults to a side-effect-free dry-run. It does not need a key, call Resend, acquire a lock, append manual skips, or change the outbox. Only live mode requires an environment key. CLI output contains counts and fixed error codes, never recipient addresses, message bodies, credentials or provider error bodies.

Ready email rows are fully validated before the first send. Required fields are:

- `channel: "email"`, `status: "ready"`, a single `to` address, a nonblank single-line `subject`, and nonblank `body_text` and/or HTML `body`.
- A stable `campaign` identifier (letters/digits/dot/underscore/hyphen) and `purpose`.
- `consent: {status: "opted_in", source: <actual receipt reference>, at: <ISO timestamp>, purposes: [<matching purpose>]}`. Consent timestamp cannot be in the future.
- `verification: {status: "verified", source: <actual check reference>, at: <ISO timestamp>}` no older than 30 days.
- `unsubscribe_url`: an HTTPS URL that the operator has checked actually opts out this recipient. The sender appends the link to each supplied body format.

The top-level input object contains `targets` and `suppressions: {checked_at: <ISO timestamp>, recipients: [{email, reason}]}`. The suppression snapshot must be no older than 24 hours, including an explicit empty array only after checking the authoritative opt-out and delivery outcomes. The sender also honors historical `bounced`, `complained`, `suppressed` and `unsubscribed` outbox entries across campaigns. These timestamps and source references are supplied evidence; this script cannot establish their truth or validate that a remote opt-out endpoint works.

`data/outreach_targets.example.json` shows the schema without invented consent evidence. Its placeholder email row is `example-only`, so copying the file cannot create a live target. Replace placeholders from real receipts before marking an email row ready. The 18 current manual rows in `data/outreach_targets.json` were preserved.

## Repeat prevention and failure handling

The sender normalizes addresses, deduplicates each campaign-recipient pair within a batch and across runs, and prevents conflicting body variants. Legacy accepted `sent` records prevent repeats; legacy dry-run records do not count as sends. New outbox entries hash recipient identity and omit body/error text. Existing legacy outbox data is preserved.

Live mode holds an exclusive `data/outbox.json.lock`, persists a pending intent before contacting Resend, and updates the outbox with same-directory atomic rename. Lock contention, unreadable/malformed history and disk write failures fail closed. A crash may leave the lock or a `.pending` file: inspect the lock's PID and open files before recovery, preserve pending intent and outbox history, and reconcile the provider outcome. Do not delete or reset history to force a repeat.

The same campaign-recipient pair always uses the same provider idempotency key; a persisted payload hash blocks changed-content retries. [Resend retains idempotency keys for 24 hours](https://resend.com/docs/dashboard/emails/idempotency-keys), verified against official documentation on 2026-10-16. Automatic retries stop after 23 hours from the first attempt to leave a margin; older uncertain results require provider reconciliation. Timeout or provider rejection stops the batch at its first failure, returns a failure count and CLI exit code 1, and retains the stable retry identity. A provider acceptance ID is recorded as `accepted`, not delivered. Outcome reconciliation is still required.

Each run permits at most 10 provider attempts with 3-second pacing. The provider request has a 15-second timeout. Attempt cap, opt-out snapshot age, mailbox check age and retry window remain enforced during sending. Nothing in this work sent a live email.

## Evidence

Commands run from `/Users/mike/mcp-servers`:

```sh
node --test test/outreach-send.test.mjs
# tests 30; pass 30; fail 0
node scripts/outreach_send.mjs --input data/outreach_targets.example.json --dry-run
# {"candidates":0,"manual":1,"skipped":2,"eligible":0,"attempts":0,"accepted":0,"failures":0,"mode":"dry-run","capped":false}
node scripts/outreach_send.mjs --input data/outreach_targets.json --dry-run
# {"candidates":0,"manual":18,"skipped":18,"eligible":0,"attempts":0,"accepted":0,"failures":0,"mode":"dry-run","capped":false}
```

The targeted suite uses injected in-memory storage and transport adapters. It covers no-key/no-write dry-run, consent and purpose mismatch, stale verification, missing/stale suppressions, opt-outs and complaints, header/body validation, in-batch/cross-run duplicates, legacy history, failure/retry identity, disk failure after acceptance, retry expiry, attempt cap, active-lock contention, malformed history, transport timeout/idempotency headers and CLI status/immutability. It creates no test fixtures or temporary folders. Live Resend delivery and production webhook outcomes were not tested.

Remaining work before an authorized live subscriber campaign: collect real consented rows; verify recipient and opt-out operation; reconcile authoritative suppressions; prepare the requested message; review dry-run counts. No live campaign is implied by the user's access question.
