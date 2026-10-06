# Iteration 1 Retrospective Prep — Risk Feature

**Prepared by:** Sesha Siva Sankar
**Iteration:** 1 — Design & Data Modelling
**Date:** September 30, 2026
**Feature:** Portfolio Health & Risk Analysis
**Purpose:** Retrospective preparation and Iteration 2 handoff

> This document is preparation for the Iteration 1 retrospective. It does not
> claim that the retrospective meeting has already taken place. Meeting-specific
> details such as attendance, final team comments, and the board photo should
> be added after the actual retrospective.

## 1. Iteration 1 Objective

The purpose of Iteration 1 was to read the existing Ghostfolio X-Ray code,
design the portfolio health and risk feature in detail, and prepare an
implementation-ready backlog for Iteration 2.

No risk-engine implementation was planned for this iteration.

The risk work focused on:

- reading and documenting the existing X-Ray rule-based logic;
- defining the 0-100 Portfolio Health Score data model;
- specifying concentration checks (stock, sector, country, currency);
- specifying volatility and cash-allocation scoring;
- specifying deviation-from-target-allocation logic;
- producing UML use case, class and activity diagrams for all four proposed
  features;
- defining warning-threshold (green/yellow/red) rules;
- designing the what-if simulation data structure;
- wireframing the risk dashboard;
- writing the risk API contract;
- peer-reviewing Tharun's tax data model;
- writing the risk Design and Architecture report section.

## 2. Completed Risk Deliverables

The following Iteration 1 risk documents were completed and merged:

```text
01-xray-current-logic.md
02-health-score-data-model.md
03-concentration-formula-spec.md
04-volatility-cash-allocation-spec.md
05-deviation-from-target-allocation-spec.md
06-uml-diagrams.md
07-warning-threshold-rules.md
08-what-if-simulation-structure.md
09-risk-dashboard-wireframe.md
10-risk-api-contract.md
peer-review-tharun-tax-data-model.md
risk-design-architecture-report-section.md
```

The completed work provides the design baseline for the Iteration 2 risk
backend.

## 3. Main Risk Design Decisions

The main decisions from Iteration 1 were:

1. Treat the health score as a layer on top of the existing 17-rule X-Ray
   engine rather than a redesign of it — every new check extends the same
   `Rule` base class and returns the same `EvaluationResult` shape.

2. Score formula:

   ```text
   score = (sum of weights of PASSED active rules)
           / (sum of weights of ALL active rules) x 100
   ```

   with inactive rules excluded and the rest renormalized, so opting out of a
   rule never costs points.

3. Reuse the existing `user.settings.xRayRules` settings pattern for new
   per-rule thresholds, and the same pattern again for a new
   `user.settings.targetAllocation` key, instead of new Prisma tables for
   features that may still change shape.

4. Restrict single-stock concentration to holdings with asset sub-class
   `STOCK` or `CRYPTOCURRENCY`, after identifying that a naive by-symbol
   grouping would have flagged a diversified ETF as a concentration risk.

5. Combine per-holding volatility into portfolio volatility using a full
   covariance matrix, not a weighted average, so real diversification lowers
   the score instead of being ignored — and precompute it nightly rather than
   per request, since the matrix is expensive to calculate.

6. Extend the existing pass/fail threshold into a severity layer (yellow =
   existing threshold, red = one new threshold added on top) instead of
   introducing a second, disconnected warning concept.

7. Run the what-if simulator through the exact same rule and scoring code
   used for the real score, on a copied and modified holdings set, so there
   is one calculation path, not two that can drift apart.

8. Make deviation-from-target-allocation the one category that is optional
   at the data level, not just the toggle level: no target set means no
   evaluation, never a fail.

## 4. What Went Well

### Repository-first design

Every spec started from reading the existing code — the X-Ray rule engine,
the Prisma schema's asset-class enums, the `MarketData` price history — before
writing anything new. This is what caught the ETF/single-stock issue in
Section 3.4 during design instead of during implementation.

### One consistent rule shape across old and new checks

Because every new rule (concentration, volatility, cash, target deviation)
follows the exact interface the 17 existing rules already use, the health
score, the severity layer, and the what-if simulator could all be built as
generic logic over "a list of rules," rather than needing special cases for
"new" versus "existing" checks.

### Cross-feature alignment was checked, not assumed

The risk API contract was written after reading Raniya's API conventions and
dashboard field spec, and it explicitly reconciles field-by-field with what
her dashboard expects (`docs/sesha-notes/10-risk-api-contract.md`, Section 8).
The gap that surfaced from that check — the shared `{ data, meta, error }`
response envelope does not exist anywhere in the codebase yet — is exactly
the kind of integration risk a design-phase check is meant to catch before
four people build against an assumption that was never actually true.

