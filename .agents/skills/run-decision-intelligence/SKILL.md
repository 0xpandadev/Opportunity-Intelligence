---
name: run-decision-intelligence
description: Execute a pending Opportunity Intelligence run from request.json through current primary-source research, forecasting, knowledge graph, whitespace, profit-pool, investment, and business analysis, then validate and save result.json. Use when the user asks to run, complete, refresh, or analyze an Opportunity Intelligence run ID or pending request.
---

# Run Opportunity Intelligence

Turn one saved Opportunity Intelligence request into a traceable decision package. The Codex session is the AI runtime, so do not request a separate LLM API key. Data-provider keys may still be required for specific connectors.

## Execute a run

1. Work from the repository root. If no run ID is given, execute `node scripts/list-pending.cjs` and select the newest pending run. If more than one materially different pending run exists, report which one is selected.
2. Read `runs/<id>/request.json`, `config/catalog.json`, `config/connectors.json`, and `schemas/result.schema.json` completely.
3. Mark the run `researching` with `node scripts/mark-run.cjs <id> researching`.
4. Use current sources. Search primary and official sources first; use academic sources for mechanisms and secondary/community sources only for discovery or weak signals.
   Before general web research, run `node scripts/route-mcp.cjs "<query, sectors, regions, and evidence needs>"`. Read `config/mcp-servers.json`, call only servers whose state is `verified`, and discover current tool schemas with `tools/list` instead of guessing arguments. Use `node scripts/mcp-call.cjs <server> <tool> --args-file <json-path>` or `lib/mcp-client.cjs` for calls. The router is evidence-domain based: property/population, prices/consumption, migration/cross-border capital, and company lifecycle are distinct needs.
   A connector is "used in this run" only after a successful `tools/call` or built-in REST response. For every used result, store `connector_id`, `acquisition.connector_id`, MCP tool name, arguments or query, `fetched_at`, publisher/source URL, and evidence limitations. `tools/list` success alone is connection verification, not run evidence. Do not route to `degraded`, `key_required`, or `not_installed` servers.
5. Invoke `$foresight-radar` only for source-map, signal, watch, and diff work. It is an input module, not this product and not the final analytical method.
6. Apply the method stack in [analysis-protocol.md](references/analysis-protocol.md). Read that file completely before analysis.
   Record each method actually used as a separate `methodology` entry with the exact `method_id` from `config/catalog.json`, a plain-language `summary`, concrete `steps_applied`, the result sections in `outputs_touched`, any `departures` from the cited method, and supporting `evidence_ids`. Do not list a method merely because it exists in the catalog.
7. Build claim-level evidence before conclusions. Every material trend, graph node, whitespace, profit pool, investment route, and forecast must cite one or more evidence IDs. Label each evidence item `fact`, `inference`, `assumption`, or `unknown`.
8. For investment output, trace theme → industry transmission → beneficiary → earnings sensitivity → expectations gap → valuation → catalyst → crowding → downside → decision. Never present guaranteed profits or automatic trading.
9. For business output, trace structural change → pain → buyer/budget → opportunity candidate → current alternatives → competition density → documented unmet gap → solution → pricing → unit economics → channel → validation/kill criterion. A market-color position requires `competition.current_alternatives`, `competition.density`, `competition.saturation_score`, `competition.unmet_need_score`, `competition.gap`, and `competition.evidence_ids`. `classification: white` additionally requires observed willingness-to-pay evidence and `competition.wtp_verified: true` (or `potential.wtp_verified: true`). A plausible price, hypothetical budget, or phrase such as “high possibility” is not verified WTP. Missing competition proof stays `unverified`; low saturation with unverified WTP stays a white candidate, not a confirmed whitespace.
10. Build `market_landscape` for the megatrends and whitespace candidates. Search listed companies first, including small-cap and niche suppliers where evidence exists; verify ticker and exchange from current official investor-relations or exchange sources, and distinguish a directly listed company from a business represented only through a listed parent. Then add relevant private companies, public programs, platforms, and existing services in Japan and overseas. Every entity must state its exact role, offerings, geography/scale, links to specific megatrend or whitespace IDs, and evidence IDs. “Related” does not mean investable, undervalued, or a beneficiary; make those conclusions only in the investment route after earnings sensitivity, expectations, valuation, catalyst, crowding, and downside analysis.
11. Write the draft to `runs/<id>/result.draft.json`. Run `node scripts/complete-run.cjs <id> runs/<id>/result.draft.json`. Do not claim completion if validation fails.

## Required analytical behavior

- Separate observed evidence from model inference and synthetic simulation.
- Include counterevidence and at least one falsifier for the main thesis.
- Use reference classes and base rates before scenario narratives.
- Give probabilities only to questions with a date and resolution criterion.
- Represent unknowns honestly. Missing data is not zero and an uninstalled connector is not unavailable evidence.
- Record source URL, publisher, publication date when available, access date, tier, limitations, and the claims supported.
- Prefer a smaller defensible graph to a large decorative graph.
- Make method provenance auditable: distinguish the cited source's principle from Opportunity Intelligence's adaptation, and distinguish both from what was actually executed in the current run.
- Prefer evidence-backed market depth over famous-name lists: include large listed incumbents, listed parents, niche/small listed suppliers, private specialists, and actual services only when their relationship to a specific trend or opportunity can be explained and cited. Use `unknown` instead of guessing listing status.

## MiroFish boundary

MiroFish is optional and stays in a separate runtime because of its AGPL-3.0 license and model/runtime requirements. Always write `simulation_lab` with `status: not_run` and `source_classification: synthetic` unless a real simulation was executed. If available, export inputs with `node scripts/export-mirofish.cjs <id>`, and import actual outputs into `simulation_lab` only as synthetic. A complete simulation record should distinguish environment/personas, agents, rounds, emergent events, interventions, ReportAgent output, and follow-up interactions. Never use a simulated agent statement as a primary fact.

## Completion check

Run `node scripts/validate-run.cjs <id>`. Report source gaps, connector states, material limitations, and where the GUI can be opened. A completed JSON result is necessary; a prose answer in chat alone is not completion.
