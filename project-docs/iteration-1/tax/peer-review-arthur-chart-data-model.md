# Peer Review — Arthur's Performance Chart Data Model

**Reviewer:** Tharun Swaminathan
**Feature Owner Reviewed:** Arthur Elly Lim — Upgraded Performance Charts
**Iteration:** 1 — Design & Data Modelling
**Scheduled Task:** September 28, 2026
**Review Finalized:** September 28, 2026
**Scope:** Design/documentation review only; no chart implementation changes

## Purpose

This peer review checks Arthur's current performance-chart design against the Iteration 1 sprint requirements, the current `main` Ghostfolio implementation, existing API/data contracts, the team's feature ownership boundaries, and implementation-readiness for later iterations.

The goal is not to redesign Arthur's feature. The goal is to identify where the proposed chart contracts should be aligned with Ghostfolio before implementation.

## Sources Reviewed

### Arthur branch

The current remote `arthur` branch contains:

```text
project-docs/iteration-1/audit/audit.md
project-docs/iteration-1/audit/zoom-pan-time-range-data-spec.md
project-docs/iteration-1/audit/portfolio-value-invested-capital-cash-toggle-spec.md
project-docs/iteration-1/audit/total-return-vs-price-return-comparison-spec.md
```

### Current Ghostfolio implementation

The review cross-checked:

```text
apps/api/src/app/portfolio/get-performance.dto.ts
apps/api/src/app/portfolio/portfolio.controller.ts
apps/api/src/app/portfolio/portfolio.service.ts
apps/api/src/app/portfolio/calculator/portfolio-calculator.ts
apps/api/src/dtos/date-range-filter.dto.ts
libs/common/src/lib/calculation-helper.ts
libs/common/src/lib/config.ts
libs/common/src/lib/interfaces/historical-data-item.interface.ts
libs/common/src/lib/interfaces/portfolio-performance.interface.ts
libs/common/src/lib/interfaces/responses/portfolio-performance-response.interface.ts
apps/client/src/app/components/investment-chart/investment-chart.component.ts
libs/ui/src/lib/line-chart/line-chart.component.ts
libs/common/src/lib/chart-helper.ts
```

## Repository Status Note

Before the final review was completed, Arthur's chart-design work was merged into
the current `main` branch. The review therefore uses the chart documents now
present on `main`, rather than an outdated branch comparison.

At this stage, the chart design set visible on `main` includes the audit,
zoom/pan range spec, value/invested-capital/cash toggle spec, total-return vs.
price-return spec, contribution/waterfall structure, benchmark comparison model,
drawdown calculation spec, and a chart issue-backlog document.

The interactive chart wireframe itself is not present in the repository path
reviewed here.

## What Is Working Well

The feature decomposition is sensible. The zoom/pan document separates backend range selection from the frontend viewport, which avoids leaking Chart.js-specific state into the API. The designs also try to preserve backward compatibility and reuse one range concept across related chart features. The total-return comparison uses aligned dates for both series, which is better than making the frontend merge independently fetched series.

The chart audit also correctly identifies the main chart dependencies already in the repository. Existing chart/data patterns should be reused rather than replaced.

## Required Corrections Before Implementation

### 1. Proposed `ChartSeriesResponse` does not match the current API

The design treats this as the baseline response:

```ts
interface ChartSeriesResponse {
  granularity: 'daily' | 'weekly';
  startDate: string;
  endDate: string;
  points: Array<{ date: string; value: number }>;
}
```

The current repository actually returns:

```ts
interface PortfolioPerformanceResponse {
  chart?: HistoricalDataItem[];
  dateOfFirstActivity: Date;
  performance: PortfolioPerformance;
}
```

`HistoricalDataItem` already includes multiple values such as:

```text
date
value
valueWithCurrencyEffect
totalInvestment
totalInvestmentValueWithCurrencyEffect
totalCashInBaseCurrency
netWorth
netPerformance
netPerformanceInPercentage
netPerformanceInPercentageWithCurrencyEffect
```

