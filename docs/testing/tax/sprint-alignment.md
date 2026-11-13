# Iteration 3 — Tax testing sprint alignment

**Owner:** Tharun Swaminathan (Tax)
**Tracking issue:** [#232 — Review Tax test coverage and finalize test plan](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/issues/232)
**Review baseline:** `main` at `024cc195d` (November 13, 2026)
**Status:** Proposed review deliverable; not an execution or instructor-acceptance record.

## Source and scope

Use **Iteration3_Sprint_Plan_Rev2.pdf (November 5, 2026)** over the original Iteration 3 plan where they differ. The November 13 assignment is to inventory existing tests, identify gaps, review November 12 demo feedback, and prioritize a confirmed bug, if one exists. **Issue #232 is documentation and planning only**: no production Tax calculations, new testing infrastructure, or new seed scripts in this issue.

The Tax feature spans FIFO acquisition lots, FIFO and average-cost realized gains, dividend/withholding records, yearly summaries, CSV/PDF report generation, and four React views in `TaxWorkspace`. The backend owns financial calculations. UI displays authoritative decimal strings and nullable values.

## Current source-based baseline

As of `024cc195d`:

- 19 Tax backend test files under `apps/api/src/app/tax/` were located and their test names/assertions inventoried.
- 12 React Tax test files under `libs/react-ui/src/lib/{tax-lots,realized-gains,dividend-withholding,yearly-tax-summary,tax-workspace}/` were located and reviewed.
- Additional Angular host tests exist at `apps/client/src/app/pages/portfolio/tax/tax-page.component.spec.ts`.
- `libs/react-ui/integration/README.md` documents real API-backed UI integration for **TaxLotsScreen** and **DividendWithholdingScreen**. It does not list the realized-gains or yearly-summary screens.
- `e2e/tests/route-smoke.spec.ts` includes `/en/portfolio/tax` and verifies the React host mounts without browser errors. It does **not** exercise the four-tab Tax journey or compare displayed numeric values against the live API.
- `scripts/demo-smoke.sh` checks `/api/v1/tax/realized-gains` and `/api/v1/tax/lots` but does not check `/tax/dividends` or `/tax/yearly-summary`.
- The three documentation paths named in issue #232 were not found in the fetched `origin/main` tree. They are being introduced as part of this documentation issue, subject to review.

**Evidence distinction:** Inspection of test source proves that scenarios have test definitions. It does **not** prove the tests were executed on November 13 or that the November 12 demo was accepted. Record execution and feedback separately.

## Schedule / next steps

| Date           | Planned Tax work                                                                                                                     | Evidence required                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **Fri Nov 13** | Inventory unit, API, React, integration and browser coverage; review demo feedback; rank gaps and any confirmed bug                  | `module-analysis.md`, `test-plan.md`, issue/PR links, reviewer decision; actual demo notes if available          |
| **Mon Nov 16** | Numeric unit/regression tests for highest-priority untested financial cases and exports, if any                                      | Assertions with expected decimal values; local result and CI link                                                |
| **Tue Nov 17** | React state and failed-export tests where supported                                                                                  | Success/loading/error/empty and auth tests, exact test results                                                   |
| **Wed Nov 18** | Live Tax integration: lots → realized gains → yearly summary; CSV/PDF only after backend endpoints exist                             | Real HTTP responses, source traceability, screenshot/log and test run evidence                                   |
| **Thu Nov 19** | Playwright browser journey under [#263](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/issues/263) | Authenticated navigation, year/method/filter actions, populated and empty fixtures, numeric parity, saved traces |
| **Fri Nov 20** | Run full applicable suites and fix regressions; update Tax README / QA log                                                           | Green results for actually run commands, CI links, unresolved risks                                              |

## Dependencies and blockers

1. **Export downloads:** Backend CSV/PDF generators exist, but public authenticated download endpoints and working UI download flow are not established as complete. [#190](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/issues/190), [#155](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/issues/155), and draft [PR #253](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/pull/253) must be reconciled. Do not claim download E2E passes.
2. **Tax-relevance UI filter:** `RealizedGainsScreen` documents that no public tax-relevance query parameter currently exists. Backend `isTaxRelevant` filtering exists, but a selectable UI filter needs an agreed API contract; coordinate via Raniya and issue [#242](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/issues/242).
3. **Shared testing infrastructure:** Reuse Raniya's existing Jest integration harness and Playwright config; do not introduce competing configuration or modify shared files without coordination.
4. **November 12 demo outcome:** Acceptance, non-acceptance, attendee status, and specific feedback have **not** been independently verified for this audit. Add from Arthur's actual demo evidence. Do not infer acceptance from successful tests.

## Review / done criteria for #232

- [ ] Every test-plan case links to a current test or is clearly marked as a gap/dependency.
- [ ] New cases describe fixture setup, action, and meaningful expected values/statuses.
- [ ] Scope and blockers match actual API contracts and preserve decimal strings/nulls.
- [ ] Arthur reviews this test plan before any additional test implementation.
- [ ] PR is independently approved and required CI passes before merge.
- [ ] Issue and Scrum notes link the merged PR and distinguish inspected coverage from executed tests.
