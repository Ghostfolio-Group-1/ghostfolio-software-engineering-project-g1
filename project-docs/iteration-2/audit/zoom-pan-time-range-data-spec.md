# Design Doc: Zoom / Pan / Selectable Time Range - Data Spec

**Status:** Draft (Iteration 1)
**Author:** _fill in_
**Scope:** Docs only, no code changes yet. This defines the data model and API contract that a future iteration will implement.

## 1. Summary

Right now the portfolio and dividend charts only support a fixed set of preset ranges (1D, WTD, MTD, YTD, 1Y, 5Y, Max). This doc proposes a data spec for letting users zoom into a chart, pan across it, and select an arbitrary custom date range, instead of being locked to the presets.

The goal here is to nail down the shape of the data before anyone touches the chart component or the backend endpoints. Once this is agreed on, Iteration 2 can wire up the actual zoom/pan interactions in the chart component and the granularity-aware data fetching on the backend.

## 2. Problem Statement

The current range selector is a fixed list of buttons. That's fine for quick checks but it breaks down in a few ways:

- A user who wants to look at "the three weeks around when I made that big purchase" has no way to get there directly. They have to pick the closest preset and squint.
- Every preset re-fetches the full historical series at whatever the default granularity is, even if the user only wants to look at a narrow window. That's wasted payload for something like a 5 year series when you only care about the last two weeks of it.
- There's no shared concept of "current viewport" that the frontend and backend agree on, so any zoom/pan work would have to invent this from scratch inside the chart component, coupled to Chart.js internals instead of being a clean data contract.

This doc defines that shared contract: what a "time range selection" looks like as data, how it's requested from the API, how granularity is chosen, and how it degrades gracefully when data is missing.

## 3. Current State (for context)

Today, a range selection is really just a string enum used to compute a start date on the frontend:

- `1d`, `wtd`, `mtd`, `ytd`, `1y`, `5y`, `max`
- The frontend maps the selected preset to a `dateRange` value and passes it to the performance/chart endpoint.
- The backend resolves that into an actual start date server side and returns the full series for that window at a single, fixed granularity (daily, as far as the chart is concerned).

There is no concept today of:

- A user-defined arbitrary start/end pair
- A zoom level or viewport that's distinct from the requested range
- Granularity as something that can vary based on how wide the window is

## 4. Goals

- Define a `TimeRangeSelection` shape that covers both presets and custom ranges, so existing preset behavior keeps working unchanged.
- Define how zoom and pan translate into that same shape, so the backend never needs to know whether a range came from a button, a drag-to-zoom gesture, or a manual date picker.
- Define a granularity resolution rule so charts don't request more data points than they can usefully render.
- Keep the contract backward compatible: any client still sending the old preset-only request shape should keep working.

## 5. Non-Goals

- Actual chart rendering/interaction implementation (drag-to-zoom, pinch gestures, mouse wheel behavior). That's Iteration 2.
- Changing how performance metrics (ROI, ROAI, etc.) are calculated. This is purely about which data window is fetched and shown.
- Real-time/streaming updates while zoomed in.

## 6. Proposed Data Spec

### 6.1 `TimeRangeSelection`

This is the core object both frontend and backend agree on.

```ts
type TimeRangeSelection =
  | {
      mode: 'preset';
      preset: '1d' | 'wtd' | 'mtd' | 'ytd' | '1y' | '5y' | 'max';
    }
  | { mode: 'custom'; startDate: string; endDate: string }; // ISO 8601 date, e.g. "2026-03-01"
```

> Correction: the preset values match Ghostfolio's existing `DateRange` type exactly (`libs/common/src/lib/types/date-range.type.ts`), including `1d` for what the UI labels "Today". An earlier draft of this doc used `'today'` as the value, that was wrong, the real type never uses that string, and a DTO validated against the real enum would reject it.

Notes:

- `mode: 'preset'` preserves exactly the current behavior. Nothing about existing preset requests changes.
- `mode: 'custom'` is new. `startDate` and `endDate` are inclusive, in the user's account currency's calendar (not UTC-shifted), matching how the rest of Ghostfolio already treats activity dates.
- Zoom and pan both resolve to a `custom` selection under the hood. Zooming in narrows `startDate`/`endDate`; panning shifts both by the same delta while keeping the window width constant. This means the chart component never needs a separate "zoom state" concept sent to the server, it's just a narrower or shifted custom range.

### 6.2 Viewport vs. Selection

Two related but distinct ideas:

