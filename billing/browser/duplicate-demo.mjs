import { check } from '../../servers/duplicate-invoice-check/src/core.ts';

// Only fixture construction and presentation live here. All comparison rules come
// from the same pure module the local MCP server imports.
const record = (record_id, changes = {}) => ({ record_id, entity_id: 'ENTITY-1', supplier_id: 'SUPPLIER-1', document_type: 'invoice', invoice_number: 'INV-001', invoice_date: '2026-10-16', currency: 'USD', total_minor: 10000, ...changes });
const presets = {
  worked: [record('R1'), record('R2'), record('R3', { invoice_number: 'inv /001', invoice_date: '2026-10-17', total_minor: 15000 }), record('R4', { invoice_number: 'RENT-9' })],
  conflict: [record('R1'), record('R2', { invoice_date: '2026-10-17', total_minor: 15000 })],
  formatting: [record('R1'), record('R2', { invoice_number: 'inv /001', invoice_date: '2026-10-17', total_minor: 15000 })],
  zeros: [record('R1'), record('R2', { invoice_number: 'INV-1', invoice_date: '2026-10-17', total_minor: 15000 })],
  boundaries: [record('R1'), record('OTHER-ENTITY', { entity_id: 'ENTITY-2' }), record('OTHER-SUPPLIER', { supplier_id: 'SUPPLIER-2' }), record('OTHER-CURRENCY', { currency: 'EUR' }), record('CREDIT-NOTE', { document_type: 'credit_note' })],
  legitimate: [record('RENT-1', { invoice_number: 'RENT-1' }), record('RENT-2', { invoice_number: 'RENT-2' })],
};
const form = document.getElementById('duplicate-demo-form');
const input = document.getElementById('duplicate-demo-input');
const status = document.getElementById('duplicate-demo-status');
const groups = document.getElementById('duplicate-demo-groups');
const rows = document.getElementById('duplicate-demo-records');
const output = document.getElementById('duplicate-demo-output');
const summary = document.getElementById('duplicate-demo-summary');
function cell(value, label) { const td = document.createElement('td'); td.textContent = String(value); td.dataset.label = label; return td; }
function run() {
  groups.replaceChildren(); rows.replaceChildren(); output.textContent = ''; summary.textContent = '';
  try {
    // Bound the editor before JSON parsing as well as enforcing the product schema.
    if (input.value.length > 2 * 1024 * 1024 || new TextEncoder().encode(input.value).byteLength > 2 * 1024 * 1024) throw Error('This browser example accepts at most 2 MiB of JSON text. Use a smaller supplied batch.');
    const parsed = JSON.parse(input.value);
    if (parsed.save === true) throw Error('This browser example does not save reports. Set save to false.');
    const report = check(parsed);
    status.dataset.status = report.status;
    status.textContent = report.status === 'candidates_for_review' ? 'Candidates for review in the supplied records.' : 'No candidates in the supplied batch. This does not establish uniqueness or approval to pay.';
    const s = report.summary;
    summary.textContent = `${s.record_count} supplied records; ${s.candidate_record_count} distinct candidate records; ${s.unflagged_record_count} unflagged records; ${s.group_count} reason groups. A record can appear in more than one group and is counted once as a candidate. No recoverable amount is calculated.`;
    for (const group of report.groups) {
      const article = document.createElement('li');
      const title = document.createElement('strong'); title.textContent = `${group.group_id}: ${group.rule}`;
      const scope = document.createElement('p'); scope.textContent = `Scope: ${group.scope.entity_id} / ${group.scope.supplier_id} / ${group.scope.document_type} / ${group.scope.currency}. Records: ${group.record_ids.join(', ')}.`;
      const evidence = document.createElement('p'); evidence.textContent = `Matching evidence: ${typeof group.match_key === 'string' ? group.match_key : JSON.stringify(group.match_key)}. Conflicting fields: ${group.conflicting_fields.join(', ') || 'none'}. ${group.explanation}`;
      article.append(title, scope, evidence); groups.append(article);
    }
    for (const r of report.records) {
      const reason = report.record_summaries.find(s => s.record_id === r.record_id);
      const row = document.createElement('tr');
      const values = [[r.record_id, 'Record'], [r.invoice_number, 'Reference'], [r.invoice_date, 'Date'], [r.total_minor, 'Minor units'], [reason.reasons.join(', ') || 'Unflagged in supplied batch', 'Reasons']];
      for (const [value, label] of values) row.append(cell(value, label));
      rows.append(row);
    }
    output.textContent = JSON.stringify(report, null, 2);
  } catch (error) {
    status.dataset.status = 'invalid';
    status.textContent = error.issues ? 'Invalid input: ' + error.issues.slice(0, 3).map(i => `${i.path.join('.')}: ${i.message}`).join('; ') : 'Invalid input: ' + error.message;
  }
}
form.addEventListener('submit', event => { event.preventDefault(); run(); });
document.getElementById('duplicate-demo-preset').addEventListener('change', event => {
  input.value = JSON.stringify({ records: presets[event.target.value], save: false }, null, 2); run();
});
input.value = JSON.stringify({ records: presets.worked, save: false }, null, 2);
run();
