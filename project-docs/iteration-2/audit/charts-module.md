# Charts Module

This module covers the chart subsystem: selectable time range (zoom/pan), the value/invested-capital/cash toggle, total-return vs. price-return comparison, the contribution/waterfall chart, benchmark comparison, and the drawdown chart. Full design docs for each live in `/docs/design/`, this README is the quick-reference API contract.

## Shared range contract

Every endpoint below accepts the same range params, so client code only needs to implement range handling once.

```
?range=1d|wtd|mtd|ytd|1y|5y|max
```

or

```
?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
```

Rules:

- `range` and `startDate`/`endDate` are mutually exclusive, sending both returns 400.
- `startDate`/`endDate` must both be present if either is, returns 400 otherwise.
- `endDate` before `startDate` returns 400.
- `endDate` beyond today is clamped to today.
- `startDate` before the account's earliest activity is clamped to that date.
- Granularity is resolved server-side from range width (daily up to 2 years, weekly beyond) and returned in the response, not requested by the client.

## Endpoints

Endpoints fall into two groups: one existing portfolio endpoint that this work extends, and four new endpoints that live under the charts feature boundary per the shared API convention.

### Reused existing endpoint (extended, not new)

#### `GET /api/v1/portfolio/performance`

This endpoint already exists in Ghostfolio for portfolio value. This work only adds the `kind` param and the historical series for `investedCapital`/`cash`, it does not move or duplicate the endpoint. It stays under `/portfolio/` because it's a change to existing portfolio functionality, not a new charts feature.

Extra param: `kind` = `portfolioValue` (default) | `investedCapital` | `cash`

```ts
interface ChartSeriesResponse {
  kind: 'portfolioValue' | 'investedCapital' | 'cash';
  granularity: 'daily' | 'weekly';
  startDate: string;
  endDate: string;
  points: Array<{ date: string; value: number }>;
}
```

### New endpoints (under the charts feature boundary)

#### `GET /api/v1/charts/return-comparison`

Total return vs. price return, indexed to base 100 at `startDate`.

Extra param: `symbol` (optional, omit for whole-portfolio scope)

```ts
interface ReturnComparisonResponse {
  granularity: 'daily' | 'weekly';
  startDate: string;
  endDate: string;
  points: Array<{ date: string; priceReturn: number; totalReturn: number }>;
}
```

#### `GET /api/v1/charts/benchmark-comparison`

Portfolio total return vs. a benchmark symbol, both indexed to base 100.

Required param: `benchmark` (a market-data symbol, same lookup as adding a holding)

```ts
interface BenchmarkComparisonResponse {
  granularity: 'daily' | 'weekly';
  startDate: string;
  endDate: string;
  benchmarkSymbol: string;
  benchmarkAvailableFrom: string;
  points: Array<{
    date: string;
    portfolioReturn: number;
    benchmarkReturn: number;
  }>;
}
```

#### `GET /api/v1/charts/drawdown`

Percentage decline from the portfolio's running all-time peak. Peak tracking always uses full account history, even when the requested range starts later.

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

#### `GET /api/v1/charts/waterfall`

Discrete start/contribution/end segments explaining a period's value change.

Extra param: `breakdown` = `portfolio` (default) | `holding`

```ts
type WaterfallSegment =
  | { kind: 'start'; label: string; value: number }
  | {
      kind: 'contribution';
      label: string;
      value: number;
      category: 'netCashFlow' | 'marketGainLoss' | 'dividends';
      holdingSymbol?: string;
    }
  | { kind: 'end'; label: string; value: number };

interface WaterfallResponse {
  startDate: string;
  endDate: string;
  currency: string;
  segments: WaterfallSegment[];
}
```

> Note: moving the four new endpoints under `/api/v1/charts/` is a naming change from the original spec docs, which proposed them under `/portfolio/`. The response shapes and params are unchanged, only the route prefix differs. The spec docs themselves still show the old `/portfolio/...` paths and should be updated to match before merge, or footnoted as superseded by this README.

## Design docs

| Area                                   | Doc                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------- |
| Zoom / pan / selectable time range     | `project-docs/iteration-1/audit/zoom-pan-time-range-data-spec.md`                     |
| Value / invested capital / cash toggle | `project-docs/iteration-1/audit/portfolio-value-invested-capital-cash-toggle-spec.md` |
| Total return vs. price return          | `project-docs/iteration-1/audit/total-return-vs-price-return-comparison-spec.md`      |
| Contribution / waterfall               | `project-docs/iteration-1/audit/contribution-waterfall-chart-data-structure.md`       |
| Benchmark comparison                   | `project-docs/iteration-1/audit/benchmark-comparison-data-model.md`                   |
| Drawdown                               | `project-docs/iteration-1/audit/drawdown-chart-calculation-spec.md`                   |
| Overall architecture                   | `project-docs/iteration-1/audit/design-architecture-charts.md`                        |

Paths are relative to the repo root: [github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/tree/main/project-docs/iteration-1/audit).