**Recommendation:** reuse or extend the actual `PortfolioPerformanceResponse` / `HistoricalDataItem` contract unless a new endpoint is clearly justified. Do not build Iteration 2 around a simplified response that does not exist.

### 2. Historical invested-capital and cash data already exist

The toggle spec says invested capital and cash exist only as current-day values. The current portfolio calculator already writes:

```text
totalInvestment
totalInvestmentValueWithCurrencyEffect
totalCashInBaseCurrency
```

into each historical chart item returned by the performance endpoint.

**Recommendation:** first evaluate a frontend series-selection approach using existing `HistoricalDataItem` fields. A new backend `kind` parameter may not be necessary for the three-value toggle.

### 3. Proposed invested-capital definition does not match Ghostfolio `totalInvestment`

The spec defines invested capital as:

```text
cumulative net contributions = deposits - withdrawals
```

Ghostfolio's current transaction-point calculation is not a generic deposit/withdrawal ledger. BUY activity increases investment from purchase cost, and SELL activity reduces investment using existing average-price/cost logic.

**Recommendation:** choose one precise definition.

If the feature reuses `totalInvestment`, document Ghostfolio's existing semantics. If Arthur wants a true contribution/deposit series, define exactly which source events count as deposits, withdrawals, BUY, SELL, transfers, and cash movements.

Do not use the two definitions interchangeably.

### 4. Preserve the existing date-range values

The proposed type contains:

```ts
'today' | 'wtd' | 'mtd' | 'ytd' | '1y' | '5y' | 'max'
```

Ghostfolio currently uses:

```text
1d
1y
5y
max
mtd
wtd
ytd
```

and also accepts calendar years such as `2026`, `2025`, and `2024`.

**Recommendation:** reuse the existing `DateRange` type and add custom-range support around it. Do not silently rename `1d` to `today`, and do not drop calendar-year ranges.

### 5. Current chart sampling is adaptive, not just daily vs weekly

The zoom spec proposes:

```text
<= 7 days  -> daily
<= 2 years -> daily
> 2 years  -> weekly
```

The current calculator instead derives a step from:

```text
daysInMarket / MAX_CHART_ITEMS
```

and also preserves transaction dates, account-balance dates, preset boundaries, year boundaries, denser points in the last 90 days, and daily points in the last 30 days.

**Recommendation:** either preserve the current adaptive sampling or explicitly define daily/weekly sampling as a deliberate behavior change. Do not describe the proposed rule as current behavior.

A single `granularity: daily | weekly` field may also be too simple to describe the current adaptive sampling.

### 6. Timezone wording should be corrected

The spec says date boundaries are based on the user's "account currency's calendar."

A currency does not define a timezone.

The current Ghostfolio helper uses local-time semantics for preset and calendar-year boundaries.

**Recommendation:** define one explicit application/user date convention and coordinate it with the shared architecture. Do not derive timezone from currency.

### 7. Preserve current performance filters and access behavior

The existing V2 performance endpoint accepts:

```text
accounts
assetClasses
dataSource
range
symbol
tags
withExcludedAccounts
```

and also applies portfolio-read scopes, restricted-view behavior, ZEN-mode value redaction, and subscription-based redaction.

**Recommendation:** the custom-range and return-comparison designs should explicitly preserve current filtering, permissions, and redaction behavior.

### 8. API examples should align with the existing version

The current controller uses:

```ts
@Version('2')
@Get('performance')
```

The design examples use `/api/v1/portfolio/performance`.

**Recommendation:** use the actual V2 convention or label endpoint paths as conceptual until the route is decided.

## Total Return vs Price Return

### 9. Core return formulas are still underspecified

The spec says total return should use distributions "as if reinvested ... or simply accumulated as cash ... whichever convention the existing ROAI calculation already uses."

That leaves the main calculation undefined.

Before implementation, define:

