# Dashboard, shared library and integration — test plan

Tracking: #68 (Unified Dashboard), #250 (harness), #238 (demo environment),
#266 (browser route smoke). Format follows the Risk test plan in
`docs/testing/test-plan.md` (#225).

Status: **have** = covered by an existing spec on `main` (read, not assumed);
**gap** = to add on the plan date shown; **blocked** = waits on the named
issue.

## Backend / API

### `GET /api/v1/dashboard/overview` — service (`dashboard-overview.spec.ts`)

| Case                                                                           | Status                  |
| ------------------------------------------------------------------------------ | ----------------------- |
| All sources load → every section `available`                                   | have                    |
| Risk built for the token user in their base currency                           | have                    |
| Tax built from FIFO realized gains for the token user                          | have                    |
| Charts built from the full history and first activity date                     | have                    |
| Empty history passed to charts when the portfolio has none                     | have                    |
| Tax fails → only tax `unavailable`, error not leaked                           | have                    |
| Holdings fail → only risk `unavailable`                                        | have                    |
| `ChartsApi` throws → only charts `unavailable`                                 | have                    |
| All sources fail → every section `unavailable` (still resolves)                | have                    |
| Non-Error rejection logged, section still `unavailable`                        | have                    |
| Invalid first-activity date omitted                                            | have                    |
| Invalid default limit → risk `unavailable` without loading holdings            | have                    |
| Charts section requests the `1y` range (`DASHBOARD_CHART_RANGE`)               | gap — Nov 16            |
| Numeric check: risk percentages and tax totals match worked-out fixture values | gap — Nov 16            |
| Holdings without an asset class still produce risk concentration (#272)        | gap — with the #272 fix |

### Controller and HTTP (`dashboard.controller.spec.ts`, `dashboard.e2e.spec.ts`)

| Case                                                          | Status       |
| ------------------------------------------------------------- | ------------ |
| Routed at `/dashboard/overview`                               | have         |
| Loads for the token user in their base currency               | have         |
| Sections returned unchanged in the success envelope           | have         |
| Error / non-Error → 500 `DASHBOARD_OVERVIEW_FAILED`, logged   | have         |
| Contract shape (JSON schema) with the real tax result         | have (e2e)   |
| 200 with only tax `unavailable` when tax data fails           | have (e2e)   |
| 403 without `portfolio:read`; 401 when not logged in          | have (e2e)   |
| While impersonating, the impersonated user's data is returned | gap — Nov 16 |

### Shared API conventions (`api-conventions.spec.ts`)

| Case                                                                                                                   | Status       |
| ---------------------------------------------------------------------------------------------------------------------- | ------------ |
| Success envelope; pagination meta kept                                                                                 | have         |
| Feature-prefixed error codes; errors carry `data: null`                                                                | have         |
| Percentages as decimals                                                                                                | have         |
| Every Iteration 3 error code starts with its feature prefix (RISK_, TAX_, CHARTS_, DASHBOARD_) and is upper snake case | gap — Nov 16 |

## UI / Component

### Dashboard page and cards (`dashboard-page/`, 40 tests)

| Case                                                                                         | Status       |
| -------------------------------------------------------------------------------------------- | ------------ |
| Shell: one card per section in order, loading by default, each section in its own state      | have         |
| Notice slot rendered above the grid                                                          | have         |
| Overview mapping: risk / tax / charts ready, empty when no rows, unavailable → generic error | have         |
| No server text in any error view (`internal detail` / `holdings down` never rendered)        | have         |
| Live page: one GET through the host fetch; whole failure → 3 retryable errors; retry reloads | have         |
| Partial failure: notice names the failed section; hidden when healthy and on total failure   | have         |
| Risk card: fraction → %, severity text, over-limit callout, all-`NO_DATA` shows shares only  | have         |
| Tax card: exact Big sums, losses, mixed currencies refused, newest first                     | have         |
| Charts card: formatting, kind labels, singular/plural, labelled sparkline, empty → nothing   | have         |
| Every card in the dark theme: no text colour equal to its background (#273 follow-up)        | gap — Nov 17 |
| Charts card with negative and very large values                                              | gap — Nov 17 |
| Partial-failure Retry reachable by keyboard and announced (`role="status"`)                  | gap — Nov 17 |
| Risk card severity colours from live severities (unblocked by #281)                          | gap — Nov 17 |

### Shared primitives (36 tests)

| Component       | Have                                                                                                  | Gap (Nov 17)                                     |
| --------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `DashboardCard` | loading (aria-busy), error (danger colour, default message), retry shown/clicked, empty, ready, theme | none                                             |
| `ChartWrapper`  | path scaling, flat series, single point, empty path, accessible chart, empty state                    | pointer readout + keyboard (lands with #226)     |
| `Table`         | headers/rows, decimal strings as given, numeric right-align, empty row, caption + theme               | very long text wraps without breaking the layout |
| `Card`          | title + children, no heading without title, surface colour                                            | none                                             |
| `Button`        | primary, secondary, disabled                                                                          | `onClick` not called when disabled               |
| `LayoutShell`   | title + children, tokens; transparent background, light and dark text colour (#274)                   | none                                             |
| `ThemeProvider` | light default, dark on request, brand colour in both                                                  | none                                             |
| `designTokens`  | brand colours, 4px spacing, `px()`                                                                    | none                                             |

### Data layer (11 tests)

| Case                                                                                                                                      | Status                   |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `requestApi`: GET through the adapter, decimal strings kept, backend code thrown, 401 sign-in message, non-JSON and missing-data rejected | have                     |
| `requestApi`: 403 and 5xx give a generic message, never server text                                                                       | gap — Nov 16             |
| `useApiData`: loading → ready, empty, error kept, `reload()`, abort on unmount                                                            | have                     |
| `useApiData`: a slow first response arriving after `reload()` is ignored                                                                  | gap — Nov 16             |
| `requestFile` for Tax CSV/PDF downloads (contract agreed with Tax, Nov 11)                                                                | gap — with `requestFile` |

## Integration (UI ↔ API ↔ service ↔ data)

| Case                                                                                             | Status               |
| ------------------------------------------------------------------------------------------------ | -------------------- |
| Every Iteration 3 route returns 200 with `error: null` on the demo stack (`demo-smoke.sh`)       | have (#239)          |
| Dashboard overview renders on the running API: all cards settle, no error, exact realized gain   | have (harness, #251) |
| Risk card: live score and concentration parse; grade renders                                     | have (harness)       |
| Tax lots and Dividends screens settle into a table on live data                                  | have (harness)       |
| Dashboard overview with one source down on the running API (e.g. tax failing) → notice + 2 cards | gap — Nov 18         |
| Harness covers Realized gains and Yearly summary                                                 | gap — Nov 18         |
| Harness covers the Charts series chart and the What-if simulator (mounted in #282)               | gap — Nov 18         |
| Fixture sets an asset class so Risk stock buckets can be asserted (#272)                         | gap — Nov 18         |

## End-to-end (browser)

| Journey                                                                                 | Status                   |
| --------------------------------------------------------------------------------------- | ------------------------ |
| Dashboard, Risk and Tax open on the production build with no host fallback or errors    | have (#269)              |
| main + Tax PR in one build: all four Tax views, then Risk, then Dashboard (one session) | done once, Nov 11 (#262) |
| Unified Dashboard → each card → drill-down to Risk, Tax and Charts                      | gap — Nov 19             |
| `/en/portfolio/risk` (Portfolio tab, #280) added to the route smoke                     | gap — Nov 19             |
| Cross-feature run on a clean demo environment                                           | gap — Nov 19             |
| Browser job added to CI as a required check                                             | gap — Nov 18             |

## Manual QA

Nov 11 smoke test on the demo environment (main @ #269): Dashboard, Risk and
Tax passed; two bugs filed, #272 (open) and #273 (fixed in #274, re-checked
in dark mode the same day).

Nov 23–25: one QA-log row per case above that has a UI, run by a person on
the demo environment, with tester, date and result; every failure gets a bug
issue. Part 2 (Nov 24) also checks the deployment from a clean environment.
