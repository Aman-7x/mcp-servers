// CSV transport only. The caller must supply the actual product schema validator;
// comparison and record validation rules are never reimplemented here.
export const CSV_MAX_FILE_BYTES = 2 * 1024 * 1024;
export const CSV_REQUIRED_COLUMNS = ['record_id', 'entity_id', 'supplier_id', 'document_type', 'invoice_number', 'invoice_date', 'currency', 'total_minor'];
export const CSV_OPTIONAL_COLUMNS = ['entity_label', 'supplier_label'];
const allowedColumns = new Set([...CSV_REQUIRED_COLUMNS, ...CSV_OPTIONAL_COLUMNS]);
export const CSV_TEMPLATE = CSV_REQUIRED_COLUMNS.join(',') + '\n' + [
  'R1,ENTITY-1,SUPPLIER-1,invoice,INV-001,2026-10-16,USD,10000',
  'R2,ENTITY-1,SUPPLIER-1,invoice,INV-001,2026-10-16,USD,10000',
  'R3,ENTITY-1,SUPPLIER-1,invoice,inv /001,2026-10-17,USD,15000',
  'R4,ENTITY-1,SUPPLIER-1,invoice,RENT-9,2026-10-16,USD,10000',
].join('\n') + '\n';

export function parseInvoiceCsv(text, validate) {
  if (typeof validate !== 'function') throw Error('The product schema validator is required.');
  if (typeof text !== 'string') throw Error('CSV input must be UTF-8 text.');
  if (text.length > CSV_MAX_FILE_BYTES || new TextEncoder().encode(text).byteLength > CSV_MAX_FILE_BYTES) throw Error('CSV text exceeds the 2 MiB file limit.');
  if (text.startsWith('\uFEFF')) text = text.slice(1);
  let headers = null, values = [], field = '', state = 'start';
  const records = [];
  const append = ch => {
    field += ch;
    if (field.length > (headers ? 200 : 32)) throw Error(headers ? 'CSV field exceeds the maximum product field length of 200 characters.' : 'CSV header exceeds 32 characters.');
  };
  const finishField = () => {
    if (values.length >= allowedColumns.size) throw Error('CSV has more than 10 columns.');
    values.push(field); field = ''; state = 'start';
  };
  const finishRecord = () => {
    if (!headers) {
      if (new Set(values).size !== values.length) throw Error('CSV has duplicate headers.');
      if (values.some(value => !allowedColumns.has(value))) throw Error('CSV has an unknown header. Use the exact required column names.');
      const missing = CSV_REQUIRED_COLUMNS.filter(name => !values.includes(name));
      if (missing.length) throw Error('CSV is missing required headers: ' + missing.join(', ') + '.');
      headers = values;
    } else {
      if (values.length !== headers.length) throw Error(`CSV record ${records.length + 1} has ${values.length} columns; expected ${headers.length}. Blank rows are not skipped.`);
      if (records.length >= 1000) throw Error('CSV exceeds the 1,000-record limit. No records were imported.');
      const record = Object.fromEntries(headers.map((name, i) => [name, values[i]]));
      if (!/^[1-9][0-9]*$/.test(record.total_minor) || !Number.isSafeInteger(Number(record.total_minor))) throw Error(`CSV record ${records.length + 1}: total_minor must be a positive safe integer written as decimal digits without spaces, signs, leading zeros or decimals.`);
      record.total_minor = Number(record.total_minor);
      records.push(record);
    }
    values = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (state === 'quoted') {
      if (ch === '"') {
        if (text[i + 1] === '"') { append('"'); i++; } else state = 'closed';
      } else append(ch);
      continue;
    }
    if (ch === ',' || ch === '\r' || ch === '\n') {
      finishField();
      if (ch !== ',') { finishRecord(); if (ch === '\r' && text[i + 1] === '\n') i++; }
    } else if (state === 'closed') throw Error('CSV contains text after a closing quote. No records were imported.');
    else if (ch === '"') {
      if (state !== 'start') throw Error('CSV contains a quote inside an unquoted field. No records were imported.');
      state = 'quoted';
    } else { append(ch); state = 'plain'; }
  }
  if (state === 'quoted') throw Error('CSV has an unterminated quoted field. No records were imported.');
  if (state !== 'start' || values.length || field.length) { finishField(); finishRecord(); }
  if (!headers) throw Error('CSV must start with the required header row.');
  // Return only after every row has parsed and the actual product schema accepts
  // the complete batch. This also rejects controls, dates, IDs and unknown types.
  return validate({ records, save: false });
}