- **Selection**: the `TimeRangeSelection` that was actually requested from the API and used to fetch data.
- **Viewport**: the currently visible window inside the chart, which may be a subset of the fetched data if the frontend is doing client-side zoom without a re-fetch (e.g. zooming in a bit within data that's already loaded).

The spec only concerns itself with **Selection**. Viewport is a frontend-only concept and never needs to be sent to or stored by the backend. This keeps the backend contract simple: it always just answers "give me the series for this range," regardless of why the range changed.

### 6.3 Granularity Resolution

Rather than sending an explicit granularity, the backend derives it from the width of the requested range, so the client doesn't need to duplicate that logic:

| Range width | Granularity           |
| ----------- | --------------------- |
| <= 7 days   | daily                 |
| <= 2 years  | daily                 |
| > 2 years   | weekly (down-sampled) |

This mirrors what most of the existing presets already imply. The only change is that a `custom` range spanning multiple years falls into the same down-sampling behavior as `5y` or `max` do today, instead of being undefined.

Granularity is returned alongside the series data so the chart component knows how to space and label the x-axis, rather than assuming daily points:

```ts
interface ChartSeriesResponse {
  granularity: 'daily' | 'weekly';
  startDate: string;
  endDate: string;
  points: Array<{ date: string; value: number }>;
}
```

## 7. API Impact

### 7.1 Request shape

The existing performance/chart endpoints currently accept something like:

```
GET /api/v2/portfolio/performance?range=5y
```

(Note: the real endpoint is versioned, `v2`, not `v1`. An earlier draft of this doc used `v1`, corrected here.)

Proposed addition, kept backward compatible by making the new params optional and mutually exclusive with `range`:

```
GET /api/v2/portfolio/performance?range=5y
GET /api/v2/portfolio/performance?startDate=2026-03-01&endDate=2026-03-21
```

The real endpoint also already accepts `accounts`, `assetClasses`, `dataSource`, `symbol`, `holdingType`, and `query` as existing filter params. `startDate`/`endDate` are additive alongside these, they don't replace or conflict with any of them.

Validation rules:

- If both `range` and `startDate`/`endDate` are present, the request is rejected with a 400. A selection is one or the other, never both, to avoid ambiguity about which one wins.
- If only one of `startDate`/`endDate` is present, reject with a 400. Custom ranges must be fully bounded.
- `endDate` must not be before `startDate`. Reject with a 400 if so.
- `endDate` must not be in the future beyond "today" in the account's timezone. Clamp to today rather than reject, since a chart zoomed slightly past "now" is a common and harmless UI state.
- If `startDate` is before the account's earliest activity, clamp it to the earliest activity date rather than rejecting. This avoids the client needing to know that date in advance just to construct a valid request.

### 7.2 Response shape

No breaking change to the existing response body. The only addition is the `granularity` field described in 6.3, which old clients can simply ignore.

## 8. Frontend State Model

The chart component holds a single `TimeRangeSelection` as its source of truth (matching 6.1). Proposed state transitions:

- Clicking a preset button sets `{ mode: 'preset', preset }`.
- Drag-to-zoom on the chart computes a `{ mode: 'custom', startDate, endDate }` from the pixel range dragged, and triggers a re-fetch.
- Pan (click-drag on an already-zoomed chart, or arrow controls) shifts `startDate`/`endDate` by the same delta and re-fetches.
- A "reset zoom" action returns to whatever preset was last active before zooming, defaulting to `1y` if the chart was opened directly into a custom range (e.g. via a shared link).

This keeps a single, serializable piece of state that could later be reflected in the URL (e.g. for shareable links to a specific zoomed view), without needing to invent a second state shape for that.

## 9. Edge Cases

- **Empty range**: `startDate` and `endDate` resolve to a window with no activity yet (e.g. before the account existed). Return an empty `points` array rather than an error, so the chart can show an empty state instead of failing.
- **Single-day range**: `startDate === endDate`. Valid, resolves to daily granularity with at most one point.
- **Range wider than available history**: clamp `startDate` as described in 7.1, and note in the response that the request was clamped is not required. The response's own `startDate`/`endDate` already tell the client what was actually served, so the client can compare against what it requested and show a subtle "showing full available history" note if it wants to.
- **Rapid zoom/pan while a previous request is in flight**: out of scope for the data spec itself, but worth flagging for Iteration 2 that the frontend should cancel/ignore stale in-flight requests when the selection changes again quickly.

## 10. Backward Compatibility

- Any existing client sending only `range=...` continues to work exactly as before. Nothing about the preset path changes.
- The new `granularity` field is additive. Clients that don't read it keep working.
- No database schema changes. This is purely a request/response contract change plus a frontend state shape, since ranges are computed on the fly rather than stored.

## 11. Open Questions

- Should custom ranges be shareable via URL query params so a link can reopen a chart at a specific zoom? Leaning yes, but deferring the URL structure to Iteration 2 once the interaction design is settled.
- Do we want a minimum zoom window (e.g. don't allow zooming below 1 day) to avoid a degenerate chart with a single point? Proposing yes, minimum of 1 day, but open to feedback.
- Should weekly down-sampling for wide ranges average, or sample the last point of each week? Existing `5y`/`max` presets presumably already answer this somewhere in the current performance calculation code, so Iteration 2 should just reuse whatever that does rather than introduce a second convention.

## 12. Summary of Proposed Changes

- Add `TimeRangeSelection` as a shared type (`preset` | `custom`).
- Add optional `startDate`/`endDate` query params to chart/performance endpoints, mutually exclusive with `range`.
- Add validation and clamping rules per section 7.1.
- Add `granularity` to the chart series response.
- No schema changes, no changes to performance calculation logic itself.
