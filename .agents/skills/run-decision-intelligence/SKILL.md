---
name: run-decision-intelligence
description: Execute a pending Decision Intelligence Workbench run from request.json through current primary-source research, forecasting, knowledge graph, whitespace, profit-pool, investment, and business analysis, then validate and save result.json. Use when the user asks to run, complete, refresh, or analyze a Workbench run ID or a pending Workbench request.
---

# Run Decision Intelligence

Turn one saved Workbench request into a traceable decision package. The Codex session is the AI runtime, so do not request a separate LLM API key. Data-provider keys may still be required for specific connectors.

## Execute a run

1. Work from the repository root. If no run ID is given, execute `node scripts/list-pending.cjs` and select the newest pending run. If more than one materially different pending run exists, report which one is selected.
2. Read `runs/<id>/request.json`, `config/catalog.json`, `config/connectors.json`, and `schemas/result.schema.json` completely.
3. Mark the run `researching` with `node scripts/mark-run.cjs <id> researching`.
4. Use current sources. Search primary and official sources first; use academic sources for mechanisms and secondary/community sources only for discovery or weak signals.
5. Invoke `$foresight-radar` only for source-map, signal, watch, and diff work. It is an input module, not this product and not the final analytical method.
6. Apply the method stack in [analysis-protocol.md](references/analysis-protocol.md). Read that file completely before analysis.
7. Build claim-level evidence before conclusions. Every material trend, graph node, whitespace, profit pool, investment route, and forecast must cite one or more evidence IDs. Label each evidence item `fact`, `inference`, `assumption`, or `unknown`.
8. For investment output, trace theme → industry transmission → beneficiary → earnings sensitivity → expectations gap → valuation → catalyst → crowding → downside → decision. Never present guaranteed profits or automatic trading.
9. For business output, trace structural change → pain → buyer/budget → whitespace → solution → pricing → unit economics → channel → validation/kill criterion.
10. Write the draft to `runs/<id>/result.draft.json`. Run `node scripts/complete-run.cjs <id> runs/<id>/result.draft.json`. Do not claim completion if validation fails.

## Required analytical behavior

- Separate observed evidence from model inference and synthetic simulation.
- Include counterevidence and at least one falsifier for the main thesis.
- Use reference classes and base rates before scenario narratives.
- Give probabilities only to questions with a date and resolution criterion.
- Represent unknowns honestly. Missing data is not zero and an uninstalled connector is not unavailable evidence.
- Record source URL, publisher, publication date when available, access date, tier, limitations, and the claims supported.
- Prefer a smaller defensible graph to a large decorative graph.

## MiroFish boundary

MiroFish is optional and stays in a separate runtime because of its AGPL-3.0 license and model/runtime requirements. If available, export inputs with `node scripts/export-mirofish.cjs <id>`, and import outputs only as `source_tier: synthetic`. Never use a simulated agent statement as a primary fact.

## Completion check

Run `node scripts/validate-run.cjs <id>`. Report source gaps, connector states, material limitations, and where the GUI can be opened. A completed JSON result is necessary; a prose answer in chat alone is not completion.
