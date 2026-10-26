import { check, exportCsv } from '../../servers/supplier-statement-check/src/core.ts';

// Presentation only. The installed MCP server imports this same comparison engine.
const item = (record_id, document_reference, changes = {}) => ({ record_id, entity_id: 'ENTITY-1', supplier_id: 'SUPPLIER-1', currency: 'USD', document_type: 'invoice', document_reference, document_date: '2026-10-01', outstanding_minor: 10000, ...changes });
const inputFor = (statement_records, ledger_records) => ({ as_of: '2026-10-26', statement_records, ledger_records, save: false });
const presets = {
  worked: inputFor(
    [item('S1', 'INV-001'), item('S2', 'INV-002'), item('S3', 'INV-003'), item('S4', 'INV-005'), item('S5', 'INV-005')],
    [item('L1', 'INV-001'), item('L2', 'INV-002', { outstanding_minor: 12000, document_date: '2026-10-02' }), item('L4', 'INV-004'), item('L5', 'INV-005')]),
  agreement: inputFor([item('S1', 'INV-001')], [item('L1', 'INV-001')]),
  zeros: inputFor([item('S1', 'INV-0001')], [item('L1', 'INV-1')]),
  credit: inputFor([item('S1', 'CN-001', { document_type: 'credit_note' })], [item('L1', 'CN-001')]),
  ambiguous: inputFor([item('S1', 'INV-001'), item('S2', 'INV-001')], [item('L1', 'INV-001')]),
};
const $ = id => document.getElementById('supplier-demo-' + id);
const editor = $('input'), status = $('status'), summary = $('summary'), groups = $('groups'), output = $('output'), download = $('csv');
let currentReport;
function clear() {
  currentReport = undefined;
  download.disabled = true;
  summary.textContent = ''; output.textContent = ''; groups.replaceChildren();
}
function run() {
  clear();
  try {
    if (editor.value.length > 2 * 1024 * 1024 || new TextEncoder().encode(editor.value).byteLength > 2 * 1024 * 1024) throw Error('Use at most 2 MiB of JSON text in this browser example. No records were checked.');
    const input = JSON.parse(editor.value);
    if (input.save === true) throw Error('This browser example never saves reports. Set save to false.');
    const report = check(input), s = report.summary;
    status.dataset.status = report.status;
    status.textContent = s.review_group_count ? 'Differences or repeated references need review.' : 'The supplied open items agree. Export completeness and balances are unverified.';
    summary.textContent = `${s.statement_record_count} statement records; ${s.ledger_record_count} AP ledger records. ${s.matched_group_count} matching groups; ${s.review_group_count} groups to review: ${s.only_in_statement_group_count} statement only, ${s.only_in_ledger_group_count} ledger only, ${s.discrepancy_group_count} amount/date differences, ${s.ambiguous_group_count} repeated references.`;
    for (const group of report.groups.slice(0, 25)) {
      const li = document.createElement('li');
      const title = document.createElement('strong'); title.textContent = `${group.group_id}: ${group.status}`;
      const key = document.createElement('p'); key.textContent = `${group.key.entity_id} / ${group.key.supplier_id} / ${group.key.currency} / ${group.key.document_type} / ${group.key.document_reference}`;
      const evidence = document.createElement('p'); evidence.textContent = `Statement: ${group.statement_record_ids.join(', ') || '(none)'}. Ledger: ${group.ledger_record_ids.join(', ') || '(none)'}. Issues: ${group.issues.join(', ') || '(none)'}. ${group.explanation}`;
      li.append(title, key, evidence); groups.append(li);
    }
    if (report.groups.length > 25) { const li = document.createElement('li'); li.textContent = 'First 25 groups shown above. The full structured report and free CSV below retain every source record and group.'; groups.append(li); }
    output.textContent = JSON.stringify(report, null, 2);
    currentReport = report; download.disabled = false;
    return report;
  } catch (error) {
    status.dataset.status = 'invalid';
    status.textContent = error.issues ? 'Invalid input: ' + error.issues.slice(0, 3).map(i => `${i.path.join('.')}: ${i.message}`).join('; ') : 'Invalid input: ' + error.message;
  }
}
$('form').addEventListener('submit', event => { event.preventDefault(); run(); });
editor.addEventListener('input', () => { clear(); $('preset').value = 'custom'; status.dataset.status = 'pending'; status.textContent = 'Input changed. Run the comparison to produce current evidence.'; });
function preset(name) { editor.value = JSON.stringify(presets[name], null, 2); editor.scrollTop = 0; run(); }
$('preset').addEventListener('change', () => preset($('preset').value));
download.addEventListener('click', () => {
  if (!currentReport) return;
  const url = URL.createObjectURL(new Blob([exportCsv(currentReport)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'supplier-statement-open-item-evidence.csv'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
preset('worked');
