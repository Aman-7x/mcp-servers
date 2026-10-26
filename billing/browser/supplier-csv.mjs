// Browser CSV transport only. The caller supplies the actual product schema.
// No accounting comparison, normalization or validation rule is duplicated here.
export const CSV_MAX_COMBINED_BYTES = 2 * 1024 * 1024;
export const CSV_MAX_EDITOR_BYTES = 2 * 1024 * 1024;
export const CSV_MAX_RECORDS_PER_SIDE = 1000;
export const CSV_REQUIRED_COLUMNS = ['record_id', 'entity_id', 'supplier_id', 'currency', 'document_type', 'document_reference', 'document_date', 'outstanding_minor'];
const columns = new Set(CSV_REQUIRED_COLUMNS);
const bytes = text => new TextEncoder().encode(text).byteLength;
const template = rows => CSV_REQUIRED_COLUMNS.join(',') + '\r\n' + rows.join('\r\n') + '\r\n';
export const CSV_TEMPLATE_AS_OF = '2026-10-26';
export const STATEMENT_CSV_TEMPLATE = template([
  'S1,ENTITY-1,SUPPLIER-1,USD,invoice,INV-001,2026-10-01,10000',
  'S2,ENTITY-1,SUPPLIER-1,USD,invoice,INV-002,2026-10-01,10000',
  'S3,ENTITY-1,SUPPLIER-1,USD,invoice,INV-003,2026-10-01,10000',
  'S4,ENTITY-1,SUPPLIER-1,USD,invoice,INV-005,2026-10-01,10000',
  'S5,ENTITY-1,SUPPLIER-1,USD,invoice,INV-005,2026-10-01,10000',
]);
export const LEDGER_CSV_TEMPLATE = template([
  'L1,ENTITY-1,SUPPLIER-1,USD,invoice,INV-001,2026-10-01,10000',
  'L2,ENTITY-1,SUPPLIER-1,USD,invoice,INV-002,2026-10-02,12000',
  'L4,ENTITY-1,SUPPLIER-1,USD,invoice,INV-004,2026-10-01,10000',
  'L5,ENTITY-1,SUPPLIER-1,USD,invoice,INV-005,2026-10-01,10000',
]);

function wellFormed(text) {
  if (typeof text !== 'string') throw Error('CSV input must be UTF-8 text.');
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = text.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw Error('CSV text contains an unpaired Unicode surrogate.');
    } else if (unit >= 0xdc00 && unit <= 0xdfff) throw Error('CSV text contains an unpaired Unicode surrogate.');
  }
}

export function decodeSupplierCsvUtf8(buffer) {
  const view = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  if (!(view instanceof Uint8Array)) throw Error('CSV file must supply bytes.');
  if (view.byteLength > CSV_MAX_COMBINED_BYTES) throw Error('The two CSV files together may contain at most 2 MiB.');
  try {
    // Keep the BOM visible so exactly one optional initial BOM is handled below.
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(view);
  } catch { throw Error('CSV file is not valid UTF-8. Export UTF-8 CSV; no rows were imported.'); }
}

