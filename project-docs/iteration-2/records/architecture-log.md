# Architecture Log — Iteration 2 (feeds: Software Architecture)

Source: direct inspection of the repo file tree under `apps/api/src/app/`, `apps/api/src/models/rules/`,
`libs/`, and `prisma/schema.prisma`, plus `project-docs/iteration-2/tax-decision-record.md` (read in full)
and merged-PR descriptions. Describes what actually exists on `main` plus what exists only on open,
unmerged PR branches (marked as such) — not an aspirational design.

**Last updated (this log):** 2026-10-08, by direct repo inspection for this record set.

## 1. Current Components / Services

### Risk feature (`apps/api/src/app/risk/`) — owner: Sesha Siva Sankar

- `risk.module.ts`, `risk.controller.ts` (+ `.spec.ts`) — skeleton only, added by PR #61 (Issue #60); no real endpoints implemented yet (Issue #24, risk API contract, is still OPEN).
- `risk.service.spec.ts` — real coverage added by PR #71 (replacing the Iteration-1 placeholder), but there is **no corresponding `risk.service.ts` implementation file found** in the current tree — the spec currently tests concentration logic that actually lives in the rule classes below. This is worth flagging: the service-level test file exists ahead of a service implementation file.
- `exposure-calculator.service.ts` / `.spec.ts` — `ExposureCalculatorService` with `calculateCurrencyExposure()` and `calculateAssetClassExposure()`, added by PR #77 (Issue #32). **Not yet merged to main as of 2026-10-08** (PR #77 is approved, CI green, awaiting merge).

### Risk rules (`apps/api/src/models/rules/concentration/`) — owner: Sesha Siva Sankar

