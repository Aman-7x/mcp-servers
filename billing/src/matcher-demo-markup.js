export const MATCHER_DEMO_HTML = `<section id="matcher-demo" aria-labelledby="matcher-demo-heading">
<style>
#matcher-demo{border:1px solid var(--bd);background:#101010;padding:20px;margin:24px 0}
#matcher-demo h2{margin-top:0}#matcher-demo label{display:block;font-size:13px}
#matcher-demo input,#matcher-demo select{box-sizing:border-box;width:100%;padding:8px;background:#080808;color:var(--fg);border:1px solid #555;font:inherit}
#matcher-demo select{margin:6px 0 16px}#matcher-demo .demo-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
#matcher-demo button{margin-top:16px;padding:10px 18px;border:1px solid var(--ac);background:var(--ac);color:#000;font:inherit;cursor:pointer}
#matcher-demo-status{font-weight:600}#matcher-demo-status[data-status="matched"]{color:var(--ok)}#matcher-demo-status[data-status="exceptions"],#matcher-demo-status[data-status="invalid"]{color:var(--warn)}
#matcher-demo .demo-table{overflow-x:auto}#matcher-demo pre{max-height:320px;overflow:auto}#matcher-demo input:focus-visible,#matcher-demo select:focus-visible,#matcher-demo button:focus-visible{outline:2px solid var(--ac);outline-offset:3px}
@media(max-width:540px){#matcher-demo{padding:14px}#matcher-demo .demo-fields{grid-template-columns:repeat(2,minmax(0,1fr))}#matcher-demo .demo-table thead{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}#matcher-demo .demo-table table,#matcher-demo .demo-table tbody{display:block}#matcher-demo .demo-table tr{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));margin-bottom:12px;border:1px solid var(--bd)}#matcher-demo .demo-table td{display:flex;flex-direction:column;gap:2px;font-size:16px}#matcher-demo .demo-table td::before{content:attr(data-label);font-size:10px;text-transform:uppercase;color:var(--mut)}}
</style>
<h2 id="matcher-demo-heading">Try the matching example</h2>
<p>Each SKU is ordered at 10 units, priced at 100 minor units ($1.00). Change the receipt and invoice below, then run the check. No install or account is needed.</p>
<p class="muted">The check runs in your browser using the same comparison engine as the MCP server. Field values stay on this page and are not sent to the server or saved. This example covers structured goods lines; it does not read PDFs, verify prior billing history or approve payment.</p>
<label for="matcher-demo-preset">Example</label><select id="matcher-demo-preset"><option value="quantity">Equal totals, offsetting delivery quantities</option><option value="price">Equal totals, offsetting unit prices</option><option value="partial">Supported partial delivery, including rejected units</option></select>
<form id="matcher-demo-form"><div class="demo-fields">
<label>Accepted A<input name="accepted_a" type="number" min="0" max="1000000000" step="1" required value="5"></label>
<label>Accepted B<input name="accepted_b" type="number" min="0" max="1000000000" step="1" required value="15"></label>
<label>Rejected A<input name="rejected_a" type="number" min="0" max="1000000000" step="1" required value="0"></label>
<label>Billed A<input name="billed_a" type="number" min="0" max="1000000000" step="1" required value="10"></label>
<label>Billed B<input name="billed_b" type="number" min="0" max="1000000000" step="1" required value="10"></label>
<label>A price (minor units)<input name="price_a" type="number" min="0" max="9007199254740991" step="1" required value="100"></label>
<label>B price (minor units)<input name="price_b" type="number" min="0" max="9007199254740991" step="1" required value="100"></label>
<label>Previously billed A<input name="prior_a" type="number" min="0" max="1000000000" step="1" required value="0"></label>
<label>Previously billed B<input name="prior_b" type="number" min="0" max="1000000000" step="1" required value="0"></label>
</div><button type="submit">Run check in this browser</button></form>
<p id="matcher-demo-status" role="status" aria-live="polite">Loading the local example…</p><p id="matcher-demo-totals"></p>
<div class="demo-table"><table><thead><tr><th>SKU</th><th>Ordered</th><th>Accepted</th><th>Rejected</th><th>Prior billed</th><th>This invoice</th></tr></thead><tbody id="matcher-demo-evidence"></tbody></table></div>
<ul id="matcher-demo-issues"></ul><details><summary>Exact structured input used for this check</summary><pre id="matcher-demo-payload"></pre></details>
<noscript><p>Enable JavaScript to run this local example. The worked examples and MCP installation below remain available.</p></noscript>
<p><a href="/downloads#three-way-match">Install the free MCP server</a> to check your own structured documents in your AI client. Full diagnostics stay free; <a href="/buy/three-way-match?src=store.guide.demo">$19 Pro</a> removes the three-saved-report cap.</p>
</section><script defer src="/assets/matcher-demo.js"></script>`;
