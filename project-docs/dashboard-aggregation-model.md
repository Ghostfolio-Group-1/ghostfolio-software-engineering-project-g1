# Ghostfolio — Dashboard Aggregation Data Model & Wireframe

_Author: Raniya Shaikh | Iteration 1 | Sep 23, 2026_

This document finalizes the aggregation data model for the Unified Portfolio Overview Dashboard and provides its wireframe, building on `dashboard-field-spec.md`.

## 1. Aggregation Data Model (Confirmed)

The dashboard endpoint returns fields **nested by feature**, rather than flattened, so the shape stays aligned with the API-only access boundary from `target-architecture.md` — each feature's data stays traceable to its own module.

```json
{
  "data": {
    "risk": {
      "healthScore": 78,
      "topConcentrationRisk": {
        "type": "stock",
        "value": "AAPL",
        "percentage": 0.28
      }
    },
    "tax": {
      "grossDividendYTD": 310.0,
      "netDividendYTD": null,
      "realizedGainsYTD": null
    },
    "charts": {
      "totalReturn": 0.124,
      "benchmarkDelta": 0.021
    }
  },
  "meta": {},
  "error": null
}
```

`netDividendYTD` and `realizedGainsYTD` remain `null` until Tharun's withholding and FIFO designs land (see Sep 25 note below) — this is unchanged from yesterday's field spec.

## 2. Aggregation Logic (Design Note for Iteration 2)

The dashboard service should call all three feature APIs **in parallel** (e.g. `Promise.all`) rather than sequentially, since the three calls are independent and don't depend on each other's results. Each call goes through the feature's public API/controller layer only, per the access boundary already defined.

This is a design note for whoever implements the dashboard service in Iteration 2 — no code is written as part of this Iteration 1 task.

## 3. Wireframe

See `wireframe.svg` (same folder).

**Layout:**

- **Top KPI row** — three headline numbers at a glance: Health Score, Total Return, Gross Dividend YTD.
- **Feature detail cards** — one card per feature (Risk, Tax, Charts) below the KPI row, each showing its full set of fields from the aggregation model above.
- The Tax card explicitly shows **Net Dividend YTD** and **Realized Gains YTD** as "— pending —" rather than hiding them, so the dashboard's UI doesn't need reworking once those fields exist Sep 25 — the layout is already built to accommodate them.
- Every value shown maps directly to a field in the data model above — nothing displayed lacks a backing field, and nothing in the model lacks a place to display.

## 4. Next Steps

- **Fri Sep 25:** reconcile this model (and the wireframe's pending fields) against Sesha's, Tharun's, and Arthur's formal API contracts. Once Tharun's withholding/FIFO fields exist, replace the `null` placeholders and update the wireframe's "pending" labels.
- **Iteration 2:** implement the dashboard controller/service using this model and the parallel-fetch aggregation logic above.
