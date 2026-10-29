# Charts Decision Record — Iteration 2 As-Built

**Owner:** Arthur (charts)
**Iteration:** 2 — Backend Development
**Date:** October 29, 2026
**Status:** Final Iteration 2 backend reconciliation for implemented charts routes
**Scope:** Documentation of implemented charts behavior; no new calculation features

Iteration 1 left chart designs under `project-docs/iteration-1/audit/` with
placeholder `/portfolio/...` paths and "docs only" status. This record closes
the gap between those specs and the backend that shipped under
`/api/v1/charts/`.

For the live HTTP contract, see `apps/api/src/app/charts/README.md`.

## CD-1 — Feature Boundary Routes

### Question

Should new chart endpoints extend existing `/api/v1/portfolio/...` routes or
live under `/api/v1/charts/...`?

### Decision

New chart responses live under `/api/v1/charts/`, matching
`project-docs/api-conventions.md`.

As-built:

```text
GET /api/v1/charts/series
GET /api/v1/charts/drawdown
```

Iteration 1 specs that still show `/portfolio/performance`,
`/portfolio/drawdown`, etc. are superseded for routing by the module README.

### Consequences

- Charts share one Nest module, envelope, and `CHARTS_*` error prefix.
- Portfolio performance loading stays inside `PortfolioService`; charts only
  reshape that history.

## CD-2 — Shared Range and Granularity

### Question

Who owns range validation and daily-vs-weekly thinning?

### Decision

Every charts endpoint uses the same query contract and the shared
`TimeRangeSelection` resolver in `libs/common`:

- preset `range` **or** custom `startDate`/`endDate` (mutually exclusive);
- clamp `endDate` to today and `startDate` to earliest activity;
- granularity: daily when the served window is ≤ 2 years, otherwise weekly;
- weekly points keep the last day of each Monday-start week.

Clients never send granularity.

### Consequences

- One validation path in `ChartsApi`; empty windows return empty `points`.
- Drawdown max summary must not rely on weekly-thinned points alone (CD-4).

## CD-3 — Series Kinds on a Dedicated Endpoint

### Question

Should `kind` extend `GET /portfolio/performance`, or should charts expose a
dedicated series endpoint?

### Decision

As-built series is `GET /api/v1/charts/series` with:

```text
kind = portfolioValue | investedCapital | cash
```

Default: `portfolioValue`.

Values come from existing performance-history fields (`netWorth`, investment
totals, cash). Invested capital and cash are sampled onto the portfolio-value
date index as step / running series.

### Consequences

- Toggle chart work does not change the legacy portfolio performance response
  shape used elsewhere in Ghostfolio.
- Iteration 1 toggle-spec path `/portfolio/performance?kind=` is superseded.

## CD-4 — Drawdown Index and Max Summary

### Question

Should drawdown track `netWorth` (Iteration 1 draft), and when should
`maxDrawdown` be measured relative to weekly thinning?

### Decision

1. **Index:** drawdown uses
   `100 × (1 + netPerformanceInPercentageWithCurrencyEffect)`.
   Deposits and withdrawals must not create false peaks or fake losses.
2. **Peak window:** running peak uses full history before the selected range;
   returned `points` cover only the served window.
3. **Max summary:** `maxDrawdown` / `maxDrawdownDate` are computed from daily
   points **before** weekly thinning, then weekly points may still be returned
   for long ranges.

### Consequences

- Matches investment drawdown intent better than portfolio-value drawdown.
- Mid-week troughs remain visible in the summary even when `points` are weekly.
- Iteration 1 drawdown formula text that says "portfolio value" is superseded
  for the implemented endpoint.

## CD-5 — Deferred Chart Types

### Question

Which Iteration 1 chart types remain unimplemented at this reconciliation?

### Decision

Still design-only (not exposed by `ChartsController`):

```text
return-comparison
benchmark-comparison
waterfall
```

No README or decision here should describe them as built.

### Consequences

- Later PRs can add routes without rewriting series/drawdown contracts.
- Iteration 1 specs for those three remain the design source until implemented.

## Final Iteration 2 Status

| Decision | Final as-built status | Notes                                                             |
| -------- | --------------------- | ----------------------------------------------------------------- |
| CD-1     | Implemented           | Routes under `/api/v1/charts/`                                    |
| CD-2     | Implemented           | Shared range + ≤2y daily / else weekly                            |
| CD-3     | Implemented           | `GET /charts/series` with three kinds                             |
| CD-4     | Implemented           | Performance-index drawdown; max from daily before weekly thinning |
| CD-5     | Deferred              | Return comparison, benchmark, waterfall not in this controller    |

## Testing Gate

Charts calculation and HTTP coverage used during Iteration 2:

```text
libs/common chart-series + drawdown unit tests
apps/api charts controller + e2e contract tests
```
