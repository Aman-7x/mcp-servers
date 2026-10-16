# Opted-in subscriber follow-up draft

A hosted tenant token does not establish email opt-in. Use only a recipient's
explicit subscription request for this purpose, record its source/date, and honor
current suppression records. The billing service already implements the disclosed
welcome/+2-day/+7-day setup sequence; do not duplicate that sequence with this kit.

Subject: Your requested MCP setup: {{server}}

Hi {{subscriber_name}},

You asked for setup guidance for {{server}}. Here is the documented workflow:
{{working_guide_url}}

The free tier can complete {{verified_free_job}}. If you need
{{verified_pro_feature}}, that server's Pro key is $19 once; the $39 bundle covers
all paid server products. Check current limits at https://mcp.zovo.one/pricing.
Hosted service limits still apply. Your key appears on the confirmation page after
payment; save the key and that page URL.

Reply with the task you are trying to finish and I can point you to its setup.

Mike
support@zovo.one
{{business_address}}
Unsubscribe: {{working_unsubscribe_url}}

Replace every placeholder with verified campaign/recipient facts before making a
row ready. No fabricated usage counts, scarcity dates, unlimited hosted-call
claims, priority availability guarantees or guessed addresses.
