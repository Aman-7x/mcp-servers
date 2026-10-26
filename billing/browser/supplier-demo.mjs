import { check, checkSchema, exportCsv } from '../../servers/supplier-statement-check/src/core.ts';
import { parseSupplierCsvBuffers, parseSupplierCsvPair, supplierCsvEditorText, CSV_MAX_COMBINED_BYTES, CSV_TEMPLATE_AS_OF, STATEMENT_CSV_TEMPLATE, LEDGER_CSV_TEMPLATE } from './supplier-csv.mjs';

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
const statementFile = $('csv-statement'), ledgerFile = $('csv-ledger'), asOf = $('csv-as-of'), csvStatus = $('csv-status');
let currentReport;
let readGeneration = 0;
function showCsvStatus(message) { if (csvStatus) csvStatus.textContent = message; }
function cancelCsvRead(message, clearFiles = false) {
  readGeneration++;
  if (clearFiles) { if (statementFile) statementFile.value = ''; if (ledgerFile) ledgerFile.value = ''; }
  showCsvStatus(message);
}
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
$('form').addEventListener('submit', event => { event.preventDefault(); cancelCsvRead('The JSON editor is the current comparison input.', true); run(); });
editor.addEventListener('input', () => { cancelCsvRead('JSON edited. Previous file selections are cleared; no pending file can replace this input.', true); clear(); $('preset').value = 'custom'; status.dataset.status = 'pending'; status.textContent = 'Input changed. Run the comparison to produce current evidence.'; });
function preset(name) { cancelCsvRead('No CSV selected. Results use the selected synthetic example.', true); editor.value = JSON.stringify(presets[name], null, 2); editor.scrollTop = 0; run(); }
$('preset').addEventListener('change', () => preset($('preset').value));
download.addEventListener('click', () => {
  if (!currentReport) return;
  const url = URL.createObjectURL(new Blob([exportCsv(currentReport)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'supplier-statement-open-item-evidence.csv'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

function clearForImport(message) {
  cancelCsvRead(message);
  editor.value = ''; clear(); status.dataset.status = 'pending'; status.textContent = message;
  if ($('preset').querySelector?.('option[value="custom"]')) $('preset').value = 'custom';
  return readGeneration;
}
function rejectImport(error, generation) {
  if (generation !== readGeneration) return;
  editor.value = ''; clear(); status.dataset.status = 'invalid';
  status.textContent = error.issues ? 'CSV input rejected: ' + error.issues.slice(0, 3).map(i => `${i.path.join('.')}: ${i.message}`).join('; ') : 'CSV input rejected: ' + error.message;
  showCsvStatus('No rows were imported. Both complete files and the common as-of date must pass.');
}
function acceptImport(input, generation) {
  if (generation !== readGeneration) return;
  // Both files, the authoritative schema and editor bounds pass before replacing
  // the editor. There is never a partly imported statement or ledger.
  editor.value = supplierCsvEditorText(input); editor.scrollTop = 0;
  if ($('preset').querySelector?.('option[value="custom"]')) $('preset').value = 'custom';
  if (!run()) throw Error('The complete parsed pair could not be compared. No records were retained.');
  showCsvStatus(`Imported ${input.statement_records.length} statement and ${input.ledger_records.length} AP ledger records locally. No rows skipped. The JSON editor shows the exact parsed input.`);
}
async function importSelectedFiles() {
  const generation = clearForImport('Previous evidence cleared. Choose both CSV files and their common as-of date.');
  const statement = statementFile.files?.[0], ledger = ledgerFile.files?.[0], date = asOf.value;
  if (!statement || !ledger || !date) return;
  try {
    if (![statement.size, ledger.size].every(n => Number.isSafeInteger(n) && n >= 0) || statement.size + ledger.size > CSV_MAX_COMBINED_BYTES) throw Error('The two CSV files together may contain at most 2 MiB.');
    status.textContent = 'Reading two local UTF-8 CSV files. Previous evidence is cleared.';
    const [statement_bytes, ledger_bytes] = await Promise.all([statement.arrayBuffer(), ledger.arrayBuffer()]);
    if (generation !== readGeneration) return;
    const input = parseSupplierCsvBuffers({ as_of: date, statement_bytes, ledger_bytes }, value => checkSchema.parse(value));
    acceptImport(input, generation);
  } catch (error) { rejectImport(error, generation); }
}
// Cached older markup has none of these controls. Its JSON/preset path remains
// functional; partially cached controls do not start incomplete file reads.
if (statementFile && ledgerFile && asOf && csvStatus) {
  statementFile.addEventListener('change', importSelectedFiles);
  ledgerFile.addEventListener('change', importSelectedFiles);
  asOf.addEventListener('input', () => clearForImport('As-of date changed. Previous evidence cleared; finish the date to compare both files.'));
  asOf.addEventListener('change', importSelectedFiles);
  $('csv-sample')?.addEventListener('click', () => {
    const generation = clearForImport('Reading the two synthetic CSV templates locally.');
    try {
      statementFile.value = ''; ledgerFile.value = ''; asOf.value = CSV_TEMPLATE_AS_OF;
      acceptImport(parseSupplierCsvPair({ as_of: CSV_TEMPLATE_AS_OF, statement_csv: STATEMENT_CSV_TEMPLATE, ledger_csv: LEDGER_CSV_TEMPLATE }, value => checkSchema.parse(value)), generation);
    } catch (error) { rejectImport(error, generation); }
  });
  function templateDownload(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  $('csv-statement-template')?.addEventListener('click', () => templateDownload('supplier-statement-synthetic.csv', STATEMENT_CSV_TEMPLATE));
  $('csv-ledger-template')?.addEventListener('click', () => templateDownload('ap-ledger-synthetic.csv', LEDGER_CSV_TEMPLATE));
}
preset('worked');
