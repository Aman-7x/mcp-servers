import { check, checkSchema } from '../../servers/duplicate-invoice-check/src/core.ts';
import { parseInvoiceCsv, CSV_MAX_FILE_BYTES, CSV_TEMPLATE } from './duplicate-csv.mjs';

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
const csvFile = document.getElementById('duplicate-demo-csv-file');
const csvStatus = document.getElementById('duplicate-demo-csv-status');
const presetSelect = document.getElementById('duplicate-demo-preset');
let readGeneration = 0;
function cell(value, label) { const td = document.createElement('td'); td.textContent = String(value); td.dataset.label = label; return td; }
function clearEvidence() {
  groups.replaceChildren(); rows.replaceChildren(); output.textContent = ''; summary.textContent = '';
}
function errorText(error) {
  return error.issues ? 'Invalid input: ' + error.issues.slice(0, 3).map(i => `${i.path.join('.')}: ${i.message}`).join('; ') : 'Invalid input: ' + error.message;
}
function cancelRead(message) {
  readGeneration++;
  if (csvFile) csvFile.value = '';
  showCsvStatus(message);
}
function showCsvStatus(message) { if (csvStatus) csvStatus.textContent = message; }
function markCustomInput() {
  // Cached pre-CSV markup has neither the controls nor the custom option.
  if (presetSelect.querySelector('option[value="custom"]')) presetSelect.value = 'custom';
}
function run() {
  clearEvidence();
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
    return true;
  } catch (error) {
    status.dataset.status = 'invalid';
    status.textContent = errorText(error);
    return false;
  }
}
function importCsv(text, source) {
  const parsed = parseInvoiceCsv(text, value => checkSchema.parse(value));
  let json = JSON.stringify(parsed, null, 2);
  if (new TextEncoder().encode(json).byteLength > CSV_MAX_FILE_BYTES) json = JSON.stringify(parsed);
  if (new TextEncoder().encode(json).byteLength > CSV_MAX_FILE_BYTES) throw Error('CSV expands beyond the 2 MiB JSON editor limit. Use a smaller complete batch; no rows were imported.');
  input.value = json; input.scrollTop = 0; markCustomInput();
  if (!run()) throw Error('The converted CSV could not be checked. No rows were accepted.');
  showCsvStatus(`Imported ${parsed.records.length} records from ${source} locally. No rows skipped. The JSON editor shows the exact parsed input.`);
}
csvFile?.addEventListener('change', async () => {
  const file = csvFile.files?.[0], generation = ++readGeneration;
  input.value = ''; clearEvidence(); status.dataset.status = 'pending';
  if (!file) { status.textContent = 'No CSV selected; no records have been checked.'; showCsvStatus('No CSV selected. Previous evidence cleared.'); return; }
  status.textContent = 'Reading a local CSV. Previous evidence cleared.';
  showCsvStatus('Reading the selected file on this device…');
  try {
    // File size is checked before any read; bytes and UTF-8 decoding are checked
    // again afterward. A newer file/edit/preset invalidates this completion.
    if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > CSV_MAX_FILE_BYTES) throw Error('Choose a nonempty CSV file no larger than 2 MiB. The file was not read.');
    const bytes = await file.arrayBuffer();
    if (generation !== readGeneration) return;
    if (bytes.byteLength > CSV_MAX_FILE_BYTES) throw Error('CSV file exceeds the 2 MiB limit.');
    // Preserve the decoder's BOM so the parser handles exactly one transport BOM.
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    importCsv(text, file.name);
  } catch (error) {
    if (generation !== readGeneration) return;
    input.value = ''; clearEvidence(); status.dataset.status = 'invalid'; status.textContent = errorText(error);
    showCsvStatus('CSV import rejected. No rows were imported; previous evidence cleared.');
  } finally { if (generation === readGeneration) csvFile.value = ''; }
});
document.getElementById('duplicate-demo-csv-sample')?.addEventListener('click', () => {
  cancelRead('Reviewing the sample CSV locally.');
  try { importCsv(CSV_TEMPLATE, 'the synthetic sample CSV'); }
  catch (error) { input.value = ''; clearEvidence(); status.dataset.status = 'invalid'; status.textContent = errorText(error); }
});
input.addEventListener('input', () => {
  cancelRead('JSON input changed. Any pending CSV read was discarded.'); clearEvidence(); markCustomInput();
  status.dataset.status = 'pending'; status.textContent = 'Input changed. Run the check to produce new evidence.';
});
form.addEventListener('submit', event => { event.preventDefault(); cancelRead('Reviewing the JSON editor; any pending CSV read was discarded.'); run(); });
presetSelect.addEventListener('change', event => {
  cancelRead('Using a synthetic JSON example. Any pending CSV read was discarded.');
  input.value = JSON.stringify({ records: presets[event.target.value], save: false }, null, 2); run();
});
input.value = JSON.stringify({ records: presets.worked, save: false }, null, 2);
run();
