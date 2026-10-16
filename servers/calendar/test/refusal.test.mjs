import test from 'node:test';
import assert from 'node:assert/strict';
import { localClient } from './refusal-client.mjs';
const fixture = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Synthetic//EN\r\nBEGIN:VEVENT\r\nUID:synthetic-1\r\nDTSTART:20261016T090000Z\r\nDTEND:20261016T100000Z\r\nSUMMARY:Synthetic event\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
test('calendar refuses URL-only imports, extra calendars and over-wide lists; clamped conflicts stay useful', async () => {
  const c = await localClient();
  try {
    const url = await c.call('ics_import', { name: 'Synthetic URL', url: 'https://example.invalid/calendar.ics' });
    assert.equal(url.isError, true); assert.match(url.text, /Free alternative/);
    for (const name of ['Synthetic Work', 'Synthetic Personal']) assert(!(await c.call('ics_import', { name, text: fixture })).isError);
    const cap = await c.call('ics_import', { name: 'Synthetic Third', text: fixture });
    assert.equal(cap.isError, true); assert.match(cap.text, /free tier keeps 2/);
    const wide = await c.call('events_list', { from: '2026-01-01', to: '2026-12-31', zone: 'UTC' });
    assert.equal(wide.isError, true); assert.match(wide.text, /31 days/);
    const list = await c.call('events_list', { from: '2026-10-16', to: '2026-10-16', zone: 'UTC' });
    assert(!list.isError, list.text); assert.match(list.text, /Synthetic event/);
    const conflicts = await c.call('conflicts', { from: '2026-10-01', to: '2026-12-31' });
    assert(!conflicts.isError, conflicts.text); assert.match(conflicts.text, /Pro feature/); assert.match(conflicts.text, /Synthetic event/);
  } finally { await c.close(); }
});
