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

| Folder               | Component(s)                                                                          | Live data source                                               |
| -------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `risk-dashboard/`    | `RiskDashboardCard`, `risk-dashboard.client.ts`                                       | `GET /risk/score` + `GET /risk/concentration`                  |
| `risk-indicator/`    | `RiskIndicator`, `formatThresholdRange` (the latter not wired in yet — Nov 23 polish) | n/a (pure presentational)                                      |
| `what-if-simulator/` | `WhatIfSimulator`, form, result panel, client                                         | `POST /risk/what-if` — **not yet committed**, scheduled Nov 10 |

Every component has loading/error/empty states and is tested via
`renderToStaticMarkup`/`act` against `react-dom` directly (the library's
Jest `testEnvironment` is `node`, not `jsdom` — see the correction requested
on PR #221).

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
   — documented and built in this PR. Its severity outcomes are verified
   against the real `RiskEvaluationService` logic directly (not just
   asserted), but the script itself still needs running against a real
   database at least once before the demo, since Docker isn't running in
   this sandbox (`docker/docker-compose.dev.yml` up, then the seed command
   documented in `docs/testing/seed-risk-demo-data.md`, including the
   `ALLOW_RISK_DEMO_SEED=yes` safety opt-in).
2. **Playwright/E2E scope**: per your "work ahead, but hold UI/Playwright"
   decision, this issue does not install Playwright or add
   `data-testid` attributes — deferred to after #68's harness lands.
