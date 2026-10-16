# Subscriber email kit — current entry point

Updated 2026-10-16. The original cold-outreach instructions are superseded.

Resend access and a verified zovo.one sending domain already exist. Read
[the current setup guide](../OUTREACH_RESEND_SETUP.md) for evidence and access details.
Resend requires explicit opt-in; a hosted token, a public address or a directory
listing is not subscriber consent.

Use the maintained sender at `scripts/outreach_send.mjs`. It defaults to a read-only
dry-run and accepts structured evidence for consent, mailbox verification and opt-outs:

    node scripts/outreach_send.mjs --input data/outreach_targets.json --dry-run

The existing queue contains manual community research; it sends zero emails.
`data/outreach_targets.example.json` documents a future permission-based input.
A live send also requires an explicit instruction to send the actual messages.
No emails were sent by this update.

`send.sh` now delegates to the maintained sender; the old --to/--subject/--body-file
interface is retired because it carried no subscription evidence and sent the
body-file path instead of its contents. `outbox.csv` remains historical evidence;
new delivery attempts use data/outbox.json. Old targets/drafts are research only.
