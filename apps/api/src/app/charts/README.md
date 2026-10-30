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
- shared `{ data, meta, error }` envelopes and `CHARTS_*` error codes.

Not implemented on `main` yet:

- investment drawdown (`GET /charts/drawdown`) — planned in PR #167;
- total-return vs price-return comparison;
- benchmark comparison (open PR #160);
- contribution / waterfall;
- Iteration 3 React chart UI.

## Architecture

```text
apps/api/src/app/charts/
  charts.controller.ts   HTTP routes, envelope, error mapping
  charts-api.ts          range parsing, window resolution, orchestration
  contracts/             AJV schemas used by controller/e2e tests
libs/common/src/lib/
  chart-series.ts        series kind → points
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

## Planned: `GET /api/v1/charts/drawdown` (PR #167)

Not on `main` until #167 merges. When it lands, the intended contract is:

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

Planned calculation (matches #167's final code):

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

Until #167 merges, treat drawdown as planned — not implemented — in this README
and in `project-docs/iteration-2/charts-decision-record.md` (CD-1 / CD-4).

## Known Limitations

### Unimplemented chart types

Drawdown (#167), return comparison, benchmark comparison (#160), and waterfall
remain unimplemented on `main`. They are not exposed by this controller today.

### Series path vs Iteration 1 toggle spec

Iteration 1 proposed extending `GET /portfolio/performance` with `kind`.
As-built, series lives at `GET /api/v1/charts/series` so charts stay behind the
feature boundary from `project-docs/api-conventions.md`.

### Weekly point dates

Weekly points use the Monday week-start label, which may not be a date that
existed in the daily history. When drawdown lands, summary fields that must
stay on real data dates (max drawdown) are computed before thinning.

### No separate charts data store

Charts read the existing performance history. There is no charts-specific
schema migration.

## Testing

```text
npx jest --config libs/common/jest.config.ts libs/common/src/lib/chart-series.spec.ts
npx jest --config apps/api/jest.config.ts apps/api/src/app/charts --runInBand
```

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
