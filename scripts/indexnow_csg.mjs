#!/usr/bin/env node
// Submit claudecodeguides.com URLs to IndexNow (Bing, Yandex, Seznam, Naver).
// Same contract as scripts/indexnow.mjs: verify the key file before submitting,
// and fail loudly rather than reporting a success we did not get.
// Usage: node scripts/indexnow_csg.mjs [--dry]
const HOST = "claudecodeguides.com";
const KEY = "c4ded4558ba249bbbd828bbfd67ebe80";
const KEY_LOC = `https://${HOST}/${KEY}.txt`;
const DRY = process.argv.includes("--dry");

// 1. The key file must be reachable with the exact body or every submission is rejected.
const probe = await fetch(KEY_LOC);
const body = (await probe.text()).trim();
if (!probe.ok || body !== KEY) {
  console.error(`FATAL: key file at ${KEY_LOC} returned ${probe.status} with body ${JSON.stringify(body.slice(0, 60))}; expected ${KEY}`);
  process.exit(2);
}
console.log(`key file OK at ${KEY_LOC}`);

// 2. Read the sitemap we are about to advertise, rather than guessing URL shapes.
const xml = await (await fetch(`https://${HOST}/sitemap.xml`)).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (urls.length === 0) {
  console.error("FATAL: sitemap returned zero <loc> entries; refusing to submit nothing.");
  process.exit(2);
}
console.log(`sitemap ${urls.length} URLs`);
if (DRY) {
  console.log(`dry: would submit ${urls.length} URLs to ${HOST}`);
  process.exit(0);
}

// 3. IndexNow accepts up to 10,000 URLs per request; batch anyway so one bad
//    batch cannot cost us the whole set.
const BATCH = 10000;
let accepted = 0;
let failed = 0;
for (let i = 0; i < urls.length; i += BATCH) {
  const batch = urls.slice(i, i + BATCH);
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: HOST,
      key: KEY,
      keyLocation: KEY_LOC,
      urlList: batch,
    }),
  });
  const ok = res.status === 200 || res.status === 202;
  console.log(`  batch ${i}-${i + batch.length - 1}: ${res.status}${ok ? "" : " FAILED"}`);
  if (ok) accepted += batch.length;
  else failed += batch.length;
}
console.log(`accepted ${accepted}, failed ${failed}`);
process.exit(failed === 0 ? 0 : 1);
