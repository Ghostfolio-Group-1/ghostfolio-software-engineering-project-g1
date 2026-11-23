# Iteration 3 — Week 3 test report (Fri Nov 20)

QA Execution Plan, Fri Nov 20: full suite green in CI, coverage report and
test counts published, open failures listed with owners. Counted on `main` at
`fb1efd6` (after #326), with the same commands the CI jobs run. Each layer's
pass / fail status is the result of that job on `main` in GitHub Actions.

## Test counts per layer

| Layer       | CI job (workflow)                    | What runs                                                                                  | Tests                   |
| ----------- | ------------------------------------ | ------------------------------------------------------------------------------------------ | ----------------------- |
| Unit        | Unit tests (Build code)              | `npm run test:coverage`: every Nx project                                                  | 1,508 pass, 1 skipped   |
| Component   | Component tests (Build code)         | `nx test react-ui`: React screens and shared components (react-dom + jsdom, decision #221) | 456 pass (also in Unit) |
| Integration | Integration tests (Demo environment) | `demo-smoke.sh` on the demo stack, then the UI-to-API harness against the running API      | 7 routes + 13 tests     |
| End-to-end  | E2E tests (Demo environment)         | Playwright on the production build with seeded users                                       | 12 tests                |

Unit tests by project:

| Project       | Suites | Tests               |
| ------------- | ------ | ------------------- |
| apps/api      | 105    | 816 pass, 1 skipped |
| libs/react-ui | 62     | 456                 |
| libs/common   | 9      | 208                 |
| apps/client   | 5      | 22                  |
| libs/ui       | 2      | 6                   |

Integration harness by file (`libs/react-ui/integration/`):

| File                             | Tests | Covers                                                                      |
| -------------------------------- | ----- | --------------------------------------------------------------------------- |
| `screens.integration.tsx`        | 6     | Dashboard, Risk card, Tax lots and Dividends screens on live data           |
| `dashboard-flow.integration.tsx` | 4     | Dashboard across Risk, Tax and Charts, including the Tax source down (D-01) |
| `tax-flow.integration.tsx`       | 3     | Lots → realized gains → yearly summary                                      |

End-to-end by file (`e2e/tests/`):

| File                           | Tests | Journey                                                               |
| ------------------------------ | ----- | --------------------------------------------------------------------- |
| `risk.spec.ts`                 | 4     | Risk dashboard for the concentrated, balanced, empty and target users |
| `risk-what-if-journey.spec.ts` | 1     | Risk dashboard → indicators → what-if                                 |
| `tax.spec.ts`                  | 2     | Tax workspace: empty and populated users, four tabs, filters, methods |
| `dashboard.spec.ts`            | 2     | Dashboard → each feature page with the same numbers; Tax source down  |
| `route-smoke.spec.ts`          | 3     | Every React route mounts on the production build                      |

## Coverage (Unit tests job)

From `scripts/coverage-summary.mjs`, which the Unit tests job writes to the
run's summary page; the full report is the `coverage-report` artifact.

| Project       | Lines | Branches |
| ------------- | ----- | -------- |
| libs/react-ui | 96.1% | 89.4%    |
| libs/common   | 77.8% | 56.0%    |
| apps/client   | 68.9% | 54.2%    |
| apps/api      | 63.2% | 49.6%    |
| libs/ui       | 19.5% | 9.7%     |

`apps/api`, `apps/client` and `libs/ui` include the upstream Ghostfolio code;
the Iteration 3 areas are:

| Iteration 3 area       | Lines  | Branches |
| ---------------------- | ------ | -------- |
| Risk API               | 97.6%  | 84.9%    |
| Tax API                | 92.4%  | 81.6%    |
| Charts API             | 90.2%  | 77.1%    |
| Dashboard API          | 100.0% | 100.0%   |
| Shared API conventions | 100.0% | 100.0%   |
| React: Risk            | 93.8%  | 85.2%    |
| React: Tax             | 97.2%  | 86.0%    |
| React: Charts          | 95.8%  | 85.0%    |
| React: Dashboard page  | 100.0% | 94.0%    |
| React: data layer      | 100.0% | 95.2%    |
| React host (Angular)   | 98.2%  | 85.0%    |

Area rows count files loaded by at least one test. The report has no
thresholds yet; "no coverage drop on a PR" is checked by the reviewer from the
run summary.

## Blocked tests (recorded as BLOCKED, not pass)

| Test                                                  | Why                                                                                                   | Owner               |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------- |
| Dashboard E2E: click a card to reach its feature page | Cards have no links yet; the test opens each page directly (annotated BLOCKED in `dashboard.spec.ts`) | Raniya              |
| Charts: benchmark and return comparison               | #160 / #105 are not on main                                                                           | Arthur              |
| Tax: CSV / PDF downloads in the browser               | The public export endpoint is not built yet; `requestFile` follows it                                 | Tharun, then Raniya |

## Open items with owners

| Item                                                                                                                                               | Owner  |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| #272 Dashboard Risk card shows "No data yet" for holdings without an asset class                                                                   | Raniya |
| #278 Asset identity in yearly summaries and exports (changes requested; trace part → #155)                                                         | Tharun |
| #293 / #294 / #295 Split of the demo presentation fixes (calculator, withholding, dark mode)                                                       | Arthur |
| Remaining GET routes in `demo-smoke.sh` (`/tax/dividends`, `/tax/yearly-summary`, `/risk/warnings`, `/risk/target-allocation`, `/risk/thresholds`) | Raniya |
| Dashboard cards link to their feature pages (unblocks the click-through step)                                                                      | Raniya |

Each row is checked against GitHub at the 3:30 Week 3 check; anything closed
since is removed here, anything new is added with an owner.
