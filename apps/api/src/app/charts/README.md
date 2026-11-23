# Charts Backend

This directory contains the Iteration 2 charts backend for the Ghostfolio
extension project.

The module turns existing portfolio performance history into chart responses
under `/api/v1/charts/`. Range validation, granularity, and response envelopes
are shared across chart endpoints. Calculation helpers live in
`libs/common` so unit tests do not need the Nest controller.

This README is the as-built HTTP contract for what is on `main` today.
Iteration 1 design docs under `project-docs/iteration-1/audit/` remain useful
for intent, but where they disagree with this file (especially
`/portfolio/...` paths), this README wins.

Cross-module as-built boundaries:
`project-docs/iteration-2/architecture-as-built.md`.

## Main Responsibilities

The charts backend currently supports:

- shared time-range presets and custom `startDate` / `endDate` windows;
- server-side granularity (`daily` up to 2 years, `weekly` beyond);
- portfolio value / invested capital / cash series via `GET /charts/series`;
- investment drawdown via `GET /charts/drawdown`;
- shared `{ data, meta, error }` envelopes and `CHARTS_*` error codes.

Not implemented on `main` yet:

- total-return vs price-return comparison;
- benchmark comparison (open PR #160);
- contribution / waterfall. A React client in
  `libs/react-ui/src/lib/charts-waterfall` calls `GET /charts/waterfall`, but
  `ChartsController` does not expose that route.

Iteration 3 React views for series, range presets, and drawdown are in
`libs/react-ui`. They are not part of this Nest module.

## Architecture

```text
apps/api/src/app/charts/
  charts.controller.ts   HTTP routes, envelope, error mapping
  charts-api.ts          range parsing, window resolution, orchestration
  contracts/             AJV schemas used by controller/e2e tests
libs/common/src/lib/
  chart-series.ts        series kind → points
  drawdown.ts            performance index → drawdown points
  calculation-helper/    TimeRangeSelection → concrete dates
```

`PortfolioService.getPerformance({ dateRange: 'max', userId })` supplies the
historical series and earliest activity date. The client never sends history;
it only chooses range (and `kind` for series).

## Shared Range Contract

Every charts endpoint accepts the same range params:

```text
?range=1d|wtd|mtd|ytd|1y|5y|max
```

or

```text
?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
```

Rules:

- `range` and `startDate`/`endDate` are mutually exclusive (400 otherwise).
- `startDate` and `endDate` must both be present if either is (400 otherwise).
- `endDate` before `startDate` returns 400.
- `endDate` beyond today is clamped to today.
- `startDate` before the account's earliest activity is clamped to that date.
- Query `range=1d` maps to the internal preset `today`.
- Granularity is resolved server-side from served window width and returned in
  the response; clients do not request it.

An empty served window (for example a custom range entirely before the first
activity) returns a successful empty `points` array with the requested dates,
not an error.

## Current HTTP API

```text
GET /api/v1/charts/series
```

Requires `portfolioRead` scope and uses the shared API envelope:

```text
data: <chart response>
error: null
meta: {}
```

Invalid query params return HTTP `400` with:

```text
data: null
error:
  code: CHARTS_INVALID_QUERY
  message: <validation message>
meta: {}
```

Load/build failures return HTTP `500` with:

```text
CHARTS_SERIES_FAILED
```

Contract schema:

- [`contracts/chart-series.schema.ts`](./contracts/chart-series.schema.ts)

### `GET /api/v1/charts/series`

Extra query param:

```text
kind = portfolioValue | investedCapital | cash
```

Default when `kind` is omitted: `portfolioValue`.

Unknown `kind` values return `CHARTS_INVALID_QUERY`.

Response shape:

```ts
interface ChartSeriesResponse {
  kind: 'portfolioValue' | 'investedCapital' | 'cash';
  granularity: 'daily' | 'weekly';
  startDate: string;
  endDate: string;
  points: Array<{ date: string; value: number }>;
}
```

Value sources from each history row:

| `kind`            | Source field(s)                                                        |
| ----------------- | ---------------------------------------------------------------------- |
| `portfolioValue`  | `netWorth`, else holdings (`valueWithCurrencyEffect` / `value`) + cash |
| `investedCapital` | `totalInvestmentValueWithCurrencyEffect` ?? `totalInvestment`          |
| `cash`            | `totalCashInBaseCurrency`                                              |

Invested capital and cash are step / running values sampled onto the same date
index as portfolio value (including dates with no new activity). They are not
interpolated between those dates.

Weekly thinning keeps the last observed point of each Monday-start week and
relabels its date to that Monday.

## `GET /api/v1/charts/drawdown`

On `main` since #167. Contract:

```text
GET /api/v1/charts/drawdown
```

Error code on load/build failure: `CHARTS_DRAWDOWN_FAILED`.

Response shape:

```ts
interface DrawdownResponse {
  granularity: 'daily' | 'weekly';
  startDate: string;
  endDate: string;
  maxDrawdown: number;
  maxDrawdownDate: string;
  points: Array<{ date: string; drawdown: number; isNewPeak: boolean }>;
}
```

Calculation:

1. Index each history row as
   `100 × (1 + netPerformanceInPercentageWithCurrencyEffect)`.
   Cash deposits/withdrawals do not create false peaks the way `netWorth` would.
2. Track the running all-time peak over full history, even before `startDate`.
3. For each date in the served window:
   `drawdown = (index - peak) / peak` (zero or negative).
4. `maxDrawdown` / `maxDrawdownDate` are taken from the **daily** points before
   any weekly thinning, so a mid-week trough is not dropped.
5. When granularity is weekly, returned `points` are thinned (last day of each
   week, date relabelled to Monday); the max-drawdown summary still uses the
   daily trough date.

`project-docs/iteration-2/charts-decision-record.md` records this as CD-4.

## Known Limitations

### Unimplemented chart types

Return comparison, benchmark comparison (#160), and the waterfall route remain
unimplemented on `main`. They are not exposed by this controller today. The
waterfall React client is ahead of the route.

### Series path vs Iteration 1 toggle spec

Iteration 1 proposed extending `GET /portfolio/performance` with `kind`.
As-built, series lives at `GET /api/v1/charts/series` so charts stay behind the
feature boundary from `project-docs/api-conventions.md`.

### Weekly point dates

Weekly points use the Monday week-start label, which may not be a date that
existed in the daily history. Drawdown's max-drawdown summary is computed
before that thinning, so the trough date stays a real history date.

### No separate charts data store

Charts read the existing performance history. There is no charts-specific
schema migration.

## Testing

November 20, 2026 check, from `main` at `fb1efd6dd`. No production failure
turned up in these layers. The live journey on PR #327 failed in the demo
smoke job because the day before the first buy is an empty portfolio (value
0); the hand calculation now treats that point as 0.

Unit, calculation (`libs/common`):

```text
npx jest --config libs/common/jest.config.ts --testPathPatterns="chart-series|drawdown"
```

2 suites, 20 tests, all passed (`chart-series.spec.ts`, `drawdown.spec.ts`).

Unit and contract (`apps/api`, including the supertest charts e2e):

```text
npx jest --config apps/api/jest.config.ts --testPathPatterns="apps/api/src/app/charts"
```

3 suites, 41 tests, all passed.

Component and client (`libs/react-ui`):

```text
npx jest --config libs/react-ui/jest.config.ts --testPathPatterns="chart-series|charts-drawdown|charts-waterfall|chart-wrapper|dashboard-charts"
```

9 suites, 47 tests, all passed. Covers the series card, interactive range
chart, drawdown card, waterfall card, chart wrapper, and the dashboard charts
summary. Waterfall tests mock `GET /charts/waterfall`; that route is still
absent.

Live UI-to-API (`INTEGRATION_API_URL` required, otherwise the files skip):

```text
INTEGRATION_API_URL=http://localhost:3333 npx jest -c libs/react-ui/jest.integration.config.ts
```

`dashboard-flow.integration.tsx` checks `GET /charts/series?range=1y` (latest
value 1055). `charts-journey.integration.tsx` walks Max → YTD → invested
capital → cash, then YTD drawdown. Not re-run locally on November 20; the
demo job for #327 is the failure this calculation fix addresses.

Browser (`e2e/tests/dashboard.spec.ts`): the home chart's latest value is
1055 and matches the overview performance card. Not re-run locally on
November 20.

Repository checks used during Iteration 2 include:

```text
npx nx run api:lint
npx nx format:check
npx nx run api:build
git diff --check
```

## Design Docs

| Area                                   | Doc                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------- |
| Zoom / pan / selectable time range     | `project-docs/iteration-1/audit/zoom-pan-time-range-data-spec.md`                     |
| Value / invested capital / cash toggle | `project-docs/iteration-1/audit/portfolio-value-invested-capital-cash-toggle-spec.md` |
| Total return vs. price return          | `project-docs/iteration-1/audit/total-return-vs-price-return-comparison-spec.md`      |
| Contribution / waterfall               | `project-docs/iteration-1/audit/contribution-waterfall-chart-data-structure.md`       |
| Benchmark comparison                   | `project-docs/iteration-1/audit/benchmark-comparison-data-model.md`                   |
| Drawdown                               | `project-docs/iteration-1/audit/drawdown-chart-calculation-spec.md`                   |
| Overall architecture                   | `project-docs/design-architecture-charts.md`                                          |
| Cross-module as-built                  | `project-docs/iteration-2/architecture-as-built.md`                                   |
| Charts as-built decisions              | `project-docs/iteration-2/charts-decision-record.md`                                  |
