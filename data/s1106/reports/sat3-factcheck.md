# S1106 sat3 fact gate (2026-11-06, before publish)

Result: all three satellites PASS. Every number in the live remote calls (sat-evidence-1106/<name>-remote.json) was re-read on the official page. Copies of the pages used are in sat-evidence-1106/factcheck-pages/ (fetched with curl on 2026-11-06, Mac time UTC+7).

| fact | server says (remote call) | official source, read independently | match |
|---|---|---|---|
| USPS lower 48 send-by dates | Ground Advantage and First-Class Mail Thu Dec 17, Priority Mail Fri Dec 18, Priority Mail Express Sat Dec 19 (2026) | https://www.usps.com/holiday/holiday-shipping-dates.htm table "2026 Holiday Shipping Dates for Contiguous U.S."; landing page https://www.usps.com/holiday/ "DEC 17 ... DEC 18 ... DEC 19" | yes |
| Alaska, Hawaii, PR, territories | First-Class Mail Dec 17, Priority Mail Dec 18, Express Dec 19; Ground Advantage no single date, 10-day or more service expectation | same page, cell "See below 4" and footnote 4 | yes. Note: syndicated news of 2026-09-23 said Ground Advantage Dec 16 for these places; the official page does not print a date, so the server prints none |
| International | every region Dec 9 (First-Class Package International, Priority Mail International), Dec 16 (Priority Mail Express International) | same page, 9 region rows | yes |
| Military | APO/FPO/DPO 090-092: Ground Advantage Nov 4, First-Class Mail and Priority Mail Dec 9, PMEMS Dec 16; 093 has no PMEMS (N/A) | same page, military table; an older "340 Nov. 6 Nov. 27 Dec. 4 ..." row sits inside an HTML comment and is ignored | yes |
| Days left | 42 days to Dec 17 on 2026-11-05 Eastern | date arithmetic, US Eastern date from Intl (America/New_York) | yes |
| US heating oil | $6.138 week of 2026-11-02, down $0.092, $3.632 a year ago | https://www.eia.gov/petroleum/heatingoilpropane/ "U.S. Average 6.138 -0.092 2.506" (6.138 - 3.632 = 2.506); weekly table release 11/4/2026, next 11/12/2026 | yes |
| US propane | $2.820, up $0.089, $2.445 a year ago | same page "U.S. Average 2.820 0.089 0.375" (2.820 - 2.445 = 0.375) | yes |
| Maine | heating oil $5.984 (down $0.056, $3.292 a year ago); propane $3.691 (up $0.012, $3.145 a year ago) | same page "Maine 5.984 -0.056 2.692" and "Maine 3.691 0.012 0.546" (5.984 - 3.292 = 2.692; 3.691 - 3.145 = 0.546) | yes |
| Connecticut heating oil | $5.991; 200 gal = $1,198.20; $43.26 per million Btu | same page "Connecticut 5.991"; 200 x 5.991 = 1,198.20; 5.991 / 138,500 x 1e6 = 43.26 | yes |
| Connecticut propane per million Btu | $48.64 | "Connecticut 4.448" (propane block); 4.448 / 91,452 x 1e6 = 48.64 | yes |
| Minnesota propane last 52 weeks | $1.827 (2025-11-03) to $2.198 (2026-11-02) | weekly table Minnesota 11/02/26 = 2.198; EIA summary "Minnesota 2.198" | yes (latest); start value read from the EIA history page by the server |
| Heat contents | heating oil 138,500 Btu/gal, propane 91,452 Btu/gal, electricity 3,412 Btu/kWh, natural gas 100,000 Btu/therm | https://www.eia.gov/energyexplained/units-and-calculators/british-thermal-units.php | yes |
| Forever stamp | $0.82, effective October 4, 2026 | https://pe.usps.com/text/dmm300/Notice123.htm "Notice 123 • Effective October 04, 2026", Letters (Stamped) 1 oz $0.82; https://www.usps.com/ship/first-class-mail.htm "Forever stamps cost $0.82 (the current 1 oz price)" | yes |
| Extra ounce, weights | $0.29; 2 oz $1.11, 3 oz $1.40, 3.5 oz $1.69 | Notice 123 Letters (Stamped) table | yes |
| Postcard, flats, surcharge | postcard $0.65, large envelope 1 oz $1.69, nonmachinable $0.49 | Notice 123; usps.com first-class page "postcard stamps start at $0.65", "Large envelopes (flats) start at $1.69", "Square ... start at $1.31" (= 0.82 + 0.49) | yes |
| International letter | 1 oz $1.75 to every country (Global Forever) | Notice 123 First-Class Mail International Retail Letters; https://www.usps.com/business/prices.htm "Global Forever ... From $1.75", "Letters and postcards from $1.75 for all countries" | yes |
| 40 square 1.2 oz cards | $1.60 each, $64.00 | 1.11 (2 oz step) + 0.49 = 1.60; x 40 = 64.00 | yes |
| Flat rate | envelope $13.90, small box $14.65, medium $25.80, large $36.10, APO large $34.65, Express envelope $38.25 | Notice 123 Flat Rate section; usps.com/business/prices.htm "Priority Mail Flat Rate Envelope $13.90", "Priority Mail Express Flat Rate Envelope $38.25" | yes |

Not checked against a second page: Notice 123 small, medium and large box prices are on Notice 123 only (the business prices page shows them for international flat rate, which is a different product).
