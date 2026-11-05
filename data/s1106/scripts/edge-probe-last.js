const URLS = ["https://pe.usps.com/text/dmm300/Notice123.htm","https://www.usps.com/holiday/holiday-shipping-dates.htm",
 "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=W_EPD2F_PRS_NUS_DPG&f=W","https://www.eia.gov/energyexplained/units-and-calculators/british-thermal-units.php"];
export default { async fetch() { const out=[]; for (const u of URLS) { const t=Date.now(); try { const r = await fetch(u,{headers:{'User-Agent':'sat3-probe/1.0 (+https://github.com/theluckystrike)'}}); const b = await r.text();
 out.push({u,status:r.status,bytes:b.length,ms:Date.now()-t, hit:(/Effective [A-Z][a-z]+ \d\d, \d{4}|Priority Mail Express[^<]{0,40}|Release Date: [0-9/]+/.exec(b)||[''])[0]}); } catch(e){ out.push({u,error:String(e)}); } }
 return Response.json(out); } };
