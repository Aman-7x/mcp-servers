import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInvoiceCsv, CSV_REQUIRED_COLUMNS, CSV_OPTIONAL_COLUMNS, CSV_TEMPLATE, CSV_MAX_FILE_BYTES } from '../browser/duplicate-csv.mjs';
import { checkSchema, check } from '../../servers/duplicate-invoice-check/dist/core.js';

const validate = value => checkSchema.parse(value);
const parse = text => parseInvoiceCsv(text, validate);
const record = (id = 'R1', changes = {}) => ({ record_id: id, entity_id: 'ENTITY-1', supplier_id: 'SUPPLIER-1', document_type: 'invoice', invoice_number: 'INV-001', invoice_date: '2026-10-16', currency: 'USD', total_minor: 10000, ...changes });
const quote = value => '"' + String(value).replaceAll('"', '""') + '"';
const csv = (records, columns = CSV_REQUIRED_COLUMNS, delimiter = '\n') => columns.join(',') + delimiter + records.map(r => columns.map(c => quote(r[c] ?? '')).join(',')).join(delimiter) + delimiter;

test('the CSV sample produces the same complete four-record comparison evidence', () => {
  const input = parse(CSV_TEMPLATE);
  assert.equal(input.save, false);
  const report = check(input);
  assert.deepEqual(report.summary, { record_count: 4, candidate_record_count: 4, unflagged_record_count: 0, group_count: 3, group_memberships: 8 });
  assert.equal(report.records[2].invoice_number, 'inv /001');
});

test('CSV quoted commas and escaped quotes preserve Unicode and leading-zero source identifiers', () => {
  const r = record('00001', { entity_id: '001', supplier_id: 'é-００１', invoice_number: 'inv, "é-００1"', entity_label: 'Entity, One', supplier_label: 'Fournisseur "é", S.A.' });
  const columns = [...CSV_REQUIRED_COLUMNS, ...CSV_OPTIONAL_COLUMNS];
  assert.deepEqual(parse(csv([r], columns)).records, [r]);
});

test('CSV header order, UTF-8 BOM and LF CRLF or CR record endings preserve exact fields', () => {
  const r = record('00001');
  const columns = [...CSV_REQUIRED_COLUMNS].reverse();
  for (const delimiter of ['\n', '\r\n', '\r']) assert.deepEqual(parse('\uFEFF' + csv([r], columns, delimiter)).records, [r]);
  assert.deepEqual(parse(csv([r]).trimEnd()).records, [r]);
});

test('CSV requires exact complete unique known headers without automatic mapping', () => {
  const columns = CSV_REQUIRED_COLUMNS;
  for (const wrong of [columns.slice(1), [...columns, 'record_id'], [...columns, 'amount'], columns.map(c => c === 'record_id' ? 'Record_ID' : c), columns.map(c => c === 'record_id' ? ' record_id' : c), [...columns, '__proto__'], [...columns, 'constructor']]) assert.throws(() => parse(csv([record()], wrong)), /header|column/i);
  assert.throws(() => parse(''), /header/);
  assert.throws(() => parse('\uFEFF'), /header/);
  assert.throws(() => parse('\uFEFF\uFEFF' + CSV_TEMPLATE), /header/);
});

test('CSV malformed quotes are rejected without a partially accepted batch', () => {
  const header = CSV_REQUIRED_COLUMNS.join(',') + '\n';
  for (const ref of ['INV"001', '"INV-001', '"INV"x', '"INV" ', '"INV""']) {
    const text = header + `R1,ENTITY-1,SUPPLIER-1,invoice,${ref},2026-10-16,USD,10000\n`;
    assert.throws(() => parse(text), /quote|unterminated/i);
  }
});

test('CSV preserves embedded newlines during parsing and the product rejects control-bearing fields', () => {
  for (const value of ['inv\n001', 'inv\r\n001', 'inv\r001', 'inv\t001', 'inv\0' + '001']) {
    let seen;
    assert.throws(() => parseInvoiceCsv(csv([record('R1', { invoice_number: value })]), input => { seen = input.records[0].invoice_number; return validate(input); }));
    assert.equal(seen, value);
  }
});

test('CSV rejects ragged and blank internal rows rather than skipping or truncating them', () => {
  const valid = csv([record()]);
  for (const bad of [valid + '\n', valid + 'R2,ENTITY-1\n', valid.replace('"10000"\n', '"10000",extra\n'), valid + ',' + '\n']) assert.throws(() => parse(bad), /columns|Blank rows/);
  assert.equal(parse(valid).records.length, 1);
});

test('CSV totals accept only canonical positive safe decimal integers', () => {
  for (const total of ['0', '-1', '+1', '1.0', '1e3', '0x10', ' 1', '1 ', '001', '10,000', '9007199254740992', '', 'Infinity', 'NaN']) assert.throws(() => parse(csv([record('R1', { total_minor: total })])), /positive safe integer/);
  assert.equal(parse(csv([record('R1', { total_minor: Number.MAX_SAFE_INTEGER })])).records[0].total_minor, Number.MAX_SAFE_INTEGER);
});

test('CSV validates the complete batch with the actual product schema and never trims values', () => {
  for (const change of [{ invoice_date: '2026-02-30' }, { invoice_date: '10/16/2026' }, { currency: 'usd' }, { document_type: 'refund' }, { record_id: ' R1' }, { supplier_id: '' }, { invoice_number: ' INV-001' }]) assert.throws(() => parse(csv([record('R1', change)])));
  assert.throws(() => parse(csv([record(), record()])));
  const optional = [...CSV_REQUIRED_COLUMNS, 'entity_label'];
  assert.throws(() => parse(csv([record()], optional)));
  let calls = 0, seenLength = 0;
  assert.throws(() => parseInvoiceCsv(csv([record('R1'), record('R2', { invoice_date: 'bad' })]), input => { calls++; seenLength = input.records.length; return validate(input); }));
  assert.equal(calls, 1); assert.equal(seenLength, 2);
  assert.throws(() => parseInvoiceCsv(CSV_TEMPLATE), /validator is required/);
});

test('CSV accepts exactly 1000 records and rejects 1001 without truncation', () => {
  const records = Array.from({ length: 1001 }, (_, i) => record(String(i)));
  assert.equal(parse(csv(records.slice(0, 1000))).records.length, 1000);
  assert.throws(() => parse(csv(records)), /1,000-record limit/);
  assert.throws(() => parse(CSV_REQUIRED_COLUMNS.join(',') + '\n'));
});

test('CSV enforces UTF-8 byte size plus header field and column memory bounds', () => {
  for (const text of ['x'.repeat(CSV_MAX_FILE_BYTES + 1), 'é'.repeat(CSV_MAX_FILE_BYTES / 2 + 1)]) assert.throws(() => parse(text), /2 MiB/);
  assert.throws(() => parse('x'.repeat(33)), /header exceeds 32/);
  assert.throws(() => parse(csv([record('R1', { invoice_number: 'x'.repeat(201) })])), /200 characters/);
  assert.throws(() => parse('a,b,c,d,e,f,g,h,i,j,k\n'), /more than 10 columns/);
});
