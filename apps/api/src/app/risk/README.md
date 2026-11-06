# Risk module

**Owner:** Sesha Siva Sankar
**Status (Iteration 3):** all 11 routes in the API contract are implemented;
React components for the dashboard card, severity indicator and what-if
simulator are built in `libs/react-ui`.

This README documents the risk module as it stands at the end of
Iteration 3. For the original design rationale see
`project-docs/risk-design-architecture-report-section.md` (Iteration 1) and
the full request/response contract at
`docs/sesha-notes/10-risk-api-contract.md`.

## 1. What this module does

Ghostfolio's existing X-Ray report checks a portfolio against 17 rules one
at a time. This module adds:

- a single weighted **0-100 health score** with a letter grade and an
  overall GREEN/YELLOW/RED severity;
- **concentration** checks (single stock, sector, country, currency);
- **volatility** and **cash allocation** checks;
- an optional **target-allocation deviation** check, only active once a
  user sets a target;
- a **warnings** feed (every breaching bucket, worst first);
- a **what-if simulator** that shocks one holding and recomputes the score
  without saving anything;
- per-rule **threshold customization**, reusing `user.settings.xRayRules`.

Severity is always one of `GREEN | YELLOW | RED | NO_DATA` (never a 5th
value) - see `interfaces/severity.type.ts`. `NO_DATA` means a rule
genuinely cannot be evaluated (e.g. no nightly volatility figure yet), and
is never silently shown as a pass.

## 2. Routes

All routes are mounted under `/api/v1/risk` and return the shared
`{ data, error, meta }` envelope (`@ghostfolio/common/api-conventions`).
Reads need the `portfolio:read` scope; writes need the authenticated
user's `updateUserSettings` permission and are rejected while
impersonating another user.

| Method   | Path                   | Handler                  | Notes                                                         |
| -------- | ---------------------- | ------------------------ | ------------------------------------------------------------- |
| `GET`    | `/concentration`       | `getConcentration`       | Top buckets per stock/sector/country/currency.                |
| `GET`    | `/score`               | `getScore`               | Full health score, categories and rules.                      |
| `GET`    | `/warnings`            | `getWarnings`            | Paginated, filterable by `severity`.                          |
| `GET`    | `/target-allocation`   | `getTargetAllocation`    | `isSet: false` with empty arrays when nothing is configured.  |
| `PUT`    | `/target-allocation`   | `putTargetAllocation`    | Validates sum-to-1, duplicate keys, valid keys for `groupBy`. |
| `DELETE` | `/target-allocation`   | `deleteTargetAllocation` | Clears the target; always succeeds.                           |
| `GET`    | `/thresholds`          | `getThresholds`          | All 7 risk rules with defaults + any override.                |
| `PUT`    | `/thresholds/:ruleKey` | `putThreshold`           | Partial update; validates ordering and 0-1 range.             |
| `DELETE` | `/thresholds/:ruleKey` | `deleteThreshold`        | Resets the rule to its defaults.                              |
| `POST`   | `/what-if`             | `postWhatIf`             | Calculation only, no side effects.                            |

`summary` (Section 6.1 of the contract) was not built separately: the
dashboard's `risk-dashboard.client.ts` composes it client-side from
`/score` and `/concentration` instead of adding a 12th backend route,
since nothing in `/score` + `/concentration` is missing from it.

### Error handling

`RiskExceptionFilter` (`risk-exception.filter.ts`) is applied to the whole
controller via `@UseFilters`. It passes through any `HttpException` the
controller already built (the `RISK_*` codes below, or a guard's plain
401/403) unchanged, and turns anything else - an uncaught exception from a
calculator, a database error, a bug - into a 500 with
`{ data: null, error: { code: 'RISK_CALC_FAILED', message: '<generic
message>' }, meta: {} }`, logging the real error server-side only.

