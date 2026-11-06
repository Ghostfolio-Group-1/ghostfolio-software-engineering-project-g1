# Risk module test plan

Tracking issue: #224. Sprint tickets: #24 (API contract), #26 (dashboard),
#187 (what-if UI, not yet committed), #188 (indicators).

Status column: **have** = already covered by an existing spec (verified by
reading it, not assumed), **gap** = filled in this PR, **deferred** = UI/E2E
work held until the Nov 10 harness (#68) per the Nov 6 pacing decision.

## Backend / API

### `GET /risk/score`

| Case                                                                    | Status                           |
| ----------------------------------------------------------------------- | -------------------------------- |
| Happy path: concentrated portfolio → correct score/grade/severity       | have (`risk.controller.spec.ts`) |
| Empty portfolio + zero cash → every category excluded, score/grade null | have                             |
| Rule detail hidden for restricted-view / Basic-subscription callers     | have                             |
| Contract-schema validation (ajv)                                        | have                             |

### `GET /risk/concentration`

| Case                                         | Status |
| -------------------------------------------- | ------ |
| Happy path, contract-schema validation       | have   |
| Invalid `limit` query → `RISK_INVALID_QUERY` | have   |

### `GET /risk/warnings`

| Case                                                                                                         | Status                                                                                         |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Default pagination (page 1, pageSize 25), contract-schema validation                                         | have (PR #222; test comment corrected to match `NO_DATA` not RED for the empty-portfolio case) |
| Invalid `severity` → `RISK_INVALID_QUERY`                                                                    | have                                                                                           |
| Filter by `severity` and paginate                                                                            | have                                                                                           |
| **Gap**: `page`/`pageSize` boundary values (0, negative, non-integer, `pageSize` > `MAX_WARNINGS_PAGE_SIZE`) | gap — added                                                                                    |

### `GET/PUT/DELETE /risk/target-allocation`

| Case                                                                                        | Status                                                          |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `isSet: false` when unset, contract-schema validation                                       | have                                                            |
| PUT: duplicate keys, sum ≠ 1, invalid key for `assetClass` → specific `RISK_TARGET_*` codes | have                                                            |
| PUT: saves and returns computed buckets                                                     | have                                                            |
| PUT/DELETE: rejected while impersonating                                                    | have (PUT); **gap**: DELETE not tested for the same 403 — added |
| DELETE: clears the target, persists the cleared setting                                     | have                                                            |

### `GET/PUT/DELETE /risk/thresholds[/:ruleKey]`

| Case                                                                                                           | Status      |
| -------------------------------------------------------------------------------------------------------------- | ----------- |
| Lists all 7 rules with defaults, contract-schema validation                                                    | have        |
| Reflects a customized override                                                                                 | have        |
| PUT: unknown rule key → 404 `RISK_RULE_NOT_FOUND`                                                              | have        |
| PUT: out-of-order ceiling override → `RISK_THRESHOLD_INVALID_ORDER`                                            | have        |
| PUT: saves a valid override                                                                                    | have        |
| DELETE: resets to defaults                                                                                     | have        |
| **Gap**: out-of-order **band** override (e.g. `PortfolioVolatility`, not just the ceiling case already tested) | gap — added |
| **Gap**: PUT/DELETE rejected while impersonating (only PUT target-allocation has this today)                   | gap — added |

### `POST /risk/what-if`

| Case                                                                          | Status |
| ----------------------------------------------------------------------------- | ------ |
| Happy path with real `VolatilityCacheService` result reaching `WhatIfService` | have   |
| `BadRequestException` → `RISK_WHATIF_INVALID_DROP` (400)                      | have   |
| `NotFoundException` → `RISK_WHATIF_HOLDING_NOT_FOUND` (404)                   | have   |

### Cross-cutting

| Case                                                                                                | Status                                                        |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `RiskExceptionFilter`: passes a controller-built `HttpException` through unchanged                  | have (PR #222)                                                |
| `RiskExceptionFilter`: turns an unexpected error into `RISK_CALC_FAILED` 500 with a generic message | have                                                          |
| Rule/service unit tests (exposure, severity, what-if, thresholds) with numeric assertions           | have — 14 existing spec files, surveyed in module-analysis.md |

## UI / Component

| Case                                                                                                                                                                                  | Status                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `RiskDashboardCard`: loading, error (with/without retry), empty, ready, top concentration, per-category rows, visible severity text, null-score unavailable-reason message + fallback | have                                  |
| `RiskIndicator`: one test per severity colour, accessible label, visible severity word                                                                                                | have                                  |
| `risk-dashboard.client.ts`: maps envelope, propagates `ApiRequestError`, missing-data error                                                                                           | have (PR #213)                        |
| What-if simulator components                                                                                                                                                          | deferred — not committed yet (Nov 10) |

## Integration (UI ↔ API ↔ service ↔ data)

| Case                                                                                                                        | Status                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full HTTP round trip for `/risk/score`, `/risk/concentration`, `/risk/what-if` against a real Nest app (`risk.e2e.spec.ts`) | have                                                                                                                                                                                                                                |
| **Gap**: the same for the Nov 6 routes (`/risk/warnings`, `/risk/target-allocation`, `/risk/thresholds`)                    | gap — would need `risk.e2e.spec.ts` extended; **not done in this PR** — flagging rather than rushing it, since it needs its own fixture/auth setup matching the existing e2e file's conventions. Tracked as a follow-up under #224. |
| UI screen driven against the running API (not mocks)                                                                        | deferred — this is explicitly Raniya's Nov 10 harness deliverable (#68); building a one-off version here would duplicate and could diverge from it                                                                                  |

## End-to-end (browser)

All deferred — Playwright isn't installed (confirmed in PR #221, "Not
installed", scheduled with the Nov 10 harness). Nov 19 plan: open the Risk
dashboard → read indicators → run a what-if.

## Seed data

See `docs/testing/seed-risk-demo-data.md`. Covers: a concentrated portfolio
(RED concentration), a balanced one (no RED anywhere, verified against the
real evaluation logic), an empty portfolio (`NO_DATA` / no-active-rules),
and one with a target allocation configured (exercises
`TargetAllocationDeviation`).
