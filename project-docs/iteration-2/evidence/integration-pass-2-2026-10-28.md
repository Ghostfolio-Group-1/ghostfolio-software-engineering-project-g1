# Integration pass #2 (Oct 28, 2026)

Final pass before the code freeze. Commit: 25bea2186 (origin/main at run time).

## End-to-end specs

```
 PASS   api  apps/api/src/app/charts/charts.e2e.spec.ts (13.391 s)
 PASS   api  apps/api/src/app/risk/risk.e2e.spec.ts (14.66 s)
 PASS   api  apps/api/src/app/tax/tax.e2e.spec.ts (17.067 s)
 PASS   api  apps/api/src/app/dashboard/dashboard.e2e.spec.ts (17.397 s)
Test Suites: 4 passed, 4 total
Tests:       47 passed, 47 total
```

## Full api test suite

```
Test Suites: 1 skipped, 93 passed, 93 of 94 total
Tests:       1 skipped, 641 passed, 642 total
```

Skipped suite: apps/api/src/app/portfolio/calculator/roai/portfolio-calculator.spec.ts (upstream Ghostfolio placeholder test.skip, not a failure).

## api build

```
 NX   Successfully ran target build for project api
```

## CI on main

Checks for 25bea2186: https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/commit/25bea2186f669aad89f4eeefdfd1efab28040b4f

- Build: success — https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/actions/runs/40628406180/job/122618787033
- Unit tests: success — https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/actions/runs/40628406180/job/122618786935
- Lint and format: success — https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/actions/runs/40628406180/job/122618786689
- extract_locales: success — https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/actions/runs/40628406212/job/122618786647

## Compared with pass #1

Pass #1 (Oct 26): 4 e2e suites / 47 tests, 91 unit suites / 611 tests, build green. See [integration-pass-1-2026-10-26.md](integration-pass-1-2026-10-26.md). New since then: tax PDF export suite (tax-pdf-export.spec.ts).

## Failures triaged

One local failure, not a code defect: on the first run tax-pdf-export.spec.ts failed to compile with "Cannot find module 'pdf-lib'" because the dependency added with the PDF export had not been installed locally. After npm install all suites passed (results above). CI installs dependencies fresh, so it is not affected.

Local setup after pulling: run npm install (new dependencies) and npx prisma generate (schema changes).
