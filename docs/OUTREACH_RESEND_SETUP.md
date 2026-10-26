# Outreach and customer email access — verified 2026-10-26

Resend is already connected. The useful next input is a small set of relevant people who requested a workflow trial, with the request recorded. Buying another sender will not supply that audience.

## Current access and its limits

The fresh [configuration and dry-run receipt](../data/r38_kpi_email_config.json) records these read-only checks at 05:15 UTC on October 26:

- The local `RESEND_API_KEY` exists; `GET https://api.resend.com/domains` succeeds and returns three domains as a nonzero read control.
- `zovo.one` is verified with sending enabled. Resend receiving is disabled; this does not establish whether the domain receives email through another provider.
- The local research queue has 18 manual-channel rows, zero email rows and zero eligible recipients. This is not a census of production setup-email subscribers.
- Zero emails were attempted. Domain verification and a stored key do not prove send permission for every sender address, successful delivery, or inbox placement.

The Worker previously exposed the `RESEND_API_KEY` secret name to the account audit. A secret name proves presence, not its value or present send behavior. Purchased-license mail and the disclosed welcome/+2-day/+7-day setup sequence are already implemented; avoid sending a duplicate sequence from the local kit. Anonymous hosted tokens and successful tool responses are not email addresses or subscription consent.

## What to provide now

1. **Requested trial contacts.** Keep actual recipients and their consent receipts in a private local file. For each person, record their requested task, the source/date of their request, the matching email purpose, a recent mailbox confirmation, and a working recipient-specific opt-out. A public address, directory entry or scraped contact is not a request.
2. **A relevant buyer audience.** Access to a bookkeeping/AP community you already participate in, an owned newsletter segment with the matching permission, or a partner who requested a demo is more useful than another email tool. Identify the allowed posting/submission route and its rules. Existing GitHub/Cloudflare access can publish demonstrated workflows and their installation paths.
3. **A concrete batch instruction when sending is intended.** Specify the actual recipient file, purpose, message and batch limit. The current request asks for an access explanation; no email campaign was sent. Sender access alone is not a campaign instruction.

Resend requires opt-in and prohibits unsolicited cold messages, purchased lists and scraped-contact campaigns. Use its existing connection for requested trials, subscribed setup mail and transactional delivery. Directory contribution forms and invited PRs are separate distribution routes. [Resend acceptable-use policy, checked October 26](https://resend.com/legal/acceptable-use).

## Secure local handoff and dry-run

The maintained sender is `scripts/outreach_send.mjs`. Keep personal data out of tracked `data/` files and chat. The existing ignored `.scratch-distribution/` directory provides a private local input location; never add it with `git add -f`.

From the project root:

```sh
mkdir -p .scratch-distribution/private-outreach
chmod 700 .scratch-distribution/private-outreach
cp data/outreach_targets.example.json .scratch-distribution/private-outreach/trial-contacts.json
chmod 600 .scratch-distribution/private-outreach/trial-contacts.json
node scripts/outreach_send.mjs --input .scratch-distribution/private-outreach/trial-contacts.json --dry-run
```

The copy starts with an `example-only` email row and deliberately invalid evidence. It sends nothing and reports zero eligible recipients until real information is supplied. Do not invent receipt IDs, dates, verification or opt-out URLs. The [requested-trial draft](OUTREACH_KIT_20261008/templates/buyer-trial-request.md) provides the message structure.

For a real eligible row, the sender expects:

| Field | Required evidence |
| --- | --- |
| `channel`, `status` | `email`, then `ready` only after the remaining fields are real |
| `to`, `campaign`, `purpose` | Actual requested recipient; stable campaign ID; specific matching purpose |
| `subject`, `body_text` or `body` | Exact message requested, with a working workflow link |
| `consent` | `status: opted_in`, actual receipt reference in `source`, actual UTC `at`, and matching `purposes` |
| `verification` | `status: verified`, real confirmation source/date, no more than 30 days old |
| `unsubscribe_url` | Working HTTPS URL for that recipient; a placeholder does not establish a working opt-out |
| `suppressions` | Batch snapshot checked within 24 hours, including current opt-outs, bounces and complaints |

The sender validates the whole batch before its first provider request, skips suppressed or already-accepted recipients, stores attempt intent before sending, and caps provider attempts at ten. Dry-run makes no provider call or outbox write. An accepted API response is not delivery: reconcile outcomes before retries; uncertain attempts older than the idempotency window require reconciliation. Existing outbox history must be retained.

The current manual queue can be checked without changing it:

```sh
node scripts/outreach_send.mjs --input data/outreach_targets.json --dry-run
```

October 26 result: 18 manual rows, zero eligible recipients, zero attempts. The sender's consent checks are mechanical safeguards; they cannot prove that a receipt or opt-out URL supplied by a person is genuine. [Evidence](../data/r38_kpi_email_config.json).

## API-key access, if rotating

No new connection is required now. If rotating the sender later, create a separate key in the [Resend API Keys dashboard](https://resend.com/api-keys), choose `sending_access`, and restrict it to the verified `zovo.one` domain. Keep it in the environment/secret store and the Worker secret, never in Git or chat. Update both actual send locations before retiring the old key; do not rotate unrelated project keys.

A domain-restricted sending key is enough for the outbound sender. Reading domains, contacts, suppressions, delivery records or inboxes can require broader access and should be handled separately; do not infer those capabilities from a send-only key. [Official create-key parameters](https://resend.com/docs/api-reference/api-keys/create-api-key), [key management](https://resend.com/docs/dashboard/api-keys/introduction).

Resend distinguishes request acceptance from delivery to the recipient's mail server. Delivery still does not prove inbox placement or that the person read the message. [Official event definitions](https://resend.com/docs/webhooks/event-types).

## What would count as a commercial result

Use the proposed pilot gate: ten relevant supplied-data trials, three voluntary repeat batches, and one independent paid outcome. These are decision thresholds, not observed results or promises. Record what each participant completed and whether they wanted saved history; retain useful free diagnostics.

The [October 26 audit](../intel/R38-kpi.md) still finds $0 MCP Checkout gross and zero finalized Google clicks. Its 19 ordinary hosted responses are unmarked protocol observations, not 19 verified buyers. All three current seven-date guard-passing clicks are known dead-product navigation. Keep these populations separate; no person-level conversion rate or ROI is established.
