# Dashboard aggregation unit test coverage (Oct 23, 2026)

Command: nx test api --test-file dashboard --coverage --coverageReporters=text

Result: 23 tests passed (dashboard-overview.spec.ts 12, dashboard.controller.spec.ts 5, dashboard.e2e.spec.ts 6)

```
> nx run api:test --test-file dashboard --coverage --coverageReporters=text
 PASS   api  apps/api/src/app/dashboard/dashboard-overview.spec.ts (14.365 s)
 PASS   api  apps/api/src/app/dashboard/dashboard.controller.spec.ts (14.364 s)
 PASS   api  apps/api/src/app/dashboard/dashboard.e2e.spec.ts (14.547 s)
File                                       | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
 app/dashboard                             |     100 |      100 |     100 |     100 |
  dashboard-overview.ts                    |     100 |      100 |     100 |     100 |
  dashboard.controller.ts                  |     100 |      100 |     100 |     100 |
 app/dashboard/contracts                   |     100 |      100 |     100 |     100 |
  dashboard-overview.schema.ts             |     100 |      100 |     100 |     100 |
Ran all test suites matching dashboard.
```
