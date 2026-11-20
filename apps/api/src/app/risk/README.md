# Risk module

**Owner:** Sesha Siva Sankar
**Status (Iteration 3):** all 10 routes in the API contract are implemented;
every React screen (dashboard card, severity indicator, warnings list,
target-allocation editor, thresholds editor, what-if simulator) is built in
`libs/react-ui` and mounted on `/risk` (`RiskPage`, issue #261). All four
test layers are green as of the Week 3 check (Fri Nov 20): unit, component,
UI-to-API integration and browser E2E - see "Testing" below.

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

| Folder               | Component(s)                                                                                                        | Purpose                                                                                                                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `risk-indicator/`    | `RiskIndicator`, `formatThresholdRange`                                                                             | Severity-to-colour dot (issue #188) and a shared threshold-range label formatter.                                                                                                                                                                         |
| `risk-dashboard/`    | `RiskDashboardCard`, `RiskDashboardPage`, `RiskPage`, `risk-dashboard.client.ts`                                    | Card on the shared `Card`/`DashboardCard` showing the score, grade, overall severity, top concentration and one `RiskIndicator` row per category. Wired to `GET /risk/score` + `GET /risk/concentration`. `RiskPage` mounts every screen below it (#261). |
| `risk-warnings/`     | `RiskWarningsList`, `RiskWarningsPage`, `risk-warnings.client.ts`                                                   | Every breaching rule/subject pair, worst first, each with its own `RiskIndicator`. Wired to `GET /risk/warnings`.                                                                                                                                         |
| `target-allocation/` | `TargetAllocationEditor`, `TargetAllocationForm`, `TargetAllocationPage`, `target-allocation.client.ts`             | Set/clear a target allocation and see the computed buckets. Wired to `GET`/`PUT`/`DELETE /risk/target-allocation`.                                                                                                                                        |
| `risk-thresholds/`   | `RiskThresholdsList`, `RiskThresholdRow`, `RiskThresholdsPage`, `risk-thresholds.client.ts`                         | Per-rule threshold editor (ceiling or band shape) with an Active toggle and reset-to-default. Wired to `GET /risk/thresholds`, `PUT`/`DELETE /risk/thresholds/:ruleKey`.                                                                                  |
| `what-if-simulator/` | `WhatIfSimulator`, `WhatIfSimulatorForm`, `WhatIfResultPanel`, `WhatIfSimulatorPage`, `what-if-simulator.client.ts` | Scenario form with client-side validation, wired to `POST /risk/what-if`, and a result panel showing the before/after score and warning differences.                                                                                                      |

Every component has loading/error/empty states (where applicable) and a
`*.spec.tsx`/`*.spec.ts` file. The HTTP layer is always injected as a plain
function (`AuthenticatedFetch`/`PostJson`), never called directly from a
presentational component, so most tests mock it without needing a DOM -
this library's Jest `testEnvironment` default is `node`; the `*-page.tsx`
host components that actually own `useState`/effects opt into
`/** @jest-environment jsdom */` per file instead.

## 5. Testing

Four layers, each stricter than the last about what it's allowed to mock.
All green as of the Fri Nov 20 Week 3 check - run locally (not yet CI, see
note below) and confirmed with these counts:

| Layer                    | Result                                                              |
| ------------------------ | ------------------------------------------------------------------- |
| Unit (backend)           | 19 suites / 188 tests passed                                        |
| Unit + component (React) | 26 suites / 171 tests passed                                        |
| Integration - in-process | included in the backend/React runs above                            |
| Integration - live       | 2 suites / 9 tests passed                                           |
| End-to-end (Playwright)  | 5 / 5 passed (`risk.spec.ts` x4, `risk-what-if-journey.spec.ts` x1) |

These are Risk-focused local runs against a freshly built demo stack on
this machine, not a CI run: the demo CI (`demo-environment.yml`) currently
runs `route-smoke.spec.ts` and (once #326 merges) `dashboard.spec.ts`, but
not the full seeded Risk Playwright journey (`risk.spec.ts` /
`risk-what-if-journey.spec.ts`) - those still need to be added to a CI job
once the seeding step below is wired into it.

### Unit (backend services/mappers)

No database, no network - `PortfolioService`/`AccountService`/etc. mocked
at the service boundary.

```
npx jest --config=apps/api/jest.config.ts --testPathPatterns="apps/api/src/app/risk"
```

19 suites / 188 tests.

### Unit + component (React, `libs/react-ui`)

No database, no network - `AuthenticatedFetch` mocked. Covers every
presentational component and page-host component across all four states
(loading/error/empty/ready) plus severity colours and accessibility
roles/labels.

```
npx jest --config=libs/react-ui/jest.config.ts --testPathPatterns="risk|what-if|target-allocation"
```

26 suites / 171 tests.

### Integration (UI -> API -> service -> data, real HTTP)

No mocked fetch anywhere above the data-access boundary. Two kinds:

- **In-process** (`libs/react-ui/src/lib/integration/risk-what-if-and-indicators.integration.spec.tsx`):
  a real NestJS app driven via `supertest`, no live stack needed - runs as
  part of the normal unit command above.
- **Live** (`libs/react-ui/integration/screens.integration.tsx`): against a
  real running demo API. Requires the demo stack (see
  `project-docs/iteration-3/deployment.md`):
  ```
  docker compose -f docker/docker-compose.demo.yml up --build -d
  ./scripts/demo-smoke.sh
  INTEGRATION_API_URL=http://localhost:3333 npx jest -c libs/react-ui/jest.integration.config.ts
  ```
  Skipped automatically (not failed) when `INTEGRATION_API_URL` isn't set.

### End-to-end (browser, Playwright)

Full journeys against a real running demo + database, using the seeded
demo users from `scripts/seed-risk-demo-data.mts`. See `e2e/README.md` for
full setup; in short:

`.env.demo`'s `DATABASE_URL` points at `postgres:5432`, which only resolves
inside the Docker network - a host-run seed script can't reach it there.
`docker-compose.e2e.yml` (added alongside #326, coordinated with Raniya)
publishes the same Postgres on `127.0.0.1:5433` for exactly this. **These
two files only exist on #326's branch as of this writing - the commands
below need #326 merged into `main` first:**

```
docker compose -f docker/docker-compose.demo.yml -f docker/docker-compose.e2e.yml up --build -d
./scripts/demo-smoke.sh
./scripts/seed-e2e-users.sh
npx playwright test -c e2e/playwright.config.ts e2e/tests/risk.spec.ts e2e/tests/risk-what-if-journey.spec.ts
```

Verified end-to-end on this machine (Fri Nov 20): since the host already
had a native Postgres service permanently bound to 5433, the local run used
a scratch override on 5434 instead with the same seed logic - the committed
5433 mapping itself is untouched and is what CI/other machines use. All 5
seeded users (`demo-risk-concentrated/-balanced/-empty/-target/-rich`)
seeded cleanly and both E2E specs passed against them (counts above).

- `risk.spec.ts`: one journey per seeded demo user (concentrated/
  balanced/empty/target), reading the indicators.
- `risk-what-if-journey.spec.ts` (Thu Nov 19): the full journey - open the
  dashboard, read the indicators, then run a what-if - on the
  "concentrated" user, asserting the result against a real API call made
  from inside the test rather than a hardcoded total (see #323 for a real
  portfolio-value/allocation inconsistency this surfaced, tracked
  separately rather than fixed in a test PR).

## 6. Known gaps

- `PUT /target-allocation`'s "every key is valid for the chosen `groupBy`"
  rule (Section 6.6) is only enforced for `groupBy: "assetClass"`; the
  other four `groupBy` values would need a market-data lookup this
  validation doesn't have.
- Money values on `what-if`'s response are not yet gated behind the
  `portfolio:read:values` scope (Section 4) - every other route has no
  money fields, so this gap is isolated to that one route.
- Basic-subscription gating (Section 11's open question - hide rules,
  keep the score) is not implemented; `rules` is never `null` today.
- `POST /what-if`'s `portfolio.valueBefore`/`valueAfter` don't agree with
  its own `holding.allocationBefore`/`allocationAfter` on the same
  response - the allocation percentage is computed against a smaller total
  than the portfolio value is, by exactly the account's cash amount in at
  least one observed case. Tracked as #323, surfaced by the Nov 19 E2E
  test, not yet fixed.
