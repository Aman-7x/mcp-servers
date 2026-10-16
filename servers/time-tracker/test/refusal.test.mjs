import test from 'node:test';
import assert from 'node:assert/strict';
import { localClient } from './refusal-client.mjs';
test('free rate and entry caps are errors; useful clamped history remains success', async () => { const c = await localClient(); try {
    for (const project of ['Project Alpha', 'Project Beta'])
        assert(!((await c.call('project_set_rate', { project, hourly_rate: 50 })).isError));
    const rate = await c.call('project_set_rate', { project: 'Project Gamma', hourly_rate: 60 });
    assert.equal(rate.isError, true);
    assert.match(rate.text, /buy\/time-tracker/);
    for (let i = 0; i < 100; i++) {
        const r = await c.call('entry_add', { project: 'Project Alpha', start: new Date(Date.now() - i * 120000).toISOString(), minutes: 1 });
        assert(!r.isError, r.text);
    }
    for (const [name, args] of [['entry_add', { project: 'Project Alpha', start: new Date().toISOString(), minutes: 1 }], ['entry_log', { client: 'Project Alpha', minutes: 1 }]]) {
        const r = await c.call(name, args);
        assert.equal(r.isError, true);
        assert.match(r.text, /more than 100 stored entries/);
    }
    const partial = await c.call('entry_list', { from: '2020-01-01', limit: 100 });
    assert(!partial.isError, partial.text);
    assert.match(partial.text, /Pro feature/);
    assert.match(partial.text, /Project Alpha/);
}
finally {
    await c.close();
} });
