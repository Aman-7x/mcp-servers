import { match } from '../../servers/three-way-match/src/core.ts';

const form = document.getElementById('matcher-demo-form');
const status = document.getElementById('matcher-demo-status');
const evidence = document.getElementById('matcher-demo-evidence');
const issues = document.getElementById('matcher-demo-issues');
const payload = document.getElementById('matcher-demo-payload');
const presets = {
  quantity: [5, 15, 0, 10, 10, 100, 100, 0, 0],
  price: [10, 10, 0, 10, 10, 90, 110, 0, 0],
  partial: [4, 0, 2, 4, 0, 100, 100, 0, 0],
};
const fields = ['accepted_a', 'accepted_b', 'rejected_a', 'billed_a', 'billed_b', 'price_a', 'price_b', 'prior_a', 'prior_b'];
function number(name) {
  const value = form.elements.namedItem(name).value;
  if (!value.trim() || !Number.isSafeInteger(Number(value)) || Number(value) < 0) throw Error('Enter a nonnegative whole number in every field.');
  return Number(value);
}
function cell(text) { const td = document.createElement('td'); td.textContent = text; return td; }
function run() {
  issues.replaceChildren(); evidence.replaceChildren();
  payload.textContent = '';
  try {
    const n = Object.fromEntries(fields.map(name => [name, number(name)]));
    const lines = ['a', 'b'].filter(s => n['billed_' + s] > 0).map(s => ({ sku: s.toUpperCase(), quantity: n['billed_' + s], unit_price_minor: n['price_' + s] }));
    if (!lines.length) throw Error('Bill at least one unit of A or B to check an invoice.');
    const input = {
      po: { reference: 'PO-example', supplier: 'Example supplier', currency: 'USD', lines: ['A', 'B'].map(sku => ({ sku, quantity: 10, unit_price_minor: 100 })) },
      receipts: [{ reference: 'GR-example', po_reference: 'PO-example', supplier: 'Example supplier', date: '2026-10-16', lines: ['a', 'b'].map(s => ({ sku: s.toUpperCase(), accepted_quantity: n['accepted_' + s], rejected_quantity: s === 'a' ? n.rejected_a : 0 })) }],
      invoice: { reference: 'INV-example', po_reference: 'PO-example', supplier: 'Example supplier', currency: 'USD', lines, total_minor: lines.reduce((sum, line) => sum + line.quantity * line.unit_price_minor, 0) },
      prior_invoiced: ['a', 'b'].filter(s => n['prior_' + s] > 0).map(s => ({ sku: s.toUpperCase(), quantity: n['prior_' + s] })), save: false,
    };
    payload.textContent = JSON.stringify(input, null, 2);
    const report = match(input);
    status.dataset.status = report.status;
    status.textContent = report.status === 'matched' ? 'Matched: the supplied goods evidence passes these checks.' : `${report.status === 'invalid' ? 'Invalid evidence' : 'Exceptions found'}: ${report.issues.length} issue${report.issues.length === 1 ? '' : 's'}.`;
    document.getElementById('matcher-demo-totals').textContent = `PO total: ${report.totals.po_total_minor} minor units. Invoice lines: ${report.totals.invoice_lines_total_minor} minor units. Equal totals alone do not establish a match.`;
    for (const line of report.lines) {
      const row = document.createElement('tr');
      const labels = ['SKU', 'Ordered', 'Accepted', 'Rejected', 'Prior billed', 'This invoice'];
      [line.sku, line.ordered_quantity, line.accepted_quantity, line.rejected_quantity, line.prior_invoiced_quantity, line.invoice_quantity].forEach((value, i) => {
        const td = cell(String(value ?? '—')); td.dataset.label = labels[i]; row.append(td);
      });
      evidence.append(row);
    }
    for (const issue of report.issues) {
      const li = document.createElement('li'); li.textContent = `${issue.sku ? issue.sku + ': ' : ''}${issue.code} — ${issue.message}`; issues.append(li);
    }
  } catch (error) {
    status.dataset.status = 'invalid';
    status.textContent = error.issues ? 'Invalid input: ' + error.issues.map(i => `${i.path.join('.')}: ${i.message}`).slice(0, 3).join('; ') : error.message;
    document.getElementById('matcher-demo-totals').textContent = '';
  }
}
form.addEventListener('submit', event => { event.preventDefault(); run(); });
document.getElementById('matcher-demo-preset').addEventListener('change', event => {
  const values = presets[event.target.value];
  fields.forEach((name, i) => { form.elements.namedItem(name).value = String(values[i]); });
  run();
});
run();
