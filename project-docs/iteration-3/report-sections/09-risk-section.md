# Report Section 9 (draft) — Risk

Owner: Sesha Siva Sankar. Drafted Fri Nov 27, 2026 per Iteration 3 Sprint Plan Rev2 Section 5
(Fri Nov 27 row) and QA Execution Plan Rev2 Part A1, from merged PRs and the QA log. Final
check against merged PRs/issues is due Dec 1 (Sprint Plan Section 7).

All test counts and coverage figures below are copied from CI, not written from memory:

- Unit + component job (`Unit tests`), run [46067807632](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/actions/runs/46067807632), commit `31943be8`, main, 2026-11-27.
- Integration + E2E job (`Demo environment`), run [46067807663](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/actions/runs/46067807663), same commit.

## What shipped

Acceptance criteria (Appendix B) status. **Note:** no Nov 12 demo Scrum-notes/acceptance record
(`accepted / not accepted per story`) exists yet in the repo — `project-docs/iteration-3/daily-log/`
only goes up to Nov 9, and no other committed record of that day's demo outcome was found. This
is flagged to Arthur (Scrum notes owner) as a gap rather than papered over. The table below
reflects that both acceptance criteria were met on main (verified against the merged PRs below),
not a formal recorded acceptance — the Risk dashboard/indicators card met its target date, while
the what-if simulator's #282 merged two days after its Nov 10 target:

