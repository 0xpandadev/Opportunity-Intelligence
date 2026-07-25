---
name: run-opportunity-simulation
description: Execute a pending synthetic multi-agent simulation inside an existing Opportunity Intelligence run using Codex as the AI runtime, then validate and merge the result into the run's Simulation Lab. Use when the user asks to execute a pending simulation for a run ID.
---

# Run Opportunity Simulation

Use Codex as the model runtime. Do not request a separate OpenAI API key. This is a MiroFish-inspired, evidence-bounded simulation implemented for personal use inside Opportunity Intelligence; it is not the upstream MiroFish runtime and must not claim to be one.

## Execute

1. Work from the repository root and identify the run ID.
2. Read `runs/<id>/simulation-request.json`, `runs/<id>/result.json`, `schemas/simulation.schema.json`, and this skill completely.
3. Change `runs/<id>/simulation-status.json` to `running`, preserving `created_at` and adding `updated_at`.
4. Treat the seed evidence and knowledge graph as initial conditions. Do not add uncited real-world facts. Analyst assumptions and every simulated observation remain synthetic.
5. Create the requested number of agents with materially different objectives, constraints, capabilities, decision rules, and evidence anchors. Include regulators/infrastructure owners, suppliers, buyers, financiers, communities, and challengers when relevant.
6. Run the requested sequential rounds. Each round must record the focus, agent actions, interactions, state changes, minority views, and evidence IDs that constrain the simulated world. Preserve path dependence; do not reset agents between rounds.
7. Test at least two interventions and one counterfactual control. Separate robust outcomes from branch-specific outcomes.
8. Produce emergent events, outcome probabilities, falsifiers, robust actions, contingent actions, actions to avoid, and limitations. Probabilities are synthetic model weights, not measured forecasts.
9. Save the draft as `runs/<id>/simulation-result.draft.json`.
10. Run `node scripts/complete-simulation.cjs <id> runs/<id>/simulation-result.draft.json`. Do not claim completion unless it returns `valid: true`.

## Required output discipline

- `classification` must be `synthetic`; `engine` must be `codex_mirofish_method`.
- Every evidence ID must already exist in the parent analysis result.
- Simulated agent statements never become primary evidence.
- Report consensus, minority outcomes, regime changes, and failed interventions.
- Keep observed evidence, analyst inference, initial assumption, and simulated emergence visibly separate.
