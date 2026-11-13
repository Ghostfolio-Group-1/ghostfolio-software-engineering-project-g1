# Dashboard, shared library and integration — sprint alignment

Source: TA Breakers Iteration 3 Sprint Plan Rev 2 (Thu Nov 5, 2026), Section 6
(Testing Strategy and QA) and Section 5 (Daily Plan). Same format as the Risk
docs in `docs/testing/` (#225).

Scope (Raniya — Arch / QA / Dashboard):

- Unified Dashboard: `apps/api/src/app/dashboard/`,
  `libs/react-ui/src/lib/dashboard-page/` and the `/dashboard` client route
- Shared API conventions: `libs/common/src/lib/api-conventions.ts`
- Shared React library: `card/`, `dashboard-card/`, `button/`,
  `layout-shell/`, `theme/`, `tokens/`, `chart-wrapper/`, `table/`
- Shared data layer: `libs/react-ui/src/lib/data/`
- UI-to-API integration harness: `libs/react-ui/integration/`
- Demo environment and smoke tests: `docker/docker-compose.demo.yml`,
  `scripts/demo-smoke.sh`, `e2e/tests/route-smoke.spec.ts`,
  `.github/workflows/demo-environment.yml`

## Current sprint

Iteration 3, Phase B (test and refine), Fri Nov 13 – Fri Nov 20, after the
Thu Nov 12 team demonstration. Phase C (manual QA) Nov 23–25; Phase D
(recorded demo, report) Nov 30 – Dec 5. From Nov 12 the limit is back to one
issue (one PR) per person per day.

## Test layers and who owns them for this scope

| Layer       | Plan date                            | Owner                          | What it covers here                                                                                            |
| ----------- | ------------------------------------ | ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Unit        | With every PR; gap fill Mon Nov 16   | Raniya                         | Dashboard aggregation (`DashboardOverview`), shared API conventions, shared React library and data layer       |
| Component   | With every PR; gap fill Tue Nov 17   | Raniya                         | Dashboard cards, partial-failure notice, shared Card / DashboardCard / ChartWrapper / Table in all four states |
| Integration | Harness Tue Nov 10; suite Wed Nov 18 | Raniya (harness for all teams) | Dashboard overview across Risk, Tax and Charts on the running API, including one source down                   |
| End-to-end  | Route smoke Nov 11; journeys Nov 19  | Raniya leads                   | Unified Dashboard → each card → drill-down; cross-feature E2E run                                              |
| Manual QA   | Nov 23–25                            | Raniya leads; all members test | QA log (Appendix C), one row per planned test                                                                  |

Other Section 6 items owned here:

- Fri Nov 13 (Week 2 check): this test strategy and the test-plan list for
  this scope; coverage report added to CI.
- Wed Nov 18: Component, Integration and E2E jobs added as required checks
  on `main`.
- Fri Nov 20: full suite green in CI; coverage report and test counts
  published.

## Deliverables

| Deliverable                                       | Date           | Status                                       |
| ------------------------------------------------- | -------------- | -------------------------------------------- |
| `docs/testing/dashboard/module-analysis.md`       | Nov 13         | This PR                                      |
| `docs/testing/dashboard/test-plan.md`             | Nov 13         | This PR                                      |
| Demo environment + API smoke test in CI           | Mon Nov 9      | Done (#239, issue #238)                      |
| UI-to-API integration harness                     | Tue Nov 10     | Done (#251, issue #250)                      |
| Unified Dashboard page on live data               | Tue Nov 10     | Done (#237, #249; route #268)                |
| Browser route smoke in CI (Dashboard, Risk, Tax)  | Wed Nov 11     | Done (#269, issue #266)                      |
| Smoke test of every screen; bugs filed            | Wed Nov 11     | Done; #272 open, #273 fixed in #274          |
| `requestFile` + Tax export contract in arch doc   | Week of Nov 16 | Planned; agreed with Tax on Nov 11           |
| Unit / component gap fill (gaps in test-plan.md)  | Nov 16–17      | Planned                                      |
| Dashboard integration suite incl. one source down | Wed Nov 18     | Planned                                      |
| Required checks on `main`                         | Wed Nov 18     | Planned                                      |
| E2E journeys (Playwright)                         | Thu Nov 19     | Planned; Playwright set up and running in CI |
| Coverage report in CI                             | Nov 13 / 20    | Planned                                      |

## Conventions (Section 1 of the plan)

- Branch `raniya/<date>-<issue>-<topic>` from the latest `main`; one issue,
  one branch, one PR; PR says `Closes #<issue>` and carries the
  `AI-assisted` line.
- Reviewer ring: Raniya → Sesha. Not self-merged.
- Unit tests keep `testEnvironment: 'node'` with per-file
  `/** @jest-environment jsdom */` (test-tooling decision, #221). React
  Testing Library is not installed; components are tested with
  `react-dom/server` and `react-dom/client` + `act`.
