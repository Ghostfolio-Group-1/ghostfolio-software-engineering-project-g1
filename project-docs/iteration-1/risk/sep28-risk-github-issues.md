# Risk Feature — GitHub Issue Backlog

**Prepared by:** Sesha Siva Sankar
**Scheduled task:** September 28, 2026 (filed once the repository's Issues feature was
enabled by a repository admin, see note below)
**Purpose:** Populate the Iteration 2/3 backlog with one issue per risk sub-feature,
following the same format Tharun used for the tax backlog
(`project-docs/iteration-1/tax/sep25-tax-github-issues.md`).

> **Timeline note:** this task was scheduled for Sep 28. GitHub Issues was disabled
> at the repository level for the whole team until a repository admin re-enabled it.
> No issues existed anywhere in the repo before that (verified with `gh issue list`).
> The issues below were filed as soon as the feature was available. Each entry lists
> its real issue number and link, filed as part of this task, not claimed in advance.

## Issue 1 — Shared risk-rule engine extensions

**Title:** [Risk][Iteration 2] Extend the rule engine with concentration, volatility, cash and target-deviation rule types
**Issue:** #18 — https://github.com/Error404IsFound/ghostfolio-software-engineering-project-g1/issues/18
**Labels:** `feature: risk`
**Milestone:** Iteration 2

### Goal

Add the new rule classes the health score depends on, all extending the existing
`Rule` base class so they share its interface with the 17 current X-Ray rules.

### Scope

