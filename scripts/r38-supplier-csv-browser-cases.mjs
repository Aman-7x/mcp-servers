// Synthetic real File inputs. No uploads, customer fixtures, checkout or MCP calls.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { STATEMENT_CSV_TEMPLATE as STMT, LEDGER_CSV_TEMPLATE as LEDGER, CSV_TEMPLATE_AS_OF as AS_OF, CSV_REQUIRED_COLUMNS as COLUMNS, CSV_MAX_COMBINED_BYTES as MAX } from '../billing/browser/supplier-csv.mjs';
import { SUPPLIER_DEMO_INPUT_SHA256, SUPPLIER_DEMO_JAVASCRIPT } from '../billing/src/supplier-demo-bundle.js';

const row = (record_id, changes = {}) => ({ record_id, entity_id: 'ENTITY-1', supplier_id: 'SUPPLIER-1', currency: 'USD', document_type: 'invoice', document_reference: 'INV-001', document_date: '2026-10-01', outstanding_minor: 10000, ...changes });
const quote = value => '"' + String(value).replaceAll('"', '""') + '"';
const csvFor = (records, columns = COLUMNS) => columns.join(',') + '\r\n' + records.map(r => columns.map(c => quote(r[c])).join(',')).join('\r\n') + (records.length ? '\r\n' : '');
const payload = (name, value) => ({ name, mimeType: 'text/csv', buffer: Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8') });

export async function runSupplierCsvBrowserCases({ page, context, origin, guide, originalGuideHtml, workedInput, root, frames, evidence, recordCheck, csvRows }) {
  const statement = page.locator('#supplier-demo-csv-statement'), ledger = page.locator('#supplier-demo-csv-ledger'), date = page.locator('#supplier-demo-csv-as-of');
  const output = page.locator('#supplier-demo-output'), editor = page.locator('#supplier-demo-input'), exportButton = page.locator('#supplier-demo-csv');
  const report = async () => JSON.parse(await output.textContent());
  const waitImported = () => page.waitForFunction(() => document.getElementById('supplier-demo-csv-status').textContent.startsWith('Imported '));
  const waitRejected = () => page.waitForFunction(() => document.getElementById('supplier-demo-status').dataset.status === 'invalid');
  const clearSelections = async () => { await statement.setInputFiles([]); await ledger.setInputFiles([]); };
  async function upload(a = STMT, b = LEDGER, asOf = AS_OF) {
    await clearSelections(); await date.fill(asOf);
    await statement.setInputFiles(payload('synthetic-statement.csv', a));
    await ledger.setInputFiles(payload('synthetic-ap-ledger.csv', b));
  }
  async function assertCleared() {
    assert.equal(await output.textContent(), ''); assert.equal(await page.locator('#supplier-demo-summary').textContent(), '');
    assert.equal(await page.locator('#supplier-demo-groups li').count(), 0); assert(await exportButton.isDisabled());
  }
  async function downloadedCsv() {
    const pending = page.waitForEvent('download'); await exportButton.click();
    const download = await pending; return readFileSync(await download.path(), 'utf8');
  }

  await upload(); await waitImported();
  let actual = await report(); assert.deepEqual(actual.statement_records, workedInput.statement_records); assert.deepEqual(actual.ledger_records, workedInput.ledger_records);
  assert.equal(actual.summary.matched_group_count, 1); assert.equal(actual.summary.review_group_count, 4);
  let rows = csvRows(await downloadedCsv()); assert.equal(rows.length, 9);
  for (const [side, originals] of [['statement', workedInput.statement_records], ['ledger', workedInput.ledger_records]]) for (const original of originals) {
    const found = rows.find(r => r.side === side && r.record_id === original.record_id); assert(found);
    for (const [key, value] of Object.entries(original)) assert.equal(found[key], String(value));
  }
  recordCheck('Two actual UTF-8 CSV files', 'Both real file controls import the complete9record pair; every source field survives actual downloaded CSV; no partial side is accepted');
  // The latest GIF's first states show an actual selected CSV pair, while the
  // initial release GIF and receipts stay at their preserved historical paths.
  for (const [index, label, selector] of [[0, 'Two local synthetic CSV exports selected', '#supplier-demo-csv-statement'], [1, 'Actual CSV-source comparison evidence', '#supplier-demo-summary']]) {
    await page.locator(selector).scrollIntoViewIfNeeded(); await page.screenshot({ path: join(frames, `${String(index).padStart(2, '0')}.png`) });
    evidence.frames[index] = { label, summary: await page.locator('#supplier-demo-summary').innerText(), status: await page.locator('#supplier-demo-status').innerText() };
  }

  const unicode = row('00001', { entity_id: '001', supplier_id: 'é-供應商-００１', document_reference: 'INV, "é-００1"' });
  await upload('\uFEFF' + csvFor([unicode], [...COLUMNS].reverse()), csvFor([unicode])); await waitImported();
  actual = await report(); assert.deepEqual(actual.statement_records, [unicode]); assert.deepEqual(actual.ledger_records, [unicode]);
  rows = csvRows(await downloadedCsv()); assert.equal(rows.length, 2); assert(rows.every(r => r.record_id === '00001' && r.document_reference === unicode.document_reference));
  recordCheck('CSV source identity and quoting', 'Real UTF-8BOM/reordered-header uploads preserve leading-zeroIDs, Unicode and quoted comma/quote references in both report and downloaded CSV');

  const badLast = [row('L1'), row('L2', { document_date: '2026-02-30' })];
  await upload(STMT, csvFor(badLast)); await waitRejected(); await assertCleared();
  assert.match(await page.locator('#supplier-demo-csv-status').textContent(), /No rows were imported/);
  recordCheck('Complete-pair invalid-row refusal', 'A bad final AP date clears all prior source/evidence; no valid first row or statement side is retained');

  const malformed = [
    ['invalid UTF-8', Buffer.from([0xc3, 0x28]), /valid UTF-8/],
    ['unknown header', LEDGER.replace('outstanding_minor', 'balance'), /header/],
    ['duplicate header', LEDGER.replace('supplier_id', 'entity_id'), /duplicate/],
    ['malformed quotes', LEDGER.replace('INV-001', 'INV"001'), /quote/],
    ['noncanonical amount', csvFor([row('L1', { outstanding_minor: '00100' })]), /positive safe integer/],
  ];
  for (const [, bad, message] of malformed) { await upload(STMT, bad); await waitRejected(); await assertCleared(); assert.match(await page.locator('#supplier-demo-status').textContent(), message); }
  recordCheck('Actual CSV encoding/header/amount rejection', 'MalformedUTF-8, unknown/duplicate headers, malformedquote and leading-zeroamount file inputs each reject the whole pair; no source values are silently repaired');

  await clearSelections(); await date.fill(AS_OF);
  await page.evaluate(() => {
    window.__csvQAMetadataReads = 0; window.__csvQAMetadataOriginal = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = function (...args) { window.__csvQAMetadataReads++; return window.__csvQAMetadataOriginal.apply(this, args); };
  });
  try {
    const oversized = Buffer.alloc(MAX / 2 + 1, 0x20);
    await statement.setInputFiles(payload('synthetic-limit-statement.csv', oversized)); await ledger.setInputFiles(payload('synthetic-limit-ap.csv', oversized));
    await waitRejected(); await assertCleared(); assert.equal(await page.evaluate(() => window.__csvQAMetadataReads), 0); assert.match(await page.locator('#supplier-demo-status').textContent(), /2 MiB/);
  } finally { await page.evaluate(() => { File.prototype.arrayBuffer = window.__csvQAMetadataOriginal; delete window.__csvQAMetadataOriginal; }); }
  recordCheck('Combined real file-size guard', 'Two real files just over2MiB combined are refused before either arrayBuffer reader runs; previous evidence stays empty');

  const many = prefix => Array.from({ length: 1000 }, (_, i) => row(prefix + String(i).padStart(4, '0'), { document_reference: 'INV-' + String(i).padStart(4, '0') }));
  const s1000 = many('S'), l1000 = many('L');
  await upload(csvFor(s1000), csvFor(l1000)); await waitImported(); actual = await report();
  assert.equal(actual.summary.statement_record_count, 1000); assert.equal(actual.summary.ledger_record_count, 1000); assert.equal(actual.summary.matched_group_count, 1000);
  rows = csvRows(await downloadedCsv()); assert.equal(rows.length, 2000); assert.equal(new Set(rows.map(r => r.side + ':' + r.record_id)).size, 2000);
  for (const [side, originals] of [['statement', s1000], ['ledger', l1000]]) for (const original of originals) {
    const found = rows.find(r => r.side === side && r.record_id === original.record_id); assert(found); assert.equal(found.document_reference, original.document_reference); assert.equal(found.outstanding_minor, String(original.outstanding_minor));
  }
  await upload(csvFor([...s1000, row('S1000')]), csvFor(l1000)); await waitRejected(); await assertCleared();
  recordCheck('Complete1000+1000 CSV boundary', 'Exactly1000items per side yield1000matches and a complete2000-row downloadedCSV;1001items on one side reject without truncation');

  const dense = (prefix, length) => Array.from({ length: 1000 }, (_, i) => row(prefix + String(i).padStart(4, '0') + 'é'.repeat(length), { entity_id: 'é'.repeat(length), supplier_id: 'é'.repeat(length), document_reference: 'é'.repeat(length) }));
  let compact, expanded;
  for (const length of [80, 90, 100, 110, 120, 130, 140]) {
    const input = { as_of: AS_OF, statement_records: dense('S', length), ledger_records: dense('L', length), save: false };
    const a = csvFor(input.statement_records), b = csvFor(input.ledger_records);
    if (Buffer.byteLength(a) + Buffer.byteLength(b) > MAX) continue;
    if (Buffer.byteLength(JSON.stringify(input)) > MAX) expanded = { a, b };
    else if (Buffer.byteLength(JSON.stringify(input, null, 2)) > MAX) compact = { a, b };
  }
  assert(compact && expanded, 'Positive controls must straddle actual compact/pretty byte bounds');
  await upload(compact.a, compact.b); await waitImported();
  const compactText = await editor.inputValue(); assert(!compactText.includes('\n')); assert(Buffer.byteLength(compactText) <= MAX); assert.equal(JSON.parse(compactText).statement_records.length, 1000);
  await upload(expanded.a, expanded.b); await waitRejected(); await assertCleared(); assert.match(await page.locator('#supplier-demo-status').textContent(), /expand beyond/);
  recordCheck('Real editor expansion guard', 'A raw-bounded2000item pair uses compactJSON when pretty form exceeds2MiB; another raw-bounded pair whose compact form exceeds2MiB rejects completely');

  await clearSelections(); await date.fill(AS_OF);
  await page.evaluate(() => {
    window.__csvQAOriginal = File.prototype.arrayBuffer; window.__csvQAPending = []; window.__csvQADelay = false;
    File.prototype.arrayBuffer = function (...args) {
      const result = window.__csvQAOriginal.apply(this, args);
      if (!window.__csvQADelay) return result;
      return new Promise((resolve, reject) => window.__csvQAPending.push(async () => { try { resolve(await result); } catch (error) { reject(error); } }));
    };
  });
  const releaseReads = () => page.evaluate(async () => { window.__csvQADelay = false; const reads = window.__csvQAPending.splice(0); await Promise.all(reads.map(fn => fn())); await new Promise(resolve => setTimeout(resolve, 0)); });
  async function startDelayedPair() {
    await clearSelections(); await date.fill(AS_OF); await page.evaluate(() => { window.__csvQADelay = true; });
    await statement.setInputFiles(payload('synthetic-old-statement.csv', STMT)); await ledger.setInputFiles(payload('synthetic-old-ap.csv', LEDGER));
    await page.waitForFunction(() => window.__csvQAPending.length === 2); await assertCleared();
  }
  try {
    await startDelayedPair(); await page.evaluate(() => { window.__csvQADelay = false; });
    await statement.setInputFiles(payload('synthetic-new-statement.csv', csvFor([row('NEW-S', { document_reference: 'NEW' })])));
    await ledger.setInputFiles(payload('synthetic-new-ap.csv', csvFor([row('NEW-L', { document_reference: 'NEW' })])));
    await waitImported(); assert.equal((await report()).statement_records[0].record_id, 'NEW-S');
    await releaseReads(); assert.equal((await report()).statement_records[0].record_id, 'NEW-S'); assert.equal((await report()).ledger_records[0].record_id, 'NEW-L');
    recordCheck('Actual late-read file race', 'A later real two-file selection remains current after both earlier delayed File reads finish');

    await startDelayedPair(); await editor.fill(JSON.stringify(workedInput)); await assertCleared(); await releaseReads();
    assert.deepEqual(JSON.parse(await editor.inputValue()), workedInput); await assertCleared();
    await page.locator('#supplier-demo-form button[type=submit]').click(); assert.equal((await report()).summary.review_group_count, 4);
    recordCheck('Actual file-to-JSON cancellation', 'An edited JSON input cancels both pending real File reads; old completion cannot repopulate source/evidence');

    await startDelayedPair(); await page.selectOption('#supplier-demo-preset', 'agreement'); await releaseReads();
    assert.equal((await report()).summary.statement_record_count, 1); assert.equal((await report()).summary.matched_group_count, 1);
    recordCheck('Actual file-to-preset cancellation', 'A selected synthetic preset remains current after both older real File reads complete');

    await startDelayedPair(); await date.fill('2026-10-27'); await assertCleared();
    await page.waitForFunction(() => window.__csvQAPending.length === 4); await releaseReads(); await waitImported(); assert.equal((await report()).as_of, '2026-10-27');
    recordCheck('Actual common-date race', 'Changing the date clears old evidence immediately; only the complete pair read for the newly declared date becomes current');
  } finally { await releaseReads(); await page.evaluate(() => { File.prototype.arrayBuffer = window.__csvQAOriginal; delete window.__csvQAOriginal; delete window.__csvQAPending; }); }

  await page.locator('#supplier-demo .supplier-csv-import details summary').click();
  for (const [id, expected, name] of [['csv-statement-template', STMT, 'supplier-statement-synthetic.csv'], ['csv-ledger-template', LEDGER, 'ap-ledger-synthetic.csv']]) {
    const pending = page.waitForEvent('download'); await page.locator('#supplier-demo-' + id).click(); const download = await pending;
    assert.equal(download.suggestedFilename(), name); assert.equal(readFileSync(await download.path(), 'utf8'), expected);
  }
  await page.locator('#supplier-demo-csv-sample').click(); await waitImported(); assert.equal((await report()).summary.group_count, 5); assert.equal(await date.inputValue(), AS_OF);
  await page.locator('#supplier-demo .supplier-csv-import details summary').click();
  recordCheck('Actual local template route', 'Both downloaded syntheticCSV templates match their copyable sourcebytes; sample button runs the same strict parser/core and declares its fixed as-of date');

  const oldSource = readFileSync(join(root, 'data/r38_supplier_first_release_source/billing__src__supplier-demo-markup.js'), 'utf8');
  const oldBundle = readFileSync(join(root, 'data/r38_supplier_first_release_source/billing__src__supplier-demo-bundle.js'), 'utf8');
  const oldHash = /SUPPLIER_DEMO_INPUT_SHA256 = "([a-f0-9]+)"/.exec(oldBundle)?.[1]; assert(oldHash);
  const oldMarkup = new Function('SINGLE_USD', 'BUNDLE_USD', 'SUPPLIER_DEMO_INPUT_SHA256', oldSource.replace(/^import[^\n]*\n/gm, '').replace('export const SUPPLIER_DEMO_HTML =', 'return '))(19, 39, oldHash)
    .replace('/assets/supplier-demo.js?v=' + oldHash, '/assets/supplier-demo.js?v=' + SUPPLIER_DEMO_INPUT_SHA256);
  const legacyHtml = originalGuideHtml.replace(/<section id="supplier-demo"[\s\S]*?<\/section><script defer src="\/assets\/supplier-demo\.js[^>]*><\/script>/, oldMarkup);
  assert(!legacyHtml.includes('id="supplier-demo-csv-statement"'), 'Compatibility control must contain actual preserved old markup');
  const oldPage = await context.newPage(); oldPage.on('pageerror', error => evidence.page_errors.push('old_markup: ' + error.message));
  try {
    await oldPage.route(origin + guide, route => route.fulfill({ status: 200, contentType: 'text/html', body: legacyHtml }));
    const legacyAsset = oldPage.waitForResponse(response => response.url().startsWith(origin + '/assets/supplier-demo.js?'));
    await oldPage.goto(origin + guide);
    assert.equal((await (await legacyAsset).body()).toString('utf8'), SUPPLIER_DEMO_JAVASCRIPT, 'Old-markup control must execute the new bundle, never a cached old script');
    await oldPage.locator('#supplier-demo-summary').filter({ hasText: '5 statement records; 4 AP ledger records' }).waitFor();
    assert.equal(await oldPage.locator('#supplier-demo-csv-statement').count(), 0);
    await oldPage.selectOption('#supplier-demo-preset', 'agreement');
    assert.equal(JSON.parse(await oldPage.locator('#supplier-demo-output').textContent()).summary.matched_group_count, 1);
    await oldPage.locator('#supplier-demo-input').fill('{'); await oldPage.locator('#supplier-demo-form button[type=submit]').click();
    assert(await oldPage.locator('#supplier-demo-csv').isDisabled()); assert.equal(await oldPage.evaluate(() => localStorage.length + sessionStorage.length + window.__qaStorageWrites), 0);
  } finally { await oldPage.close(); }
  recordCheck('Actual preserved-old-markup compatibility', 'Preserved firstrelease markup withoutCSVcontrols runs the new generated bundle, presets and invalid-input clearing in a real second page');

  await upload(); await waitImported();
  return { csv_cases: 13, synthetic_csv_values_uploaded: false, core_changed: false };
}
