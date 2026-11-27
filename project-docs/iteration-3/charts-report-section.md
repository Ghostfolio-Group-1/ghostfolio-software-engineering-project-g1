# Charts — Final Implementation Report

- **Contributor:** Arthur Elly Lim
- **Team:** TA Breakers
- **Project:** Ghostfolio Extension — Portfolio Risk, Tax, Performance & Income Analytics
- **Iteration:** 3 — Frontend, Visualization, Testing and Refinement
- **Initial draft:** November 27, 2026
- **Repository baseline:** Charts work on `main` through PR #313 / #363, Overview host #295, and open follow-ups #338, #356, #364
- **Also serving as:** Iteration 3 Scrum Master (handover recorded in Iteration 2 retrospective)

## 1. Objective and Individual Contribution

My primary responsibility was the Charts module: shared time-range charting for portfolio value, invested capital, cash, and investment drawdown, with React views hosted inside Ghostfolio.

The objective was to turn Iteration 1 designs and the Iteration 2 Nest `/api/v1/charts/` backend into interactive, testable UI that reuses the same range contract as the API, keeps financial series authoritative on the server, and meets the Week 4 manual QA bar (contrast, keyboard use, empty and error states).

Across the three iterations I owned Charts design reconciliation, backend series and drawdown routes (with teammates on shared Nest wiring), React series/range/drawdown/waterfall views, numeric and component tests, live integration and browser journeys, and Iteration 3 Scrum coordination.

## 2. Development Across the Three Iterations

### 2.1 Iteration 1 — Design

Iteration 1 produced chart data-model and architecture drafts under `project-docs/iteration-1/` and `project-docs/design-architecture-charts.md`. Those drafts used placeholder `/portfolio/...` paths and were explicitly documentation-first.

Peer review of the chart data model (Tax peer-review note) helped align series kinds, range selection, and drawdown semantics before backend work started.

### 2.2 Iteration 2 — Backend

Iteration 2 shipped the as-built Nest charts module and shared calculation helpers:

- `GET /api/v1/charts/series` — portfolio value, invested capital, cash;
- `GET /api/v1/charts/drawdown` — drawdown points and max-drawdown summary;
- shared range presets / custom dates, server-side granularity, `{ data, meta, error }` envelopes and `CHARTS_*` codes.

Decision record: `project-docs/iteration-2/charts-decision-record.md`. Live HTTP contract: `apps/api/src/app/charts/README.md`.

Not on `main` at the end of Iteration 2 (and still open or incomplete in Iteration 3):

