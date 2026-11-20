# Tax regression and QA evidence — November 20, 2026

- **Issue:** [#329](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/issues/329)
- **Owner:** Tharun Swaminathan (Tax); **independent reviewer:** Arthur
- **Scope:** Regression checks and Tax README updates only. No source calculation, UI, shared CI, or fixture changes.
- **Local branch:** `tharun/2026-11-20-329-tax-suite-readme`, created from `origin/main` at `a3e70368e46f9be89e52d49211e48f1cb2d1e8c4`.
- **Overall status:** Targeted Tax and cross-feature browser tests **passed locally**. Full Nx unit/coverage run **failed** due to a Dashboard E2E timeout. CI and merge status **not yet accepted**.

## Recorded local test evidence

| Check                                          | Actual outcome                              | Notes                                                                                                                            |
| ---------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Tax API backend Jest (`apps/api/src/app/tax`)  | **PASS:** 19 suites, 271 tests              | Rerun with `--runInBand --testTimeout=15000`; initial default-timeout run had one 5-second timeout and an isolated retest passed |
| React UI Jest unit/component                   | **PASS:** 62 suites, 456 tests              | Includes shared UI and Tax state tests                                                                                           |
| Live UI-to-API Jest integration                | **PASS:** 2 suites, 9 tests                 | `INTEGRATION_API_URL=http://localhost:3333`, real local Docker demo API, exit 0; no reported skips                               |
| Tax Playwright Chromium E2E                    | **PASS:** 2/2                               | Empty and populated seeded users; 9.9s; exit 0                                                                                   |
| React route-smoke Chromium                     | **PASS:** 3/3                               | Dashboard, Risk, and Tax routes; 9.4s; exit 0                                                                                    |
| **Full Playwright Chromium suite**             | **PASS:** 10/10                             | Five Risk, three route-smoke, two Tax browser tests; 35.7s; exit 0                                                               |
| Nx full-project Jest with coverage             | **FAIL:** 1,507 passed, 1 failed, 1 skipped | Five projects run; `api:test` failed, final process exit 1; see breakdown below                                                  |
| Repository-wide lint, format, production build | **NOT VERIFIED**                            | Not performed in this evidence session after repeated Windows crashes                                                            |
| Green GitHub Actions on this documentation PR  | **NOT VERIFIED**                            | PR not yet created/reviewed at time of this evidence draft                                                                       |

The targeted browser 2/2 and 3/3 cases are included within the later full browser
10/10 and must **not** be added again as unique test coverage. The local Docker
image was created two days before the run; successful testing proves behavior
of that running image but not that the image was rebuilt from the latest `main`.

### Full-project Nx coverage breakdown (failed run)

| Nx project | Suites                                      | Tests                                       | Result   |
| ---------- | ------------------------------------------- | ------------------------------------------- | -------- |
| `common`   | 9/9                                         | 208 passed                                  | PASS     |
| `api`      | 103 passed, 1 failed, 1 skipped (105 total) | 815 passed, 1 failed, 1 skipped (817 total) | **FAIL** |
| `ui`       | 2/2                                         | 6 passed                                    | PASS     |
| `react-ui` | 62/62                                       | 456 passed                                  | PASS     |
| `client`   | 5/5                                         | 22 passed                                   | PASS     |

**Single failed test:**
`apps/api/src/app/dashboard/dashboard.e2e.spec.ts` —
`returns all three sections in the contract shape with the real tax result`.
Jest reported `Exceeded timeout of 5000 ms for a test.` This is a shared
Dashboard test, not a failed numeric assertion. Contention from Jest workers
is **a hypothesis**, not a verified cause. No code or expected values were
changed to suppress the failure. The full suite also emitted a Jest worker
teardown warning. An isolated retest was recommended but **not performed**
because the workstation repeatedly blue-screened. The workstation crash root
cause has **not** been established and must not be attributed to Ghostfolio.

The `client` project's tests passed but logged Babel parsing errors when
attempting to load `theme-provider.tsx`, together with Angular NG0956 warnings.
These are separately observable shared React-host test concerns; a passing
Jest summary does not prove that every tested host render succeeded. Coordinate
any production or shared-harness remediation with Raniya rather than editing
shared code in this Tax documentation PR.

## Reproduction commands (PowerShell, repository root)

```powershell
# Tax backend (diagnostic 15-second Jest timeout)
npx.cmd jest --config apps/api/jest.config.ts apps/api/src/app/tax --runInBand --testTimeout=15000

# React unit/component
npx.cmd jest --config libs/react-ui/jest.config.ts --runInBand

# Live integration; requires running healthy demo app and fixtures
$env:INTEGRATION_API_URL = 'http://localhost:3333'
npx.cmd jest -c libs/react-ui/jest.integration.config.ts --runInBand

# Targeted and full browser E2E; requires synthetic seeded demo users
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:3333'
npx.cmd playwright test -c e2e/playwright.config.ts tax.spec.ts --project=chromium
npx.cmd playwright test -c e2e/playwright.config.ts route-smoke.spec.ts --project=chromium
npx.cmd playwright test -c e2e/playwright.config.ts --project=chromium

# Full-project test/coverage run actually attempted (failed overall)
$env:DOTENV_CONFIG_PATH = (Resolve-Path '.env.example').Path
$env:NODE_OPTIONS = '--require dotenv/config'
.\node_modules\.bin\nx.cmd run-many --target=test --all --parallel=1 --codeCoverage --coverageReporters=json-summary --coverageReporters=lcov
Remove-Item Env:NODE_OPTIONS -ErrorAction SilentlyContinue
Remove-Item Env:DOTENV_CONFIG_PATH -ErrorAction SilentlyContinue
```

Local logs were written under `$env:TEMP/ghostfolio-tax-329/` using `Tee-Object`.
Those machine-local logs are **not** automatically uploaded to GitHub; keep a
sanitized excerpt of the failing Jest summary in Issue #329 or the PR.

## API, feature status and follow-ups

The current `TaxController` exposes four authenticated read routes:
`/tax/lots` (FIFO lots), `/tax/realized-gains` (FIFO/AVERAGE_COST),
`/tax/dividends?year=YYYY`, and `/tax/yearly-summary?year=YYYY&method=FIFO|AVERAGE_COST`.
Tax math stays in the backend; the React TaxWorkspace uses authoritative
amount strings and preserves nulls, including unknown withholding.

- **Blocked:** Browser CSV/PDF downloads have backend export services but no
  confirmed public download HTTP routes or working UI buttons — [#190](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/issues/190).
- **Blocked/needs contract:** Tax-relevance UI filter — [#242](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/issues/242). The existing lot-status filter is different.
- **Not covered:** Incomplete-history Tax browser diagnostic state; no verified
  seeded browser fixture supporting this state.
- **Shared dependency:** [PR #324](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/pull/324) (live integration / CI) and [PR #326](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/pull/326) (synthetic seeding / Playwright CI) were open on the last November 20 GitHub check. Their branch results do not establish green `main` CI.

## Acceptance handoff

- **Verified:** Tax backend, React components, live integration, Tax browser
  journeys, full local Playwright; API shape rechecked against controller.
- **Unverified:** clean full-project coverage, lint, format, build, updated
  `main` workflow CI, reviewer approval, merge, issue closure.
- **Recommendation:** Review this documentation-only patch, run low-impact
  `git diff --check` and Prettier on changed Markdown when the machine is
  stable, then open an Issue #329 PR with Arthur as reviewer. Coordinate the
  existing shared Dashboard timeout and React-host warnings with Raniya.
- **Definition of done:** not yet met; keep Issue #329 open until reviewed,
  applicable green CI, merge and evidence links are recorded.
