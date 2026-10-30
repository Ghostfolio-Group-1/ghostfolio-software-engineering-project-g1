# Architecture — as built (end of Iteration 2)

Snapshot of the service boundaries on `main` as of Oct 27, 2026. The plan is in [target-architecture.md](../target-architecture.md); this file records what shipped and where it differs.

## Modules and boundaries

All feature code lives in the NestJS API (`apps/api/src/app/<feature>/`). Each feature is one Nest module with one controller. Other modules reach a feature only through its exported services.

| Module          | Exports                    | Imports (feature-relevant)                                                                    | Owner  |
| --------------- | -------------------------- | --------------------------------------------------------------------------------------------- | ------ |
| RiskModule      | ExposureService            | AccountModule, ExchangeRateDataModule, ImpersonationModule, MarketDataModule, PortfolioModule | Sesha  |
| TaxModule       | TaxDataService, TaxService | ExchangeRateDataModule, ImpersonationModule, PrismaModule                                     | Tharun |
| ChartsModule    | ChartsApi                  | ImpersonationModule, PortfolioModule                                                          | Arthur |
| DashboardModule | DashboardOverview          | ChartsModule, ImpersonationModule, PortfolioModule, RiskModule, TaxModule                     | Raniya |

Dependency direction: Dashboard → Risk / Tax / Charts → Portfolio / Prisma. No feature module imports another feature module except Dashboard.

## Routes

All routes are under `/api/v1` (URI versioning, global prefix `api`) and require login plus the `portfolio:read` scope (`@RequiresScope`), which applies the JWT, permission, impersonation and scope guards.

| Method | Route               | Controller          | Notes                                                                                           |
| ------ | ------------------- | ------------------- | ----------------------------------------------------------------------------------------------- |
| GET    | /risk/concentration | RiskController      | `limit` query (1–20)                                                                            |
| POST   | /risk/what-if       | RiskController      | What-if scenario for a holding                                                                  |
| GET    | /tax/realized-gains | TaxController       | FIFO realized gains; decimal amounts as strings                                                 |
| GET    | /tax/lots           | TaxController       | Open FIFO tax lots                                                                              |
| GET    | /charts/series      | ChartsController    | `range` preset or `startDate`/`endDate`, optional `kind`                                        |
| GET    | /charts/drawdown    | ChartsController    | Drawdown from the running peak of the performance index; merged Oct 30, after the freeze (#167) |
| GET    | /dashboard/overview | DashboardController | Risk, tax and charts sections, each available/unavailable                                       |

## Shared conventions

- **Envelope:** every response is `{ data, error, meta }` from `@ghostfolio/common/api-conventions` (`createSuccessResponse` / `createErrorResponse`).
- **Error codes:** prefixed by feature (`RISK_`, `TAX_`, `CHARTS_`, `DASHBOARD_`). Messages to the client are generic; internal errors are logged on the server.
- **Numbers:** risk and charts return JSON numbers; tax returns decimal amounts as strings (`Big.toString()`) so no precision is lost.
- **Drafts:** excluded by tag (`tags: { none: { id: TAG_ID_DRAFT } }`), not a column.
- **Contracts:** each endpoint has a JSON schema under `<feature>/contracts/`, validated with ajv in unit and end-to-end tests. The dashboard schema reuses the tax and charts schemas.

## Error codes on main

| Code                                          | HTTP             | Meaning                                                   |
| --------------------------------------------- | ---------------- | --------------------------------------------------------- |
| RISK_INVALID_QUERY                            | 400              | Invalid `limit`                                           |
| RISK_WHATIF_INVALID_DROP                      | 4xx              | Invalid what-if input                                     |
| RISK_WHATIF_HOLDING_NOT_FOUND                 | 4xx              | What-if holding not in the portfolio                      |
| TAX_REALIZED_GAINS_FAILED                     | 422              | FIFO realized gains could not be calculated               |
| TAX_LOTS_FAILED                               | 4xx              | Open lots could not be built                              |
| TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY     | 4xx              | Tax scope depends on excluded (non tax-relevant) activity |
| CHARTS_INVALID_QUERY                          | 400              | Invalid range, dates or kind                              |
| CHARTS_SERIES_FAILED                          | 500              | History could not be loaded                               |
| CHARTS_DRAWDOWN_FAILED                        | 500              | Drawdown could not be loaded                              |
| DASHBOARD_RISK_UNAVAILABLE / _TAX_ / _CHARTS_ | 200 (in section) | One section failed; the rest still render                 |
| DASHBOARD_OVERVIEW_FAILED                     | 500              | Unexpected failure outside the sections                   |

Exact status codes for the `4xx` rows are set in the owning controller.

## Dashboard aggregation

`DashboardOverview.getOverview()` loads the three sections in parallel with the same calls their controllers make. Each section is `{ status: 'available', data }` or `{ status: 'unavailable', error }`, so one failing source never fails the whole response.

## Differences from the target architecture / known gaps

- **Risk has no catch-all envelope.** An unexpected error in `/risk/*` returns a raw 500 instead of a `RISK_*` code. The dashboard is unaffected, because it wraps risk as a section. Owner: Sesha.
- **Risk orchestration.** The dashboard calls `ExposureService` directly. If a single risk entry point (a `RiskService`) is added, the dashboard should switch to it.
- **No React dashboard view yet.** The overview is available over HTTP only; the React migration (`libs/react-ui`) has the components but no page wired to `/dashboard/overview`.
- **Local setup:** run `npx prisma generate` after pulling schema changes (for example `isTaxRelevant`, #55), or local tests fail to compile.

## Evidence

- Integration pass #1: [evidence/integration-pass-1-2026-10-26.md](evidence/integration-pass-1-2026-10-26.md) — 4 e2e suites (47 tests), 91 unit suites (611 tests), build green; no integration bugs found.
- Dashboard coverage: [evidence/dashboard-coverage-2026-10-23.md](evidence/dashboard-coverage-2026-10-23.md) — 100% on dashboard files.
