# Portfolio Health and Risk Analysis — Design and Architecture

**Owner:** Sesha Siva Sankar
**Iteration:** 1 — Design & Data Modelling
**Report Section Date:** September 29, 2026
**Status:** Design complete for Iteration 1; backend implementation is planned for Iteration 2

## 1. Overview

The risk feature extends Ghostfolio's existing X-Ray page with a single 0-100
Portfolio Health Score, a red/yellow/green risk dashboard, configurable
warning thresholds, and a what-if simulator, without replacing anything X-Ray
already does. The guiding decision made on day one and kept throughout the
iteration was to treat the health score as a **second layer on top of the
existing rule engine**, not a redesign of it: every new check (concentration,
volatility, cash allocation, target-allocation deviation) is written as a new
rule using the same base class and output shape the 17 existing X-Ray rules
already use, and the score is just a weighted read of those results.

The risk work covers five main areas:

- a weighted 0-100 health score built from the existing and new rules;
- concentration checks for single stock, sector, country and currency;
- volatility and cash-allocation checks;
- optional deviation-from-target-allocation checks;
- a green/yellow/red severity layer, a what-if simulator, a dashboard
  wireframe and a formal API contract.

## 2. Existing Ghostfolio Model

The design started by reading the current X-Ray implementation before writing
anything new, so the new checks would sit inside the existing pattern instead
of next to it.

X-Ray is a rule engine, not a monolith. Every check extends one abstract
`Rule` base class (`apps/api/src/models/rule.ts`) and returns the same shape:

```text
EvaluationResult {
  evaluation: string
  value: boolean
}
```

The engine runs 17 rules across 8 categories today (liquidity, emergency
fund, currency/asset-class/account/economic-market/regional-market cluster
risk, and fees), wired up by hand in
`PortfolioService.getReport()`. Per-user thresholds already live in
`user.settings.xRayRules`, keyed by rule name, with `isActive`,
`thresholdMax` and `thresholdMin` fields. The only existing aggregation is a
flat pass-count (`rulesFulfilledCount` out of `rulesActiveCount`) shown as
"N out of M rules align with your portfolio" — there is no score, no
weighting, and no per-rule severity beyond pass/fail.

That last point shaped the whole iteration: the health score is genuinely new
work, not a refactor of something that already exists.

## 3. Health Score Data Model

The score reuses the existing rule output as its only input — `key`,
`isActive`, `value`, `evaluation` — so scoring logic and rule logic stay
separate. 100 points are split across the categories (Fees 15, Currency 15,
Economic Market 15, Regional Market 15, Asset Class 15, Account 10, Emergency
Fund 10, Liquidity 5), then split again across each category's rules. The
score is:

```text
score = (sum of weights of PASSED active rules)
        / (sum of weights of ALL active rules) × 100
```

Inactive rules are excluded from both sides of that fraction, so the
remaining weights renormalize automatically — a user who turns off a rule
never loses points for a check they opted out of. A user with zero active
rules gets `score: null` with a reason, never a fake 100. Category
sub-scores are the same formula scoped to one category, so the dashboard can
show "Fees: 100, Currency: 50" without a second calculation path. v1 keeps
scoring binary (pass = full weight, fail = zero); partial credit for
near-misses was considered and parked as a v2 idea, since it would require
every rule to expose a normalized "how close" value, not just a boolean.

## 4. Concentration, Volatility and Cash

Single-stock, sector, country and currency concentration share one formula:
group holdings by the attribute, find the largest bucket's share of the
portfolio, fail above a threshold. Currency concentration already exists in
X-Ray, so it was reused as-is rather than duplicated. Stock and currency
group on a flat field; sector and country required a variant, because
`assetProfile.sectors` and `assetProfile.countries` are arrays of
`{ name/code, weight }` (a single ETF can span several sectors), so a
holding's value has to be split proportionally across its sectors/countries
before grouping, not assigned to one bucket.

A correction made mid-iteration: the single-stock rule as first specified
would have flagged a diversified ETF holding 40% of a portfolio as a "single
stock" problem. The fix restricts that rule to holdings whose asset
sub-class is `STOCK` or `CRYPTOCURRENCY` (confirmed against the
`AssetSubClass` enum in `prisma/schema.prisma`, which separates `ETF` and
`MUTUALFUND` from `STOCK`), while sector/country rules still count ETFs,
since their sector/country weights are already split out per holding.

Volatility is computed from existing `MarketData.marketPrice` history — no
new data collection — as annualized standard deviation of daily returns,
combined across holdings via a full covariance matrix rather than a naive
weighted average, so genuine diversification (holdings that move opposite
each other) correctly lowers the score instead of being penalized as if the
risks just added up. Because an N×N covariance matrix is expensive to
compute per request, the design calls for it to be precomputed by a nightly
job rather than calculated synchronously inside the rule.

