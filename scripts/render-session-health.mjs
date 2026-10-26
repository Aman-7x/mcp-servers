// Owner-dashboard visualization of point samples, never an uptime estimate.
const escape = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
export function renderSessionHealth(watch) {
  const samples = (watch?.snapshots || []).filter(row => Number.isFinite(Date.parse(row.at)));
  const start = Date.parse(watch?.started_at), deadline = Date.parse(watch?.deadline_at);
  if (!samples.length || !Number.isFinite(start) || !Number.isFinite(deadline)) return '';
  const end = Math.max(deadline, ...samples.map(row => Date.parse(row.at)));
  const x = time => 18 + Math.max(0, Math.min(1, (time - start) / Math.max(1, end - start))) * 684;
  const clock = time => new Date(time).toISOString().slice(11, 16) + ' UTC';
  const gaps = (watch.observation_gaps || []).filter(gap => Number.isFinite(Date.parse(gap.last_observed_at)) && Number.isFinite(Date.parse(gap.resumed_at)));
  const bands = gaps.map(gap => {
    const a = Date.parse(gap.last_observed_at), b = Date.parse(gap.resumed_at);
    return `<rect x="${x(a).toFixed(1)}" y="19" width="${Math.max(1, x(b) - x(a)).toFixed(1)}" height="38" fill="#777" opacity=".24"><title>Recorded observation gap: ${escape(new Date(a).toISOString())} to ${escape(new Date(b).toISOString())}</title></rect>`;
  }).join('');
  const points = samples.map(row => {
    const status = row.public_health_status;
    const color = status === 200 ? '#7bd7aa' : status === 503 ? '#ffb1aa' : '#aaa';
    return `<circle cx="${x(Date.parse(row.at)).toFixed(1)}" cy="38" r="3.8" fill="${color}"><title>${escape(new Date(row.at).toISOString())}: checkout-monitor HTTP ${escape(status ?? 'unavailable')}; pin ${row.pin_matches === true ? 'matches' : 'unverified'}; scheduled check ${row.cron?.ok === true ? 'passed' : 'unverified'}</title></circle>`;
  }).join('');
  const good = samples.filter(row => row.public_health_status === 200).length;
  const recovering = samples.filter(row => row.public_health_status === 503).length;
  return `<figure id="session-health-chart" style="margin:14px 0 8px;max-width:900px"><svg viewBox="0 0 720 82" role="img" aria-labelledby="session-health-title" style="display:block;width:100%;height:auto"><title id="session-health-title">Sampled public checkout-monitor status from ${clock(start)} to ${clock(end)}. Dots are observations; shaded intervals mark gaps.</title><line x1="18" y1="38" x2="702" y2="38" stroke="#555" stroke-width="1"/>${bands}${points}<text x="18" y="76" fill="#aaa" font-size="11">${clock(start)}</text><text x="702" y="76" text-anchor="end" fill="#aaa" font-size="11">${clock(end)}</text></svg><figcaption class="dim">${samples.length} dated samples: <span style="color:#7bd7aa">${good} HTTP 200</span>, <span style="color:#ffb1aa">${recovering} HTTP 503</span>, ${samples.length - good - recovering} other/unreadable. ${gaps.length} recorded gap${gaps.length === 1 ? '' : 's'}. These are monitor-status samples, not an uptime percentage or checkout-page failure count.</figcaption></figure>`;
}