- `single-stock-concentration.ts` / `.spec.ts` — merged via PR #51 (Issue #30). Restricts to STOCK/CRYPTOCURRENCY sub-classes; default `thresholdMax` 10%; aggregates by symbol (fixed in PR #51 rework).
- `sector-concentration.ts` / `.spec.ts`, `country-concentration.ts` / `.spec.ts` — merged via PR #71 (Issue #31). Country default `thresholdMax` 50%.
- `weighted-attribute-grouping.util.ts` — shared utility (added in PR #71) that splits a multi-attribute holding proportionally across buckets (e.g. a 70/30 multi-sector holding); reused as-is by the currency-exposure calculator (PR #77) rather than reimplemented.
- These sit alongside the pre-existing 17 X-Ray rule classes under `apps/api/src/models/rules/` (account-cluster-risk, asset-class-cluster-risk, currency-cluster-risk, economic-market-cluster-risk, emergency-fund, fees, liquidity, regional-market-cluster-risk) — the new concentration rules extend the same base `Rule` class per Issue #18's scope.

### Tax feature (`apps/api/src/app/tax/`) — owner: Tharun Swaminathan

- `tax.module.ts`, `tax.controller.ts` (+ `.spec.ts`) — skeleton only, added by PR #61 (Issue #60).
- `withholding-tax-migration.spec.ts` — exists on `main`; individual test assertions not re-extracted in this pass (see `gaps.md`).
- Prisma: `Order.withholdingTax Float?` (nullable) added via PR #72 (Issue #46), migration `prisma/migrations/20261006120000_added_withholding_tax_to_order/`. Persistence/validation on create/update implemented via PR #80 (Issue #79): non-negative, dividend-only, capped at gross dividend (`quantity * unitPrice`), preserves omitted-field value on update, distinguishes `null` (unknown) from `0` (known-zero) per DR-1.
- `export.service.ts` (outside the tax module, in `apps/api/src/app/export/`) required a follow-up fix (PR #78) to include `withholdingTax` in its activity-mapping call site — see Architecture Decision/incident note below.
- FIFO (Issue #47), average-cost pool (Issue #53), tax-lot tracker (Issue #54), tax-relevant flag (Issue #55), yearly summary (Issue #56), CSV export (Issue #57), PDF export (Issue #58) are all still OPEN/not started as of 2026-10-08.

### Charts feature (`apps/api/src/app/charts/`) — owner: Arthur Elly Lim

- `charts.module.ts`, `charts.controller.ts` (+ `.spec.ts`) — skeleton only, added by PR #61 (Issue #60).
- `resolveTimeRange()` — a shared time-range resolver (presets today/wtd/mtd/ytd/1y/5y/max plus custom inclusive date ranges; clamps future end dates to today and pre-history start dates to the earliest activity; throws `InvalidTimeRangeError` for end-before-start) — merged via PR #76. **No GitHub issue is linked to this PR** (see `gaps.md`/`deviations.md` D-5) and its file location was not independently confirmed from the merged diff in this pass.
- A performance-history-to-`ChartSeriesResponse` adapter (daily granularity ≤2 years, weekly beyond, Monday-start weeks) exists only on the **open, unmerged** PR #83 branch (`Existing-Ghostfolio-performance-history`).
- A chart-API-contract reconciliation (preset `'1d'` correction, real `/api/v2/portfolio/performance` endpoint mapping) exists only on the **open, unmerged** PR #70 branch (`reconcile-chart-api`), which has an outstanding `CHANGES_REQUESTED` review from Tharun Swaminathan.
- **No charts module has any linked GitHub issue** — this is a standing architecture-traceability gap, not just a process one; see `gaps.md`.

### Dashboard feature — owner: Raniya Shaikh

- No `apps/api/src/app/dashboard/` module exists yet as of 2026-10-08 (Issue #64, "Create dashboard module, controller, and service skeleton," is scheduled for Oct 19 and is OPEN/not started). The risk/tax/charts skeletons (PR #61) exist; the dashboard-side aggregation module does not yet.
- Shared API conventions: `libs/common/src/lib/api-conventions.ts` (PR #74, Issue #73) — `{ data, meta, error }` envelope, `MoneyAmount { amount, currency }`, ISO date / decimal-percentage type aliases, feature-prefixed error codes, pagination meta, success/error response builder functions. Imported as `@ghostfolio/common/api-conventions`.
- Shared React component library: `libs/react-ui/` (PR #75, Issue #73) — design tokens (`tokens/design-tokens.ts`), `LayoutShell` component, `@ghostfolio/react-ui/*` tsconfig alias. Extended (on **open, unmerged** PR #82) with `Card`, `Button`, and a `ThemeProvider`/`useTheme` light-dark theme module.

## 2. API Endpoints

As of 2026-10-08, **no new risk/tax/charts/dashboard HTTP endpoint has been implemented and merged
to main.** The risk, tax, and charts controllers added in PR #61 are empty skeletons (module +
controller registration only, per that PR's own description: "No services or endpoints yet;
feature owners add those from Oct 6"). The only endpoint-shaped work found is:

- Prisma/DTO-level changes supporting the existing activity create/update endpoints to accept and
  return `withholdingTax` (via PR #72, #80) — these extend an **existing** Ghostfolio endpoint
  rather than adding a new one.
- `export.service.ts`'s activity-export mapping was updated (PR #78) to also return `withholdingTax`
  — again, an existing endpoint's response shape, not a new endpoint.

No request/response shape table is produced here because there is nothing yet to populate it with
for the risk/tax/charts/dashboard feature APIs themselves. This should not be read as a
documentation gap in this log — it reflects actual repo state. See `product-backlog.csv` /
`sprint-backlog.csv` for the still-open endpoint-building issues (#24 risk API contract, #42
what-if endpoint, #65/#66 dashboard aggregation endpoint, #57/#58 tax exports).

## 3. Dependencies Between Components

- `ExposureCalculatorService` (risk, PR #77) reuses `weighted-attribute-grouping.util.ts` from the
  Oct 6 concentration PR (#71) rather than reimplementing proportional-split logic — confirmed in
  PR #77's own description.
- Tax calculations are designed (per `tax-decision-record.md`) to consume the team's shared API
  decimal-serialization convention (owned by Raniya/dashboard) rather than define a tax-only
  number format — this is a documented decision (DR-6), not yet exercised by merged code since no
  tax calculation endpoint is merged yet.
- The dashboard feature is designed to call the risk, tax, and charts **public APIs** for
  aggregation (per Issue #65's title: "Start aggregation endpoint calling risk, tax, and charts
  public APIs") — this dependency is planned, not yet implemented (Issue #65 is OPEN, scheduled
  Oct 21).
- `export.service.ts` (pre-existing Ghostfolio module) now depends on the tax feature's
  `withholdingTax` field — this dependency surfaced _unexpectedly_ when PR #72 broke it, rather
  than being planned up front (see deviations.md D-3).

## 4. Data Model Changes

| Change | Field                                    | Migration                                                                       | PR              | Status            |
| ------ | ---------------------------------------- | ------------------------------------------------------------------------------- | --------------- | ----------------- |
| Tax    | `Order.withholdingTax Float?` (nullable) | `prisma/migrations/20261006120000_added_withholding_tax_to_order/migration.sql` | #72 (Issue #46) | Merged 2026-10-07 |

No other Prisma schema changes were found in the Oct 2–8 window (`git log --diff-filter=A --
prisma/migrations/*` shows no other new migration in this period). The planned `Order.isTaxRelevant
Boolean @default(true)` field (Issue #55) and any tax-lot/average-cost persistence are still OPEN,
not yet implemented.

## 5. Deployment View

NOT RECORDED. No deployment-environment change (Docker, CI/CD target, environment variable, or
infra-as-code file) was found to have changed in the Oct 2–8 window beyond the CI workflow
additions in PR #49 (`.github/workflows/daily-pr-fallback.yml`) and the branch-protection ruleset
(see `github-audit.csv`). Neither of these is a deployment-view change in the architectural sense;
no production/staging deployment target was located to describe. See `gaps.md`.

## 6. Source Files for Architecture Diagrams

- `project-docs/architecture-baseline.md`, `project-docs/target-architecture.md`,
  `project-docs/architecture-integration-design-architecture-report-section.md` — these are
  Iteration 1 documents; **not found to have been updated during Oct 2–8, 2026** (no commit in the
  date-range commit log touches these paths). Date last updated: NOT RECORDED beyond their
  Iteration 1 authorship — treat as stale relative to the Iteration 2 code changes logged above
  until confirmed otherwise.

## 7. Decision Records DR-1 through DR-6

All six are closed, found verbatim in `project-docs/iteration-2/tax-decision-record.md` (read in
full for this record set):

| DR   | Topic                           | Closed                    | Owner              | Final rule (verbatim summary from the doc's own summary table)                                                                                                             |
| ---- | ------------------------------- | ------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DR-1 | Net-dividend nullability        | Oct 2 (PR #48, Issue #45) | Tharun Swaminathan | Unknown withholding -> `netDividend = null`; known-zero withholding -> `netDividend = grossDividend`.                                                                      |
| DR-2 | Currency handling               | Oct 2 (PR #48, Issue #45) | Tharun Swaminathan | Withholding stored in transaction currency; derive other currencies via historical conversion; missing FX stays unavailable with a diagnostic, never defaults to 0 or 1:1. |
| DR-3 | Same-date ordering tie-breaker  | Oct 2 (PR #48, Issue #45) | Tharun Swaminathan | Deterministic order is `date ASC`, then `id ASC`.                                                                                                                          |
| DR-4 | Fee treatment                   | Oct 5 (PR #59, Issue #52) | Tharun Swaminathan | Keep gross values and attached activity fees separate; expose a separate fee-adjusted gain; never guess standalone FEE-activity linkage.                                   |
| DR-5 | Average-cost pool scope         | Oct 5 (PR #59, Issue #52) | Tharun Swaminathan | Pool scope is `userId + symbolProfileId` (user+asset), explicitly superseding the Iteration 1 account-aware proposal.                                                      |
| DR-6 | Decimal-safe precision/rounding | Oct 5 (PR #59, Issue #52) | Tharun Swaminathan | Use `Big` at the tax-engine boundary; no intermediate rounding; reconcile allocation residuals on the final allocation; round only once for presentation.                  |

## 8. Change Log (date / change / why / PR link)

| Date                  | Change                                                                                   | Why                                                                           | PR                                         |
| --------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------ |
| 2026-10-02            | Branch-protection ruleset "Protect Main" created                                         | Enforce PR-only merges to `main`, 1 required approval, no force-push/deletion | n/a (repo setting, see `github-audit.csv`) |
| 2026-10-02            | PR template, CODEOWNERS, daily-pr-fallback workflow added                                | Iteration 2 process governance                                                | #49                                        |
| 2026-10-05            | Empty NestJS skeletons for risk/tax/charts modules                                       | Give each feature owner a place to add real services from Oct 6               | #61                                        |
| 2026-10-05            | Single-stock concentration rule                                                          | Issue #30                                                                     | #51                                        |
| 2026-10-06            | Sector + country concentration rules; real `risk.service.spec.ts` coverage               | Issue #31                                                                     | #71                                        |
| 2026-10-06            | `Order.withholdingTax` nullable field + migration                                        | Issue #46                                                                     | #72                                        |
| 2026-10-06            | Shared API convention types (`libs/common/api-conventions.ts`)                           | Issue #73                                                                     | #74                                        |
| 2026-10-06            | React UI scaffold (`libs/react-ui`: design tokens, LayoutShell)                          | Issue #73 (part of)                                                           | #75                                        |
| 2026-10-06/07         | Shared `resolveTimeRange()` for charts                                                   | No linked issue (see gaps.md)                                                 | #76                                        |
| 2026-10-07            | Hotfix: `export.service.ts` missing `withholdingTax` in activity map, broke `main` build | Fix regression from PR #72                                                    | #78                                        |
| 2026-10-07            | withholdingTax persistence + validation on activity create/update                        | Issue #79                                                                     | #80                                        |
| 2026-10-07 (unmerged) | Currency + asset-class exposure calculators                                              | Issue #32                                                                     | #77 (open)                                 |
| 2026-10-07 (unmerged) | Card/Button/Theme components; retracts "151/152" claim                                   | Issue #81                                                                     | #82 (open)                                 |
| 2026-10-08 (unmerged) | Performance-history-to-ChartSeriesResponse adapter                                       | No linked issue                                                               | #83 (open)                                 |
