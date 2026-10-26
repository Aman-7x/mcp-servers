import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { STATEMENT_CSV_TEMPLATE as STMT, LEDGER_CSV_TEMPLATE as LEDGER, CSV_TEMPLATE_AS_OF as AS_OF, CSV_REQUIRED_COLUMNS as COLS, CSV_MAX_COMBINED_BYTES as MAX } from '../browser/supplier-csv.mjs';
const bundle = await build({ absWorkingDir: fileURLToPath(new URL('../../', import.meta.url)), entryPoints: [fileURLToPath(new URL('../browser/supplier-demo.mjs', import.meta.url))], bundle: true, platform: 'browser', format: 'iife', target: ['es2022'], minify: true, write: false });
const js = bundle.outputFiles[0].text;
const encode = text => new TextEncoder().encode(text);
const buffer = text => encode(text).buffer;
const file = text => ({ size: encode(text).length, arrayBuffer: async () => buffer(text) });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const rowCsv = id => COLS.join(',') + '\n' + `${id},E,S,USD,invoice,NEW,2026-10-01,10000\n`;

function harness(withCsv = true) {
  const nodes = new Map(), privacy = [], downloads = [], blobs = [];
  class Element {
    constructor(name = '') { this.name = name; this.children = []; this.dataset = {}; this.events = new Map(); this.rawValue = ''; this.disabled = false; this.textContent = ''; this.files = []; this.scrollTop = 500; }
    get value() { return this.rawValue; }
    set value(value) { this.rawValue = value; if (value === '' && ['csv-statement', 'csv-ledger'].includes(this.name)) this.files = []; }
    set innerHTML(_) { throw Error('Unsafe HTML sink used'); }
    addEventListener(name, fn) { const list = this.events.get(name) || []; list.push(fn); this.events.set(name, list); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    querySelector(selector) { return this.name === 'preset' && selector.includes('custom') ? {} : null; }
    click() { downloads.push({ href: this.href, name: this.download }); }
    async emit(name) { await Promise.all((this.events.get(name) || []).map(fn => fn({ preventDefault() {} }))); }
  }
  for (const name of ['input', 'status', 'summary', 'groups', 'output', 'csv', 'form', 'preset', ...(withCsv ? ['csv-statement', 'csv-ledger', 'csv-as-of', 'csv-status', 'csv-sample', 'csv-statement-template', 'csv-ledger-template'] : [])]) nodes.set('supplier-demo-' + name, new Element(name));
  const document = { getElementById(id) { return nodes.get(id) || null; }, createElement() { return new Element(); } };
  const deny = name => { privacy.push(name); throw Error('Forbidden privacy API: ' + name); };
  const context = { document, TextEncoder, TextDecoder, ArrayBuffer, Uint8Array, Blob, URL: { createObjectURL(blob) { blobs.push(blob); return 'blob:local-draft'; }, revokeObjectURL() {} }, setTimeout(fn) { fn(); }, fetch() { return deny('fetch'); }, XMLHttpRequest() { return deny('XMLHttpRequest'); }, WebSocket() { return deny('WebSocket'); }, EventSource() { return deny('EventSource'); }, navigator: { sendBeacon() { return deny('sendBeacon'); } } };
  for (const name of ['localStorage', 'sessionStorage', 'indexedDB']) Object.defineProperty(context, name, { get() { return deny(name); } });
  runInNewContext(js, context, { timeout: 10000 });
  const get = name => nodes.get('supplier-demo-' + name);
  const select = (statement = file(STMT), ledger = file(LEDGER), date = AS_OF) => { get('csv-statement').files = [statement]; get('csv-ledger').files = [ledger]; get('csv-as-of').value = date; };
  const report = () => JSON.parse(get('output').textContent);
  return { get, select, report, privacy, downloads, blobs };
}

test('two actual CSV byte buffers replace the editor only after the complete pair passes', async () => {
  const b = harness(); b.select(); await b.get('csv-ledger').emit('change');
  assert.equal(b.report().summary.statement_record_count, 5); assert.equal(b.report().summary.ledger_record_count, 4); assert.equal(b.report().summary.review_group_count, 4);
  assert.equal(JSON.parse(b.get('input').value).as_of, AS_OF); assert.equal(b.get('input').scrollTop, 0); assert.equal(b.get('csv').disabled, false); assert.match(b.get('csv-status').textContent, /No rows skipped/); assert.deepEqual(b.privacy, []);
});

test('one file or missing date clears every stale result without reading a partial pair', async () => {
  const b = harness(); let reads = 0; const source = { size: 100, async arrayBuffer() { reads++; return buffer(STMT); } };
  b.get('csv-statement').files = [source]; b.get('csv-as-of').value = AS_OF; await b.get('csv-statement').emit('change');
  assert.equal(reads, 0); assert.equal(b.get('input').value, ''); assert.equal(b.get('output').textContent, ''); assert.equal(b.get('groups').children.length, 0); assert.equal(b.get('csv').disabled, true);
  b.select(source, source, ''); await b.get('csv-ledger').emit('change'); assert.equal(reads, 0);
});

test('a later two-file selection wins even when both older reads finish afterward', async () => {
  const b = harness(), a = deferred(), c = deferred();
  b.select({ size: 100, arrayBuffer: () => a.promise }, { size: 100, arrayBuffer: () => c.promise });
  const older = b.get('csv-statement').emit('change');
  assert.equal(b.get('csv').disabled, true); assert.equal(b.get('output').textContent, '');
  b.select(file(rowCsv('NEW-S')), file(rowCsv('NEW-L'))); await b.get('csv-ledger').emit('change');
  assert.equal(b.report().statement_records[0].record_id, 'NEW-S');
  a.resolve(buffer(STMT)); c.resolve(buffer(LEDGER)); await older;
  assert.equal(b.report().statement_records[0].record_id, 'NEW-S'); assert.equal(b.report().ledger_records[0].record_id, 'NEW-L'); assert.equal(b.report().summary.matched_group_count, 1);
});

test('editing JSON or selecting a preset invalidates pending file reads and keeps current evidence honest', async () => {
  for (const cancel of ['json', 'preset']) {
    const b = harness(), original = b.get('input').value, a = deferred(), c = deferred();
    b.select({ size: 100, arrayBuffer: () => a.promise }, { size: 100, arrayBuffer: () => c.promise });
    const older = b.get('csv-statement').emit('change');
    if (cancel === 'json') { b.get('input').value = original; await b.get('input').emit('input'); assert.equal(b.get('output').textContent, ''); }
    else { b.get('preset').value = 'agreement'; await b.get('preset').emit('change'); assert.equal(b.report().summary.matched_group_count, 1); }
    a.resolve(buffer(rowCsv('OLD-S'))); c.resolve(buffer(rowCsv('OLD-L'))); await older;
    assert.equal(b.get('csv-statement').files.length, 0); assert.equal(b.get('csv-ledger').files.length, 0);
    if (cancel === 'json') { assert.equal(b.get('input').value, original); assert.equal(b.get('output').textContent, ''); assert.equal(b.get('csv').disabled, true); }
    else { assert.equal(b.report().statement_records[0].record_id, 'S1'); assert.equal(b.report().summary.statement_record_count, 1); }
    assert.deepEqual(b.privacy, []);
  }
});

test('date input cancels pending evidence immediately and a committed date rechecks the complete pair', async () => {
  const b = harness(), a = deferred(), c = deferred();
  b.select({ size: 100, arrayBuffer: () => a.promise }, { size: 100, arrayBuffer: () => c.promise });
  const older = b.get('csv-statement').emit('change');
  b.get('csv-as-of').value = '2026-10-27'; await b.get('csv-as-of').emit('input');
  assert.equal(b.get('input').value, ''); assert.equal(b.get('output').textContent, ''); assert.equal(b.get('csv').disabled, true);
  a.resolve(buffer(STMT)); c.resolve(buffer(LEDGER)); await older;
  assert.equal(b.get('output').textContent, '');
  await b.get('csv-as-of').emit('change'); assert.equal(b.report().as_of, '2026-10-27');
});

test('invalid second file or malformed UTF-8 clears the complete pair and exposes no partial source', async () => {
  for (const ledger of [file('bad,header\n'), { size: 1, async arrayBuffer() { return new Uint8Array([0x80]).buffer; } }]) {
    const b = harness(); b.select(file(STMT), ledger); await b.get('csv-ledger').emit('change');
    assert.equal(b.get('input').value, ''); assert.equal(b.get('output').textContent, ''); assert.equal(b.get('csv').disabled, true); assert.equal(b.get('status').dataset.status, 'invalid'); assert.match(b.get('csv-status').textContent, /No rows were imported/); assert.deepEqual(b.privacy, []);
  }
});

test('combined file metadata limits fail before either byte reader runs', async () => {
  const b = harness(); let reads = 0;
  const source = size => ({ size, async arrayBuffer() { reads++; return buffer(STMT); } });
  b.select(source(MAX), source(1)); await b.get('csv-ledger').emit('change');
  assert.equal(reads, 0); assert.equal(b.get('csv').disabled, true); assert.match(b.get('status').textContent, /2 MiB/);
});

test('synthetic template imports and downloads remain local and JSON-only cached markup still works', async () => {
  const b = harness(); await b.get('csv-sample').emit('click');
  assert.equal(b.report().summary.group_count, 5); assert.equal(b.get('csv-as-of').value, AS_OF);
  await b.get('csv-statement-template').emit('click'); await b.get('csv-ledger-template').emit('click');
  assert.deepEqual(b.downloads.map(x => x.name), ['supplier-statement-synthetic.csv', 'ap-ledger-synthetic.csv']);
  assert.equal(await b.blobs[0].text(), STMT); assert.equal(await b.blobs[1].text(), LEDGER); assert.deepEqual(b.privacy, []);
  const old = harness(false); assert.equal(old.report().summary.group_count, 5);
  old.get('preset').value = 'agreement'; await old.get('preset').emit('change'); assert.equal(old.report().summary.matched_group_count, 1);
  old.get('input').value = '{'; await old.get('input').emit('input'); await old.get('form').emit('submit'); assert.equal(old.get('csv').disabled, true); assert.deepEqual(old.privacy, []);
});
