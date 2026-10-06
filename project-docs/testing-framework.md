# Ghostfolio — Testing Framework Scaffold

_Author: Raniya Shaikh | Iteration 1 | Sep 24, 2026_

This document confirms the testing setup for the project and establishes conventions for unit and integration tests going into Iteration 2.

## 1. Test Runner

**Jest** (via `ts-jest`), already configured per-app:

- `apps/api/jest.config.ts`
- `apps/client/jest.config.ts`

The API config runs tests in UTC (`process.env.TZ = 'UTC'`) for deterministic date-based calculations — worth keeping in mind for any tax/date-related test logic.

Run tests with:

```
npx nx test api
```

**Known issue:** on some machines, Jest's parallel workers can crash with `Jest worker encountered N child process exceptions, exceeding retry limit`. This is a worker/resource issue, not a test failure — the actual tests still pass (confirmed: 151/152 passing, 1 skipped, 0 real failures on a full run). If you hit this, run:

```
npx nx test api --maxWorkers=2
```

## 2. Unit Test Convention

Colocated `*.spec.ts` files, sitting directly next to the source file they test:

```
risk.service.ts
risk.service.spec.ts
```

This is the existing convention (see `portfolio.service.spec.ts`, `portfolio-calculator-liability.spec.ts`) and should be followed for all new feature modules (risk, tax, charts, dashboard).

An example placeholder stub has been added at `apps/api/src/app/risk/risk.service.spec.ts` as a copy-paste template:

```ts
describe('RiskService', () => {
  it('should be defined (placeholder — replace with real tests in Iteration 2)', () => {
    expect(true).toBe(true);
  });
});
```

## 3. Integration Test Location

No existing integration/e2e project was found in the repo (`apps/api-e2e` or similar does not exist). A new folder has been created as the convention going forward:

```
apps/api/src/test/integration/
```

Integration tests for cross-module flows (e.g. the dashboard calling risk/tax/charts APIs) should live here in Iteration 2, once those endpoints exist.

## 4. Coverage Expectation

Going into Iteration 2: **every new service function should have at least one unit test.** This isn't enforced by tooling yet — it's a team convention, and worth reflecting in the PR review checklist (Sep 25 task).

## 5. What This Unlocks Next

- **Fri Sep 25 (branching/PR checklist):** the checklist should reference this convention — link to this doc.
- **Iteration 2:** Sesha, Tharun, and Arthur each copy the `risk.service.spec.ts` stub pattern into their own feature folders when they start writing real service logic.
