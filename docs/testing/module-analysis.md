# Risk module analysis

Source of truth for the contract: `docs/sesha-notes/10-risk-api-contract.md`
and `apps/api/src/app/risk/README.md`. This doc exists to ground the test
plan in what's actually there, not to replace either.

## Routes (`apps/api/src/app/risk/risk.controller.ts`, mounted at `/api/v1/risk`)

All reads need `portfolio:read`; writes also need `updateUserSettings` and
are rejected while impersonating (403).

| Method         | Path                     | Notes                                                                                                                                                                 |
| -------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET            | `/concentration`         | Top buckets per stock/sector/country/currency. Every bucket's severity is `NO_DATA` today (threshold engine not wired in here — known gap, documented in the README). |
| GET            | `/score`                 | Full health score; rule detail hidden for restricted-view/Basic-subscription callers.                                                                                 |
| GET            | `/warnings`              | Paginated (`page`, `pageSize`), filterable by `severity`.                                                                                                             |
| GET/PUT/DELETE | `/target-allocation`     | `isSet: false` with empty arrays when unset; PUT validates sum-to-1, duplicate keys, and valid keys (only for `groupBy: assetClass`).                                 |
| GET/PUT/DELETE | `/thresholds[/:ruleKey]` | All 7 rules with defaults + override; PUT validates ordering and the 0–1 range.                                                                                       |
| POST           | `/what-if`               | Calculation only, no persistence.                                                                                                                                     |

## Services (`apps/api/src/app/risk/`)

`risk-evaluation.service.ts` runs the 7 rules (`warning-threshold.model.ts`)
against a holdings set and produces `WeightedRuleResult[]` (for the score)
and `ThresholdEngineInput[]` (for severity/warnings) — the connective layer
between the rule models and `health-score-calculator.service.ts` /
`threshold-engine.service.ts`. `exposure.service.ts` / `exposure-calculator
.service.ts` build concentration buckets; `volatility-cache.service.ts`
supplies pre-computed annualized volatility; `what-if.service.ts` re-runs
the evaluation against a shocked holding.

## Severity model

`GREEN | YELLOW | RED | NO_DATA` (`interfaces/severity.type.ts`), never a
5th value. `NO_DATA` means a rule genuinely couldn't be evaluated (e.g. an
empty portfolio has no portfolio value to compute `CashAllocation`'s ratio
against) — it is never shown as a silent pass. This is deliberate and
already asserted directly in `risk-evaluation.service.spec.ts`; it's the
same thing the Nov 6 `GET /risk/warnings` test fix (PR #222) corrected a
wrong assumption about.

## React components (`libs/react-ui/src/lib/`)

| Folder               | Component(s)                                                                          | Live data source                                                                  |
| -------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `risk-dashboard/`    | `RiskDashboardCard`, `risk-dashboard.client.ts`                                       | `GET /risk/score` + `GET /risk/concentration`                                     |
| `risk-indicator/`    | `RiskIndicator`, `formatThresholdRange` (the latter not wired in yet — Nov 23 polish) | n/a (pure presentational)                                                         |
| `what-if-simulator/` | `WhatIfSimulator`, form, result panel, client, `WhatIfSimulatorPage` host             | `POST /risk/what-if` + `GET /portfolio/holdings` — merged to `main` (PR #241)     |
| `risk-warnings/`     | `RiskWarningsList`, client, `RiskWarningsPage` host                                   | `GET /risk/warnings` — merged to `main` (PR #282, Nov 12)                         |
| `target-allocation/` | `TargetAllocationEditor`, form, client, `TargetAllocationPage` host                   | `GET/PUT/DELETE /risk/target-allocation` — merged to `main` (PR #282, Nov 12)     |
| `risk-thresholds/`   | `RiskThresholdsList`, row, row-form model, client, `RiskThresholdsPage` host          | `GET/PUT/DELETE /risk/thresholds[/:ruleKey]` — merged to `main` (PR #282, Nov 12) |

Every component has loading/error/empty states and is tested via
`renderToStaticMarkup`/`act` against `react-dom` directly (the library's
Jest `testEnvironment` is `node`, not `jsdom` — see the correction requested
on PR #221). The three Nov 12 folders use the `createRoot`/`act`/jsdom
pattern instead (per-file `/** @jest-environment jsdom */`), same as
`WhatIfSimulatorPage`, since each owns a live `useApiData` fetch.

## Week 2 check (Fri Nov 13, #285)

Reviewed the three Nov 12 screens (`risk-warnings/`, `target-allocation/`,
`risk-thresholds/`) against the page-level pattern `RiskWarningsPage`
already had (an initial-GET-failure test with retry) and found two real
gaps, both coverage-only — the implementations already handled both paths
correctly via `useApiData`'s `status`/`error` and each page's own
`*ErrorMessage()` mapper:

- `TargetAllocationPage` had no test for the initial GET failing, and no
  test for a save (PUT) being rejected server-side (e.g. `RISK_FORBIDDEN`
  for a DEMO user) and showing below the form.
- `RiskThresholdsPage` had no test for the initial GET failing.

All three added in #285. No production code changed — see the test-plan.md
entries for the exact cases.

## External dependencies

None live in the request path for any Risk route: `volatility-cache.service
.ts` reads a pre-computed nightly figure (no external call per-request),
and `what-if.service.ts` does pure calculation. Nothing to mock beyond the
existing Prisma/`PortfolioService`/`AccountService` seams the specs already
mock.

## Existing coverage (surveyed before writing the test plan)

The Risk module already has 14 backend spec files (services, mappers,
models) and 2 added today (`risk.controller.routes.spec.ts`,
`risk-exception.filter.spec.ts`, PR #222) plus `risk.controller.spec.ts` and
`risk.e2e.spec.ts`. Component tests exist for `RiskDashboardCard` and
`RiskIndicator`. This is **not** a green-field module — the test plan below
focuses on genuine gaps, not re-testing what's already covered, per the
project's own "don't pad coverage" convention.

## Ambiguities flagged (not guessed past)

1. **Seed data target**: no existing seed mechanism puts realistic Risk
   data into a running Postgres instance (`prisma/seed.mts` only seeds
   tags). Building this for real requires `SymbolProfile`/`MarketData` rows
   with `dataSource: MANUAL` so no external price-gathering call is needed
   — documented and built in this PR. Its severity outcomes were verified
   twice: once against the real `RiskEvaluationService` logic directly, and
   since then against a real throwaway Postgres + Redis database (Raniya,
   Nov 7) — idempotence across two runs and the four users' actual Risk API
   responses, documented in `docs/testing/seed-risk-demo-data.md`.
2. **Playwright/E2E scope**: per your "work ahead, but hold UI/Playwright"
   decision, this issue does not install Playwright or add
   `data-testid` attributes — deferred to after #68's harness lands.
