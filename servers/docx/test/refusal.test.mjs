import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { localClient } from './refusal-client.mjs';
test('free agreement and template fill caps are errors; normal branded document creation succeeds', async () => { const c = await localClient(); try {
    await c.call('business_set', { name: 'Synthetic Business', default_currency: 'USD' });
    for (let i = 0; i < 3; i++) {
        const r = await c.call('proposal_create', { client: `Synthetic Client ${i}`, project_title: `Synthetic Job ${i}`, summary: 'Synthetic summary', scope: ['One'], deliverables: ['One'], price: { amount: 100 } });
        assert(!r.isError, r.text);
    }
    const denied = await c.call('proposal_create', { client: 'Fourth', project_title: 'Fourth', summary: 'Synthetic', price: { amount: 100 } });
    assert.equal(denied.isError, true);
    assert.match(denied.text, /free tier allows 3/i);
    const contract = await c.call('contract_create', { client: 'Fourth', services: 'Synthetic services', start_date: '2026-10-16', fee: { amount: 100, schedule: 'monthly' } });
    assert.equal(contract.isError, true, contract.text);
    const path = join(c.dir, 'template.docx');
    const doc = await c.call('doc_create', { title: 'Synthetic template', out_path: path, sections: [{ paragraphs: [Array.from({ length: 11 }, (_, i) => `{{field${i}}}`).join(' ')] }] });
    assert(!doc.isError, doc.text);
    assert.match(doc.text, /Pro feature/);
    const preview = await c.call('doc_fill_template', { template_path: path });
    assert(!preview.isError, preview.text);
    assert.match(preview.text, /11 placeholders/);
    const out = join(c.dir, 'filled.docx');
    const filled = await c.call('doc_fill_template', { template_path: path, out_path: out, values: Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`field${i}`, String(i)])) });
    assert.equal(filled.isError, true);
    assert(!existsSync(out));
}
finally {
    await c.close();
} });
