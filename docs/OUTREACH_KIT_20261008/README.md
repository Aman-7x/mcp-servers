# Subscriber email kit — current entry point

Updated 2026-10-26. Resend access and a verified zovo.one sending domain already exist. [The setup guide](../OUTREACH_RESEND_SETUP.md) gives current evidence, a secure private contact-file location and the exact dry-run command.

The local queue is manual community research: 18 rows, zero eligible email recipients at the latest audit. It is not a subscriber export. A hosted token, public address or directory listing is not email consent.

Use the maintained sender:

    node scripts/outreach_send.mjs --input data/outreach_targets.json --dry-run

It defaults to read-only dry-run and checks structured consent, mailbox verification, opt-outs and stable message identity. Personal contact files belong in the existing ignored .scratch-distribution/private-outreach/ directory. Copy data/outreach_targets.example.json there; its email row is deliberately example-only until real evidence is supplied.

[Requested-trial message](templates/buyer-trial-request.md) and [invited directory contribution copy](templates/directory-outreach.md) serve separate purposes. Do not duplicate the billing service's disclosed setup sequence. No email was sent by this update.

send.sh delegates to the maintained sender. The old --to/--subject/--body-file interface is retired; outbox.csv is historical evidence and data/outbox.json retains current attempt identity.
