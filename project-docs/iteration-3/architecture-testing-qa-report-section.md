# Iteration 3 report — Architecture, Testing and QA (draft)

_Owner: Raniya Shaikh (Dashboard / Architecture / QA) · Draft Fri Nov 27, 2026 · Final check Wed Dec 2_

Sources: `main` at `31943be84`, the QA log (`docs/testing/qa-log.md`), the Week 3 test report (`docs/testing/week3-test-report.md`) and GitHub Actions. Test counts come from CI runs, not from local runs.

## 1. Software architecture — as built

The design from Week 1 ([architecture-3-tier-soa.md](architecture-3-tier-soa.md)) held: three tiers, one service per feature, and a React presentation tier mounted inside the existing Angular client.

| Tier                      | Lives in                                                          | As built at the end of Iteration 3                                                                                                                                                                             |
| ------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Presentation (React)   | `libs/react-ui`, mounted by `gf-react-host` in `apps/client`      | Feature screens for Risk, Tax, Charts and the Unified Dashboard on shared primitives (Card, DashboardCard, Table, Button, ChartWrapper, ThemeProvider, tokens) and one data layer (`requestApi`, `useApiData`) |
| 2. Application / services | `apps/api/src/app/<feature>/`, pure calculations in `libs/common` | Four NestJS feature services behind `/api/v1/<feature>`, each with its own error-code prefix and the shared `{ data, error, meta }` envelope                                                                   |
| 3. Data                   | `PortfolioService`, Prisma (PostgreSQL), Redis, market data       | Unchanged from Ghostfolio; no feature reads another feature's tables                                                                                                                                           |

### 1.1 Services and routes on `main`

| Service   | Owner  | Routes (`/api/v1`)                                                                                                                                                         | Error prefix |
| --------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Risk      | Sesha  | `GET risk/score`, `GET risk/concentration`, `GET risk/warnings`, `POST risk/what-if`, `GET/PUT/DELETE risk/thresholds[/:ruleKey]`, `GET/PUT/DELETE risk/target-allocation` | `RISK_`      |
| Tax       | Tharun | `GET tax/lots`, `GET tax/realized-gains`, `GET tax/dividends`, `GET tax/yearly-summary`                                                                                    | `TAX_`       |
| Charts    | Arthur | `GET charts/series`, `GET charts/drawdown`                                                                                                                                 | `CHARTS_`    |
| Dashboard | Raniya | `GET dashboard/overview`                                                                                                                                                   | `DASHBOARD_` |

Only the Dashboard service composes the others. It loads Risk, Tax and Charts in parallel and returns each section as `available` or `unavailable`, so one failing service never breaks the page (QA row D-06).

### 1.2 Presentation tier

| Feature   | React folders (`libs/react-ui/src/lib/`)                                                                         | Page                  |
| --------- | ---------------------------------------------------------------------------------------------------------------- | --------------------- |
| Risk      | `risk-dashboard`, `risk-indicator`, `risk-warnings`, `risk-thresholds`, `target-allocation`, `what-if-simulator` | `/en/risk`            |
| Tax       | `tax-workspace`, `tax-lots`, `realized-gains`, `dividend-withholding`, `yearly-tax-summary`                      | `/en/portfolio/tax`   |
| Charts    | `chart-series` (interactive chart with range and series toggles), `charts-drawdown`, `charts-waterfall`          | Overview (`/en/home`) |
| Dashboard | `dashboard-page`                                                                                                 | `/en/dashboard`       |
| Shared    | `card`, `dashboard-card`, `table`, `button`, `layout-shell`, `theme`, `tokens`, `chart-wrapper`, `data`          | -                     |

The Angular host (`gf-react-host`) supplies the authenticated fetch (token, impersonation and timezone headers) and the colour scheme. React code never reads tokens. Since #295 and #360 the host also follows the operating system's dark mode when the user's Appearance is Auto.

