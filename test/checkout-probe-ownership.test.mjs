import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ownsProbeSession, canExpireProbeSession } from '../scripts/checkout-lifecycle-probe.mjs';
const state = { started_unix: 1000, source: 'probe.unique', tenant: 'synthetic', submitted: [{ product: 'three-way-match', order_token: 'order-unique' }] };
const session = { id: 'cs_live_example123', livemode: true, created: 1001, status: 'open', payment_status: 'unpaid', client_reference_id: state.tenant, metadata: { probe: '1', source: state.source, tenant: state.tenant, product: 'three-way-match', order_token: 'order-unique' } };
test('expiry requires exact ownership and an open unpaid live session', () => {
  assert.equal(canExpireProbeSession(session, state), true);
  for (const changed of [{ status: 'complete' }, { payment_status: 'paid' }, { livemode: false }, { created: 900 }, { client_reference_id: 'foreign' }, { id: 'cs_test_example123' }]) assert.equal(canExpireProbeSession({ ...session, ...changed }, state), false);
});
test('another product, operator, order or tenant is never a cleanup target', () => {
  for (const changed of [{ probe: undefined }, { source: 'foreign' }, { tenant: 'foreign' }, { order_token: 'foreign' }, { product: 'invoice' }]) assert.equal(ownsProbeSession({ ...session, metadata: { ...session.metadata, ...changed } }, state), false);
  assert.equal(ownsProbeSession({ ...session, metadata: undefined }, state), false);
});