Feature-prefixed error codes in use: `RISK_INVALID_QUERY`,
`RISK_TARGET_INVALID_SUM`, `RISK_TARGET_DUPLICATE_KEY`,
`RISK_TARGET_INVALID_KEY`, `RISK_THRESHOLD_INVALID_ORDER`,
`RISK_THRESHOLD_OUT_OF_RANGE`, `RISK_RULE_NOT_FOUND`,
`RISK_WHATIF_INVALID_DROP`, `RISK_WHATIF_HOLDING_NOT_FOUND`,
`RISK_CALC_FAILED`.

## 3. Architecture

```
risk.controller.ts            one method per route above
  -> risk-evaluation.service.ts   runs the 7 rules, produces WeightedRuleResult[]
                                   + ThresholdEngineInput[] for the whole portfolio
  -> health-score-calculator.service.ts   weighted pass-rate -> score/grade/categories
  -> threshold-engine.service.ts          actual + thresholds -> Severity, builds warnings
  -> exposure.service.ts / exposure-calculator.service.ts   concentration buckets
  -> what-if.service.ts                   shocks one holding, re-runs the above
  -> volatility-cache.service.ts          pre-computed annualized volatility (nightly)

Mappers (API-shape <-> internal shape, one per route, with contracts/*.schema.ts
ajv schemas + *.fixtures.ts next to them):
  risk-concentration.mapper.ts
  risk-score.mapper.ts
  risk-warnings.mapper.ts
  target-allocation.mapper.ts
  risk-threshold.mapper.ts
```

Threshold defaults for all 7 rules live in one place,
`warning-threshold.model.ts` (`WARNING_THRESHOLD_DEFAULTS`), each with a
`shape` of `'ceiling'` (one line, e.g. SingleStockConcentration) or
`'band'` (two lines, e.g. PortfolioVolatility). Per-user overrides are
stored in `user.settings.xRayRules[ruleKey]`
(`RuleSettings.redThresholdMax`/`redThresholdMin`, added in Iteration 3 -
see `libs/common/src/lib/interfaces/x-ray-rules-settings.interface.ts`).
Target allocation is stored in `user.settings.targetAllocation`.

## 4. React components (`libs/react-ui/src/lib/`)

| Folder               | Component(s)                                                                                                          | Purpose                                                                                                                                                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `risk-indicator/`    | `RiskIndicator`, `formatThresholdRange`                                                                               | Severity-to-colour dot (issue #188) and a shared threshold-range label formatter.                                                                                                                                                                           |
| `risk-dashboard/`    | `RiskDashboardCard`, `risk-dashboard.client.ts`                                                                       | Card on the shared `Card`/`DashboardCard` showing the score, grade, overall severity, top concentration and one `RiskIndicator` row per category (concentration/volatility/cash/target allocation). Wired to `GET /risk/score` + `GET /risk/concentration`. |
| `what-if-simulator/` | `WhatIfSimulator`, `WhatIfSimulatorForm`, `WhatIfResultPanel`, `what-if-form.model.ts`, `what-if-simulator.client.ts` | Scenario form with client-side validation, wired to `POST /risk/what-if`, and a result panel showing the before/after score and warning differences.                                                                                                        |

Every component has loading/error/empty states (where applicable) and a
`*.spec.tsx`/`*.spec.ts` file. The HTTP layer is always injected as a
plain function (`fetchJson`/`postJson`), never called directly from a
component, so tests mock it without needing a DOM - this library's Jest
`testEnvironment` is `node`, not `jsdom`.

## 5. Known gaps

- `GET /risk/concentration`'s buckets are always returned with
  `severity: 'NO_DATA'` and `thresholds: null` - the threshold engine was
  wired into `/score`, `/warnings` and `/target-allocation` in Iteration 3,
  but back-filling `/concentration` itself was not part of this iteration's
  task list and was left untouched.
- `PUT /target-allocation`'s "every key is valid for the chosen `groupBy`"
  rule (Section 6.6) is only enforced for `groupBy: "assetClass"`; the
  other four `groupBy` values would need a market-data lookup this
  validation doesn't have.
- Money values on `what-if`'s response are not yet gated behind the
  `portfolio:read:values` scope (Section 4) - every other route has no
  money fields, so this gap is isolated to that one route.
- Basic-subscription gating (Section 11's open question - hide rules,
  keep the score) is not implemented; `rules` is never `null` today.