### A design inconsistency in my own docs was caught and resolved

An early spec set single-stock concentration's fail line at 10%, while the
project proposal's own example says "more than 25% in one stock." Rather than
picking one and discarding the other, the warning-threshold design resolved
both as correct: 10% is the yellow line, 25% is the red line. Documenting the
reasoning, not just the number, made it possible to reconcile what looked
like a contradiction.

### Diagrams were checked against real names, not invented ones

The UML class diagrams reused field names already confirmed in the codebase
or in teammates' merged docs (Tharun's `withholdingTax`, Arthur's
`TimeRangeSelection`) rather than guessing at shapes, and openly flagged the
two names that were still assumptions (`isTaxRelevant`, `SeriesType`) so they
could be corrected once confirmed — see Section 6 for the outcome of that
check.

## 5. What Could Be Improved

### Some tasks were completed later than their scheduled date

The Sep 21–25 tasks (target deviation, warning thresholds, what-if structure,
wireframe, API contract) were designed and merged together on Sep 26 rather
than on each individual scheduled day. The content does not depend on being
written same-day, but daily delivery is part of the sprint's own rule, and
slipping several days in a row is worth naming directly rather than only
fixing quietly.

### GitHub Issues could not be filed on schedule

The Sep 28 task — filing GitHub issues for every risk sub-feature — could not
be completed on the day it was scheduled because Issues are disabled at the
repository level, and this account does not have the admin access needed to
re-enable them. This is the same category of risk Tharun's tax retrospective
already flagged: a Markdown backlog is not a substitute for actual tracked
issues when the assignment expects issue tracking, and the report should not
claim issue numbers that were never actually created. This needs a repository
owner to enable Issues before it can be resolved, and should be raised with
the team directly rather than worked around.

### Shared architecture decisions needed by risk are still open

Two dependencies outside this feature's control are blocking full
Iteration 2 readiness:

- the shared response envelope (Section 3, item above) needs an owner and a
  build slot, since no risk endpoint can return data in the agreed shape
  without it;
- a user-level risk-tolerance setting does not exist yet, which is why the
  volatility band was specified as one fixed default range instead of
  something that adapts per user, flagged as an open question rather than
  quietly assumed away.

### Branch and PR hygiene matches the pattern already flagged by tax

Risk's own history shows the same pattern Tharun's retrospective already
named for the team generally: several small, mergeable docs sitting
unpushed for a few days before being committed and PR'd together. Committing
and opening a PR closer to when each document is finished, rather than
batching, would make peer review easier and keep `main` closer to current
day by day.

## 6. Problems / Risks Identified

### Health score has no build slot of its own in the Iteration 2 plan

The weekly Iteration 2/3 plan schedules the individual rule engines
(concentration, volatility, warning-threshold engine, what-if simulator) but
never explicitly schedules `HealthScoreCalculator` — the piece that actually
aggregates rule results into the 0-100 number the dashboard shows. Iteration 3
assumes a "score endpoint" already exists. This needs its own backlog item so
it is not silently skipped.

### What-if results can surface counterintuitive score movement

Because shrinking one holding raises every other holding's _share_ of a
now-smaller total, a drop in one stock can push a completely different,
untouched holding from yellow into red. This is documented behavior
(`08-what-if-simulation-structure.md`, Section 7), not a bug, but the
frontend must surface _why_ a warning changed (via `ruleChanges` and
`changedWarnings`), not just show a new number, or the result will look wrong
to users even though it is correct.

### Rules with no threshold configuration still need a scoring weight

A handful of existing rules (for example `AccountClusterRiskSingleAccount`)
are structural yes/no checks with nothing to tune. This does not block the
health score — weight only cares whether a rule passed, not whether it is
configurable — but it is worth confirming during Iteration 2 implementation
that these rules are not accidentally skipped by code that assumes every rule
has a `thresholdMax`.

## 7. Iteration 2 Readiness Summary

| Area                                                                    | Status                                                                      |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Data models (score, concentration, volatility, cash, target allocation) | Specified, ready to implement                                               |
| Warning-threshold (severity) model                                      | Specified, ready to implement                                               |
| What-if simulation                                                      | Specified, ready to implement                                               |
| Dashboard wireframe                                                     | Complete, component-to-field mapping done                                   |
| API contract                                                            | Complete, reconciled with dashboard's field spec                            |
| GitHub issue backlog                                                    | **Blocked** — repository Issues feature disabled, needs a repo admin        |
| Shared response envelope                                                | **Blocked on Raniya/architecture** — not yet built anywhere in the codebase |
| Risk-tolerance-aware volatility bands                                   | Open question, not required for Iteration 2 v1                              |
