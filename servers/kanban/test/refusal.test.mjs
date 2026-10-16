import test from 'node:test';
import assert from 'node:assert/strict';
import { localClient } from './refusal-client.mjs';
test('free board and open-task caps plus custom-columns refusal are errors; reads still work', async () => { const c = await localClient(); try {
    for (const project of ['Alpha', 'Beta', 'Gamma'])
        assert(!(await c.call('task_add', { title: `Synthetic ${project}`, project })).isError);
    const fourth = await c.call('task_add', { title: 'Synthetic Fourth', project: 'Delta' });
    assert.equal(fourth.isError, true);
    assert.match(fourth.text, /free tier keeps 3/i);
    const columns = await c.call('columns_set', { project: 'Alpha', columns: ['todo', 'doing', 'done'] });
    assert.equal(columns.isError, true, columns.text);
    assert.equal((await c.call('weekly_review', { week: '2020-W02' })).isError, true);
    for (let i = 0; i < 197; i++) {
        const r = await c.call('task_add', { title: `Synthetic task ${i}`, project: 'Alpha' });
        assert(!r.isError, r.text);
    }
    const cap = await c.call('task_add', { title: 'Synthetic overflow', project: 'Alpha' });
    assert.equal(cap.isError, true);
    assert.match(cap.text, /200 open tasks/);
    const read = await c.call('task_list', { project: 'Alpha' });
    assert(!read.isError, read.text);
    assert.match(read.text, /Synthetic/);
}
finally {
    await c.close();
} });
