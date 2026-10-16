// Private object host; requests reach FunnelState through bindings only.
export { FunnelState } from './funnel-state.js';
export default { fetch() { return new Response('Not found', { status: 404 }); } };
