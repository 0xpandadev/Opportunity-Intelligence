# Analysis protocol

## 1. Frame the decision

- Restate the user decision, decision owner, horizon, geography, industry, constraints, and what would change the decision.
- Compile a small set of answerable subquestions. Keep investment, business, and policy questions separate even when they share evidence.
- Define the as-of date and data cutoff.

## 2. Build an evidence map

Use this source priority:

1. Laws, regulators, statistical agencies, company filings, official technical databases.
2. Peer-reviewed papers, preprints with explicit caveats, standards bodies.
3. Industry bodies, credible specialist datasets, company materials.
4. News, GitHub, Qiita, Reddit, and communities for discovery or weak signals.
5. Agent simulations only as synthetic scenario evidence.
6. A whitespace label requires observed alternatives, competition-density evidence, and a documented unmet gap. Without all three, report an opportunity candidate and the missing proof gates instead of a blue-ocean claim.
7. Record simulation state explicitly: `not_run`, `ready`, `running`, `complete`, or `failed`. Scenario priors are not simulation outputs.

For each material claim store a source, date, tier, fact/inference/assumption/unknown label, limitation, and counterevidence reference. Do not use a source merely because it mentions the topic; record exactly what it supports.

## 3. Run the method ensemble

Use only the methods that fit the decision. For every method actually used, add one result `methodology` record using its exact catalog ID:

```json
{
  "method_id": "reference_class",
  "summary": "What the method changed in this analysis",
  "steps_applied": ["Concrete step performed", "Concrete step performed"],
  "outputs_touched": ["forecasts", "scenarios"],
  "departures": "Any simplification, missing input, or adaptation from the cited method",
  "evidence_ids": ["evidence-id"]
}
```

Do not claim a method was used when only its vocabulary appears in the prose. `steps_applied` must describe work visible in the result, and `outputs_touched` must name the affected result sections.

1. **Horizon scanning:** inventory established trends, emerging issues, weak signals, and wild cards. Score novelty, momentum, reach, and evidence strength.
2. **STEEP:** classify social, technological, economic, environmental, political, and legal drivers. Record second-order effects.
3. **Causal mapping:** connect drivers, constraints, feedback loops, delays, risks, sectors, and beneficiaries. Assign polarity and confidence.
4. **Reference class:** select comparable transitions or projects, summarize base rates, and state why the current case differs.
5. **Bayesian update:** state a prior, evidence that should move it, the direction of updates, and a calibrated posterior. Numerical precision must not exceed evidence quality.
6. **S-curve / TRL / learning curve:** determine maturity, cost trajectory, scaling bottlenecks, and adoption gate when technology is involved.
7. **Supply-demand / bottleneck:** model capacity, utilization, inventory, substitute availability, concentration, qualification time, and policy dependence.
8. **Cross-impact and scenarios:** choose critical uncertainties, build 3–4 coherent scenarios, assign probabilities only after the base-rate view, and define signposts.
9. **Whitespace / JTBD:** identify customer job, pain severity, current workaround, why supply is absent, buyer, budget, willingness to pay, timing, feasibility, and smallest validation.
10. **Value chain / profit pool:** map stages, revenue and margin direction, bargaining power, scarcity rents, capital intensity, and who gains or loses.
11. **Real options:** define staged commitments, option value, evidence gates, expansion triggers, and kill criteria.
12. **MiroFish / multi-agent world simulation:** when simulation is requested and the separate runtime is available, build a GraphRAG world from evidence, define agents and interventions, run multiple seeds and controls, separate recurring patterns from branch-specific outcomes, and label every returned observation as synthetic. When the runtime is unavailable, export the seed package and record `not_run`; never describe scenario priors as MiroFish output.
13. **Falsification:** articulate the strongest alternative thesis, leading indicators that would disprove the conclusion, and a decision review date.

## 4. Produce decision routes

### Investment

Theme → transmission mechanism → exposed industries → listed beneficiaries → revenue/cost sensitivity → expectations gap → valuation → catalyst → positioning/crowding → downside → decision and review trigger.

### Business

Structural change → user pain → buyer and budget → underserved job → offer → price → unit economics → acquisition channel → regulatory/operational barriers → pilot → success and kill criteria.

## 5. Calibrate forecasts

Each forecast needs one binary or precisely measurable question, probability, base rate, resolution date, resolution source/criterion, up/down factors, and cited evidence. Never backfill a probability after the outcome is known. Preserve updates so a Brier score can be calculated.

## 6. Quality gates

- No major conclusion without evidence IDs.
- No broken evidence references.
- No synthetic evidence labeled primary.
- No “market size” without units, geography, date, and method.
- No investment route without downside and expectations/valuation discussion.
- No business route without buyer, budget, validation, and kill criterion.
- No scenario without signposts.
- No confidence score without limitations and counterargument.
- No methodology entry without an exact catalog `method_id`, concrete execution steps, result-section links, and a note on departures or limitations.
- No `mirofish_simulation` methodology record unless the simulation actually ran. A seed export may be reported as `ready`, but not as a completed method application.
- Do not plot an opportunity on the market-color map unless current alternatives, competition density, solution-saturation score, unmet-need score, and competition evidence IDs are present. Missing items stay in the proof queue.
- Do not classify an opportunity as `white` unless the buyer's willingness to pay is supported by observed customer, budget, contract, or payment evidence and the record explicitly sets `wtp_verified: true`. A proposed pricing model or analyst belief is not verified WTP.
- Every whitespace item must separate `competition` (alternatives, density, saturation, unmet gap, evidence) from `potential` (TAM, willingness to pay, growth, gross-margin potential, repeatability, defensibility). Use `null` or omit a field instead of inventing a score.
- Every profit-pool score must state whose profit is measured, the metric, geography, horizon, unit, base year, evidence, and whether the value is an actual amount or a relative index. Never label a 0–100 attractiveness score as revenue or profit currency.
- A megatrend must pass four visible gates: multi-year persistence, at least three independent structural drivers, value-chain spillover, and traceable evidence. Use a separate time-horizon radar and decision-priority matrix; do not call an impact-by-momentum scatterplot a radar.
