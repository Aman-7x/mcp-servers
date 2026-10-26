// Exercise the shipped browser bundle with DOM sinks and privacy APIs instrumented.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { SUPPLIER_DEMO_JAVASCRIPT } from '../src/supplier-demo-bundle.js';

function browserHarness() {
  const nodes = new Map(), created = [], downloads = [], revoked = [], privacy = [];
  class Element {
    constructor(tag = 'div') { this.tag = tag; this.children = []; this.dataset = {}; this.events = new Map(); this.value = ''; this.disabled = false; this.textContent = ''; }
    set innerHTML(_) { throw Error('Unsafe HTML sink used'); }
    addEventListener(name, listener) { this.events.set(name, listener); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    click() { downloads.push({ href: this.href, name: this.download }); }
    emit(name) { this.events.get(name)?.({ preventDefault() {} }); }
  }
  const document = { getElementById(id) { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); }, createElement(tag) { const el = new Element(tag); created.push(el); return el; } };
  const denied = name => { privacy.push(name); throw Error('Forbidden privacy API: ' + name); };
  const context = { document, TextEncoder, Blob, URL: { createObjectURL(blob) { downloads.blob = blob; return 'blob:local-test'; }, revokeObjectURL(value) { revoked.push(value); } }, setTimeout(callback) { callback(); }, fetch() { return denied('fetch'); }, XMLHttpRequest() { return denied('XMLHttpRequest'); }, WebSocket() { return denied('WebSocket'); }, EventSource() { return denied('EventSource'); }, navigator: { sendBeacon() { return denied('sendBeacon'); } } };
  for (const name of ['localStorage', 'sessionStorage', 'indexedDB']) Object.defineProperty(context, name, { get() { return denied(name); } });
  runInNewContext(SUPPLIER_DEMO_JAVASCRIPT, context, { timeout: 10000 });
  const get = name => nodes.get('supplier-demo-' + name);
  const input = value => { get('input').value = typeof value === 'string' ? value : JSON.stringify(value); get('input').emit('input'); };
  const submit = () => get('form').emit('submit');
  return { get, input, submit, created, downloads, revoked, privacy };
}

test('supplier demo shipped engine computes all five synthetic outcomes without privacy API use', () => {
  const b = browserHarness(), report = JSON.parse(b.get('output').textContent);
  assert.equal(report.summary.statement_record_count, 5); assert.equal(report.summary.ledger_record_count, 4);
  assert.equal(report.summary.matched_group_count, 1); assert.equal(report.summary.review_group_count, 4);
  assert.deepEqual(new Set(report.groups.map(g => g.status)), new Set(['matched', 'discrepancy', 'only_in_statement', 'only_in_ledger', 'ambiguous_reference']));
  assert.equal(b.get('csv').disabled, false); assert.deepEqual(b.privacy, []); assert.equal(b.downloads.length, 0);
});

test('supplier demo immediately clears stale evidence and disables exports after any edit or rejected run', () => {
  const b = browserHarness();
  for (const invalid of ['{', 'null', '{}', JSON.stringify({ ...JSON.parse(b.get('input').value), save: true })]) {
    b.input(invalid);
    assert.equal(b.get('output').textContent, ''); assert.equal(b.get('summary').textContent, ''); assert.equal(b.get('groups').children.length, 0); assert.equal(b.get('csv').disabled, true);
    b.submit(); assert.equal(b.get('status').dataset.status, 'invalid'); assert.equal(b.get('csv').disabled, true); assert.equal(b.get('output').textContent, '');
  }
  assert.deepEqual(b.privacy, []);
});

test('supplier demo treats hostile source strings as text and exports formula-safe complete CSV', async () => {
  const b = browserHarness(), value = JSON.parse(b.get('input').value);
  value.statement_records[0].document_reference = '=HYPERLINK("https://example.invalid","<img onerror=alert(1)>")';
  value.statement_records[0].entity_id = '<svg onload=alert(1)>';
  b.input(value); b.submit();
  assert.equal(b.get('csv').disabled, false);
  const report = JSON.parse(b.get('output').textContent);
  assert.equal(report.statement_records[0].document_reference, value.statement_records[0].document_reference);
  assert.equal(report.statement_records[0].entity_id, value.statement_records[0].entity_id);
  b.get('csv').emit('click');
  assert.equal(b.downloads.length, 1); assert.equal(b.downloads[0].href, 'blob:local-test'); assert.match(b.downloads[0].name, /evidence\.csv$/);
  const csv = await b.downloads.blob.text();
  assert.equal(csv.split('\r\n').length, 11); assert.match(csv, /"'=HYPERLINK/); assert.match(csv, /<svg onload=alert\(1\)>/);
  assert.deepEqual(b.revoked, ['blob:local-test']); assert.deepEqual(b.privacy, []);
});

test('supplier demo rejects oversized JSON before retaining any earlier report', () => {
  const b = browserHarness(); b.input(' '.repeat(2 * 1024 * 1024 + 1)); b.submit();
  assert.match(b.get('status').textContent, /2 MiB/); assert.equal(b.get('csv').disabled, true); assert.equal(b.get('output').textContent, ''); assert.deepEqual(b.privacy, []);
});
