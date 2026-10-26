# R38 outreach access and navigation interpretation — 26 October 2026

Resend is already configured. The missing commercial input is relevant people who requested a workflow trial, with actual consent and task context. No new account, email platform or paid enrichment service is required by the evidence.

## Authoritative access evidence

[data/r38_kpi_email_config.json](../data/r38_kpi_email_config.json), read at 05:15 UTC, confirms a present local key and a verified zovo.one domain with sending enabled. The local campaign has 18 manual research rows, zero email rows, zero explicit opt-in rows and zero eligible recipients. Its dry-run attempts zero sends. This inventory is not a production subscriber census. Resend receiving is disabled; another provider's inbound mailbox status is unknown. The configuration receipt does not prove send scope or inbox delivery.

No contacts, raw personal addresses, keys, email bodies or consent receipts were fetched from an external API for this task. No email was attempted. The exact source/outbox hashes retained in the preceding receipt remain the preservation control.

Official sources were opened on October 26:

- [Resend acceptable-use policy](https://resend.com/legal/acceptable-use): requires opt-in and disallows unsolicited cold messages, purchased lists and scraped-contact campaigns.
- [Create-key parameters](https://resend.com/docs/api-reference/api-keys/create-api-key): outbound access can use sending_access restricted to a domain. It does not give general read access to contacts, delivery records or account configuration.
- [Manage keys](https://resend.com/docs/dashboard/api-keys/introduction): keys can be separated by action; API renaming differs from Dashboard permission/domain editing.
- [Event types](https://resend.com/docs/webhooks/event-types): API request acceptance and delivery to the recipient's mail server are distinct outcomes. Neither proves inbox placement or attention.

The current setup guide provides a private local handoff: copy the deliberately example-only schema into the already ignored .scratch-distribution/private-outreach/ directory, retain real receipt references privately, and run the maintained sender in dry-run. The sender checks recent verification, consent purpose, suppressions, opt-out presence, stable campaign identity and prior attempts; it cannot prove the truth of supplied evidence. No contacts were fabricated or promoted to ready. No private folder was populated by this task.

The immediate owner input is a relevant opted-in trial audience and a known allowed distribution route. The working GitHub/Cloudflare connections already cover publishing owned workflows. A domain-restricted outbound key can be used if a later rotation is desired; the current connection was not changed. An actual live batch needs a concrete message/recipient instruction because the current task asks for the access explanation.

## Navigation correction

The fresh audit's instrument-3 aggregate has three guard-passing observations in seven UTC dates, all in buy.unknown-product. These are known invalid purchase routes. Historical totals also include 978 observations in other attributed source buckets; those are not 978 valid offers or buyers.

Source inspection of billing/src/index.js shows why a simple subtraction is insufficient for historical classification: an unknown /buy/ route can retain a syntactically valid supplied src. That observation can then appear under store.s.invoice or another legitimate-looking source. A source label names a declaration, not the resolved product or a person.

The new pure reporting helper, scripts/r38-commercial-kpis.mjs, preserves the original counted population and source time. It returns:

- Current seven-date counted navigation: 3.
- Known dead-product navigation: 3.
- Other guard-passing navigation: 0.
- Verified buyers: unknown.
- For future nonzero remainder, verified valid-product navigation stays unknown because legacy source buckets cannot prove route validity.

The zero remaining current observations is limited to the counted source population. It is not proof of zero site visitors, all purchase intent, or all actual buyers. Legacy and unattributed populations are excluded; missing, unsupported, malformed or inconsistent source snapshots become unavailable rather than zero.

Reproduce:

```sh
node scripts/r38-commercial-kpis.mjs data/r38_kpi_audit.json
node --test test/r38-commercial-kpis.test.mjs test/outreach-send.test.mjs
node scripts/outreach_send.mjs --input data/outreach_targets.example.json --dry-run
```

[data/r38_commercial_navigation.json](../data/r38_commercial_navigation.json) contains the interpretation. [Targeted tests](../data/r38_outreach_metric_tests.tap) pass 35/35 in 149.8 ms (23 top-level tests, 12 consent subtests). They cover the actual immutable receipt, valid-looking dead-route attribution, excluded populations, inconsistent counters, malformed/overflow values, missing-data behavior, dry-run/no-write, consent, suppressions, retry identity and provider failures. The example-only dry-run reports zero candidates, one manual row, zero eligible recipients and zero attempts.

## Future runtime split, if instrumented

Keep v3 counters intact as historical navigation. At the request branch, resolve the product first, then record a separate fixed outcome dimension (valid_product or unknown_product) independent of src. Reject arbitrary outcome values and never use a requested invalid product as a storage key. Add a versioned route-outcome aggregate and its own start time, leaving old /stats/clicks fields backward compatible. The classification must follow the resolved route; changing only the label for buy.unknown-product cannot identify dead routes that preserve a valid src.

No billing runtime file was edited here because the entitlement review owns it. No production instrumentation was deployed. Route validity would still not establish human identity, willingness to pay or a completed business outcome.

## Files delivered

- docs/OUTREACH_RESEND_SETUP.md: fresh evidence, useful next access, exact secure dry-run handoff, send-only key scope, measurement limits.
- docs/OUTREACH_KIT_20261008/README.md: current entry point.
- docs/OUTREACH_KIT_20261008/templates/buyer-trial-request.md: requested-task draft.
- docs/OUTREACH_KIT_20261008/templates/directory-outreach.md: invited contribution copy; obsolete estate counts and automatic cold follow-ups removed.
- scripts/r38-commercial-kpis.mjs and test/r38-commercial-kpis.test.mjs: read-only interpretation and regression controls.
- data/r38_commercial_navigation.json and data/r38_outreach_metric_tests.tap: actual output and tests.

The shared dashboard, shared KPI files and billing runtime remain owned by the parent and other agents.
