import test from 'node:test';
import assert from 'node:assert/strict';
import { localClient } from './refusal-client.mjs';
test('invoice cap refuses both creators; business profile and branded PDF remain useful successes', async () => { const c = await localClient(); try {
    const biz = await c.call('business_set', { name: 'Synthetic Business', default_currency: 'USD', invoice_prefix: 'CUSTOM' });
    assert(!biz.isError, biz.text);
    assert.match(biz.text, /Pro feature/);
    for (let i = 0; i < 3; i++) {
        const r = await c.call('invoice_create', { client: 'Synthetic Client', items: [{ description: `Synthetic item ${i}`, quantity: 1, unit_price: 10 }], issue_date: '2026-04-10' });
        assert(!r.isError, r.text);
    }
    const denied = await c.call('invoice_create', { client: 'Synthetic Client', items: [{ description: 'Fourth', quantity: 1, unit_price: 10 }], issue_date: '2026-04-10' });
    assert.equal(denied.isError, true);
    assert.match(denied.text, /buy\/invoice/);
    const from = await c.call('invoice_from_hours', { client: 'Synthetic Client', hours: 1, rate: 10, issue_date: '2026-04-10' });
    assert.equal(from.isError, true, from.text);
    assert.match(from.text, /free tier allows 3 invoices/i);
    const pdf = await c.call('invoice_pdf', { number: 'INV-2026-0001' });
    assert(!pdf.isError, pdf.text);
    assert.match(pdf.text, /Pro feature/);
}
finally {
    await c.close();
} });