Cash allocation is a band check (too much idle cash is also a problem, not
just too little), distinct from the existing `BuyingPower` rule: buying
power is an absolute dollar floor for near-term liquidity, cash allocation is
a percentage-of-portfolio efficiency check. The two can disagree for a
legitimate reason (large portfolio, small percentage) without double-counting
the same risk.

## 5. Target-Allocation Deviation

This is the one category that is optional even at the data level, not just
toggle-able: a user who never sets a target gets no evaluation at all, not a
fail. Nothing like a target allocation exists in the current schema, so the
design stores it in `user.settings.targetAllocation`, following the same
JSON-settings pattern `xRayRules` already uses rather than adding a new
Prisma table for a feature that may still change shape. Deviation is
reported per bucket (signed, so "8 points overweight" and "5 points
underweight" are both visible), with a single threshold rather than a band,
since the "correct" value here is whatever the user chose, not a fixed
ideal — only how far off is "too far" needs a limit. Buckets the user holds
but never set a target for are treated as an implicit 0% target, so drift
outside the stated plan is surfaced rather than hidden.

## 6. Severity Layer and Warnings

X-Ray's existing pass/fail is binary; the proposal calls for red/yellow/green.
Rather than a second, disconnected concept, warnings extend the existing
pass/fail threshold: the existing `thresholdMax`/`thresholdMin` becomes the
yellow line, and one new red line is added on top, so a rule's severity and
its pass/fail state can never disagree (a rule fails if and only if its
severity is yellow or red). This also resolved an apparent conflict between
two of this iteration's own docs: single-stock concentration was specced at
a 10% fail threshold on one day and the proposal's example says 25% — both
are correct once 10% is read as the yellow line and 25% as red. A fourth
state, `NO_DATA`, is explicit rather than defaulting to green, for cases like
no target set or too little price history to estimate volatility.

## 7. What-If Simulation

The simulator answers "what if this holding drops X%?" by copying the
current holdings, shrinking one value in the copy, and re-running the
**same** rule and score logic used for the real score — no parallel
calculation path to drift out of sync. A worked example surfaced a
non-obvious behavior worth documenting up front rather than discovering
during implementation: shrinking one holding reduces the total, which raises
every other holding's _share_ even though its _value_ didn't change, so a
40% drop in one stock can turn a different, untouched holding's
concentration from yellow to red. The result therefore reports what changed
(new/resolved/changed warnings) rather than only a before/after score, so the
UI can explain why the score moved.

## 8. Dashboard Wireframe and API Contract

The wireframe (`docs/sesha-notes/09-risk-dashboard-wireframe.md`) lists,
component by component, exactly which API field backs it — the same
discipline Raniya's dashboard wireframe uses — so nothing on screen lacks a
field and nothing in the API lacks a place to render. The API contract
(`docs/sesha-notes/10-risk-api-contract.md`) follows Raniya's shared
conventions (`{ data, meta, error }` envelope, `/api/v1/risk/...`, decimal
percentages, `Money` objects) and was reconciled against her
`dashboard-field-spec.md`: both fields her dashboard summary needs
(`healthScore`, `topConcentrationRisk`) match exactly, with a severity field
proposed as an addition. One gap found while writing the contract: the
`{ data, meta, error }` envelope Raniya specified doesn't exist anywhere in
the current codebase yet — existing controllers return payloads directly, and
the existing exception filters are feature-specific (MCP, portfolio
snapshots) rather than shared — so a shared response interceptor and
exception filter is a cross-cutting Iteration 2 dependency for all four
modules, not something the risk module can build in isolation.

## 9. Alignment With Other Feature Owners

- **Tharun (tax):** no direct data dependency; the risk module reads only
  holdings, market data and account balances.
- **Arthur (charts):** no direct dependency either; volatility uses the same
  `MarketData` price history charts already rely on, but through its own
  cached calculation, not a shared endpoint.
- **Raniya (architecture/dashboard):** the risk module follows her target
  architecture (`apps/api/src/app/risk/`, controller → service → Prisma) and
  her API-only access boundary — the dashboard will call `/api/v1/risk/...`
  and never reach into risk services directly. Her dashboard field spec and
  this module's API contract were cross-checked and agree (Section 8).

## 10. Known Gaps for Iteration 2

- The proposal's dashboard wireframe references a "score endpoint" the
  weekly build plan doesn't explicitly schedule; `HealthScoreCalculator`
  needs its own backlog item so it isn't assumed to fall out of the rule
  work automatically.
- Volatility band defaults are a single fixed range for every user; keying
  them to a risk-tolerance setting was identified as desirable but there is
  no such field on the user profile today, so it was left as a flagged open
  question rather than designed against a field that doesn't exist.
- The shared response envelope (Section 8) needs an owner and a slot in the
  Iteration 2 week 1 plan before any risk endpoint can return real data in
  the agreed shape.
