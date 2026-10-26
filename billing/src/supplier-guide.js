import { SUPPLIER_DEMO_HTML } from './supplier-demo-markup.js';
import { SINGLE_USD, BUNDLE_USD } from './figures.js';

export const SUPPLIER_GUIDE = {
  'compare-supplier-statement-ap-open-items-in-claude': {
    title: 'Compare supplier statement open items with an AP ledger in Claude',
    description: 'Compare two local CSV open-item exports: missing invoices, amount/date differences and repeated references. The same exact-key engine provides free source evidence and CSV.',
    html: `<h1>Compare supplier statement open items with an AP ledger</h1>
<p>You have a supplier open-invoice statement and an accounts-payable open-item export for the same statement date. Identify which exact invoice or credit-note references are missing, disagree or repeat. <a href="/s/supplier-statement-check">MCP Supplier Statement Check</a> retains both sides of that evidence.</p>
${SUPPLIER_DEMO_HTML}
<h2>Prepare comparable open items</h2>
<p>For the browser route, select two UTF-8 CSV exports and declare their common as-of date. Use the exact required headers shown above. No automatic column mapping, discarded rows, date or currency conversion is performed. Both complete files must pass before a result appears; choosing another file or changing the input clears old evidence.</p>
<p>Supply a common <code>as_of</code> date, <code>statement_records</code> and <code>ledger_records</code>. Each row needs a side-local unique record ID, exact entity and supplier IDs, uppercase currency code, invoice or credit-note type, document reference, real ISO document date and a positive integer <code>outstanding_minor</code> amount. The declared statement date does not verify export freshness or completeness.</p>
<p>Credit notes use positive absolute outstanding amounts and match only credit notes. Currencies and entities never mix. Reference case, punctuation, Unicode and leading zeros remain significant; no equivalence is silently inferred.</p>
<h2>Read the evidence</h2>
<ul><li><b>Matched:</b> one item per side has the same exact key, amount and document date.</li><li><b>Statement only or ledger only:</b> the scoped reference appears on one supplied side. Export scope or timing may explain it.</li><li><b>Discrepancy:</b> one item per side shares the exact key but amount or date differs. Both original values remain.</li><li><b>Ambiguous reference:</b> a key repeats on either side. Every source row stays visible; no pairing or payment allocation is guessed.</li></ul>
<p>This is open-item comparison. It does not reconcile balances, net credits, match payments, extract a PDF, query an ERP, determine fraud or approve payment. Two incomplete exports can agree.</p>
<h2>Run it in a local MCP client</h2>
<p>Download <code>supplier-statement-check.mcpb</code> from the <a href="/downloads#supplier-statement-check">versioned download catalogue</a> and open it in Claude Desktop. For a terminal or editor client, build the relevant source workspaces:</p>
<pre><code>git clone https://github.com/theluckystrike/mcp-servers.git
cd mcp-servers
npm install
node scripts/bootstrap-timezone.mjs
npm run build -w packages/mcp-license -w servers/supplier-statement-check
claude mcp add --scope user supplier-statement-check -- node /absolute/path/to/mcp-servers/servers/supplier-statement-check/dist/index.js</code></pre>
<p>Replace the absolute path with yours. <a href="/setup/claude-desktop/supplier-statement-check">Claude Desktop</a>, <a href="/setup/cursor/supplier-statement-check">Cursor</a> and <a href="/setup/vscode/supplier-statement-check">VS Code</a> have client-specific configuration. This server is local stdio only; its npm package is not published.</p>
<h2>Complete evidence is free</h2>
<p>Call <code>supplier_statement_check</code> with <code>save: false</code> for an unsaved preview. Free pages and <code>report_export_csv</code> retain every original item, its side, group and issues. Formula-like CSV fields are escaped. Save three reports at once for free; deleting one frees a slot. <a href="/buy/supplier-statement-check?src=store.guide.supplier-statement-check">$${SINGLE_USD} Pro once</a> removes only the saved-report-count cap. The <a href="/bundle">$${BUNDLE_USD} bundle</a> includes it. Input, response and aggregate-storage bounds remain.</p>
<p>For repeated references within one history, use <a href="/s/duplicate-invoice-check">duplicate invoice review</a>. For invoice lines against a PO and accepted receipts, use <a href="/s/three-way-match">three-way matching</a>. <a href="/compare/supplier-statement-check">Compare this tool with integrated and generic alternatives</a>.</p>`,
    faq: [
      { q: 'Does agreement prove that the supplier balance is correct?', a: 'No. Only the supplied open invoice and credit-note rows are compared. Export completeness, freshness, payments and opening and closing balances are unverified.' },
      { q: 'What does Pro change?', a: 'The $19 one-time upgrade removes the three-saved-report count cap. Full diagnostics, source evidence pages and CSV remain free, with the same safety bounds.' },
      { q: 'Are statement values uploaded by the browser example?', a: 'No. The engine runs in this browser and sends no field values or diagnostic requests. It writes no browser storage. A separate MCP client or model has its own data handling.' },
    ],
  },
};
