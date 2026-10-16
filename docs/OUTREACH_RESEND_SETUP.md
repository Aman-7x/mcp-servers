# Outreach and customer email access — verified 2026-10-16

## What is already connected

No new account or key is needed for the current project. A local RESEND_API_KEY is present; read-only GET https://api.resend.com/domains returned HTTP 200 with zovo.one verified and sending enabled. The billing Worker also has a RESEND_API_KEY secret, confirmed by secret names only with:

    cd billing
    npm_config_cache=/Users/mike/.npm-cache-local npx wrangler secret list

These checks prove domain/account configuration, not delivery to an inbox. No email was sent during this verification. The previous R35 statement that the key was missing is superseded.

## Where Resend fits

Use Resend for purchased license delivery and people who explicitly subscribe to setup emails. Its current acceptable-use policy prohibits unsolicited messages, including cold outreach and scraped contact lists: https://resend.com/legal/acceptable-use (checked 2026-10-16). The earlier guide recommending Resend for cold directory outreach was incorrect and is superseded by this guide.

The public subscription form at https://mcp.zovo.one collects an explicit setup-email request. Hosted anonymous tenants are not email subscribers: possessing a token or storing a document does not imply consent or provide an email address. Keep directory discovery and opted-in customer mail separate.

The billing flow attempts a license email after verified paid webhook fulfillment; the confirmation page and recovery flow remain the primary key-delivery paths. Subscriber welcome and scheduled setup emails are already implemented. Do not claim delivery is verified merely because a secret exists or the API accepted a request.

## What access would improve ROI now

1. For customer email, the current access is sufficient. A domain-restricted sending-access key is enough for production sends; full account access is unnecessary. If rotating later, create it at https://resend.com/api-keys with permission sending_access and the verified zovo.one domain. Store it in the environment/Worker secret, never in Git or chat.
2. For organic distribution, keep the existing GitHub CLI and Cloudflare access. They already allow the project to publish its own useful server documentation, release artifacts, and corrected searchable metadata. No new email platform is needed for these tasks.
3. For permission-based partner conversations, record who requested contact, the source and date, and the specific message requested. An email found on a public page is not an opt-in. Curators' submission forms and contribution PR routes are the immediate alternatives when they invite submissions.
4. To measure business outcomes, use storefront-scoped Stripe payments, Google Search Console clicks for this exact host, and successful real tool usage. Shared-account payments, release fetches, bot page requests, and raw stored-document counts are not customer counts.

Official API-key scopes: https://resend.com/docs/api-reference/api-keys/create-api-key
Official event outcomes: https://resend.com/docs/webhooks/event-types

## Send workflow

The local sender defaults to dry-run. Keep it in dry-run until rows include explicit subscription evidence and a current recipient check. Keep sent-message identity stable across retries and honor opt-outs before selection. The existing 18 directory/community rows are manual-channel research, not an email campaign, and several were posted previously. Do not convert them to guessed addresses or repost them.

For a subscriber campaign, record consent source/date, verified address status/date, campaign id, purpose, message, and a functioning opt-out. Reconcile bounce/complaint outcomes and suppress those recipients before another send. Use an explicit message request for any live batch; access alone is not an instruction to email people.

## Immediate decision

Do not buy another outreach tool. The current bottleneck is finding relevant buyers and earning their click, not sending capacity. Publish demonstrated workflows and route visitors to a working free tool; offer the $19 server or $39 bundle once the tool has delivered value. Treat price/offer experiments as hypotheses until enough real buyer visits exist to compare them.
