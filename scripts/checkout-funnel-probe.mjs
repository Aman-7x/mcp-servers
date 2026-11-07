// Checkout funnel probe: proves a real browser can reach Stripe, or finds where it stops.
//
// Why the UA override matters: billing/src/index.js computes
//   scripted = BOT_UA_RE.test(ua) || !looksLikeNavigation
// and Playwright's default UA contains "HeadlessChrome", which BOT_UA_RE matches. Without
// the override the probe is turned away with `x-mcp-buy: scripted-ua-no-session` and the
// conclusion "checkout is broken" would be wrong. A real Chrome UA gets a live
// cs_live_... session, which is what this script asserts.
//
// It sends `x-mcp-probe: 1` so the run is not counted as a human funnel view, and it stops
// on Stripe's payment page: no card is entered, no charge is possible.
//
//   ~/.hermes/node/bin/node scripts/checkout-funnel-probe.mjs [buy-url]
// Exit 0 = reached checkout.stripe.com, 1 = stopped earlier (URL printed).
import { chromium } from '/Users/mike/mcp-servers/node_modules/playwright/index.mjs';

const url = process.argv[2] ?? 'https://mcp.zovo.one/buy/ingredient-convert';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ userAgent: UA, extraHTTPHeaders: { 'x-mcp-probe': '1' } });
const page = await ctx.newPage();
const seen = [];
page.on('response', (r) => {
  const u = r.url();
  if (/\/buy\//.test(u) || /checkout\.stripe\.com/.test(u)) seen.push(`${r.status()} ${u.split('#')[0].slice(0, 100)}`);
});

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
console.log('landed        ', page.url());
const email = page.locator('input[name="email"]');
if (await email.count()) await email.fill('probe@zovo.one');
const btn = page.locator('form button, form input[type="submit"]').first();
if (await btn.count()) {
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null),
    btn.click(),
  ]);
}
await page.waitForTimeout(2500);
const final = page.url();
const ok = final.startsWith('https://checkout.stripe.com/');
console.log('after_submit  ', final.split('#')[0].slice(0, 110));
console.log('stripe_title  ', (await page.title()).slice(0, 60));
console.log('responses     \n' + seen.slice(-5).join('\n'));
await browser.close();
console.log(ok ? 'RESULT reach-stripe' : 'RESULT stopped-before-stripe');
process.exit(ok ? 0 : 1);
