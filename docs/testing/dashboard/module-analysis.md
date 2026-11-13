# Dashboard, shared library and integration — module analysis

Source of truth for the contracts: `project-docs/iteration-3/architecture-3-tier-soa.md`
and the JSON schemas under each feature's `contracts/`. This doc grounds the
test plan in what is on `main` (at `024cc19`, Nov 13), not what was planned.

## Route (`apps/api/src/app/dashboard/dashboard.controller.ts`, mounted at `/api/v1/dashboard`)

| Method | Path        | Notes                                                                                                                                                                                                                                                                                                     |
| ------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/overview` | `portfolio:read`. Loads risk, tax and charts in parallel. Each section is `{ status: 'available', data }` or `{ status: 'unavailable', error }` with a `DASHBOARD_<SECTION>_UNAVAILABLE` code, so one failing source never fails the page. 500 `DASHBOARD_OVERVIEW_FAILED` only on an unexpected failure. |

## Service (`apps/api/src/app/dashboard/dashboard-overview.ts`)

`DashboardOverview.getOverview()` composes:

- **risk**: holdings from `PortfolioService`, stock concentration via
  `toRiskConcentrationResponse` with the default limit (groups by asset class)
- **tax**: FIFO realized gains from `TaxService`
- **charts**: full performance history from `PortfolioService`, cut to
  `DASHBOARD_CHART_RANGE = '1y'` by `ChartsApi.getSeries`

Each section is loaded through `loadSection`, which catches and logs the
error and returns `unavailable` without the server message.

## Shared API conventions (`libs/common/src/lib/api-conventions.ts`)

`createSuccessResponse`, `createErrorResponse`, feature-prefixed error codes,
decimal percentages. Every Iteration 3 route uses them.

## Client

| Where                                        | What                                                                                                                                                                             |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/client/src/app/components/react-host/` | `gf-react-host` (#257, static import fix #265): mounts a React screen, passes the signed-in `AuthenticatedFetch` and the theme, remounts on user / impersonation / colour scheme |
| `apps/client/src/app/pages/dashboard/`       | `/dashboard` route (#268) rendering `DashboardOverviewPage`; not in the nav                                                                                                      |

## React (`libs/react-ui/src/lib/`)

| Folder                                                   | What                                                                                                                                                                          | Data                             |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `dashboard-page/`                                        | `DashboardPage` shell, `DashboardOverviewPage` (live), `toDashboardSections`, Risk / Tax / Charts summary cards, `DashboardPartialFailure`                                    | `GET /api/v1/dashboard/overview` |
| `data/`                                                  | `AuthenticatedFetch`, `requestApi` (envelope unwrap, `ApiRequestError` with code, no server text), `useApiData` (loading / error / empty / ready, `reload`, abort on unmount) | every screen                     |
| `dashboard-card/`                                        | `DashboardCard`: one card, four states, optional retry                                                                                                                        | n/a                              |
| `chart-wrapper/`                                         | `ChartWrapper`, `toPath` (pointer readout in #226, not merged)                                                                                                                | n/a                              |
| `table/`                                                 | `Table`: decimal strings rendered as given, numeric columns right-aligned                                                                                                     | n/a                              |
| `card/`, `button/`, `layout-shell/`, `theme/`, `tokens/` | Primitives and design tokens; light and dark themes. `LayoutShell` takes its text colour from the active theme and leaves the host background (#274)                          | n/a                              |

React never calculates financial values: the Tax card sums decimal strings
exactly with Big for display only; the Charts card shows API values as sent.

## Integration harness (`libs/react-ui/integration/`)

Signs up a fresh user on a running API, imports a shared fixture portfolio
(`fixtures/portfolio.json`) and its prices, and renders the Dashboard, Risk
card, Tax lots and Dividends screens through the same `AuthenticatedFetch`
the Angular host passes in. Runs in the `Demo environment` workflow after
`scripts/demo-smoke.sh`; skipped when `INTEGRATION_API_URL` is not set.

## Browser smoke (`e2e/tests/route-smoke.spec.ts`)

Playwright (config `e2e/playwright.config.ts`). Signs up, signs in through the
header dialog and opens `/en/dashboard`, `/en/risk` and `/en/portfolio/tax`
on the production build; fails on a host fallback, a `react-host-error` or
any page / console error. Runs in the `Demo environment` workflow (#269).

## External dependencies

None in the request path for `/dashboard/overview` beyond the existing
`PortfolioService` / `TaxService` / `ChartsApi` seams, which the unit specs
mock. Market prices in the harness come from `MANUAL` market data, so no
data-provider call is needed.

## Existing coverage (counted on `main` at `024cc19`, Nov 13)

| Area                                     | Spec files | Tests    |
| ---------------------------------------- | ---------- | -------- |
| Dashboard API (service, controller, e2e) | 3          | 23       |
| Shared API conventions                   | 1          | 5        |
| Shared React primitives                  | 8          | 36       |
| Data layer                               | 2          | 11       |
| Dashboard page and cards                 | 7          | 40       |
| UI-to-API integration harness            | 1          | 4        |
| Demo smoke test (API routes)             | 1 script   | 7 routes |
| Browser route smoke (Playwright)         | 1          | 3 routes |

The whole `react-ui` unit run is 60 suites / 428 tests. This is not a
green-field area; the plan targets the gaps below rather than re-testing what
is covered.

## Ambiguities and findings

1. **Host mounting**: resolved. `gf-react-host` (#257, #265) and the
   `/dashboard` route (#268) are on main; browser tests can run.
2. **Risk severity**: resolved. `/risk/concentration` now takes severity from
   the threshold engine (#281, the gap reported in #240), so severity assertions on the Risk
   card can be written.
3. **Asset class**: the dashboard Risk card groups by asset class, so holdings
   without one (imported `MANUAL` symbols) show "No data yet" while `/risk`
   shows data (#272, found in the Nov 11 smoke test). The harness fixture has
   the same gap. Fix: fallback to per-holding concentration, then assert it.
4. **Dark mode**: the dashboard page stayed white in dark mode (#273, fixed in
   #274 with three `LayoutShell` tests). The cards' own dark-theme rendering
   is still untested.
