# Risk — test output (evidence)

Mon Nov 30 task: test-output evidence for the demo script and report Section 7/9. Copied from
CI, not memory — same source runs as `project-docs/iteration-3/report-sections/09-risk-section.md`
(drafted Nov 27, PR #372). Done ahead of schedule on Nov 27.

CI runs (main, commit `31943be8`, 2026-11-27):

- Unit + component: [run 46067807632](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/actions/runs/46067807632)
- Integration + E2E (Demo environment): [run 46067807663](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/actions/runs/46067807663)

## Unit

- `apps/api` Risk folder: 19 spec files, all PASS (`risk.controller.routes.spec.ts`, `risk.e2e.spec.ts`,
  `risk.controller.spec.ts`, `risk-evaluation.service.spec.ts`, `volatility-cache.service.spec.ts`,
  `what-if.service.spec.ts`, `risk-score.mapper.spec.ts`, `threshold-engine.service.spec.ts`,
  `covariance.model.spec.ts`, `target-allocation.mapper.spec.ts`, `health-score-calculator.service.spec.ts`,
  `risk.service.spec.ts`, `risk-exception.filter.spec.ts`, `warning-threshold.model.spec.ts`,
  `exposure.service.spec.ts`, `risk-concentration.mapper.spec.ts`, `exposure-calculator.service.spec.ts`,
  `volatility.model.spec.ts`, `risk-threshold.mapper.spec.ts`).
- `libs/react-ui` Risk components: 15 spec files, all PASS (dashboard card/page, indicator,
  thresholds row/list/page/form, warnings list/page, dashboard-risk-summary, plus the what-if/
  indicators integration spec that lives in this project).
- `apps/client` (Angular host): `risk-page.component.spec.ts`, PASS.
- `apps/api` project total: 104 of 105 suites passed (1 pre-existing unrelated skip), 822 of 823
  tests passed.

## Coverage (CI coverage-summary script, Iteration 3 areas)

| Area        | Lines | Statements | Functions | Branches | Lines counted |
| ----------- | ----- | ---------- | --------- | -------- | ------------- |
| Risk API    | 97.6% | 97.6%      | 97.7%     | 84.9%    | 765           |
| React: Risk | 93.7% | 93.7%      | 94.7%     | 88.5%    | 462           |

## Integration

The what-if/indicators integration spec (#317) is a `libs/react-ui` test and runs inside the Unit
tests job rather than the separate `Integration tests` job (which only covers Tax, Dashboard,
Charts, and a cross-feature screens suite). It passed in this run. This is a tooling-placement
note, not a missing test.

## End-to-end (Playwright, Demo environment -> E2E tests job)

14 tests total across all features, all passing. Risk-specific:

- `risk-thresholds-usability.spec.ts` - 2 tests (field labels/keyboard-only editing; target-allocation row labels)
- `risk-what-if-journey.spec.ts` - 1 test (open dashboard -> read indicators -> run a what-if, concentrated user)
- `risk.spec.ts` - 4 tests (concentrated, balanced, empty, target-allocation demo users)
- `route-smoke.spec.ts` - `/en/risk` route mounts (shared cross-feature check)

## Manual QA (`docs/testing/qa-log.md`)

Risk usability checklist (R-01-R-10): 9 PASS, 1 FAIL (R-09, dark-theme contrast, shared root
cause #342 - fixed and re-verified). Bug issues from this pass: #341 and #343, both closed with
regression tests (#336, #348). Dashboard cross-check D-02: Risk side fixed in #362/#365 (see
report section for detail); Overview's separate figure stays open under #355.
