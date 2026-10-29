# Design Doc: Portfolio Value / Invested Capital / Cash Toggle - Data Spec

**Status:** Implemented (Iteration 2) as `GET /api/v1/charts/series`
**Author:** _fill in_
**Scope:** Original Iteration 1 design. As-built route/shape supersede the
`/portfolio/performance?kind=` proposal — see
`apps/api/src/app/charts/README.md` and CD-3 in
`project-docs/iteration-2/charts-decision-record.md`.

## 1. Summary

The performance chart today shows a single series: portfolio value over time. This doc proposes a data spec for a toggle that lets a user switch what that series represents, between portfolio value, invested capital (net contributions), and cash balance, without needing three separate chart components or three separate endpoints.

## 2. Problem Statement

A user watching their portfolio value line go up has no easy way to tell how much of that is market performance versus how much is just money they put in. Two related questions people ask:

- "How much of this growth is mine versus the market's?" (portfolio value vs. invested capital)
- "How much of my portfolio is sitting uninvested right now, over time?" (cash)

Right now the only way to approximate this is to look at separate pages (allocation, cash accounts) and mentally line up dates. There's no shared chart series concept that can represent any of these three, so the toggle can't be built without first agreeing on what data shape backs it.

## 3. Current State (for context)

The performance chart today fetches a single time series tied to portfolio value:

```ts
interface ChartSeriesResponse {
  granularity: 'daily' | 'weekly';
  startDate: string;
  endDate: string;
  points: Array<{ date: string; value: number }>;
}
```

`value` here is implicitly "portfolio value" and nothing else. Invested capital is computed elsewhere (as a single current-day number, for ROI calculations) but not as a historical series. Cash balance is tracked per account as a current snapshot, not as a time series either.

## 4. Goals

- Define a `ChartSeriesKind` enum so the frontend and backend agree on what a requested series represents.
- Extend the chart series response so each of the three kinds returns points in the same shape, so the chart component doesn't need per-kind rendering logic.
- Define how invested capital and cash are computed as historical series, since today they only exist as current-day numbers.
- Keep this compatible with the time-range selection spec (custom ranges, granularity resolution) already defined separately, so the toggle and the zoom/pan work don't conflict.

## 5. Non-Goals

- Changing how invested capital or cash are calculated for their current, non-historical uses elsewhere in the app (e.g. the ROI card, the accounts page).
- Multi-series overlay (showing more than one of the three at once on the same chart). That's a reasonable follow-up but is left for a later doc, this one only covers a single active toggle at a time.
- Currency conversion edge cases beyond what the existing performance endpoint already handles.

## 6. Proposed Data Spec

### 6.1 `ChartSeriesKind`

```ts
type ChartSeriesKind = 'portfolioValue' | 'investedCapital' | 'cash';
```

This is passed alongside the existing `range` or custom `startDate`/`endDate` params, defaulting to `portfolioValue` so existing callers see no change in behavior if they never send it.

### 6.2 Response shape

Reuse the existing `ChartSeriesResponse` shape and just tag which kind it is, so the frontend can label the axis and tooltip correctly without guessing:

```ts
interface ChartSeriesResponse {
  kind: ChartSeriesKind;
  granularity: 'daily' | 'weekly';
  startDate: string;
  endDate: string;
  points: Array<{ date: string; value: number }>;
}
```

`value` means something different per kind, but is always a single number in the account's base currency, so the chart component itself doesn't need to branch on `kind` to render the line, only to label it.

### 6.3 What each kind means, as a series

- **`portfolioValue`**: unchanged from today. Market value of all holdings plus cash, at each point in time.
- **`investedCapital`**: cumulative net contributions up to each point in time, meaning deposits minus withdrawals, running forward chronologically through the account's activity history. This is a step function that only changes on days with a buy/sell/transfer activity, not a smooth daily curve, and the chart should be allowed to render it as such (e.g. a step-line) rather than assuming smooth interpolation.
- **`cash`**: cash account balance at each point in time, computed the same way account balances are computed today, just sampled across the requested date range instead of only at "now."

### 6.4 Relationship to the time-range spec

This reuses the same `TimeRangeSelection` (preset or custom) and the same granularity resolution rules already defined for zoom/pan. A `kind` param and a `TimeRangeSelection` are fully independent of each other, changing one should never require re-deriving the other. This means a user can zoom into a narrow window on any of the three kinds, and pan/zoom state should be preserved across a toggle switch rather than reset, since the user is very likely trying to compare the same window across kinds.

## 7. API Impact

### 7.1 Request shape

```
GET /api/v1/portfolio/performance?range=1y&kind=investedCapital
GET /api/v1/portfolio/performance?startDate=2026-01-01&endDate=2026-06-01&kind=cash
```

Validation rules:

- `kind` is optional, defaults to `portfolioValue`.
- An unrecognized `kind` value returns a 400 rather than silently falling back, so a frontend bug doesn't quietly show the wrong series.
- All existing range validation rules from the time-range spec apply unchanged, `kind` doesn't affect date validation.

### 7.2 Response shape

As shown in 6.2. The added `kind` field is the only change to the response body, so existing clients that don't send `kind` and don't read it keep working exactly as before.

## 8. Frontend State Model

The chart component holds `kind: ChartSeriesKind` as a small piece of state alongside the existing `TimeRangeSelection`. Switching `kind` triggers a re-fetch with the same range but a different `kind` param, it does not reset the range. The three toggle options can be rendered as a simple segmented control above or below the existing range preset buttons.

## 9. Edge Cases

- **No activity yet in the selected range**: `investedCapital` returns a flat line at whatever the cumulative contribution was entering the range (possibly zero), not an empty series, since "how much have I put in as of this date" is always a well defined number even with no activity inside the visible window.
- **Cash goes negative briefly**: if margin or a pending settlement causes a momentary negative cash balance, the series should reflect that as-is rather than clamping to zero, since hiding it would be misleading.
- **Account added mid-range**: if an account is added partway through the selected window, its cash and invested-capital contributions before its creation date are simply absent (treated as zero), consistent with how it doesn't exist yet for portfolio value either.
- **Multi-currency accounts**: `value` in all three kinds is already expected to be converted to the account's base currency, same as the existing `portfolioValue` series does today. No new conversion logic needed, just applied consistently to the other two kinds.

## 10. Backward Compatibility

- Existing clients that never send `kind` keep getting `portfolioValue`, identical to current behavior.
- The added `kind` field in the response is additive.
- No database schema changes. `investedCapital` and `cash` as historical series are computed from existing activity/account data, not stored separately.

## 11. Open Questions

- Should `investedCapital` be rendered as a step line or interpolated smoothly in the chart itself? Leaning step line since it's a more honest representation of a value that only changes on discrete days, but this is a rendering choice for Iteration 2, not a data shape question.
- Do we want a fourth kind later for "invested capital plus cash" as a combined baseline to compare against `portfolioValue`? Deferring, since it's really a multi-series overlay concern and out of scope per section 5.
- Should switching `kind` reset any active zoom, or preserve it as proposed in 6.4? Proposing preserve, open to feedback if user testing suggests otherwise.

## 12. Summary of Proposed Changes

- Add `ChartSeriesKind` (`portfolioValue` | `investedCapital` | `cash`) as a shared type.
- Add optional `kind` query param to chart/performance endpoints, defaulting to `portfolioValue`.
- Add `kind` field to the chart series response.
- Define `investedCapital` and `cash` as historical series computed from existing data, reusing current-day calculation logic sampled across a date range.
- No schema changes.
