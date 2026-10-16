import test from 'node:test';
import assert from 'node:assert/strict';
import { localClient } from './refusal-client.mjs';
test('free multi-refresh and add caps refuse, while truncated manual history succeeds', async () => { const c = await localClient(); try {
    for (let i = 1; i <= 3; i++) {
        const r = await c.call('price_add_manual', { url: `https://example.invalid/p${i}`, price: '10.00', currency: 'USD' });
        assert(!r.isError, r.text);
    }
    const refresh = await c.call('watch_refresh', { all: true });
    assert.equal(refresh.isError, true);
    assert.match(refresh.text, /Pro feature/);
    for (const name of ['price_add_manual', 'watch_add']) {
        const args = name === 'watch_add' ? { url: 'https://example.invalid/p4' } : { url: 'https://example.invalid/p4', price: '12.00' };
        const denied = await c.call(name, args);
        assert.equal(denied.isError, true);
        assert.match(denied.text, /free tier tracks 3/i);
    }
    for (let i = 0; i < 31; i++)
        assert(!(await c.call('price_add_manual', { url: 'https://example.invalid/p1', price: String(20 + i), currency: 'USD' })).isError);
    const history = await c.call('price_history', { url: 'https://example.invalid/p1' });
    assert(!history.isError, history.text);
    assert.match(history.text, /Pro feature/);
    assert.match(history.text, /20|21|22|30/);
}
finally {
    await c.close();
} });

test('watch_add racing with a filled free quota refuses before storing the fetched watch', async () => {
  const { createServer } = await import('node:http');
  let respond;
  let requestArrived;
  const arrived = new Promise(resolve => { requestArrived = resolve; });
  const shop = createServer((_request, response) => { respond = response; requestArrived(); });
  await new Promise(resolve => shop.listen(0, '127.0.0.1', resolve));
  const c = await localClient();
  try {
    for (let i = 0; i < 2; i++) assert(!(await c.call('price_add_manual', { url: `https://example.invalid/race${i}`, price: '10.00' })).isError);
    const url = `http://127.0.0.1:${shop.address().port}/product`;
    const pending = c.call('watch_add', { url });
    await Promise.race([arrived, new Promise((_, reject) => setTimeout(() => reject(new Error('local fixture request timeout')), 5000).unref())]);
    assert(!(await c.call('price_add_manual', { url: 'https://example.invalid/race2', price: '10.00' })).isError);
    respond.writeHead(200, { 'content-type': 'text/html' });
    respond.end('<html><head><title>Synthetic Product</title><script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Synthetic Product","offers":{"@type":"Offer","price":"10.00","priceCurrency":"USD"}}</script></head><body>Synthetic Product</body></html>');
    const result = await pending;
    assert.equal(result.isError, true);
    assert.match(result.text, /free tier tracks 3 items/);
    assert.doesNotMatch((await c.call('watch_list')).text, /Synthetic Product/);
  } finally {
    respond?.end();
    await c.close();
    await new Promise(resolve => shop.close(resolve));
  }
});
