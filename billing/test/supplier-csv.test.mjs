import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSchema, check } from '../../servers/supplier-statement-check/dist/core.js';
import { CSV_REQUIRED_COLUMNS as COLS, CSV_MAX_COMBINED_BYTES as MAX, CSV_TEMPLATE_AS_OF as AS_OF, STATEMENT_CSV_TEMPLATE as STMT, LEDGER_CSV_TEMPLATE as LEDGER, parseSupplierCsvPair, parseSupplierCsvBuffers, decodeSupplierCsvUtf8, supplierCsvEditorText } from '../browser/supplier-csv.mjs';

const validate = value => checkSchema.parse(value);
const parse = (statement_csv = STMT, ledger_csv = LEDGER, as_of = AS_OF) => parseSupplierCsvPair({ as_of, statement_csv, ledger_csv }, validate);
const record = (record_id = 'R1', changes = {}) => ({ record_id, entity_id: 'ENTITY-1', supplier_id: 'SUPPLIER-1', currency: 'USD', document_type: 'invoice', document_reference: 'INV-001', document_date: '2026-10-01', outstanding_minor: 10000, ...changes });
const quote = value => '"' + String(value).replaceAll('"', '""') + '"';
const csv = (rows, columns = COLS, ending = '\r\n') => columns.join(',') + ending + rows.map(row => columns.map(name => quote(row[name] ?? '')).join(',')).join(ending) + (rows.length ? ending : '');
const encode = value => new TextEncoder().encode(value);

test('two templates yield the same nine original rows and all five group outcomes', () => {
  const input = parse(), report = check(input);
  assert.equal(input.as_of, AS_OF); assert.equal(input.save, false);
  assert.equal(input.statement_records.length, 5); assert.equal(input.ledger_records.length, 4);
  assert.equal(report.summary.group_count, 5); assert.equal(report.summary.matched_group_count, 1); assert.equal(report.summary.review_group_count, 4);
  assert.deepEqual(new Set(report.groups.map(g => g.status)), new Set(['matched', 'only_in_statement', 'only_in_ledger', 'discrepancy', 'ambiguous_reference']));
  assert.deepEqual(report.groups.find(g => g.status === 'discrepancy').issues, ['amount_mismatch', 'date_mismatch']);
});

test('quoted commas and quotes preserve exact Unicode identifiers and leading zeros on both sides', () => {
  const row = record('00001', { entity_id: '0002', supplier_id: 'é-供應商-００１', document_reference: 'INV, "é-００1"' });
  const input = parse(csv([row]), csv([row]));
  assert.deepEqual(input.statement_records, [row]); assert.deepEqual(input.ledger_records, [row]);
  assert.equal(check(input).summary.matched_group_count, 1);
  const unequal = parse(csv([row]), csv([{ ...row, document_reference: 'INV, "é-００1"' }]));
  assert.equal(check(unequal).summary.review_group_count, 2, 'No Unicode normalization');
});

test('header order and exactly one UTF-8 BOM preserve LF, CRLF and CR records without coercion', () => {
  for (const ending of ['\n', '\r\n', '\r']) {
    const a = '\uFEFF' + csv([record()], [...COLS].reverse(), ending);
    const input = parseSupplierCsvBuffers({ as_of: AS_OF, statement_bytes: encode(a), ledger_bytes: encode(csv([record()], COLS, ending)).buffer }, validate);
    assert.deepEqual(input.statement_records, [record()]); assert.deepEqual(input.ledger_records, [record()]);
  }
  assert.equal(parse(STMT.trimEnd(), LEDGER.trimEnd()).statement_records.length, 5);
  assert.throws(() => parse('\uFEFF\uFEFF' + STMT), /header/i);
});

test('fatal UTF-8 refuses corrupt sequences, UTF-16 files and unpaired string surrogates', () => {
  for (const bytes of [new Uint8Array([0xc3, 0x28]), new Uint8Array([0xed, 0xa0, 0x80]), new Uint8Array([0xff, 0xfe, 0x72, 0])]) assert.throws(() => decodeSupplierCsvUtf8(bytes), /valid UTF-8/);
  assert.throws(() => parse(STMT + '\ud800'), /surrogate/);
  assert.throws(() => parseSupplierCsvBuffers({ as_of: AS_OF, statement_bytes: encode(STMT), ledger_bytes: new Uint8Array([0x80]) }, validate), /valid UTF-8/);
  const padded = new Uint8Array(encode(STMT).length + 2); padded[0] = 0xff; padded.set(encode(STMT), 1); padded[padded.length - 1] = 0xff;
  assert.equal(parseSupplierCsvBuffers({ as_of: AS_OF, statement_bytes: padded.subarray(1, padded.length - 1), ledger_bytes: encode(LEDGER) }, validate).statement_records.length, 5);
});

test('each header must be exact, known, complete and unique', () => {
  for (const wrong of [COLS.slice(1), [...COLS, 'record_id'], [...COLS, 'balance'], COLS.map(x => x === 'record_id' ? 'Record_ID' : x), COLS.map(x => x === 'record_id' ? ' record_id' : x), [...COLS, '__proto__']]) assert.throws(() => parse(csv([record()], wrong)), /header|column/i);
  for (const empty of ['', '\uFEFF']) assert.throws(() => parse(empty), /header/);
  assert.throws(() => parse('x'.repeat(33)), /header exceeds32|header exceeds 32/);
});