- `SingleStockConcentration`, `SectorConcentration`, `CountryConcentration` rules,
  grouping holdings by the shared formula (largest bucket's share of portfolio value).
- Restrict `SingleStockConcentration` to holdings with `assetSubClass` `STOCK` or
  `CRYPTOCURRENCY` — not ETFs or mutual funds.
- `PortfolioVolatility` and `CashAllocation` rules as band checks (min/max, not a
  single ceiling).
- `TargetAllocationDeviation` rule, only evaluated when a target is set.
- Each rule returns the existing `EvaluationResult` shape (`evaluation`, `value`).

### Implementation Notes

Reuse `groupCurrentHoldingsByAttribute()` where the grouping is a flat field
(stock, currency); sector and country need a variant that splits a holding's value
proportionally across its `sectors[]`/`countries[]` weights before grouping.

Likely touch:

- `apps/api/src/models/rule.ts`
- `apps/api/src/models/rules/` (new subfolders per rule)
- `apps/api/src/app/portfolio/portfolio.service.ts` (wiring into `getReport()`)

### Acceptance Criteria

- Every new rule extends `Rule` and returns `EvaluationResult`.
- Single-stock concentration excludes ETFs and mutual funds.
- Sector/country grouping correctly splits multi-sector/country holdings.
- Target-deviation rule does not run, and does not fail, when no target is set.

### Tests

Diversified ETF is not flagged by single-stock concentration; a holding split
70/30 across two sectors contributes proportionally to each bucket; volatility and
cash allocation both fail correctly above and below their bands; target deviation
returns no result with no target configured.

### Dependencies

None — builds directly on the existing rule engine.

### Out of Scope

Health score aggregation (Issue 2), warning severity (Issue 5), API endpoints
(Issue 7).

### Design Sources

`docs/sesha-notes/01-xray-current-logic.md`,
`docs/sesha-notes/03-concentration-formula-spec.md`,
`docs/sesha-notes/04-volatility-cash-allocation-spec.md`,
`docs/sesha-notes/05-deviation-from-target-allocation-spec.md`

---

## Issue 2 — Portfolio Health Score calculator

**Title:** [Risk][Iteration 2] Build the weighted Portfolio Health Score calculator
**Issue:** #19 — https://github.com/Error404IsFound/ghostfolio-software-engineering-project-g1/issues/19
**Labels:** `feature: risk`
**Milestone:** Iteration 2

### Goal

Aggregate every active rule's pass/fail result into one 0-100 score, using the
category and rule weights from the Sep 16 data model. This is the piece the
Iteration 2/3 plan does not otherwise schedule a build slot for — flagged during
Iteration 1's retrospective prep.

### Scope

- `HealthScoreCalculator` service: `score = (sum of weights of PASSED active
rules) / (sum of weights of ALL active rules) × 100`.
- Inactive rules excluded from both sides of the fraction, so weights renormalize.
- Category sub-scores using the same formula, scoped to one category.
- `score: null` with a reason when zero rules are active.
- Grade letter (A/B/C/D/F) derived from the score, not stored separately.

### Implementation Notes

Consumes only the existing `RuleInterface` output — no changes to individual
rule logic. Should be usable by the summary endpoint, the full score endpoint,
and the what-if simulator (Issue 6) without three separate implementations.

Likely touch: new `apps/api/src/app/risk/` module (per
`project-docs/target-architecture.md`).

### Acceptance Criteria

- Score matches the hand-worked example in `02-health-score-data-model.md`.
- Turning off a rule never lowers the score for a portfolio that would otherwise pass.
- Zero active rules produces `null`, not `0` or `100`.

### Tests

All rules pass (100); mixed pass/fail matches the weighted formula by hand;
all rules inactive returns null; one category fully excluded (e.g. no holdings)
does not corrupt other categories' weights.

### Dependencies

Issue 1 (rule types must exist to be aggregated).

### Out of Scope

Severity bands (Issue 5), API surface (Issue 7).

### Design Source

`docs/sesha-notes/02-health-score-data-model.md`

---

## Issue 3 — Volatility precomputation job

**Title:** [Risk][Iteration 2] Precompute portfolio volatility and covariance data nightly
**Issue:** #20 — https://github.com/Error404IsFound/ghostfolio-software-engineering-project-g1/issues/20
**Labels:** `feature: risk`
**Milestone:** Iteration 2

### Goal

Move the expensive N×N covariance calculation out of the request path into a
scheduled job, so `PortfolioVolatility` (Issue 1) and the what-if simulator
(Issue 6) can read a cached value instead of recomputing it per request.

### Scope

- Nightly job computing annualized per-holding volatility and the covariance
  matrix from `MarketData.marketPrice` history (90-day lookback default).
- Cache keyed so the what-if simulator can recompute portfolio-level volatility
  from new weights without redoing the covariance matrix itself.
- Graceful `NO_DATA` / `skippedRules` behavior when a symbol has under ~20 days
  of history.

### Implementation Notes

Reuses existing `MarketData` — no new data collection. Should follow the same
scheduling pattern as other existing nightly market-data jobs in the codebase.

### Acceptance Criteria

- A full covariance matrix, not a naive weighted average, is used for portfolio
  volatility, so diversification correctly lowers the estimate.
- A stale or missing cache degrades to `NO_DATA` rather than blocking the score.

### Tests

Two negatively-correlated holdings produce lower portfolio volatility than either
alone; a newly-added symbol with 5 days of history returns `NO_DATA`, not a
misleadingly precise number.

### Dependencies

None directly, but Issue 1's `PortfolioVolatility` rule and Issue 6's what-if
engine both read this cache.

### Out of Scope

Risk-tolerance-adjusted bands (open question, not in Iteration 2 v1).

### Design Source

`docs/sesha-notes/04-volatility-cash-allocation-spec.md`, Section 2.5

---

## Issue 4 — Target allocation settings storage

**Title:** [Risk][Iteration 2] Store and validate user-defined target allocation
**Issue:** #21 — https://github.com/Error404IsFound/ghostfolio-software-engineering-project-g1/issues/21
**Labels:** `feature: risk`
**Milestone:** Iteration 2

### Goal

Let a user optionally set a target allocation (by asset class, sector, country,
currency or symbol), stored the same way X-Ray rule thresholds already are.

### Scope

- `user.settings.targetAllocation` shape: `isActive`, `groupBy`, `targets[]`.
- Validation: percentages sum to 1 (0.0001 tolerance), no duplicate keys, every
  key valid for the chosen `groupBy`, rejected (not silently rescaled) on failure.
- No new Prisma table/migration.

### Implementation Notes

Follows the exact settings pattern `xRayRules` already uses on `User.settings`.

### Acceptance Criteria

- Invalid sums are rejected with a clear error, not auto-normalized.
- Buckets held but not present in the target are treated as an implicit 0%
  target by the deviation rule (Issue 1), not silently ignored.

### Tests

Sum = 0.9999 accepted (tolerance); sum = 0.9 rejected; unknown `groupBy` key
rejected; deleting the target makes the deviation rule stop running entirely.

### Dependencies

None.

### Out of Scope

The deviation calculation itself (Issue 1).

### Design Source

`docs/sesha-notes/05-deviation-from-target-allocation-spec.md`, Section 2

---

## Issue 5 — Warning severity (green/yellow/red) layer

**Title:** [Risk][Iteration 2] Add yellow/red severity thresholds on top of existing pass/fail
**Issue:** #22 — https://github.com/Error404IsFound/ghostfolio-software-engineering-project-g1/issues/22
**Labels:** `feature: risk`
**Milestone:** Iteration 2

### Goal

Turn each rule's binary pass/fail into a three-level severity (plus `NO_DATA`),
without introducing a second, disconnected threshold concept.

### Scope

- Add `redThresholdMax`/`redThresholdMin` alongside the existing
  `thresholdMax`/`thresholdMin` in `RuleSettings`.
- Severity logic: ceiling rules (concentration, target deviation) vs band rules
  (volatility, cash allocation) per the Sep 22 formulas.
- Health score severity bands (80/60 cutoffs) on the aggregate score.
- `RiskWarning` generation, sorted worst-first, with the message templates from
  the design doc.
- `topConcentrationRisk` tie-break logic for the dashboard summary field.

### Implementation Notes

The invariant to preserve: a rule fails if and only if its severity is yellow or
red — the yellow line is always the existing pass/fail threshold, never a
separate number.

### Acceptance Criteria

- Existing `thresholdMax` continues to determine pass/fail exactly as it does today.
- Single-stock concentration example from the proposal (25% red) and the Sep 17
  spec (10% yellow) are both correct simultaneously.
- Validation rejects thresholds in the wrong order (e.g. `redMax` below `max`).

### Tests

Value exactly on the yellow line stays green (per "fail if above," not
"at or above"); a value between yellow and red is yellow; band rule below the
red-min edge is red; invalid threshold ordering is rejected on save.

### Dependencies

Issue 1 (rules must exist), Issue 2 (score severity bands apply to the aggregate).

### Out of Scope

Frontend rendering of severity badges (Iteration 3, Issue 9).

### Design Source

`docs/sesha-notes/07-warning-threshold-rules.md`

---

## Issue 6 — What-if simulation engine

**Title:** [Risk][Iteration 2] Build the what-if (holding drop) simulation engine
**Issue:** #23 — https://github.com/Error404IsFound/ghostfolio-software-engineering-project-g1/issues/23
**Labels:** `feature: risk`
**Milestone:** Iteration 2

### Goal

Let a user simulate one holding dropping by X% and see the before/after impact
on portfolio value and the health score, without touching real data.

### Scope

- Pure function: copy holdings, shrink one holding's value, recompute weights
  for every holding in the copy, re-run Issue 1's rules and Issue 2's calculator
  on the copy.
- Split rules into value-based (re-evaluated) vs investment/fee-based (left
  unchanged) per the Sep 23 doc's table.
- Result includes `ruleChanges`, `newWarnings`, `resolvedWarnings`,
  `changedWarnings` — not just a before/after score.

### Implementation Notes

Must reuse Issue 1's rule classes and Issue 2's calculator directly — no
parallel scoring logic that could drift from the real score.

### Acceptance Criteria

- Running the same request twice gives the same answer (pure, no side effects).
- The worked example (40% AAPL drop pushing MSFT from yellow to red because the
  total shrank) reproduces exactly.
- Fee-ratio and buying-power rules are listed as unaffected, not silently rerun.

### Tests

Reproduce the worked example from `08-what-if-simulation-structure.md` Section 7
exactly; 100% drop zeroes the holding without erroring; invalid `dropPercentage`
(0, negative, above 1) is rejected; missing volatility cache lists that rule
under `skippedRules` instead of failing the whole simulation.

### Dependencies

Issue 1, Issue 2, Issue 3 (volatility cache), Issue 5 (severity for
`ruleChanges`).

### Out of Scope

What-if UI (Iteration 3, Issue 9).

### Design Source

`docs/sesha-notes/08-what-if-simulation-structure.md`

---

## Issue 7 — Risk API endpoints

**Title:** [Risk][Iteration 2] Implement the risk API contract (summary, score, warnings, concentration, target-allocation, thresholds, what-if)
**Issue:** #24 — https://github.com/Error404IsFound/ghostfolio-software-engineering-project-g1/issues/24
**Labels:** `feature: risk`
**Milestone:** Iteration 2

### Goal

Implement the eleven endpoints specified in the Sep 25 API contract as a new
`risk` module following the target architecture.

### Scope

- `apps/api/src/app/risk/`: `risk.controller.ts`, `risk.module.ts`,
  `risk.service.ts`, plus DTOs per endpoint (`get-risk-warnings.dto.ts`,
  `update-target-allocation.dto.ts`, `run-what-if.dto.ts`, etc.).
- Auth matching existing patterns: `portfolio:read` scope for reads,
  `portfolio:read:values` for money fields, `updateUserSettings` for writes.
- All error codes from the contract's Section 7.

### Implementation Notes

Depends on the shared `{ data, meta, error }` response envelope existing
somewhere in the codebase first — this does not exist yet anywhere in the
current implementation (verified while writing the contract) and needs to be
built as shared infrastructure, not duplicated per module. Flagging as a
blocking dependency rather than building a risk-only version of it.

### Acceptance Criteria

- Every endpoint in the contract exists with the exact request/response shape specified.
- Restricted-view users get `null` money values but real percentages/severities.
- Basic-subscription gating matches the existing X-Ray report's behavior
  (rules hidden, score visible) pending the open question in the contract.

### Tests

One test per endpoint against its documented example payload; restricted-view
and Basic-subscription variants; every documented error code triggers correctly.

### Dependencies

Issues 1, 2, 4, 5, 6. **Blocked on:** the shared response envelope
(interceptor + exception filter), owned by Raniya's architecture work per the
API contract's Section 10.

### Out of Scope

Frontend consumption (Iteration 3).

### Design Source

`docs/sesha-notes/10-risk-api-contract.md`

---

## Issue 8 — Risk engine unit test suite

**Title:** [Risk][Iteration 2] Unit test suite for the risk engine (Week 4 wrap-up)
**Issue:** #25 — https://github.com/Error404IsFound/ghostfolio-software-engineering-project-g1/issues/25
**Labels:** `feature: risk`
**Milestone:** Iteration 2

### Goal

Cover the full risk engine with unit tests before Iteration 3 builds UI on top
of it, per the Iteration 2 Week 4 plan ("Unit tests for risk engine; write up
results").

### Scope

Test suites for every rule in Issue 1, the health score calculator (Issue 2),
severity logic (Issue 5), and the what-if engine (Issue 6), using the worked
examples already documented in each design doc as the source of expected values.

### Implementation Notes

Every design doc under `docs/sesha-notes/03` through `08` already contains at
least one hand-worked numeric example specifically so it can be turned directly
into a test case.

### Acceptance Criteria

Every worked example in the design docs has a corresponding passing test.

### Dependencies

Issues 1, 2, 5, 6.

### Out of Scope

Integration tests against the live API (covered by Raniya's cross-feature
integration suite, per `project-docs/target-architecture.md`).

### Design Sources

`docs/sesha-notes/02` through `08`, "worked example" sections.

---

## Issue 9 — Risk dashboard React implementation

**Title:** [Risk][Iteration 3] Build the risk dashboard as React components
**Issue:** #26 — https://github.com/Error404IsFound/ghostfolio-software-engineering-project-g1/issues/26
**Labels:** `feature: risk`
**Milestone:** Iteration 3

### Goal

Implement the wireframed risk dashboard (score gauge, category bars, warnings,
concentration panel, volatility/cash cards, target-allocation card, what-if
panel, threshold settings) as React components wired to the Issue 7 endpoints.

### Scope

Components listed in `09-risk-dashboard-wireframe.md` Section 8:
`RiskScoreGauge`, `CategoryScoreBar`, `WarningList`, `ConcentrationPanel`,
`MetricCard`, `TargetAllocationCard`, `WhatIfPanel`/`WhatIfResult`,
`ThresholdSettingsForm`. Requests `SeverityBadge` and `BandMeter` as shared
components from Raniya's component library rather than building risk-only
copies.

### Implementation Notes

Every screen state in Section 5 of the wireframe doc (loading, empty portfolio,
no active rules, no target set, `NO_DATA`, restricted view, Basic subscription,
API error) must be handled, not only the happy path.

### Acceptance Criteria

Every component's data maps to the exact API field listed in the wireframe's
Section 4 table; no displayed value lacks a backing field.

### Dependencies

Issue 7 (API must exist first). `SeverityBadge`/`BandMeter` from Raniya's
shared component library.

### Out of Scope

Backend logic (Issues 1-8, already complete by Iteration 3).

### Design Source

`docs/sesha-notes/09-risk-dashboard-wireframe.md`
