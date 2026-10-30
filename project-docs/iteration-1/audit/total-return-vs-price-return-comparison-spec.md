# Design Doc: Total Return vs Price Return Comparison - Data Spec

**Status:** Draft (Iteration 1) — not implemented in Iteration 2 backend
**Author:** _fill in_
**Scope:** Design only. Planned route if implemented:
`GET /api/v1/charts/return-comparison`. See CD-5 in
`project-docs/iteration-2/charts-decision-record.md`.

## 1. Summary

The performance chart today plots portfolio value based on market price movement, and dividends are tracked separately, but there's no view that shows how much dividends and other distributions actually contributed to overall return. This doc proposes a data spec for a comparison between total return (price movement plus reinvested/collected distributions) and price return (price movement alone), as two series that can be shown together on the same chart.

## 2. Problem Statement

A holding that pays a steady dividend can look flat or even negative on a pure price chart while still delivering a healthy return once dividends are counted. Right now there's no way to see that gap. Users have to separately check the dividend calendar/totals and mentally combine that with the price chart to understand it. This is especially relevant for dividend-focused or income-focused portfolios where price return alone understates what the holding actually delivered.

## 3. Current State (for context)

The chart series today (as used by the range and toggle specs already written) represents portfolio value, which does already include the effect of cash from collected dividends sitting in the account, but it does not show that contribution as a distinct, comparable line. Dividend data itself exists per activity, tied to individual holdings, but isn't currently expressed as a cumulative time series that can be compared point-for-point against a price series.

## 4. Goals

- Define what "price return" and "total return" mean as two individually well-defined time series, not just a single blended number.
- Define a comparison response shape that returns both series aligned to the same dates, so the chart can draw them together without the frontend having to reconcile two separately-fetched, potentially misaligned series.
- Make this work at both the single-holding level and the whole-portfolio level, since the question "how much did dividends help" is meaningful at both scales.
- Keep this compatible with the existing time-range and granularity rules already defined, so this doesn't introduce a second, incompatible notion of date range.

## 5. Non-Goals

- Tax treatment of dividends (qualified vs. non-qualified, withholding tax, etc.). That's covered by the separate withholding-tax design work and isn't touched here.
- Changing how ROI/ROAI are calculated as single current-day numbers. This is about historical series for charting, not the summary metrics shown elsewhere.
- Benchmark comparison (comparing total return against a market index). That's a related but separate feature, out of scope here.

## 6. Proposed Data Spec

### 6.1 Definitions

- **Price return**: the return attributable purely to the change in market price of the holding(s), ignoring any distributions. Expressed as an indexed value starting at a base of 100 (or 1.0) at the start of the selected range, so the two series are visually comparable in percentage terms regardless of the holding's absolute price.
- **Total return**: the same, but with distributions (dividends, interest, or other cash payouts) added back in as if reinvested at the time received, or simply accumulated as cash contribution to return, whichever convention the existing ROAI calculation already uses. This spec reuses that convention rather than introducing a second one, so total return here stays consistent with the total return number already shown elsewhere in the app.

Both are indexed series, not absolute currency values, since the point of the comparison is the shape of the gap between them, not the absolute portfolio value (which is already covered by the existing `portfolioValue` chart kind).

### 6.2 Response shape

```ts
interface ReturnComparisonResponse {
  granularity: 'daily' | 'weekly';
  startDate: string;
  endDate: string;
  points: Array<{
    date: string;
    priceReturn: number; // indexed, base 100 at startDate
    totalReturn: number; // indexed, base 100 at startDate
  }>;
}
```

Both values are given per date so the chart can draw two aligned lines from a single response, rather than the frontend fetching two series and matching them up by date itself, which would be fragile if the two series ever had gaps on different dates.

### 6.3 Scope parameter

Since this is meaningful both per-holding and for the whole portfolio, the request needs to specify which:

```ts
type ReturnComparisonScope =
  { level: 'portfolio' } | { level: 'holding'; symbol: string };
```

At the portfolio level, distributions from all holdings are aggregated. At the holding level, only that holding's own distributions count.

