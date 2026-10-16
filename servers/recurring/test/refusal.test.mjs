import test from 'node:test';
import assert from 'node:assert/strict';
import { localClient } from './refusal-client.mjs';
test('free schedule create/resume/history refusals are errors; downgraded rules and forecast succeed', async () => { const c = await localClient(); try {
    const mk = async (n) => c.call('schedule_create', { client: `Synthetic Client ${n}`, items: [{ description: 'Synthetic retainer', quantity: 1, unit_price: 100 }], currency: 'USD', every: 'monthly', start_date: '2026-01-10', anchor_day: 31 });
    const first = await mk(1);
    assert(!first.isError, first.text);
    assert.match(first.text, /Pro rules/);
    assert.match(first.text, /Created schedule/);
    const id = first.text.match(/Created schedule ([0-9a-f]+)/)?.[1];
    assert(id);
    for (let i = 2; i <= 3; i++)
        assert(!(await mk(i)).isError);
    const cap = await mk(4);
    assert.equal(cap.isError, true);
    assert.match(cap.text, /free tier allows 3/i);
    assert.equal((await c.call('schedule_history', { id })).isError, true);
    assert(!(await c.call('schedule_pause', { id })).isError);
    assert(!(await mk(4)).isError);
    const resume = await c.call('schedule_resume', { id });
    assert.equal(resume.isError, true);
    assert.match(resume.text, /Resuming would make 4/);
    const forecast = await c.call('forecast', { months: 12 });
    assert(!forecast.isError, forecast.text);
    assert.match(forecast.text, /Pro feature/);
    assert.equal(JSON.parse(forecast.text).months, 3);
}
finally {
    await c.close();
} });
