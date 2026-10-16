import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { localClient } from './refusal-client.mjs';
test('free library, JSON and assembly refusals are errors; tag-filter partial search succeeds', async () => { const c = await localClient(); try {
    for (let i = 0; i < 10; i++)
        assert(!(await c.call('clause_add', { title: `Synthetic rule ${i}`, body: 'Synthetic fee clause', category: 'general', tags: ['synthetic'] })).isError);
    const cap = await c.call('clause_add', { title: 'Synthetic rule 11', body: 'Synthetic', category: 'general' });
    assert.equal(cap.isError, true);
    const path = join(c.dir, 'input.json');
    writeFileSync(path, '[]');
    assert.equal((await c.call('clause_import', { path })).isError, true);
    const out = join(c.dir, 'output.json');
    assert.equal((await c.call('clause_export', { path: out, format: 'json' })).isError, true);
    assert(!existsSync(out));
    const nine = ['scope-of-work', 'payment-terms', 'late-fees', 'ip-assignment', 'confidentiality', 'termination', 'liability-cap', 'revisions', 'expenses'];
    const assembly = await c.call('contract_assemble', { title: 'Synthetic long form', clause_ids: nine, format: 'markdown' });
    assert.equal(assembly.isError, true);
    assert.match(assembly.text, /up to 8/);
    const partial = await c.call('clause_search', { query: 'fee', tags: ['synthetic'] });
    assert(!partial.isError, partial.text);
    assert.match(partial.text, /Pro feature/);
    assert(JSON.parse(partial.text).results.some(r => r.title === 'Synthetic rule 0'));
}
finally {
    await c.close();
} });
