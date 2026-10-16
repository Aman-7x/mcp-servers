import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import worker from '../src/index.js';
import { DUPLICATE_DEMO_INPUT_SHA256, DUPLICATE_DEMO_JAVASCRIPT } from '../src/duplicate-demo-bundle.js';

test('duplicate-reference buyer proof serves the actual comparison core with fresh provenance', async () => {
  const hash = createHash('sha256');
  for (const file of ['servers/duplicate-invoice-check/src/core.ts', 'billing/browser/duplicate-demo.mjs', 'billing/browser/duplicate-csv.mjs']) {
    hash.update(file); hash.update(readFileSync(new URL('../../' + file, import.meta.url)));
  }
  assert.equal(hash.digest('hex'), DUPLICATE_DEMO_INPUT_SHA256, 'Rebuild the browser asset after a core or UI edit');
  const ctx = { waitUntil() {} };
  const asset = await worker.fetch(new Request('https://mcp.zovo.one/assets/duplicate-demo.js?v=' + DUPLICATE_DEMO_INPUT_SHA256), {}, ctx);
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('content-type'), /javascript/);
  assert.equal(await asset.text(), DUPLICATE_DEMO_JAVASCRIPT);
  assert.ok(DUPLICATE_DEMO_JAVASCRIPT.includes('Third-party Zod license:'));
  const response = await worker.fetch(new Request('https://mcp.zovo.one/guides/check-duplicate-supplier-invoice-references-in-claude'), {}, ctx);
  assert.equal(response.status, 200);
  const guide = await response.text();
  assert.match(guide, /id="duplicate-demo-form"/);
  assert.match(guide, /id="duplicate-demo-csv-file"[^>]*type="file"/);
  assert.match(guide, /id="duplicate-demo-csv-sample"/);
  assert.ok(guide.includes('src="/assets/duplicate-demo.js?v=' + DUPLICATE_DEMO_INPUT_SHA256 + '"'), 'Script URL changes with the compiled input so cached older code cannot back the new markup');
  assert.match(guide, /same_amount_date/);
  assert.match(guide, /preserves leading zeros/i);
  assert.match(guide, /no recoverable or duplicate-payment amount/i);
  for (const href of ['/s/duplicate-invoice-check', '/downloads#duplicate-invoice-check', '/buy/duplicate-invoice-check?src=store.guide.duplicate-demo']) assert.ok(guide.includes(href));
  assert.doesNotMatch(guide, /confirmed duplicates found|unflagged records are safe to pay|guaranteed savings|prevents duplicate payment/i);
  const product = await worker.fetch(new Request('https://mcp.zovo.one/s/duplicate-invoice-check'), {}, ctx);
  const html = await product.text();
  const position = html.indexOf('#duplicate-demo');
  assert.ok(position >= 0 && position < html.indexOf('Install it in one click'), 'Editable proof appears before the install path');
  assert.doesNotMatch(html, /\/setup\/claude-web\/duplicate-invoice-check/);
});