### 1.3 Changes from the Week 1 design

- **Planned but not built:** benchmark comparison (#160) and return comparison (#105). Their QA row (C-08) is recorded as BLOCKED.
- **Built but not reachable from a page:** the waterfall card (#356). The drawdown card is mounted under the Overview chart by #364.
- **Changed after QA:** the Overview page now scrolls from the top instead of centring a fixed-height box (#295), which fixed the clipped chart controls found in QA (C-01, #353).
- **Open contract question:** the portfolio total differs between Charts (no cash) and the Risk what-if (with cash) (#355, D-02).

## 2. Testing

### 2.1 Tools and layers

| Layer       | Tool                                                            | Where                                                                | CI job                               |
| ----------- | --------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------ |
| Unit        | Jest                                                            | `apps/api`, `libs/common`, `libs/react-ui`, `apps/client`, `libs/ui` | Build code → Unit tests              |
| Component   | Jest + jsdom, `react-dom/client` with `act` (decision #221)     | `libs/react-ui/src/lib/**/*.spec.tsx`                                | Build code → Component tests         |
| Integration | `scripts/demo-smoke.sh` plus the React-against-live-API harness | `libs/react-ui/integration/*.integration.tsx`                        | Demo environment → Integration tests |
| End-to-end  | Playwright (Chromium) on a clean demo stack with seeded users   | `e2e/tests/*.spec.ts`                                                | Demo environment → E2E tests         |

The Unit job runs every project, including the `libs/react-ui` component specs, so the Component count is part of the Unit count, not added to it.

All four jobs, plus Lint and format and Build, are required checks on `main`, so a red suite blocks a merge. Coverage is produced by `npm run test:coverage` and published in the run summary and the `coverage-report` artifact.

React Testing Library was planned on Nov 6 but not adopted (#221): tests use `react-dom/client` and `act` with the per-file jsdom environment, which kept one way of writing component tests across the library.

### 2.2 Test counts (CI)

| Layer       | Tests                      | Source                                 |
| ----------- | -------------------------- | -------------------------------------- |
| Unit        | 1564 passed, 1 skipped     | Build code run 46067807632, Unit tests |
| Component   | 493 passed                 | same run, Component tests              |
| Integration | 8 smoke routes + 14 passed | Demo environment run 46067807663       |
| End-to-end  | 14 passed                  | same run, E2E tests                    |

Week 3 baseline for comparison (main `fb1efd6`, Nov 20): 1,508 unit tests passed and 1 skipped, 456 component tests, 7 smoke routes plus 13 integration tests, and 12 E2E tests.

### 2.3 How tests were checked

- **Break on purpose.** A reviewer approves a test only after seeing it fail when the code is wrong. For example, removing the drawdown mount fails the interactive-chart spec (#364), and making the React host ignore the OS colour scheme fails 2 of the 4 host tests (#360).
- **Blocked is not pass.** Steps that depend on work that is not on `main` are recorded as BLOCKED with the issue that unblocks them (export #190, tax-relevance filter #242, benchmark #160 / #105, dashboard card links #354).
- **One source down.** The dashboard integration test makes the Tax service throw and checks HTTP 200, the Tax section `unavailable`, and Risk and Charts still present.

### 2.4 Use of AI

AI assistance (Claude) was used to draft tests, small fixes, review comments, scripts and documentation. The rules we kept:

- The plan asks every PR to state `AI-assisted: Yes` or `No`. Of the 80 PRs merged since Nov 2, 8 say Yes, 38 say No and 34 have no line, so the line was not applied consistently.
- AI output was treated like any other draft. It was run locally, formatted with Prettier, and accepted only when CI was green and a teammate approved it.
- Every AI-drafted test was broken on purpose before review to show that it can fail.
- Numbers in reports and the QA log come from CI runs and GitHub, not from AI summaries. Where AI proposed a figure, it was checked against the run or the code.
- AI was not used for manual QA judgements. Every QA row was tested by a person in the browser and logged with tester and date.

Where AI got things wrong, these checks caught it. For example, an AI-drafted dark-theme test used the wrong `it.each` shape and failed before review, and an AI-written QA-log edit added an extra table column that was spotted in the terminal output and fixed.

## 3. Quality assurance

### 3.1 Manual QA pass (Nov 23–24)

All screens were tested on a clean demo stack (`down -v`, rebuild, seed five demo users) in the browser, with each result logged with tester and date.

| Part                                               | Planned | PASS | FAIL | BLOCKED |
| -------------------------------------------------- | ------- | ---- | ---- | ------- |
| 1. Risk and Tax (Nov 23)                           | 21      | 16   | 3    | 2       |
| 2. Charts, Dashboard, deploy, Redis drill (Nov 24) | 21      | 12   | 7    | 2       |
| **Total**                                          | 42      | 28   | 10   | 4       |

The clean deployment came up healthy in 332 s (309 s of that was the image build), seeded all five users without manual steps, and passed all 9 smoke routes.

### 3.2 Defects found

| Issue | Found by               | What                                                                    | Owner                 | State at freeze (Nov 25)                 |
| ----- | ---------------------- | ----------------------------------------------------------------------- | --------------------- | ---------------------------------------- |
| #341  | R-07                   | Risk rule scores had no label                                           | Sesha                 | Fixed, re-tested PASS                    |
| #343  | R-04                   | Target-allocation warnings showed the deviation as the holding's share  | Sesha                 | Fixed, re-tested PASS                    |
| #342  | R-09, T-09, C-06, D-09 | React screens stayed light when Appearance was Auto and the OS was dark | Raniya, Arthur        | Fixed (#295, tests #360), re-tested PASS |
| #344  | T-07                   | Tax money values shown as raw decimals                                  | Tharun                | Fixed (#349) after the regression run    |
| #353  | C-01                   | Overview chart controls clipped under the header at 100 % zoom          | Arthur                | Fixed by #295 (re-test Nov 30)           |
| #338  | C-05                   | No keyboard focus ring on chart toggles                                 | Arthur                | PR open                                  |
| #356  | C-07                   | Drawdown and waterfall cards not mounted on any page                    | Arthur                | Drawdown in #364; waterfall open         |
| #355  | D-02                   | Portfolio total differs between Charts, Risk what-if and Overview       | Raniya, Arthur, Sesha | Open                                     |
| #357  | X-02                   | Dashboard stays on "Loading…" when Redis is down                        | Raniya                | Open                                     |
| #354  | D-07 (BLOCKED)         | Dashboard cards do not link to their pages                              | Raniya                | Open                                     |

Every failure had a merged fix or an open issue with an owner at the 6 PM freeze on Nov 25, which is the freeze rule.

### 3.3 Regression run (Nov 25)

The regression run was the CI of #360 on top of `main`: Build code run 45680046804 and Demo environment run 45680046633, both green (7 of 7 checks). A clean local rebuild was healthy after 438 s. #341, #343 and #342 were re-tested on that stack and passed. #360 itself was merged after the freeze and is recorded as late.

### 3.4 Resilience

With Redis stopped, the Dashboard stayed on "Loading…" for more than 20 seconds instead of showing a section as unavailable (#357). The API was healthy again 3 seconds after Redis restarted. The planned fix is a client-side timeout in `requestApi` that turns a hung request into the existing unavailable-and-Retry state.

### 3.5 What QA changed

- Usability: labelled scores (#341), clearer warnings (#343), formatted money (#344), focus rings (#338).
- Layout: the Overview chart is reachable at normal zoom (#295).
- Theming: React screens follow the system dark mode (#342).
- Open for the next iteration: one definition of portfolio total (#355), request timeouts (#357), dashboard card links (#354), the waterfall chart (#356), and the benchmark and return comparisons (#160, #105).