- benchmark comparison (PR #160);
- total-return vs price-return (PR #105 / related);
- `GET /charts/waterfall` (React card exists; controller route does not).

**Supporting documentation PR:** #170.

### 2.3 Iteration 3 — React UI, Hosting, Testing, QA

Iteration 3 focused on React screens in `libs/react-ui`, mounting them through `gf-react-host`, and proving behaviour with unit, component, integration, and Playwright coverage.

Delivered on or against `main`:

| Area                              | What shipped                                                | Evidence                                                |
| --------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------- |
| Series data hook                  | Authenticated fetch for `/charts/series`                    | PR #201                                                 |
| Interactive chart + range presets | Shared range group on Overview                              | PR #256                                                 |
| Series kind card                  | Value / invested / cash toggle                              | merged with InteractiveChart work                       |
| Drawdown React card               | Live `/charts/drawdown`                                     | PR #276                                                 |
| Waterfall React card              | Client for contribution breakdown                           | PR #275 (HTTP route still missing)                      |
| Overview host / theme             | Scrollable Overview; `embedded` chart chrome; OS/dark theme | PR #295 (closes the C-01 layout class of bug with #353) |
| Empty-day series fix              | Day before first buy counts as 0                            | PR #334                                                 |
| Four-state component tests        | Loading / empty / error / success for chart views           | PR #313 / #363                                          |
| Live integration journey          | Range → kind → drawdown against demo API                    | PR #327                                                 |
| Numeric unit tests                | Series, drawdown (benchmark held)                           | PR #304                                                 |
| Keyboard + contrast polish        | Focus ring; chart-mark contrast; named groups               | PR #338 (open at freeze; checklist below)               |
| Drawdown mount + browser E2E      | Overview mounts drawdown; Playwright journey                | PR #364 (open; late)                                    |

## 3. Software Architecture

### 3.1 Presentation

React components under `libs/react-ui`:

- `InteractiveChart` — range presets + `ChartSeriesCard` (+ drawdown when mounted);
- `ChartSeriesCard` / `useChartSeries` — kind toggle and four UI states;
- `ChartWrapper` — SVG path; optional `embedded` mode for Overview;
- `DrawdownCard` / `useDrawdown` — max drawdown text + line;
- `WaterfallCard` — contribution breakdown UI (blocked on API).

Ghostfolio Overview hosts the interactive chart through `gf-react-host` with host-supplied authenticated `request` and theme.

### 3.2 Business Logic

Nest `ChartsController` / `ChartsApi` plus `libs/common` helpers (`chart-series`, `drawdown`, `TimeRangeSelection`). The UI never recomputes series or drawdown; it only chooses range and series kind.

### 3.3 Data Access

Historical performance comes from Ghostfolio `PortfolioService.getPerformance`. Charts reshape that history; clients do not upload price history for these views.

## 4. Shared Range and Series Contract

Every charts endpoint and the React range control share:

```text
?range=1d|wtd|mtd|ytd|1y|5y|max
```

or custom `startDate` / `endDate` (mutually exclusive). Granularity is server-chosen. Empty windows return empty `points`, not an error.

Series kinds: `portfolioValue`, `investedCapital`, `cash`. Drawdown returns points plus `maxDrawdown` / `maxDrawdownDate`.

## 5. Testing

| Layer       | Location                                                                                 | What it proves                                           |
| ----------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Unit        | `libs/common`, charts helpers                                                            | Numeric series / drawdown behaviour                      |
| Component   | `*.spec.tsx` under chart-series, chart-wrapper, drawdown, waterfall                      | Four states, focus ring, contrast marks, embedded chrome |
| Integration | `libs/react-ui/integration/charts-journey.integration.tsx`                               | Live API: Max → YTD → invested → cash → YTD drawdown     |
| Browser E2E | `e2e/tests/charts.spec.ts`                                                               | Production build on `/en/home` (open with #364)          |
| Manual QA   | `docs/testing/qa-log.md` Part 2; `docs/testing/charts-usability-checklist-2026-11-23.md` | C-01–C-08; Nov 23 polish rows                            |

Benchmark component tests are held until `#160` lands. Return comparison has no React screen on `main`.

## 6. Quality Assurance (Week 4)

Raniya's master QA log (Tue Nov 24) for Overview charts:

| ID                        | Result at pass                                  | Notes                                                               |
| ------------------------- | ----------------------------------------------- | ------------------------------------------------------------------- |
| C-01 Chart loads          | FAIL → addressed by Overview layout #295 / #353 | Clipped card / unreachable toggles at 100% zoom                     |
| C-02 Range toggle         | PASS                                            |                                                                     |
| C-03 Series toggle        | PASS                                            |                                                                     |
| C-04 Empty portfolio      | PASS                                            |                                                                     |
| C-05 Keyboard             | FAIL → fix in #338                              | Missing focus ring                                                  |
| C-06 Dark theme           | FAIL → PASS on Nov 25 via #342 / #295           |                                                                     |
| C-07 Drawdown / waterfall | FAIL                                            | Drawdown mount in #364; waterfall still unmounted / no route (#356) |
| C-08 Benchmark            | BLOCKED                                         | #160, #105                                                          |

Owner polish checklist (Mon Nov 23): focus ring, named groups, line contrast (`#0d7377` on light), waterfall legend text contrast — with component regression assertions in #338.

## 7. Known Limitations

| Item                                       | Status                                             |
| ------------------------------------------ | -------------------------------------------------- |
| Benchmark comparison UI + route            | Open #160                                          |
| Return comparison                          | Open #105; no React screen                         |
| Waterfall HTTP route                       | Not on `ChartsController`; React card only         |
| Waterfall mounted in app                   | Leave #356 open until waterfall is hosted          |
| Pointer readout / arrow-key point movement | Open #226                                          |
| Charts browser E2E on CI Demo job          | Open #364 (authToken / embedded / body-read fixes) |
| Formal story acceptance                    | After December 3 Sprint Review                     |

## 8. Conclusion

Charts progressed from Iteration 1 design stubs, through an Iteration 2 Nest API with a shared range contract, to Iteration 3 React views on Overview with multi-layer tests and Week 4 QA.

What users can use on a current `main` build: interactive portfolio series with range and kind toggles, drawdown data via API (and Overview mount when #364 merges), empty/error handling, and theme-aware hosting. What remains explicitly out of scope for “done on main”: benchmark and return comparison, waterfall end-to-end, and pointer readout.

Scrum Master notes for Iteration 3 Week 4 are in `project-docs/iteration-3/scrum-notes.md` and summarised in `project-docs/iteration-3/scrum-meetings-summary.md`.