```text
price-return index formula
total-return index formula
base date/value
BUY/SELL cash-flow treatment
dividend treatment
interest treatment
reinvestment assumption
fees
FX conversion
partial holding periods
portfolio aggregation
```

The response can still remain:

```ts
{
  date,
  priceReturn,
  totalReturn
}
```

but the numbers must come from a deterministic formula.

### 10. Define exactly which activity types are distributions

The document refers to dividends, interest, and "other cash payouts."

**Recommendation:** list the exact Ghostfolio activity types that affect total return. Do not leave "other distributions" open-ended without a source-model category.

### 11. Gross vs net dividend requires one cross-feature decision

The chart feature should not implement tax rules.

However, after the tax extension introduces:

```text
gross dividend
withholding amount
net dividend
```

the performance contract still needs to say whether total return uses gross distribution or net cash received.

Arthur should not infer that from the withholding field. Tharun's tax engine should remain separate from the chart calculation.

### 12. Holding identity should use `dataSource + symbol`

The proposed holding scope is:

```ts
{ level: 'holding'; symbol: string }
```

Ghostfolio commonly identifies an asset using:

```text
dataSource + symbol
```

**Recommendation:** use the existing asset-profile identifier pattern rather than symbol alone.

### 13. Re-entry after a full sale is not defined

The spec says a fully sold holding's indexed series stays flat for the rest of the range.

That becomes ambiguous if the same asset is bought again later in the selected range.

**Recommendation:** define whether a re-entry continues the same index, starts a new segment, or follows another deterministic rule.

## Frontend and Component Reuse

The existing shared line-chart implementation already supports two datasets through historical and benchmark inputs. The investment chart also renders an investment series and a portfolio-value series together.

**Recommendation:** reuse those existing data patterns where practical instead of creating a completely separate comparison architecture.

The final React implementation should still coordinate with Raniya's shared React component architecture.

## Additional Review of Sep 21–25 Chart Deliverables

The later chart documents are now present on `main` and were included in the
final peer review.

### Contribution / waterfall model

The proposed reconciliation identity is useful:

```text
start value
+ net cash flow
+ market gain/loss
+ dividends
= end value
```

However, the calculation inputs still need tighter definitions before coding.

Ghostfolio's persisted `Order` activity types do not include generic
`DEPOSIT`/`WITHDRAWAL` activities. Cash history can also come through account
balance data and synthetic cash handling in the portfolio calculator.

**Recommendation:** define exactly which existing Ghostfolio source records
produce `netCashFlow`, and specify the waterfall formula so buys, sells,
dividends, and changing cash balances cannot be double counted.

The `marketGainLoss` definition should also be stated as a deterministic formula,
not only as "pure price movement."

### Benchmark comparison model

The benchmark document is directionally sound in reusing existing market-data
symbols instead of creating a new benchmark database entity.

Two contract details need correction:

1. benchmark identity should use Ghostfolio's existing `dataSource + symbol`
   pattern rather than `symbol` alone;
2. the benchmark-return convention must be explicit.

A portfolio total-return index should not silently be compared with a benchmark
price-only index unless that is an intentional, documented choice. The spec must
define which historical price field/distribution treatment produces
`benchmarkReturn`.

### Drawdown model

The full-history peak rule is well specified and avoids resetting drawdown to
zero simply because the user zoomed into a later range.

One semantic decision still needs to be made: the current spec calculates
drawdown from raw portfolio value. Deposits and withdrawals can therefore create
or deepen apparent drawdowns even when market performance has not changed.

**Recommendation:** explicitly decide whether the feature is:

```text
portfolio-value drawdown
```

or:

```text
investment-performance / return-index drawdown
```

Either can be valid, but the UI label and calculation contract must match the
chosen meaning.

### Chart issue backlog

The repository now contains:

```text
project-docs/iteration-1/audit/chart-feature-github-issues.md
```

This is a paste-ready issue backlog, not evidence that the corresponding GitHub
issues were actually filed. At review time, no matching chart issues were found
in the repository's GitHub Issues list.