| Story                             | Done when                                                                                                       | Working by                       | Status (criteria met on main; demo acceptance not recorded in repo) |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------- |
| Risk dashboard + indicators (#26) | Concentration/score in dashboard cards; indicator colour follows Risk-engine severity; component tests pass     | Nov 6 (card), Nov 9 (indicators) | Criteria met on target (#211/#213/#223, merged Nov 4-6)             |
| What-if simulator                 | Form posts to the what-if route; shows before/after score and warning differences; invalid input shows an error | Nov 10                           | Criteria met, 2 days after target (#282, merged Nov 12)             |

Key merged PRs (chronological; full list is the GitHub audit, Section 4, due Dec 4):

- #193 `GET /risk/score` route; #222 remaining Risk API routes (thresholds, warnings, target-allocation, catch-all error envelope) — closes carry-over #24.
- #211/#213/#223 Risk dashboard card + red/yellow/green indicators wired to live score/concentration routes.
- #260/#265/#280/#282 mount the Risk feature (dashboard, what-if, warnings, target allocation, thresholds) through `gf-react-host` and the Portfolio nav.
- #299, #307, #317, #320 — Phase B full suite: unit (boundary values), component (all four states), integration (UI↔API↔service↔data for what-if/indicators), E2E (dashboard→indicators→what-if journey).
- #330 — Week 3 check: full-suite run, Risk README Testing section.
- #336, #348 — Nov 23/24 QA-pass fixes: label/contrast polish, unlabelled score numbers, target-allocation wording (closes #341, #343).
- #362 — last bug-fix-day fixes: Active-label spacing + the cash-double-count fix in `excludeCashHoldings` (closes carry-over of #323 into the what-if path).

**Not yet shipped / still open** (not counted as shipped functionality above — see "Open items" below for detail):

- #365 — regression test confirming the what-if simulator inherits the #323 cash-exclusion fix (QA D-02, Risk side); references #355, Risk side only. Open, awaiting Arthur's post-freeze approval and Raniya's QA-log confirmation; recorded as late work per the Nov 25 freeze.
- #351 — Risk UI redesign (closes #350): visual/layout redesign of Risk summary, Warnings, Thresholds, Target allocation and the What-if simulator. Open, not merged; no business-logic or API changes, presentational only.

## Test suite (by layer, CI-verified)

**Unit (`apps/api` Risk folder, `libs/react-ui` Risk components, `apps/client` Risk page)** — all passing in the Unit tests CI job:

- API: 19 Risk spec files (`risk.controller.routes.spec.ts`, `risk.e2e.spec.ts`, `risk.controller.spec.ts`, `risk-evaluation.service.spec.ts`, `volatility-cache.service.spec.ts`, `what-if.service.spec.ts`, `risk-score.mapper.spec.ts`, `threshold-engine.service.spec.ts`, `covariance.model.spec.ts`, `target-allocation.mapper.spec.ts`, `health-score-calculator.service.spec.ts`, `risk.service.spec.ts`, `risk-exception.filter.spec.ts`, `warning-threshold.model.spec.ts`, `exposure.service.spec.ts`, `risk-concentration.mapper.spec.ts`, `exposure-calculator.service.spec.ts`, `volatility.model.spec.ts`, `risk-threshold.mapper.spec.ts`), all PASS.
- React: 15 Risk spec files (dashboard card/page, indicator, thresholds row/list/page/form, warnings list/page, dashboard-risk-summary, plus the what-if/indicators integration spec that lives in this project — see note below), all PASS.
- Angular host: `risk-page.component.spec.ts`, PASS.
- apps/api as a whole: 104 of 105 suites passed (1 pre-existing unrelated skip), 822 of 823 tests passed.

**Coverage** (`apps/api` + `libs/react-ui`, Risk-tagged areas, from CI's coverage-summary script):

| Area        | Lines | Statements | Functions | Branches | Lines counted |
| ----------- | ----- | ---------- | --------- | -------- | ------------- |
| Risk API    | 97.6% | 97.6%      | 97.7%     | 84.9%    | 765           |
| React: Risk | 93.7% | 93.7%      | 94.7%     | 88.5%    | 462           |

**Integration** — two distinct Risk integration suites exist, covering different things:

- `risk-what-if-and-indicators.integration.spec.tsx` (#317, UI↔API↔service↔data) is an in-process test with mocked data-access dependencies. It is a `libs/react-ui` test file and runs inside the Unit tests CI job rather than the separate `Integration tests` job — a tooling placement worth fixing, not a gap in coverage. It passed in this run.
- `libs/react-ui/integration/screens.integration.tsx` runs inside the separate `Integration tests` CI job (Demo environment workflow) against the live, running API (not mocked) and includes three Risk cases: the dashboard card against live `GET /risk/score`/`concentration`, the warnings screen against live `GET /risk/warnings`, and the what-if simulator against live `GET /portfolio/holdings` and `POST /risk/what-if`. This file is shared across features (it also covers Dashboard and Tax), so it does not appear as a Risk-only suite in the job's file list, but the three Risk cases inside it did run and pass in this CI run (job run 46067807663, 4 suites/14 tests total across all features in that job).

**End-to-end** (Demo environment → E2E tests job, Playwright, 14 tests total across all features, all passing):

- `risk-thresholds-usability.spec.ts` — 2 tests (field labels/keyboard-only editing; target-allocation row labels).
- `risk-what-if-journey.spec.ts` — 1 test (open dashboard → read indicators → run a what-if, concentrated user).
- `risk.spec.ts` — 4 tests (concentrated, balanced, empty, target-allocation demo users).
- `route-smoke.spec.ts` — `/en/risk` route mounts (shared cross-feature check).

## Manual QA (Mon Nov 23 – Wed Nov 25 pass, `docs/testing/qa-log.md`)

Risk usability checklist (R-01–R-10): 9 PASS, 1 FAIL (R-09, dark-theme contrast — shared root cause #342, fixed and re-verified). Bug issues filed from this pass: #341 (score numbers unlabelled) and #343 (target-allocation wording) — both closed same week with regression tests (#336, #348).

Dashboard-level cross-check (D-02, QA C/D section): Risk what-if's `portfolio.valueBefore` disagreed with Charts/Dashboard (10,640 vs 10,140) — same root cause as carry-over issue #323 (synthetic CASH holding double-counted), extending to a fourth caller (`WhatIfService`) that hadn't been locked down by a test. Fixed in #362 (production fix) and #365 (regression test + QA-log update, late/post-freeze). On #365, Tharun confirmed there are no remaining technical concerns with the regression test itself, but formal PR approval is still pending on the procedural items: Arthur's post-freeze approval and Raniya's QA-log confirmation. Overview's separate 9,640 reading is a distinct, still-open discrepancy outside the Risk module; #355 stays open for that.

## Open items at today's draft

- #355 (QA D-02) stays open: Overview's 9,640 figure is unreconciled.
- PR #365 awaiting Arthur's and Raniya's sign-off before merge (no outstanding technical concerns on the test itself).
- PR #351 (Risk UI redesign, closes #350) is open and unmerged — presentational only, not yet shipped.
- No committed Nov 12 demo acceptance record found in the repo; flagged to Arthur rather than assumed.
- No other open Risk defects as of this draft (#341, #343, #342 all closed with regression tests).
