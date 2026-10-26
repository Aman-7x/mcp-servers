// Owner-facing commercial diagnosis, separate from historical shipping results.
const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderRevenueReview(review) {
  if (!review) return '';
  const link = (path, label = 'Evidence') => `<a href="${esc(path)}">${esc(label)}</a>`;
  return `<section class="card revenue-review" id="revenue-review" aria-labelledby="revenue-review-title">
<style>
.revenue-review{margin-bottom:18px;border-top:4px solid var(--acc)}
.revenue-review h2{font-size:23px;letter-spacing:-.02em;text-transform:none;color:var(--tx);margin:5px 0 12px;border:0}
.revenue-review h3{font-size:16px;margin:23px 0 8px}
.revenue-review p{max-width:95ch}.revenue-review .lead{font-size:17px;line-height:1.55}
.revenue-review .review-meta{color:var(--tx2);font-size:12px;overflow-wrap:anywhere}
.revenue-review .evidence-note{font-size:12px;color:var(--tx2);margin-top:8px}
.revenue-review .review-callout{border-left:3px solid var(--warn);padding:4px 14px;margin:20px 0;background:var(--bg)}
.revenue-review .review-callout p{margin:6px 0}.revenue-review details{border-bottom:1px solid var(--line);padding:12px 0}
.revenue-review summary{font-size:15px;color:var(--tx);font-weight:600}
.revenue-review .finding-status{display:block;font-size:12px;color:var(--tx2);font-weight:400;margin:3px 0}
.revenue-review .scenario-inputs{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}
.revenue-review label{display:block;font-size:12px;color:var(--tx2)}
.revenue-review input,.revenue-review select{display:block;width:100%;padding:9px;margin-top:5px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--tx);font:inherit}
.revenue-review .scenario-results{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-top:15px}
.revenue-review output{font-size:22px;font-weight:650;display:block}.revenue-review .scenario-results p{margin:0}
.revenue-review .review-next li{margin-bottom:14px}.revenue-review .tw td{min-width:150px}
@media(max-width:600px){.revenue-review h2{font-size:22px}.revenue-review .lead{font-size:16px}}
</style>
<p class="review-meta">Commercial review · ${esc(review.date_label || '17 October 2026 ICT')} · APIs read ${esc(review.updated_at)} · ${link(review.audit, 'Fresh aggregate audit')}</p>
<h2 id="revenue-review-title">${esc(review.title)}</h2>
<p class="lead">${esc(review.conclusion)}</p>
<p>${esc(review.accountability)}</p>
<div class="kpis">${review.metrics.map(m => `<div class="kpi"><div class="n">${esc(m.value)}</div><div class="k">${esc(m.label)}</div><p class="evidence-note">${esc(m.window)}<br>${esc(m.note)} ${link(m.source)}</p></div>`).join('')}</div>
<p class="evidence-note">Each metric has its own population and observation window. These figures do not establish a person-level conversion rate. No fees, hosting or agent costs have been reconciled into actual profit.</p>
<div class="review-callout"><strong>${esc(review.correction.title)}</strong><p>${esc(review.correction.text)} ${link(review.correction.source, 'Corrected historical report')}</p></div>
<h3>Where the path to revenue breaks</h3>
${review.findings.map((f, i) => `<details${i === 0 || i === 2 ? ' open' : ''}><summary>${esc(f.title)}<span class="finding-status">${esc(f.status)}</span></summary><p>${esc(f.evidence)}</p><p><b>Implication:</b> ${esc(f.implication)} ${link(f.source)}</p></details>`).join('')}
<p>${esc(review.indexation.summary)} ${link(review.indexation.source, 'Current Google inspection')}</p>
<h3>What should change now</h3><p><b>${esc(review.decision)}</b></p>
<ol class="review-next">${review.next_test.map(t => `<li><b>${esc(t.action)}.</b> ${esc(t.measure)}<br><span class="evidence-note">Decision threshold: ${esc(t.gate)}</span></li>`).join('')}</ol>
<p>Resend is already connected. The last outreach audit found zero eligible email recipients; sender access is not a customer pipeline. Use permission-based trials or a relevant public channel where participation is allowed. ${link('docs/OUTREACH_RESEND_SETUP.md', 'Existing outreach setup')}</p>
<h3>The revenue arithmetic</h3>
<p>At $19, $1,000 gross requires <b>53 sales</b>. At $39, it requires <b>26 sales</b>. At an assumed 2% qualified-visit-to-purchase rate, that means <b>2,650 or 1,300 qualified visits</b>, respectively. The 2% rate is an example, not a measured rate or benchmark.</p>
<details id="revenue-scenario"><summary>Change the assumptions</summary>
<p class="evidence-note">Illustration only. Actual qualified visits, purchase rate and total costs are unknown. Each purchase is a one-time payment; this does not calculate recurring revenue.</p>
<div class="scenario-inputs">
<label>Qualified visits in chosen period<input id="scenario-traffic" type="number" value="100" min="0" max="10000000" step="1"></label>
<label>Assumed purchase rate (%)<input id="scenario-rate" type="number" value="2" min="0" max="100" step="0.1"></label>
<label>One-time price<select id="scenario-price"><option value="19">$19 single</option><option value="39">$39 bundle</option></select></label>
<label>Gross target ($)<input id="scenario-target" type="number" value="1000" min="0" max="1000000000" step="1"></label>
<label>All attributable costs ($, optional)<input id="scenario-cost" type="number" min="0" max="1000000000" step="0.01" placeholder="Enter known costs"></label>
</div>
<div class="scenario-results" aria-live="polite">
<p><span>Scenario gross</span><output id="scenario-gross"></output></p>
<p><span>Whole sales to reach target</span><output id="scenario-sales"></output></p>
<p><span>Qualified visits needed at assumed rate</span><output id="scenario-visits"></output></p>
<p><span>Scenario surplus after entered costs</span><output id="scenario-net"></output></p>
</div><p class="evidence-note">Enter agent, hosting, acquisition and payment fees together for the same period to estimate a surplus before taxes. Missing costs are not treated as zero. A positive scenario is not demonstrated ROI.</p>
</details>
<details><summary>Scope and remaining uncertainty</summary><ul>${review.limits.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>
<p>${link(review.report, 'Full revenue explanation and evidence')} · <a href="#previous-session">Previous implementation sprint</a></p>
</section>
<script>
(() => {
  const ids = ['traffic', 'rate', 'price', 'target', 'cost'];
  const fields = Object.fromEntries(ids.map(id => [id, document.getElementById('scenario-' + id)]));
  const outputs = ['gross', 'sales', 'visits', 'net'];
  const money = n => new Intl.NumberFormat('en-US', {style:'currency',currency:'USD'}).format(n);
  const count = n => n.toLocaleString('en-US');
  function update() {
    const put = (id, value) => { document.getElementById('scenario-' + id).textContent = value; };
    if (ids.some(id => !fields[id].checkValidity() || (id !== 'cost' && fields[id].value === ''))) {
      outputs.forEach(id => put(id, 'Check inputs')); return;
    }
    const traffic = Number(fields.traffic.value), rate = Number(fields.rate.value) / 100;
    const price = Number(fields.price.value), target = Number(fields.target.value);
    const gross = traffic * rate * price, sales = Math.ceil(target / price);
    put('gross', money(gross)); put('sales', count(sales));
    put('visits', sales === 0 ? '0' : rate > 0 ? count(Math.ceil(sales / rate)) : 'Unreachable at 0%');
    put('net', fields.cost.value === '' ? 'Costs unknown' : money(gross - Number(fields.cost.value)));
  }
  ids.forEach(id => fields[id].addEventListener('input', update)); update();
})();
</script>`;
}