If Sep 25 requires the issues to be filed rather than only drafted, Arthur
should create them in GitHub and record their issue numbers.

### Interactive chart wireframe

The issue backlog references an external interactive-chart wireframe, but no
wireframe file is present under the chart design folder reviewed on `main`.

If the external artifact is the official deliverable, the team should ensure it
is accessible for grading/review. Preferably, a repository copy or screenshot
should be stored with the project documentation so the design remains available
without relying on an external artifact link.

## Sprint Completeness Check

Arthur's scheduled Iteration 1 work before this peer review includes:

```text
Sep 15 - audit current chart implementation/libraries
Sep 16 - zoom/pan/selectable-time-range data spec
Sep 17 - portfolio value/invested capital/cash toggle spec
Sep 18 - total-return vs price-return comparison spec
Sep 21 - contribution/waterfall chart data structure
Sep 22 - benchmark comparison data model
Sep 23 - drawdown chart calculation spec
Sep 24 - interactive chart wireframe
Sep 25 - GitHub issues for every chart sub-feature
```

The audit and Sep 16–23 design documents are now visible on `main`, along with
the chart issue-backlog document.

The remaining verification items are:

```text
interactive chart wireframe stored/accessibly linked for the team
actual GitHub chart issues created, if filing rather than drafting is required
```

## Documentation Cleanup

Before finalizing the chart design:

- replace `**Author:** _fill in_` with Arthur's name;
- remove the literal command left at the bottom of the zoom spec:
  `npx prettier --write project-docs/iteration-1/audit/zoom-pan-time-range-data-spec.md`;
- optionally use a chart-specific documentation folder instead of the generic `audit/` folder if the team wants consistent organization.

The folder rename is optional and should not create unnecessary churn.

## Recommended Repository-Aligned Direction

For value/investment/cash charting:

```text
Existing V2 performance endpoint
        |
        v
PortfolioPerformanceResponse
        |
        v
HistoricalDataItem[]
        |
        +--> value / valueWithCurrencyEffect
        +--> totalInvestment
        +--> totalCashInBaseCurrency
        +--> net performance fields
```

For custom ranges:

```text
existing DateRange preset/year
OR
custom start/end
```

should feed the same calculator and preserve filters, permissions, redaction, and current adaptive sampling.

For price-return vs total-return comparison, a dedicated response can still be reasonable because it is an indexed two-series calculation, but the calculation formulas and holding identity need to be defined precisely first.

## Peer Review Outcome

Arthur's current design has a useful feature decomposition and several good state/API ideas, especially the separation of requested range from frontend viewport and the aligned return-comparison response.

Before Iteration 2 implementation, the documents should be revised to match the current Ghostfolio repository.

Highest-priority corrections:

1. Reuse the actual `PortfolioPerformanceResponse` / `HistoricalDataItem` contract.
2. Recognize that historical `totalInvestment` and `totalCashInBaseCurrency` already exist.
3. Resolve the semantic mismatch between `totalInvestment` and "net contributions."
4. Preserve `1d` and calendar-year ranges.
5. Align sampling with current adaptive behavior or clearly specify a deliberate change.
6. Remove currency-based timezone wording.
7. Preserve all filters/access/redaction behavior.
8. Define exact price-return and total-return formulas.
9. Use `dataSource + symbol` for holding and benchmark identity.
10. Clarify gross-vs-net distribution behavior with the shared/tax contract.
11. Define exact waterfall source inputs/reconciliation to prevent double counting.
12. Decide whether drawdown is raw portfolio-value drawdown or return/performance drawdown.
13. Define the benchmark return convention so portfolio and benchmark series are comparable.
14. Ensure the chart wireframe is stored or reliably accessible.
15. Create the actual GitHub chart issues if the sprint requires filing, not only drafting.

## Changes Made by Reviewer

None.

This peer review does not modify Arthur's feature files or implementation. It records feedback only and respects Arthur's chart ownership.