function parseRows(raw, side) {
  wellFormed(raw);
  let text = raw.startsWith('\uFEFF') ? raw.slice(1) : raw;
  let headers = null, values = [], field = '', state = 'start';
  const records = [];
  function append(ch) {
    field += ch;
    if (field.length > (headers ? 160 : 32)) throw Error(`${side} CSV ${headers ? 'field exceeds 160 characters' : 'header exceeds 32 characters'}.`);
  }
  function finishField() {
    if (values.length >= CSV_REQUIRED_COLUMNS.length) throw Error(`${side} CSV has more than eight columns.`);
    values.push(field); field = ''; state = 'start';
  }
  function finishRecord() {
    if (!headers) {
      if (new Set(values).size !== values.length) throw Error(`${side} CSV has duplicate headers.`);
      if (values.some(value => !columns.has(value))) throw Error(`${side} CSV has an unknown header. Use the exact required names.`);
      const missing = CSV_REQUIRED_COLUMNS.filter(name => !values.includes(name));
      if (missing.length) throw Error(`${side} CSV is missing required headers: ${missing.join(', ')}.`);
      headers = values;
    } else {
      if (values.length !== headers.length) throw Error(`${side} CSV row ${records.length + 1} has ${values.length} columns; expected ${headers.length}. Blank rows are not skipped.`);
      if (records.length >= CSV_MAX_RECORDS_PER_SIDE) throw Error(`${side} CSV exceeds 1,000 records. No rows were imported.`);
      const record = Object.fromEntries(headers.map((name, index) => [name, values[index]]));
      if (!/^[1-9][0-9]*$/.test(record.outstanding_minor) || !Number.isSafeInteger(Number(record.outstanding_minor))) throw Error(`${side} CSV row ${records.length + 1}: outstanding_minor must be positive safe integer decimal digits without signs, spaces, leading zeros or decimal points.`);
      record.outstanding_minor = Number(record.outstanding_minor);
      records.push(record);
    }
    values = [];
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (state === 'quoted') {
      if (ch === '"') {
        if (text[i + 1] === '"') { append('"'); i++; } else state = 'closed';
      } else append(ch);
    } else if (ch === ',' || ch === '\r' || ch === '\n') {
      finishField();
      if (ch !== ',') { finishRecord(); if (ch === '\r' && text[i + 1] === '\n') i++; }
    } else if (state === 'closed') throw Error(`${side} CSV contains text after a closing quote. No rows were imported.`);
    else if (ch === '"') {
      if (state !== 'start') throw Error(`${side} CSV contains a quote in an unquoted field. No rows were imported.`);
      state = 'quoted';
    } else { append(ch); state = 'plain'; }
  }
  if (state === 'quoted') throw Error(`${side} CSV has an unterminated quoted field. No rows were imported.`);
  if (state !== 'start' || values.length || field.length) { finishField(); finishRecord(); }
  if (!headers) throw Error(`${side} CSV must start with the exact required header row.`);
  return records;
}

export function supplierCsvEditorText(input) {
  let json = JSON.stringify(input, null, 2);
  if (bytes(json) > CSV_MAX_EDITOR_BYTES) json = JSON.stringify(input);
  if (bytes(json) > CSV_MAX_EDITOR_BYTES) throw Error('The two CSVs expand beyond the 2 MiB JSON editor limit. Use a smaller complete batch; no rows were imported.');
  return json;
}

export function parseSupplierCsvPair({ as_of, statement_csv, ledger_csv }, validate) {
  if (typeof validate !== 'function') throw Error('The actual product schema validator is required.');
  wellFormed(statement_csv); wellFormed(ledger_csv);
  if (statement_csv.length + ledger_csv.length > CSV_MAX_COMBINED_BYTES || bytes(statement_csv) + bytes(ledger_csv) > CSV_MAX_COMBINED_BYTES) throw Error('The two CSV files together may contain at most 2 MiB. No rows were imported.');
  const statement_records = parseRows(statement_csv, 'Statement');
  const ledger_records = parseRows(ledger_csv, 'AP ledger');
  // The complete pair is accepted once, after transport parsing, by the same
  // schema the installed MCP server uses. No partial side is ever returned.
  const input = validate({ as_of, statement_records, ledger_records, save: false });
  supplierCsvEditorText(input);
  return input;
}

export function parseSupplierCsvBuffers({ as_of, statement_bytes, ledger_bytes }, validate) {
  const size = value => value instanceof ArrayBuffer ? value.byteLength : value instanceof Uint8Array ? value.byteLength : NaN;
  const total = size(statement_bytes) + size(ledger_bytes);
  if (!Number.isSafeInteger(total)) throw Error('Both CSV files must supply bytes.');
  if (total > CSV_MAX_COMBINED_BYTES) throw Error('The two CSV files together may contain at most 2 MiB. No rows were imported.');
  return parseSupplierCsvPair({ as_of, statement_csv: decodeSupplierCsvUtf8(statement_bytes), ledger_csv: decodeSupplierCsvUtf8(ledger_bytes) }, validate);
}
