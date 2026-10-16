# R36 blind recommendation KPI addendum

status: DONE

The current comparable instrument is `data/blind_recommendation_r8.json`, measured 2026-10-16T00:39:11Z. Its structured provenance records a fresh context (`fork_turns: none`), gpt-6-astra, and no estate priming. Parent identity scoring occurred after the runner finished.

`scripts/kpi.mjs` now selects the newest valid unprimed instrument through `latestBlindInstrument` in `scripts/kpi-populations.mjs`. Both the full collector and `--from-audit` consume the same two row definitions. Selection verifies all question numbers, verbatim text, and order against `data/blind_questions.json`, explicit estate identity scores against distinct question lists, first-listed membership, and raw host appearances against stored result URLs. Missing/unknown estate scores, primed or inherited-context runs, changed question sets, and inconsistent counts are rejected. No eligible run yields unmeasured/null values, never an invented zero.

Current KPI rows in `data/kpi.json`:

- Named by a blind assistant: 9/18 questions with an estate recommendation; includes companion and conditional recommendations. Six are first-listed, retained separately in detail.
- Storefront host surfaced in raw search results: 15/18 questions. This replaces the misleading “share of recommendation citations” label. It is raw retrieval presence, not citations or a citation percentage.

The rows carry the R8 source, measurement/evaluation timestamps, provenance, and limitations, and are marked current. R7 `scores.named_by_blind_assistant = 12` counted any credible MCP server and is not an estate recommendation score. No 12-to-9 estate comparison is made, and old-round estate counts are not manufactured.

Limitations: estate identity was evaluated post hoc; this is one documentary trial in a different model/search environment from older rounds. There is no causal ranking or revenue claim and no runtime certification. The runner reports that public pages containing historical test references were not followed or used as capability evidence.

Evidence commands:

- `node --check scripts/kpi.mjs` → exit 0.
- `node --test test/kpi-populations.test.mjs` → 6/6 pass, including latest-valid selection, exact frozen-question comparability, priming/unknown-score rejection, and the R7 all-server score counterexample.
- `node scripts/kpi.mjs --from-audit` → 14 measured rows, other rows explicitly stale; no network calls.
- Direct JSON assertions verified current 9/18 and 15/18 rows, measurement timestamps, and absence of the old citation-share row.

The full network collector was not executed; its shared selector/row path is covered by the focused helper tests. No network refresh, deployment, or publication occurred.
