# Iteration 2 Tax Evidence — Oct 29, 2026

**Owner:** Tharun Swaminathan

**Area:** Tax Metrics & Tax Calculations

**Iteration:** 2 — Backend Development

**Evidence date:** October 29, 2026

**Related issue:** #168 — Prepare tax demo, evidence and report sections

## Purpose

This document records GitHub and test evidence for the Iteration 2 tax backend work.

The evidence is used for the Oct 29 Sprint Review, the Iteration 2 report, and final Scrum documentation.

Only completed and merged work is listed.

## Completed Tax Scope

Iteration 2 tax work delivered:

- tax decision records DR-1 through DR-6;
- withholding-tax schema and persistence;
- derived dividend records;
- deterministic FIFO ordering;
- FIFO tax-lot creation and consumption;
- FIFO realized-gain calculation;
- FIFO edge-case handling;
- authenticated realized-gains API;
- average-cost running pool;
- average-cost realized gains;
- shared FIFO / average-cost method selection;
- derived tax-lot tracking and API;
- tax-relevant activity filtering;
- yearly tax summary;
- deterministic CSV export;
- deterministic PDF export;
- final tax README and as-built decision reconciliation.

## Merged Pull Request Evidence

| PR   | Work completed                                                                 |
| ---- | ------------------------------------------------------------------------------ |
| #48  | Closed DR-1 through DR-3 and added Iteration 2 Scrum notes                     |
| #59  | Closed DR-4 through DR-6 and finalized the tax implementation backlog          |
| #72  | Added nullable `withholdingTax` to the Order model and DTOs                    |
| #80  | Added withholding-tax persistence and validation                               |
| #86  | Added derived `DividendRecord` calculation                                     |
| #92  | Added deterministic FIFO ordering and BUY-derived tax lots                     |
| #98  | Added FIFO lot consumption and partial-sell support                            |
| #104 | Added FIFO realized-gain and fee-allocation calculations                       |
| #109 | Added FIFO edge-case, insufficient-holdings, ordering, and currency protection |
| #117 | Added authenticated FIFO realized-gains API                                    |
| #120 | Added average-cost running pool                                                |
| #126 | Added average-cost realized-gain calculation                                   |
| #132 | Added shared FIFO / average-cost calculator method selection                   |
| #139 | Added derived tax-lot tracker and `/tax/lots` endpoint                         |
| #147 | Added tax-relevant activity flag, filtering, and incomplete-result diagnostics |
| #148 | Added yearly tax summary                                                       |
| #152 | Added deterministic CSV tax export                                             |
| #159 | Added deterministic PDF tax export                                             |
| #164 | Finalized Iteration 2 tax README and as-built DR-1 through DR-6 reconciliation |

## Related Tax Issues

The merged work above resolved the associated Iteration 2 tax issues, including:

`#45`, `#52`, `#46`, `#79`, `#84`, `#47`, `#96`, `#103`, `#100`, `#114`, `#53`, `#124`, `#131`, `#54`, `#55`, `#56`, `#57`, `#58`, and `#163`.

Current Oct 29 evidence/demo work is tracked by Issue #168.

## Final Tax Validation

The final Oct 28 tax documentation PR recorded the following local validation:

```text
Tax suites: 16 / 16 passed
Tax tests: 218 / 218 passed
API lint: 0 errors
Format check: passed
API build: passed
git diff --check: passed
git diff --cached --check: passed
```

The financial test coverage includes numeric assertions rather than execution-only checks.

Across the tax implementation, tests cover examples such as:

- known zero versus unknown withholding;
- gross and net dividend calculations;
- deterministic date/activity-ID ordering;
- FIFO partial lot consumption;
- one SELL spanning multiple FIFO lots;
- fee allocation and residual reconciliation;
- insufficient holdings;
- same-timestamp SELL-before-BUY behavior;
- fractional quantities;
- realized losses;
- cross-currency rejection where normalization is unavailable;
- average-cost pool updates;
- full liquidation and re-entry;
- cross-account average-cost behavior;
- source activity traceability;
- tax-relevant filtering;
- incomplete-result diagnostics;
- yearly aggregation;
- CSV reconciliation;
- PDF reconciliation and deterministic metadata.

### Oct 29 Sprint Review Rehearsal

Before the Oct 29 Sprint Review, the complete tax test suite was rerun from the current Iteration 2 main baseline using:

```powershell
npx jest --config apps/api/jest.config.ts apps/api/src/app/tax --runInBand
```

Result:

```text
Test Suites: 16 passed, 16 total
Tests:       218 passed, 218 total
Snapshots:   0 total
Time:        15.939 s
```

All tax test suites passed during the live rehearsal. This provides current evidence for the Sprint Review demonstration.
This folder-scoped run includes:

```text
apps/api/src/app/tax/tax.e2e.spec.ts
```

The `tax.e2e.spec.ts` file contains 20 end-to-end tests. Therefore, the 218-test total is not a unit-test-only figure; it includes the tax E2E coverage contained inside the tax folder.

All 16 tax-folder suites and all 218 tests passed during the Oct 29 Sprint Review rehearsal.

The Integration Pass #2 described below is a separate cross-feature integration run. It contains four E2E suites covering charts, risk, tax, and dashboard, with 47 E2E tests in total. The 47-test integration result should therefore not be added to the 218 tax-folder total as though the two results represented non-overlapping test categories.

## Integration Pass #2

The final backend integration pass was recorded on October 28 before the feature/code freeze.

Integration Pass #2 was run against:

```text
25bea2186
```

which was `origin/main` at the time that integration pass was executed.

Results:

