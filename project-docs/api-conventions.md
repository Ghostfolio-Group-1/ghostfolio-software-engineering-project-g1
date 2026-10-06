# Ghostfolio — Shared API Conventions & Data-Layer Contracts

_Author: Raniya Shaikh | Iteration 1 | Sep 21, 2026_

This document defines the conventions Sesha (risk), Tharun (tax), Arthur (charts), and Raniya (dashboard) should follow when writing formal API contracts (due Fri Sep 25) and building endpoints in Iteration 2. It extends the existing pattern already used by `apps/api/src/app/portfolio/`, rather than inventing a new one.

_Note: teammates' formal specs aren't due until Sep 25 — this is a proposed convention based on the existing codebase pattern. Flag anything that doesn't fit your feature's data and we'll adjust._

## 1. Response Envelope

Every endpoint returns a consistent top-level shape:

```json
{
  "data": {},
  "meta": {},
  "error": null
}
```

- `data` — the actual payload (object or array)
- `meta` — optional metadata (pagination info, timestamps, etc.) — omit if not needed
- `error` — `null` on success; on failure, see Section 4

## 2. URL Naming Convention

```
/api/v1/risk/...
/api/v1/tax/...
/api/v1/charts/...
/api/v1/dashboard/...
```

- One base path per feature module, matching the folder structure in `target-architecture.md`
- Use kebab-case for multi-word resources, e.g. `/api/v1/tax/tax-lots`
- Versioned from the start (`v1`) so future breaking changes don't require a new convention

## 3. Shared Data Primitives

To keep the dashboard's aggregation (Sep 22–23) consistent when merging data from all three feature APIs:

| Type        | Format                                                                                                                     |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| Dates       | ISO 8601 string (`"2026-09-21"` or `"2026-09-21T00:00:00Z"` for timestamps)                                                |
| Currency    | Numeric value + separate ISO currency code field (e.g. `{ "amount": 1234.56, "currency": "USD" }`), not a formatted string |
| Percentages | Decimal (e.g. `0.0725` for 7.25%), not pre-formatted strings — let the frontend format for display                         |

## 4. Error Shape

On failure, `data` is `null` and `error` is populated:

```json
{
  "data": null,
  "meta": {},
  "error": {
    "code": "RISK_CALC_FAILED",
    "message": "Unable to calculate concentration score"
  }
}
```

- `code` — a short, feature-prefixed constant (e.g. `TAX_INVALID_LOT`, `CHART_RANGE_OUT_OF_BOUNDS`) for programmatic handling
- `message` — human-readable, safe to show in the UI

## 5. Pagination

For any endpoint returning a list:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 25,
    "total": 143
  },
  "error": null
}
```

Query params: `?page=1&pageSize=25`.

## 6. DTO Structure

Following the existing `portfolio` module pattern — one DTO per endpoint, named by action:

```
get-<resource>.dto.ts     e.g. get-holdings.dto.ts, get-tax-summary.dto.ts
update-<resource>.dto.ts  e.g. update-holding-tags.dto.ts
```

Each DTO defines the exact request/response shape for its endpoint — keep them in each feature's own folder (`apps/api/src/app/<feature>/`), not shared, unless a shape is genuinely reused across features (in which case it belongs in `libs/`).

## 7. What This Unlocks Next

- **Fri Sep 25:** Sesha, Tharun, and Arthur write their formal API contracts using this envelope, naming, and error convention.
- **Sep 22–23 (Dashboard spec):** the dashboard's aggregation endpoint consumes each feature's API (per the API-only access boundary in `target-architecture.md`) and merges their `data` fields into one summary response, using the same envelope shape.
