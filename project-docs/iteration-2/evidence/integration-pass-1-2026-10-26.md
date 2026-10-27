# Integration pass #1 (Oct 26, 2026)

Commit: 0519a1cff (origin/main at run time)

## End-to-end specs

```
 PASS   api  apps/api/src/app/tax/tax.e2e.spec.ts (10.317 s)
 PASS   api  apps/api/src/app/charts/charts.e2e.spec.ts (14.68 s)
 PASS   api  apps/api/src/app/dashboard/dashboard.e2e.spec.ts (14.699 s)
 PASS   api  apps/api/src/app/risk/risk.e2e.spec.ts (14.817 s)
Test Suites: 4 passed, 4 total
Tests:       47 passed, 47 total
```

## Full api test suite

```
Test Suites: 1 skipped, 91 passed, 91 of 92 total
Tests:       1 skipped, 611 passed, 612 total
```

1 suite skipped: apps/api/src/app/portfolio/calculator/roai/portfolio-calculator.spec.ts (upstream Ghostfolio placeholder test.skip, not a failure).

## api build

```
 NX   Successfully ran target build for project api
```

## Failures triaged

None. All 4 e2e suites (47 tests) and 91 unit suites (611 tests) passed; build succeeded. Local setup note: run npx prisma generate after pulling schema changes (#55).