### 6.4 Relationship to the time-range and toggle specs

This reuses the same `TimeRangeSelection` and granularity rules from the zoom/pan spec. It's a distinct endpoint/response shape from the `kind` toggle spec (portfolio value / invested capital / cash) rather than a fourth `kind`, since those are absolute-value series and this is an indexed comparison, mixing the two into one response shape would make the response ambiguous about units. They can still be shown as separate views the user switches between, but the specs stay independent.

## 7. API Impact

### 7.1 Request shape

```
GET /api/v1/portfolio/return-comparison?range=1y
GET /api/v1/portfolio/return-comparison?range=1y&symbol=AAPL
GET /api/v1/portfolio/return-comparison?startDate=2026-01-01&endDate=2026-06-01&symbol=AAPL
```

Absence of `symbol` implies portfolio-level scope. Validation rules:

- If `symbol` is present but not held in the account (currently or historically) within the requested range, return a 404 rather than an empty series, since that's likely a client bug (typo, stale symbol) rather than a legitimate empty state.
- All existing date-range validation rules apply unchanged.
- A holding with zero distributions in the range still returns valid data, with `priceReturn` and `totalReturn` simply equal to each other for that entire range.

### 7.2 Response shape

As shown in 6.2. This is a new endpoint rather than an extension of the existing chart series endpoint, since the response shape (two indexed values per point) is different enough from the existing single-value-per-point shape that reusing the same endpoint would require clients to branch on response shape based on a request param, which is worse than just having two clearly-named endpoints.

## 8. Frontend State Model

This is proposed as an overlay/comparison view rather than a toggle, since the value of the feature is in seeing both lines at once. The chart component would show `priceReturn` and `totalReturn` as two lines on the same axes, with the gap between them being the visually interesting part. A holding-level version of the chart would need a symbol selector, most likely reusing an existing holding-picker component rather than a new one.

## 9. Edge Cases

- **Holding sold before end of range, then range extended past the sale**: once a holding is fully sold, both series should hold flat at their last computed value for the remainder of the range rather than dropping to zero or disappearing, so a user comparing "how did this do while I held it" isn't confused by a sudden drop that isn't a real price movement.
- **Holding bought partway through range**: both series start at their base-100 index from the holding's first activity date within the range, not from the range's `startDate`, since indexing from a date before the holding existed would be meaningless.
- **Distribution reinvested automatically vs. paid as cash**: both cases should be treated identically for `totalReturn` purposes, the mechanism of reinvestment doesn't change the fact that the value was received, only whether it shows up as new units or as cash. This spec doesn't need to distinguish them at the response level.
- **Portfolio-level scope with a mix of currencies**: distributions from holdings in different currencies are converted to the account's base currency before being folded into `totalReturn`, consistent with how the rest of the app already handles multi-currency aggregation.

## 10. Backward Compatibility

- This is a new endpoint, so there's no existing behavior to preserve. No changes to existing endpoints or response shapes.
- No database schema changes. Both series are computed from existing activity and price history data.

## 11. Open Questions

- Should the gap between the two lines be exposed as its own explicit value (e.g. `dividendContribution: number`) rather than leaving the frontend to compute `totalReturn - priceReturn`? Leaning toward leaving it derived on the frontend to keep the response minimal, but open to adding it if the chart tooltip design ends up wanting it directly.
- Should there be a portfolio-level breakdown by holding (which holdings contributed most to the total-return gap)? That feels like a natural follow-up feature but is a separate spec, not part of this one.
- Confirm which reinvestment convention the existing ROAI calculation actually uses today, so `totalReturn` here matches it exactly rather than introducing a subtly different number under a similar name.

## 12. Summary of Proposed Changes

- Add a new `return-comparison` endpoint returning aligned `priceReturn`/`totalReturn` indexed series.
- Support both portfolio-level and per-holding scope via an optional `symbol` param.
- Reuse the existing `TimeRangeSelection` and granularity rules, no new range concept introduced.
- No schema changes, calculation reuses the existing total-return convention from ROAI.
