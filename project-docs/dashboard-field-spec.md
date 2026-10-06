# Ghostfolio — Unified Dashboard Field Spec

_Author: Raniya Shaikh | Iteration 1 | Sep 22, 2026_

This document specifies which fields the Unified Portfolio Overview Dashboard pulls from the risk, tax, and chart APIs, using the response envelope defined in `api-conventions.md`.

**⚠ Status: provisional.** Sesha's, Tharun's, and Arthur's formal API contracts aren't due until Fri Sep 25 — three days after this spec. The fields below are drawn from what each teammate has drafted so far (health score model, existing transaction/dividend data model, toggle/benchmark specs) and from direct conversation, not finished contracts. This spec should be reconciled against the real API contracts once they land on Sep 25.

## 1. Risk (Sesha)

| Field                  | Source                         | Notes                                                                             |
| ---------------------- | ------------------------------ | --------------------------------------------------------------------------------- |
| `healthScore`          | Portfolio Health Score (0–100) | Sesha's core model, drafted Sep 16                                                |
| `topConcentrationRisk` | Concentration formula          | Single highest concentration flag (stock/sector/country/currency), drafted Sep 17 |

## 2. Tax (Tharun)

| Field              | Source                                 | Notes                                                                                                                 |
| ------------------ | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `grossDividendYTD` | Activity model (`type = DIVIDEND`)     | Confirmed available — dividends are stored as regular activities (`quantity × unitPrice`), per Tharun's Sep 15 review |
| `netDividendYTD`   | Activity model + withholding (pending) | **Not yet available** — withholding tax fields are not designed yet (Tharun's Sep 16 task). Placeholder only.         |
| `realizedGainsYTD` | FIFO capital gains calc                | **Not yet available** — FIFO spec is Tharun's Sep 17 task, not yet pushed. Placeholder only.                          |

## 3. Charts (Arthur)

| Field            | Source                                       | Notes          |
| ---------------- | -------------------------------------------- | -------------- |
| `totalReturn`    | Total-return vs price-return comparison spec | Drafted Sep 18 |
| `benchmarkDelta` | Benchmark comparison data model              | Drafted Sep 22 |

## 4. Draft Response Shape

Using the envelope from `api-conventions.md`:

```json
{
  "data": {
    "risk": {
      "healthScore": 0,
      "topConcentrationRisk": {
        "type": "stock",
        "value": "AAPL",
        "percentage": 0.0
      }
    },
    "tax": {
      "grossDividendYTD": 0.0,
      "netDividendYTD": null,
      "realizedGainsYTD": null
    },
    "charts": {
      "totalReturn": 0.0,
      "benchmarkDelta": 0.0
    }
  },
  "meta": {},
  "error": null
}
```

`netDividendYTD` and `realizedGainsYTD` are `null` until Tharun's withholding and FIFO designs land — this is intentional, not an oversight, and should be revisited Sep 25.

## 5. Access Boundary

Per `target-architecture.md`, the dashboard pulls these fields only through each feature's public API/controller layer (`/api/v1/risk/...`, `/api/v1/tax/...`, `/api/v1/charts/...`), never their internal services directly.

## 6. Next Steps

- **Fri Sep 25:** reconcile this spec against Sesha's, Tharun's, and Arthur's formal API contracts. Update `netDividendYTD` and `realizedGainsYTD` once Tharun's withholding/FIFO fields exist.
- **Wed Sep 23:** use this field list to design the dashboard's aggregation data model and wireframe.
