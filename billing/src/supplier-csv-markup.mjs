import { CSV_REQUIRED_COLUMNS, CSV_TEMPLATE_AS_OF, STATEMENT_CSV_TEMPLATE, LEDGER_CSV_TEMPLATE } from '../browser/supplier-csv.mjs';

// Inject inside #supplier-demo, before the existing JSON preset/editor. No user
// values enter this HTML string; file/import status always uses textContent.
export const SUPPLIER_CSV_IMPORT_HTML = `<div class="supplier-csv-import">
<h3>Compare two local CSV exports</h3>
<p>Choose one supplier statement CSV and one AP ledger CSV. Both files stay on your device. Use UTF-8, up to 1,000 records per side and 2 MiB combined. A rejected pair clears previous evidence; no rows are skipped.</p>
<label for="supplier-demo-csv-as-of">Common as-of date declared for both exports</label>
<input id="supplier-demo-csv-as-of" type="date" min="0001-01-01" max="9999-12-31" aria-describedby="supplier-demo-csv-help supplier-demo-csv-status">
<label for="supplier-demo-csv-statement">Supplier statement open items (UTF-8 CSV)</label>
<input id="supplier-demo-csv-statement" type="file" accept=".csv,text/csv" aria-describedby="supplier-demo-csv-help supplier-demo-csv-status">
<label for="supplier-demo-csv-ledger">AP ledger open items (UTF-8 CSV)</label>
<input id="supplier-demo-csv-ledger" type="file" accept=".csv,text/csv" aria-describedby="supplier-demo-csv-help supplier-demo-csv-status">
<p id="supplier-demo-csv-help">Required headers, in any order: <code>${CSV_REQUIRED_COLUMNS.join(', ')}</code>. Exact names only; no extra columns, automatic mapping, trimming, date/currency conversion or guessed matches. Use real ISO dates and positive integer minor-unit amounts without signs, spaces, leading zeros or decimals. Record IDs and references keep their leading zeros and Unicode. Quoted commas and escaped double quotes are supported. The as-of date does not prove export freshness or completeness.</p>
<p id="supplier-demo-csv-status" role="status" aria-live="polite">No CSV selected. The initial comparison uses synthetic records.</p>
<details><summary>Copy or download two synthetic CSV templates</summary>
<p>These two templates use as-of date <code>${CSV_TEMPLATE_AS_OF}</code>. Their nine records show one matching group and four review groups.</p>
<p>Supplier statement:</p><pre>${STATEMENT_CSV_TEMPLATE}</pre>
<button id="supplier-demo-csv-statement-template" type="button">Download statement template</button>
<p>AP ledger:</p><pre>${LEDGER_CSV_TEMPLATE}</pre>
<button id="supplier-demo-csv-ledger-template" type="button">Download AP ledger template</button>
<button id="supplier-demo-csv-sample" type="button">Compare these two sample CSVs locally</button>
</details></div>`;

export const SUPPLIER_CSV_IMPORT_CSS = `#supplier-demo input[type="file"],#supplier-demo input[type="date"]{box-sizing:border-box;width:100%;min-width:0;max-width:100%;padding:10px;background:#080808;color:var(--fg);border:1px solid #555;font:inherit}#supplier-demo .supplier-csv-import{border-bottom:1px solid var(--bd);padding-bottom:20px;margin-bottom:20px}#supplier-demo .supplier-csv-import pre{max-height:260px;overflow:auto;font-size:12px}`;
