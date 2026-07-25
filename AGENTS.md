# Repository execution rules

- This repository powers **Opportunity Intelligence**, not Foresight Radar.
- When asked to execute, complete, or refresh a saved run, use `.agents/skills/run-decision-intelligence/SKILL.md`.
- Use the globally installed Foresight Radar skill only for source-map, signal scanning, source audit, watch, and diff inputs.
- Do not mark a run complete until `scripts/complete-run.cjs` accepts the result.
- Do not present uninstalled MCPs or key-required data providers as connected.
- Keep facts, inferences, assumptions, unknowns, and synthetic MiroFish outputs distinguishable.
- For a pending Simulation Lab request, use `.agents/skills/run-opportunity-simulation/SKILL.md`; Codex is the runtime and no separate OpenAI API key is required.
- Never promise guaranteed investment returns or add automatic trading without an explicit separate request and safety review.
