import { SINGLE_USD, BUNDLE_USD } from './figures.js';
import { CSV_REQUIRED_COLUMNS, CSV_OPTIONAL_COLUMNS, CSV_TEMPLATE, CSV_MAX_FILE_BYTES } from '../browser/duplicate-csv.mjs';

export const DUPLICATE_DEMO_HTML = `<section id="duplicate-demo" aria-labelledby="duplicate-demo-heading">
<style>
#duplicate-demo{border:1px solid var(--bd);background:#101010;padding:20px;margin:24px 0}
#duplicate-demo h2{margin-top:0}#duplicate-demo label{display:block;margin-top:12px;font-size:14px}
#duplicate-demo select,#duplicate-demo textarea,#duplicate-demo input[type="file"]{box-sizing:border-box;width:100%;padding:10px;background:#080808;color:var(--fg);border:1px solid #555;font:inherit}
#duplicate-demo textarea{font:13px/1.55 monospace;resize:vertical;min-height:300px}#duplicate-demo select{margin:6px 0 12px}
#duplicate-demo button{margin-top:12px;padding:10px 18px;border:1px solid var(--ac);background:var(--ac);color:#000;font:inherit;cursor:pointer}
#duplicate-demo :is(textarea,select,button,input):focus-visible{outline:2px solid var(--ac);outline-offset:3px}
#duplicate-demo .csv-import{border-bottom:1px solid var(--bd);padding-bottom:20px;margin-bottom:20px}#duplicate-demo .csv-import pre{max-height:240px;overflow:auto;font-size:12px}
#duplicate-demo-status{font-weight:600}#duplicate-demo-status[data-status="candidates_for_review"],#duplicate-demo-status[data-status="invalid"]{color:var(--warn)}
#duplicate-demo .demo-table{overflow:auto}#duplicate-demo td{overflow-wrap:anywhere}#duplicate-demo-groups{padding-left:22px}#duplicate-demo-groups li{margin:16px 0}#duplicate-demo-groups p{margin:6px 0}#duplicate-demo-output{max-height:400px;overflow:auto}
@media(max-width:540px){#duplicate-demo{padding:14px}#duplicate-demo .demo-table thead{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}#duplicate-demo .demo-table table,#duplicate-demo .demo-table tbody{display:block}#duplicate-demo .demo-table tr{display:block;margin-bottom:12px;border:1px solid var(--bd)}#duplicate-demo .demo-table td{display:flex;flex-direction:column;gap:2px}#duplicate-demo .demo-table td::before{content:attr(data-label);font-size:10px;text-transform:uppercase;color:var(--mut)}}
</style>
<h2 id="duplicate-demo-heading">Try duplicate-reference review in this browser</h2>
<p>Choose a CSV from your device, or edit the synthetic JSON example below. The same comparison engine powers the local MCP server. No install or account is needed.</p>
<p class="muted">The check runs on this page. The example sends no field values or diagnostic requests, writes no browser storage, and does not save reports. A candidate is a reason to review source documents; an unflagged record is not proof of uniqueness or approval to pay.</p>
<div class="csv-import">
<label for="duplicate-demo-csv-file">Review a local CSV (UTF-8, up to ${CSV_MAX_FILE_BYTES / 1024 / 1024} MiB and 1,000 records)</label>
<input id="duplicate-demo-csv-file" type="file" accept=".csv,text/csv" aria-describedby="duplicate-demo-csv-help duplicate-demo-csv-status">
<p id="duplicate-demo-csv-help">Use the exact columns below. Import replaces the editor and checks the entire supplied batch locally. No automatic column mapping, date conversion, currency conversion or skipped rows. A rejected import clears previous evidence.</p>
<p id="duplicate-demo-csv-status" role="status" aria-live="polite">No CSV selected. The initial results use synthetic records.</p>
<details><summary>Required CSV columns and a copyable sample</summary>
<p>Required header names, in any order: <code>${CSV_REQUIRED_COLUMNS.join(', ')}</code>. Optional only: <code>${CSV_OPTIONAL_COLUMNS.join(', ')}</code>. Optional columns need nonempty values when included. Do not add an exported row-number column.</p>
<p>Use exact identifiers, <code>invoice</code> or <code>credit_note</code>, an ISO date such as <code>2026-10-16</code>, and uppercase three-letter currency. <code>total_minor</code> must be positive decimal integer digits without signs, spaces, leading zeros or decimal points; 10000 is $100.00 for USD. References and IDs keep their leading zeros and Unicode. Values are not trimmed. Quoted commas and escaped double quotes are supported; control characters inside values are rejected by the product schema.</p>
<pre id="duplicate-demo-csv-template">${CSV_TEMPLATE}</pre>
<button id="duplicate-demo-csv-sample" type="button">Review this sample CSV locally</button>
</details>
</div>
<label for="duplicate-demo-preset">Worked example</label>
<select id="duplicate-demo-preset"><option value="worked">Four records, overlapping review reasons</option><option value="conflict">Same reference, conflicting amount and date</option><option value="formatting">Reference formatting changes</option><option value="zeros">Leading zeros remain significant</option><option value="boundaries">Entity, supplier, currency and document type boundaries</option><option value="legitimate">Distinct invoices with the same amount and date</option><option value="custom" disabled>CSV or edited records</option></select>
<form id="duplicate-demo-form"><label for="duplicate-demo-input">Structured input JSON (up to 1,000 supplied records; positive integer minor-unit totals)</label><textarea id="duplicate-demo-input" spellcheck="false" rows="16" aria-describedby="duplicate-demo-input-help" required></textarea>
<p id="duplicate-demo-input-help">Keep record_id unique. Scope identifiers are exact and case sensitive. Set save to false: this browser example retains no report. In USD, 10000 minor units means $100.00.</p>
<button type="submit">Review records in this browser</button></form>
<p id="duplicate-demo-status" role="status" aria-live="polite">Loading the local example…</p><p id="duplicate-demo-summary"></p>
<ol id="duplicate-demo-groups" aria-label="Review reason groups"></ol>
<div class="demo-table"><table><thead><tr><th>Record</th><th>Reference</th><th>Date</th><th>Minor units</th><th>Reasons</th></tr></thead><tbody id="duplicate-demo-records"></tbody></table></div>
<details><summary>Full structured report, including scope and original records</summary><pre id="duplicate-demo-output"></pre></details>
<noscript><p>Enable JavaScript to run the editable example. The worked explanation and installation below remain available.</p></noscript>
<p><a href="/s/duplicate-invoice-check">See the local MCP product</a> or <a href="/downloads#duplicate-invoice-check">install the free server</a>. Full candidate evidence is free; <a href="/buy/duplicate-invoice-check?src=store.guide.duplicate-demo">$${SINGLE_USD} Pro</a> removes the saved-report-count cap. The <a href="/bundle">$${BUNDLE_USD} bundle</a> also includes it.</p>
</section><script defer src="/assets/duplicate-demo.js"></script>`;