```text
E2E suites: 4 / 4 passed
E2E tests: 47 / 47 passed
```

The four integration suites covered:

```text
charts
risk
tax
dashboard
```

The full API suite recorded:

```text
93 suites passed
1 suite skipped

641 tests passed
1 test skipped
```

The skipped test belonged to an upstream Ghostfolio placeholder test and was not recorded as a feature failure.

The API build also completed successfully.

## CI Evidence

For the integration-pass-2 freeze commit, GitHub CI recorded successful results for:
The Oct 29 tax-folder rerun and Integration Pass #2 therefore represent two different verification points:

```text
Oct 28 Integration Pass #2
Baseline: 25bea2186
Scope: cross-feature integration + full API suite

Oct 29 Tax Sprint Review Rehearsal
Baseline: 344f74e4c9145f8ab7ef2dd731fb3088e388f620
Scope: apps/api/src/app/tax
```

## CI Evidence

For the Integration Pass #2 freeze commit, GitHub CI recorded successful results for:

```text
Build
Unit tests
Lint and format
extract_locales
```

The Oct 28 tax documentation PR subsequently passed its required GitHub checks before merge.

## Financial Calculation Rules Demonstrated

### Withholding and Dividends

The backend distinguishes:

```text
withholdingTax = null
```

from:

```text
withholdingTax = 0
```

A null withholding amount means that withholding is unknown.

A known zero means that no withholding was applied.

Gross dividend is calculated as:

```text
quantity × unitPrice
```

When withholding is known:

```text
netDividend = grossDividend - withholdingTax
```

Activity fees remain separate from withholding.

### FIFO

FIFO processes activities deterministically using:

```text
1. activity date/time ascending
2. activity ID ascending
```

Acquisition lots are consumed chronologically.

FIFO preserves BUY/SELL source activity traceability and supports:

- partial lot sales;
- sales spanning multiple acquisition lots;
- fractional quantities;
- fee allocation;
- realized losses;
- explicit insufficient-holdings errors.

### Average Cost

The average-cost pool is scoped by:

```text
userId + symbolProfileId
```

The pool tracks:

```text
quantity
gross cost
acquisition-fee pool
source activity IDs
```

BUYs add to the pool.

SELLs proportionally reduce the pool and calculate realized cost basis from the before/after pool transition.

Full liquidation resets remaining pool cost and acquisition fees to exact zero.

### Yearly Summary

The yearly summary aggregates:

```text
gross dividends
withholding
net dividends
gross sale proceeds
cost basis
realized gain
allocated activity fees
fee-adjusted realized gain
```

Both FIFO and average-cost results are supported.

Unavailable information is kept distinct from numeric zero.

### CSV Export

CSV export uses already calculated yearly-summary and trace results.

It does not recalculate financial values.

The export provides deterministic rows including:

```text
SUMMARY
DIVIDEND
REALIZED_GAIN
FIFO_MATCH
AVERAGE_COST_EVENT
WARNING
ERROR
```

### PDF Export

PDF export uses the same authoritative tax results as the CSV/yearly-summary layers.

The renderer does not independently calculate tax values.

The implementation uses `pdf-lib@1.17.1` and plain-decimal formatting.

## Known Iteration 2 Limitations

The following limitations are documented rather than hidden:

- `withholdingTaxRate` is not currently part of the authoritative `DividendRecord` or yearly-summary model;
- the reserved CSV `withholdingTaxRate` field remains empty;
- authoritative `assetCurrency` is not currently available to the yearly export model, so the reserved CSV field remains empty;
- FIFO and average-cost cost-basis engines do not perform historical FX normalization before calculation;
- incompatible or unknown currencies fail explicitly instead of assuming an exchange rate;
- realized-gain base-currency fields currently use the SELL-date historical conversion rate;
- same-timestamp activity ordering is based on activity ID and does not force BUY before SELL;
- if a SELL sorts before the supporting BUY at the same timestamp, insufficient holdings can be reported;
- yearly summary, CSV export, and PDF export currently exist in the backend service/domain layer and are not exposed through separate public HTTP download endpoints;
- jurisdiction-specific tax rules are intentionally outside Iteration 2 scope.

## Sprint Review Demo Evidence

The Oct 29 tax demonstration will show the completed backend using existing test and API/service evidence.

Planned demo flow:

```text
1. Explain the tax backend scope and DR-1 through DR-6.
2. Run/show the final tax test suite.
3. Demonstrate withholding/dividend behavior.
4. Demonstrate FIFO lot consumption and realized gain.
5. Demonstrate average-cost calculation.
6. Show tax-lot and realized-gain API behavior.
7. Show yearly summary.
8. Show CSV and PDF outputs.
9. Close with limitations and final test/CI evidence.
```

Target demo duration: approximately 5 minutes.

## Sprint Review Result

To be completed after the Oct 29 Sprint Review.

**Tax stories accepted:** Pending Sprint Review.

**Tax stories not accepted:** Pending Sprint Review.

**Feedback received:** Pending Sprint Review.

**Follow-up actions:** Pending Sprint Review.

These fields intentionally remain pending in this pre-Sprint-Review evidence draft. They should be completed only from direct evidence recorded during or after the Oct 29 Sprint Review.

## Evidence References

Repository evidence used for this record includes:

```text
apps/api/src/app/tax/README.md
project-docs/iteration-2/tax-decision-record.md
project-docs/iteration-2/evidence/integration-pass-1-2026-10-26.md
project-docs/iteration-2/evidence/integration-pass-2-2026-10-28.md
```

GitHub Issues and Pull Requests remain the authoritative source for completion, review, CI, and merge state.
