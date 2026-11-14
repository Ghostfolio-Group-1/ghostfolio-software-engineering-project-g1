# Iteration 3 Tax module — Evidence-based test plan

**Owner:** Tharun Swaminathan
**Reviewer:** Arthur (independent review); Raniya for shared harness, authentication, and cross-owner contracts
**Issue:** [#232](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/issues/232)
**Inspected baseline:** `024cc195d` on November 13, 2026
**Status:** **Proposed**. These are planned checks and coverage mappings, not assertions that tests were executed or that the instructor accepted the November 12 demo.

## Ground rules

- Keep FIFO, average-cost, withholding and yearly Tax calculations in the backend. TaxWorkspace screens render authoritative API results without recalculating gains or totals. The separate Dashboard Tax overview currently sums already-calculated sale gains client-side using Big.js (`dashboard-page/dashboard-tax-summary.tsx`, covered by `dashboard-tax-summary.spec.tsx`); treat that as an existing dashboard aggregation outside the Tax workspace scope, not an authorization to move tax-engine calculations into React.
- Use synthetic, reproducible user/portfolio fixtures; no production financial data or secrets.
- Financial assertions compare exact decimal values and nullable fields; never substitute `0` for unknown data.
- Do not modify shared Jest, Playwright, React host, API contracts, or seed tooling without Raniya's coordination.
- Each scenario has setup, action, and a meaningful expected result. An execution-only or placeholder test does not satisfy acceptance.
- Verify existing tests first; fill gaps rather than duplicate coverage.

## Matrix: existing tests to preserve and rerun

| ID      | Area                   | Setup / action                                                          | Meaningful assertions                                                                                          | Existing source                                                                  | Planned execution |
| ------- | ---------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------- |
| TAX-U01 | FIFO lots              | Two BUY lots; partial and multi-lot SELL                                | Oldest lot consumed first; original = consumed + remaining; account/asset isolation                            | `fifo-tax-lot.spec.ts`                                                           | Nov 16 regression |
| TAX-U02 | FIFO gains             | SELL spans two BUY lots with fees                                       | Exact proceeds, basis, gross gain, allocated buy/sell fees, gain after fees; fee reconciliation                | `fifo-realized-gain.spec.ts`                                                     | Nov 16 regression |
| TAX-U03 | Average cost           | Multi-BUY pool, partial SELL, full liquidation, re-entry                | Exact pool quantity/cost/fee before/after; zero after liquidation; fresh basis on re-entry                     | `average-cost.spec.ts`, `average-cost-realized-gain.spec.ts`                     | Nov 16 regression |
| TAX-U04 | Dividend               | Known zero, nonzero and unknown withholding; activity fees              | Gross = qty×unitPrice; net = gross−known withholding; null stays null; fees separate                           | `dividend-record.spec.ts`, `tax-dividends.service.spec.ts`                       | Nov 16 regression |
| TAX-U05 | Yearly summary         | Cross-year BUY/SELL and dividends; missing FX                           | Correct UTC-year counts and cost basis; distinct currencies; missing FX yields null + diagnostic, not zero     | `yearly-tax-summary.spec.ts`, `tax-service-yearly-summary.spec.ts`               | Nov 16 regression |
| TAX-U06 | CSV/PDF                | Two-lot disposal, incomplete values, both methods                       | Export matches authoritative summary/trace; deterministic order/metadata; safe CSV quoting; no invented values | `tax-export.spec.ts`, `tax-pdf-export.spec.ts`                                   | Nov 16 regression |
| TAX-A01 | Tax HTTP routes        | Authenticated user, missing scope, malformed data and empty portfolio   | Exact envelope, 200 success, 401/403 guards, safe 422 errors, decimal strings                                  | `tax.e2e.spec.ts`, `tax-dividends.e2e.spec.ts`, `tax-yearly-summary.e2e.spec.ts` | Nov 18 regression |
| TAX-R01 | React screen states    | Mock successful, pending, empty, malformed and failing Tax API response | Correct loading/success/empty/error UI, retry behavior, exact decimal strings; no arithmetic                   | 12 React Tax specs under `libs/react-ui/src/lib/`                                | Nov 17 regression |
| TAX-R02 | Authentication refresh | Change signed-in user or impersonation context while request pending    | Previous request aborted; correct identity's data shown; host remounted                                        | `tax-workspace.spec.tsx`, screen specs, `tax-page.component.spec.ts`             | Nov 17 regression |

_Backend spec paths above are relative to `apps/api/src/app/tax/`. React spec paths are relative to `libs/react-ui/src/lib/`._

## Integration candidates and coverage status

TAX-G01 is retained for traceability but **already covered in source**, so it is **not** an implementation task. The remaining rows identify proposed integration tests, blockers or conditional work.

| ID      | Priority                    | Setup                                                                                                    | Action                                                                                                        | Expected assertion                                                                                                                                                                             | Dependency / owner                                                                                                                       |
| ------- | --------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| TAX-G01 | Already covered — not a gap | Existing authenticated API fixtures; no new synthetic user needed                                        | Parameterized missing, non-integer, out-of-range, and boundary-year requests for dividends and yearly summary | Invalid queries return HTTP 400 and `TAX_INVALID_QUERY` before data access; boundary years 1970 and 2100 return 200; yearly summary also rejects invalid method and duplicate query parameters | Existing `tax-dividends.e2e.spec.ts`, `tax-yearly-summary.e2e.spec.ts`, `tax-dividends.service.spec.ts`; rerun only as regression Nov 18 |
| TAX-G02 | P0                          | One shared fixture with known FIFO and average-cost outcomes                                             | Render `RealizedGainsScreen` with **real** `GET /tax/realized-gains`; change method                           | Selected method loads; exact displayed sale/fee/pool decimal strings equal response; no stale FIFO state                                                                                       | Raniya shared UI-to-API integration harness, Nov 18                                                                                      |
| TAX-G03 | P0                          | Same fixture plus yearly dividend/sales data and known/missing FX cases                                  | Render `YearlyTaxSummaryScreen` with **real** yearly endpoint; change year and method                         | Counts, currency breakdown and null/diagnostic values match response exactly                                                                                                                   | Raniya shared UI-to-API integration harness, Nov 18                                                                                      |
| TAX-G04 | P0                          | Real authenticated browser and seeded holdings; test user session                                        | Open `/en/portfolio/tax`, navigate Lots → Gains → Dividends → Yearly                                          | Four views reachable, no host fallback; correct endpoint called; no browser runtime errors                                                                                                     | Issue #263, Playwright, Nov 19                                                                                                           |
| TAX-G05 | P0                          | Synthetic data with FIFO/average-cost differing numeric gains                                            | Switch method, choose 2026, filter open/closed lots                                                           | Gains change only according to server method; lot method remains FIFO; year/lot filters work; rendered numbers match live response                                                             | Issue #263, Playwright, Nov 19                                                                                                           |
| TAX-G06 | P1                          | Empty synthetic portfolio and one incomplete-history fixture                                             | Navigate each view and change year                                                                            | Complete empty history shows empty state; incomplete history shows diagnostic, never a normal zero/empty claim                                                                                 | Issue #263 and Raniya fixture coordination, Nov 19                                                                                       |
| TAX-G07 | Blocked                     | Public authenticated export endpoint and frontend integration available                                  | Download CSV and PDF; force a supported export failure                                                        | Content type, filename, downloadable bytes, calculation parity, clear error, retry; no client math                                                                                             | Issues #190 and #155, draft PR #253; **do not execute or claim pass before unblock**                                                     |
| TAX-G08 | Contract blocked            | Agreed server-side tax-relevance query parameter, if instructor scope requires user-selectable filtering | Toggle tax-relevant filter in React                                                                           | Request uses documented backend contract and results are authoritative                                                                                                                         | Issue #242 / Raniya contract sign-off; no present endpoint, don't implement speculative UI                                               |
| TAX-G09 | Conditional                 | Confirmed, reproducible instructor demo defect (none provided to this audit yet)                         | Reproduce failure, add regression, apply smallest safe fix                                                    | Test fails before the fix and passes after; relevant regressions remain green                                                                                                                  | Post-demo QA evidence; separate issue/branch/PR; Arthur post-freeze authorization                                                        |

## Test data required

- **Fixture A:** Same asset bought at different prices, partial SELL consumes two FIFO lots; known BUY/SELL fees and exact expected gains under both methods.
- **Fixture B:** DIVIDEND with known-zero withholding, nonzero withholding, and unknown (`null`) withholding; include an activity fee.
- **Fixture C:** At least two currencies; one available historical FX conversion and one unavailable rate; verify by-currency versus base-currency completeness.
- **Fixture D:** Complete empty portfolio; history with a normally eligible, tax-irrelevant BUY or SELL that may affect basis calculations.
- **Fixture E:** User with portfolio:read, user lacking that scope, and authenticated context change; do not record or publish access tokens.

Use approved existing synthetic fixtures when possible. Do **not** write a duplicate seed script as part of Issue #232.

## Verification / evidence protocol

1. Before running tests: `git rev-parse --short HEAD`, `git status --short --branch`, and record the environment/fixture.
2. For backend Tax tests (when scheduled): `npx jest --config apps/api/jest.config.ts apps/api/src/app/tax --runInBand` on macOS/Linux/CI; on Windows PowerShell use `npx.cmd jest --config apps/api/jest.config.ts apps/api/src/app/tax --runInBand`. The existing Nx target is also acceptable.
3. For React tests (when scheduled): use the repo's existing `nx test react-ui` target, or targeted Jest with `libs/react-ui/jest.config.ts`; do not assume a new test run passed.
4. For browser E2E (Nov 19), use the shared `e2e/playwright.config.ts`, approved authentication and fixtures, and capture evidence without credentials.
5. Record exact test count/results, failures, CI run links, and issue/PR links. Treat historical October evidence separately from new runs.
6. A documented test gap is not a bug. A confirmed bug requires reproduction and its own tracked fix.

## Acceptance / review gates

- [ ] Arthur reviews proposed test matrix and priorities under #232.
- [ ] Raniya confirms integration harness/seed/CI coordination for cross-layer tests.
- [ ] Each planned new test identifies a concrete missing assertion and its test layer.
- [ ] Actual November 12 demo feedback, if available, is linked rather than assumed.
- [ ] Export blocker and unavailable tax-relevance query contract remain explicitly visible.
- [ ] Documentation PR has independent approval and green required CI before author merge.