test('malformed quotes and ragged or blank rows reject the entire pair', () => {
  const header = COLS.join(',') + '\n';
  for (const ref of ['INV"001', '"INV-001', '"INV"x', '"INV" ', '"INV""']) {
    const text = header + `R1,ENTITY-1,SUPPLIER-1,USD,invoice,${ref},2026-10-01,10000\n`;
    assert.throws(() => parse(text), /quote|unterminated/i);
  }
  for (const text of [STMT + '\n', STMT + 'R6,ENTITY-1\n', STMT.replace('10000\r\n', '10000,extra\r\n')]) assert.throws(() => parse(text), /columns|Blank rows/i);
});

test('amount transport accepts canonical positive safe digits only; IDs keep leading zeros', () => {
  for (const value of ['0', '-1', '+1', '1.0', '1e3', '0x10', ' 1', '1 ', '001', '10,000', '9007199254740992', '', 'Infinity', 'NaN', '١']) assert.throws(() => parse(csv([record('00001', { outstanding_minor: value })])), /positive safe integer/);
  assert.equal(parse(csv([record('00001', { outstanding_minor: Number.MAX_SAFE_INTEGER })])).statement_records[0].outstanding_minor, Number.MAX_SAFE_INTEGER);
});

test('the complete pair reaches the authoritative schema once, including invalid last rows', () => {
  let calls = 0, pair;
  assert.throws(() => parseSupplierCsvPair({ as_of: AS_OF, statement_csv: STMT, ledger_csv: csv([record('L1'), record('L2', { document_date: '2026-02-30' })]) }, value => { calls++; pair = value; return validate(value); }));
  assert.equal(calls, 1); assert.equal(pair.statement_records.length, 5); assert.equal(pair.ledger_records.length, 2);
  for (const change of [{ document_date: '10/01/2026' }, { currency: 'usd' }, { document_type: 'refund' }, { record_id: ' R1' }, { supplier_id: '' }, { document_reference: ' INV-001' }]) assert.throws(() => parse(csv([record('R1', change)])));
  for (const date of ['', '2026-02-30', '26/10/2026']) assert.throws(() => parse(STMT, LEDGER, date));
  assert.throws(() => parse(csv([record(), record()])));
  assert.throws(() => parseSupplierCsvPair({ as_of: AS_OF, statement_csv: STMT, ledger_csv: LEDGER }), /validator is required/);
});

test('quoted control-bearing values survive parsing then fail actual product rules', () => {
  for (const value of ['INV\n001', 'INV\r\n001', 'INV\t001', 'INV\0' + '001']) {
    let seen;
    assert.throws(() => parseSupplierCsvPair({ as_of: AS_OF, statement_csv: csv([record('R1', { document_reference: value })]), ledger_csv: LEDGER }, input => { seen = input.statement_records[0].document_reference; return validate(input); }));
    assert.equal(seen, value);
  }
});

test('a header-only side is valid when the other contains records; two empty sides are rejected', () => {
  const empty = COLS.join(',') + '\r\n';
  assert.equal(parse(empty).statement_records.length, 0); assert.equal(parse(STMT, empty).ledger_records.length, 0);
  assert.throws(() => parse(empty, empty));
});

test('each side accepts exactly1000 and refuses1001 records without truncation', () => {
  const rows = Array.from({ length: 1001 }, (_, i) => record(String(i)));
  const empty = COLS.join(',') + '\n';
  assert.equal(parse(csv(rows.slice(0, 1000)), empty).statement_records.length, 1000);
  assert.throws(() => parse(csv(rows), empty), /1,000 records/);
  assert.throws(() => parse(empty, csv(rows)), /1,000 records/);
});

test('combined raw limits count both byte streams before decoding or partial acceptance', () => {
  assert.throws(() => parse('x'.repeat(MAX), 'x'), /2 MiB/);
  assert.throws(() => parse('é'.repeat(MAX / 2), 'x'), /2 MiB/);
  assert.throws(() => parseSupplierCsvBuffers({ as_of: AS_OF, statement_bytes: new Uint8Array(MAX), ledger_bytes: new Uint8Array(1) }, validate), /2 MiB/);
  assert.throws(() => parse(csv([record('R1', { document_reference: 'x'.repeat(161) })])), /160 characters/);
});

test('pretty editor overflow falls back to compact JSON but overlarge compact input is rejected', () => {
  const make = (prefix, count, length) => Array.from({ length: count }, (_, i) => record(prefix + String(i).padStart(4, '0') + 'é'.repeat(length), { entity_id: 'é'.repeat(length), supplier_id: 'é'.repeat(length), document_reference: 'é'.repeat(length) }));
  const candidates = [80, 90, 100, 110, 120, 130, 140];
  let fallback, rejected;
  for (const length of candidates) {
    const input = { as_of: AS_OF, statement_records: make('S', 1000, length), ledger_records: make('L', 1000, length), save: false };
    const a = csv(input.statement_records), b = csv(input.ledger_records);
    if (encode(a).length + encode(b).length > MAX) continue;
    if (encode(JSON.stringify(input)).length > MAX) { rejected = { a, b }; continue; }
    if (encode(JSON.stringify(input, null, 2)).length > MAX) { fallback = { input, a, b }; }
  }
  assert(fallback, 'Need a real complete pair whose pretty JSON exceeds the bound');
  const parsed = parse(fallback.a, fallback.b), text = supplierCsvEditorText(parsed);
  assert.equal(text, JSON.stringify(parsed)); assert(encode(text).length <= MAX); assert.equal(JSON.parse(text).statement_records.length, 1000);
  assert(rejected, 'Need a raw-bounded pair whose complete compact JSON exceeds the editor bound');
  assert.throws(() => parse(rejected.a, rejected.b), /expand beyond/);
});
