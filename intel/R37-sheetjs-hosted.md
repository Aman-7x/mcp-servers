# R37 hosted XLSX verification

Status: passed. Actual coordinated live controls ran from 2026-10-16T10:48:18.937Z through 2026-10-16T10:49:19.503Z. Evidence is `data/r37_sheetjs_hosted_verification.json`; this agent performed no deployment, commit or push.

The Cloudflare deployments API confirmed the expected sole 100 percent remote version `4bd75932-3eff-4475-8df3-3c8c5ccc35d7`, billing version `3376864a-7e1c-40dc-98a2-01fea2cd1af1` and private funnel version `c09f6360-34da-4107-82ae-15e7ae4ac387` before and after the test. Billing deployment was held during this window. The local workbook reader was the installed official SheetJS 0.20.3. Root separately owns the deployed vendor/package integrity evidence.

Ten controls passed over actual hosted JSON-RPC and download HTTP requests:

- Uploaded the independent verifier's canonical numeric-date XLSX through `sheet_load{xlsx_base64}`, read it through `sheet_read`, converted it through `sheet_convert{to:xlsx}`, downloaded the resulting binary and reopened it. Both canonical date values remained exact: 2026-09-03T15:30:00 and 2026-09-04.
- Repeated that path with the canonical ISO-date XLSX. The two converted downloads had identical hashes and exact date values. Neither input was generated through a legacy Date-object writer.
- Added one synthetic expense for 12.34 USD on the current ISO date. A free-tier `expense_export{format:xlsx}` declared `isError:true`, created no download and received no success trailer.
- Minted a distinct ephemeral expense-tracker-only QA licence in memory using the existing local signer, activated it on the owned marked token, and confirmed the actual hosted tier became Pro. No email, customer record, Checkout Session or payment was created.
- Exported that persisted expense through the licensed XLSX path, downloaded the actual workbook and reopened its Expenses sheet. It contained one row; amount, gross and net were numeric 12.34, VAT was 0, currency was USD and the ISO date matched exactly. The Pro response had no free upgrade trailer.

All three downloads returned HTTP 200, an XLSX MIME type and ZIP magic. Numeric-date and ISO-date conversions were each 16,121 bytes; the expense workbook was 16,935 bytes. SHA256 digests and source fixture sizes are in the evidence file. Workbook bytes and private download URLs were not published.

One anonymous token was minted with explicit probe marking and declared source guide. That source/probe sidecar was verified before calls, and every subsequent call and download retained the explicit probe header. The guide/probe counter deltas were exactly eight successful business responses, two first anonymous-token/server/day observations and seven emitted free upgrade trailers. Offer-view and checkout-handoff deltas were zero. Every ordinary counter remained unchanged. These retained aggregate observations identify synthetic operator activity, not people, buyer demand, completed customer jobs or conversion. Counters are pooled across servers; missing sidecars or deferred write failures can still leave observations unmeasured.

Cleanup considered eleven exact owned KV keys: ten successful DELETE acknowledgments and one already absent candidate, with zero failures. This included the anonymous token, source sidecar, bound ephemeral licence, token metadata, spreadsheet and expense documents, rate key and three download records. The private script, token state, canonical fixture copies and downloaded workbooks passed `lsof`, were recorded with byte sizes in `data/build-deletions.jsonl`, and were removed. The signed QA key was never printed or saved to files; its temporary hosted binding was deleted. Shared IP counters and global Durable Object counters were retained. DELETE acknowledgments do not imply immediate eviction of cached credentials from every edge.

The test establishes these hosted workbook and licensing paths after the dependency change. It does not exercise arbitrary workbooks, prove every Excel compatibility case, simulate an exploit, prove paid fulfillment, or establish revenue/ROI.
