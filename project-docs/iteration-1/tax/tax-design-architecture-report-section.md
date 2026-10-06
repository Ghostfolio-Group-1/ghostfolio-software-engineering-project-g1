# Tax Metrics and Tax Calculations — Design and Architecture

**Owner:** Tharun Swaminathan
**Iteration:** 1 — Design & Data Modelling
**Report Section Date:** September 29, 2026
**Status:** Design complete for Iteration 1; backend implementation is planned for Iteration 2

## 1. Overview

The tax feature extends Ghostfolio with portfolio tax analytics while preserving
the application's existing transaction model and portfolio-calculation behavior.
The main design goal of Iteration 1 was to specify the tax data model,
calculation rules, service boundaries, filtering behavior, yearly reporting, and
export contracts clearly enough that Iteration 2 can focus on implementation and
testing rather than redesign.

The tax work covers four main areas:

- dividend withholding-tax tracking;
- realized capital-gains calculation using FIFO and average-cost methods;
- derived tax-lot and calculation-trace data;
- yearly tax summaries and CSV/PDF exports.

The feature is designed as tax analytics, not personal tax advice. No
jurisdiction-specific tax rates, wash-sale rules, holding-period rules, or
government filing formats are assumed.

## 2. Existing Ghostfolio Model

The design started by reviewing Ghostfolio's existing transaction and dividend
model instead of introducing a separate tax transaction system.

Ghostfolio persists financial activities using the Prisma `Order` model. The
important existing fields include:

```text
id
userId
accountId
symbolProfileId
date
type
quantity
unitPrice
fee
currency
createdAt
updatedAt
```

The supported activity types include `BUY`, `DIVIDEND`, `FEE`, `INTEREST`,
`LIABILITY`, and `SELL`.

A dividend is already represented as a normal activity with:

```text
type = DIVIDEND
```

and its gross value can be derived from:

```text
grossDividend = quantity × unitPrice
```

This existing model is sufficient as the source of truth for the tax extension.
The tax feature therefore extends the current activity flow rather than creating
a second transaction database or a separate dividend entity.

The existing activity `fee` field keeps its current meaning. It is not reused as
withholding tax because brokerage/activity fees and tax withholding are
different financial values and may both exist on the same dividend.

## 3. Proposed Tax Architecture

The tax feature follows a source-data-plus-derived-results architecture.

```text
Ghostfolio persisted activities
        |
        |  source metadata
        |  - withholdingTax
        |  - isTaxRelevant
        v
Tax source filtering and normalization
        |
        |  deterministic ordering
        |  stock-split normalization
        |  currency preparation
        v
Cost-basis strategy
     /       \
    /         \
 FIFO      AVERAGE_COST
    \         /
     \       /
      v     v
TaxRealizedGainRecord[]
method-specific trace data
        |
        +--------------------+
        |                    |
        v                    v
DividendRecord[]       Tax lot / trace views
        |
        v
YearlyTaxSummary
        |
        v
CSV / PDF tax export
```

The important architectural rule is that calculation logic belongs in the tax
backend. Yearly summaries, exports, and later frontend screens consume tax
calculation results instead of implementing their own FIFO, average-cost,
withholding, or currency-conversion logic.

A dedicated tax service/module under the API layer is the preferred direction,
for example under:

```text
apps/api/src/app/tax/
```

The exact shared service and interface locations should follow the architecture
conventions coordinated by the integration/architecture owner. The tax design
does not require replacing Ghostfolio's current portfolio calculator.

## 4. Source Data and Stored Tax Fields

### 4.1 Withholding tax

The proposed persisted field is:

```prisma
withholdingTax Float?
```

on the existing `Order` model.

The value represents the actual withholding amount in the activity's transaction
currency.

The design intentionally distinguishes:

```text
withholdingTax = null
```

from:

```text
withholdingTax = 0
```

`null` means the withholding information is unknown or was not provided.
`0` means the system knows that no tax was withheld.

The following values remain separate:

```text
grossDividend
withholdingTax
withholdingTaxRate
netDividend
activityFee
```

Only the withholding amount is proposed as stored source data. The rate and net
dividend are derived.

```text
grossDividend = quantity × unitPrice

withholdingTaxRate =
    withholdingTax / grossDividend

netDividend =
    grossDividend - withholdingTax
```

If withholding is unknown, derived tax-reporting values that depend on it remain
unavailable instead of being silently treated as zero.

### 4.2 Tax-relevant flag

A second proposed source field is:

```prisma
isTaxRelevant Boolean @default(true)
```

This allows the user to exclude a source activity from tax analytics without
deleting it or changing its normal portfolio meaning.

The default is `true` for backward compatibility with existing activities and
older imports.

Tax relevance is an additional tax filter. It does not override Ghostfolio's
existing stronger exclusions such as Draft activities, activities excluded from
analysis, or excluded accounts.

The flag is intentionally separate from the existing "Exclude from Analysis"
behavior because an activity may need to remain visible in normal portfolio
analytics while being excluded from tax calculations.

## 5. Common Tax Input Pipeline

FIFO and average cost should share one normalized source pipeline before their
calculation methods diverge.

The proposed tax source flow is:

```text
ActivitiesService
      |
      v
existing Draft/account/activity exclusions
      |
      v
isTaxRelevant filter
      |
      v
persisted BUY / SELL / DIVIDEND activities
      |
      v
stock-split normalization
      |
      v
currency preparation
      |
      v
deterministically ordered tax activities
```

Synthetic cash activities are excluded because they are generated at runtime and
are not persisted source transactions.

For capital gains, only `BUY` and `SELL` participate in the cost-basis engines.
`DIVIDEND` is processed separately for withholding and yearly income reporting.

The deterministic ordering rule is:

1. exact activity `date` ascending;
2. activity `id` ascending when dates are equal.

This prevents FIFO and average-cost results from depending on accidental
database or array order.

## 6. Tax Calculation Scope

The initial calculation scope is:

```text
userId
+ accountId
+ symbolProfileId
```

This creates an independent tax calculation scope per user, account, and asset.

Activities with:

```text
accountId = null
```

remain in a distinct `NO_ACCOUNT` scope instead of being merged into a real
account.

This is an engineering choice for deterministic calculation and traceability. It
is not presented as a jurisdiction-specific legal rule.

## 7. FIFO Capital-Gains Design

FIFO consumes eligible acquisition lots chronologically.

Each normalized `BUY` creates one derived acquisition lot. A `SELL` consumes the
oldest open lot first and continues through later lots until the sale quantity is
matched.

For each sale:

```text
grossProceeds =
    sellQuantity × sellUnitPrice

grossRealizedGain =
    grossProceeds - grossCostBasis
```

BUY and SELL activity fees are kept separately and allocated deterministically
so the system can also expose a fee-adjusted analytical result:

```text
realizedGainAfterActivityFees =
    (grossProceeds - allocatedSellFee)
    - (grossCostBasis + allocatedBuyFees)
```

Gross gain and fee-adjusted gain remain separate because the project does not
assume that all jurisdictions treat fees identically.

FIFO supports:

- multiple acquisition lots;
- partial lot consumption;
- one sale consuming several lots;
- fractional quantities;
- stock-split-adjusted quantities and unit prices;
- source BUY/SELL traceability.

A sale with insufficient open quantity produces an explicit calculation error
rather than inventing a short-sale cost basis.

## 8. Average-Cost Capital-Gains Design

Average cost uses the same normalized source activities but does not match a
sale to individual acquisition lots.

For each calculation scope, it maintains:

```text
Q = pooled quantity
C = gross cost pool
F = acquisition-fee pool
```

For a BUY with quantity `q`, unit price `p`, and fee `f`:

```text
Qnew = Q + q
Cnew = C + (q × p)
Fnew = F + f
```

For a SELL of quantity `q`:

```text
disposalRatio = q / Q

grossCostBasisAllocated =
    C × disposalRatio

buyFeesAllocated =
    F × disposalRatio
```

The pool is then reduced proportionally.

```text
Qnew = Q - q
Cnew = C - grossCostBasisAllocated
Fnew = F - buyFeesAllocated
```

A partial disposal therefore leaves the average unit cost unchanged, while a
full disposal resets the pool exactly to zero.

Average cost does not invent FIFO-style lot matches. Its traceability comes from
ordered calculation events that record the pool state before and after each BUY
or SELL.

## 9. Tax-Lot and Calculation-State Model

One major design decision is that calculated tax state is derived rather than
stored as authoritative database records.

Persisted source data:

```text
Order activity
withholdingTax
isTaxRelevant
AssetProfileSplit source data
```

Derived calculation state:

```text
TaxLot
TaxLotMatch
AverageCostPool
AverageCostEvent
TaxRealizedGainRecord
YearlyTaxSummary
```

This avoids stale tax records after historical activities are edited or deleted.

A historical transaction change can alter every later FIFO match or average-cost
result in the same scope. Replaying the ordered source history is therefore safer
than trying to update stored calculation rows manually.

Caching may be introduced later for performance, but any cache should remain
disposable and non-authoritative.

## 10. Common Realized-Gain Contract

FIFO and average cost both produce the same sale-level result type:

```text
TaxRealizedGainRecord
```

The common record contains conceptually:

```text
method
scope
sellActivityId
realizedAt

quantity
matchedQuantity
unmatchedQuantity

grossProceeds
grossCostBasis
grossRealizedGain

activityFees
realizedGainAfterActivityFees

asset-currency values
base-currency values

traceIds
warnings
errors
```

This common output keeps yearly summaries and exports independent from the
internal cost-basis algorithm.

Method-specific details remain separate:

```text
FIFO
-> TaxLot[]
-> TaxLotMatch[]

AVERAGE_COST
-> AverageCostEvent[]
-> pool state
```

## 11. Currency and Precision

Tax calculations may need values in:

- original transaction currency;
- asset-profile currency;
- user's base currency.

The original source transaction remains unchanged.

Where practical, the design reuses Ghostfolio's existing conversion services,
but the tax domain adds a stricter rule for missing historical exchange rates:

```text
missing FX != 0
missing FX != assumed 1:1 conversion
```

If a reliable base-currency value cannot be calculated, the asset-currency result
can still exist while the base-currency field remains unavailable and a
diagnostic is attached.

Financial calculations should use high-precision `Big` values internally.
Display rounding belongs at the presentation/export boundary rather than inside
FIFO or average-cost intermediate calculations.

## 12. Stock Splits

Tax calculations reuse Ghostfolio's existing stock-split normalization.

For a historical activity before a split:

```text
adjustedQuantity =
    originalQuantity × numerator / denominator

adjustedUnitPrice =
    originalUnitPrice × denominator / numerator
```

This preserves the economic value of the original activity while updating the
effective quantity and unit cost.

Split-adjusted values are calculation inputs only. They are not written back to
the original `Order`.

## 13. Filtering and Incomplete History

Tax calculations use only eligible persisted source activities.

The design reuses Ghostfolio's normal filtering for:

- Draft activities;
- activities excluded from analysis;
- excluded accounts.

It then applies:

```text
isTaxRelevant = true
```

as a tax-specific condition.

Excluding historical BUY/SELL activity can break later cost-basis continuity.

For example, an excluded BUY can produce:

```text
INSUFFICIENT_OPEN_LOTS
```

for FIFO or:

```text
INSUFFICIENT_POOL_QUANTITY
```

for average cost.

An excluded historical SELL can be more subtle because the later calculation may
still produce a number while using an incomplete history.

The design therefore includes a conservative diagnostic:

```text
TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY
```

The system does not silently restore excluded transactions. Instead, the
affected result can be returned with incomplete status and diagnostics.

This completeness rule affects basis-dependent capital-gain results but does not
automatically invalidate unrelated dividend records.

## 14. Yearly Tax Summary

The yearly summary is also derived rather than persisted.

A request supplies:

```text
year
cost-basis method
```

and uses the user's base currency.

A critical calculation rule is that cost-basis history must not be limited to
the requested year.

For example, a sale in 2026 may depend on a purchase from 2024.

The correct flow is:

```text
load eligible acquisition/disposal history
from the beginning through selected year-end
        |
        v
run FIFO or average cost
        |
        v
filter realized SELL records to selected year
        |
        v
build selected-year dividend records
        |
        v
aggregate yearly summary
```

The proposed yearly summary contains:

```text
year
method
baseCurrency
calculatedAt
isComplete

grossDividends
withholdingTax
netDividends

grossProceeds
grossCostBasis
grossRealizedGain
activityFees
realizedGainAfterActivityFees

dividendCount
disposalCount

detail records
warnings
errors
```

A nullable aggregate represents an unavailable value. A numeric zero represents a
known zero.

This distinction is important for unknown withholding and missing historical FX.

## 15. CSV and PDF Export Architecture

Tax exports are presentation layers over the already calculated yearly tax data.

They do not independently recalculate:

- FIFO;
- average cost;
- withholding;
- historical FX;
- yearly totals.

The export source is conceptually:

```text
YearlyTaxSummary
+ DividendRecord[]
+ TaxRealizedGainRecord[]
+ method-specific trace data
```

### CSV

The CSV design uses one flat typed table with record types:

```text
SUMMARY
DIVIDEND
REALIZED_GAIN
FIFO_MATCH
AVERAGE_COST_EVENT
WARNING
ERROR
```

A FIFO sale that consumes several lots still produces one sale-level
`REALIZED_GAIN` row. Its `FIFO_MATCH` rows are trace records and are not added
again to yearly totals.

The CSV design uses UTF-8, comma delimiters, deterministic row ordering, explicit
currency columns, and empty numeric fields for unavailable values.

### PDF

The PDF design contains:

```text
1. Report Header
2. Annual Tax Summary
3. Dividend and Withholding Detail
4. Realized Capital Gains Detail
5. Cost-Basis Trace Detail
6. Warnings and Errors
7. Report Note
```

Incomplete reports may still be exported, but they must clearly display their
incomplete status and diagnostics.

The export is described as "Ghostfolio Tax Analytics" and not as an official tax
return.

## 16. Existing Ghostfolio Backup Export

The existing Ghostfolio `/export` functionality is a full portfolio
backup/data-portability feature.

It intentionally includes source data that normal analytics may exclude.

Therefore, the new tax CSV/PDF report should remain logically separate from the
general backup export.

However, when the new source fields are implemented, the normal backup/import
round trip should preserve:

```text
withholdingTax
isTaxRelevant
```

so exporting and re-importing a portfolio does not lose tax metadata.

## 17. Error and Diagnostic Strategy

Tax calculations need explicit diagnostics rather than silent fallback values.

Examples include:

```text
MISSING_BASE_CURRENCY_CONVERSION
INSUFFICIENT_OPEN_LOTS
INSUFFICIENT_POOL_QUANTITY
INVALID_QUANTITY
INVALID_UNIT_PRICE
INVALID_FEE
TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY
```

The final shared response format should follow the project's common API
conventions, but warnings/errors must remain traceable to source activities where
possible.

## 18. Traceability

Traceability is a core design requirement.

FIFO can trace a realized sale through:

```text
SELL activity
-> FIFO match
-> source BUY activity
```

Average cost can trace through:

```text
source activity
-> pool state before
-> basis/fee allocation
-> pool state after
```

Yearly summaries preserve the source sale/dividend records, and exports preserve
the same source identifiers and diagnostics.

This allows a reported annual value to be traced back to the transactions that
produced it.

## 19. Integration with Other Project Features

The tax backend is intentionally separated from portfolio health/risk and
performance-chart calculations.

The existing ROAI/performance calculator should not be changed to FIFO simply
because the tax feature supports FIFO. Performance calculations and tax basis are
different concerns.

The unified dashboard can later consume a compact projection from the yearly tax
summary, but the dashboard should not calculate tax values itself.

The React frontend planned for Iteration 3 should also display backend-calculated
results rather than reproducing financial calculations in the browser.

Shared API contracts, numeric serialization, error response style, and dashboard
integration should be coordinated through the team's common architecture work.

## 20. Planned Backend Implementation

Iteration 2 is planned in the following sequence:

```text
Week 1
withholding-tax field and storage

Week 2
FIFO capital-gains engine

Week 3
average-cost engine and tax-lot tracker

Week 4
yearly tax summary
CSV/PDF export
unit tests
```

The implementation should follow the existing Ghostfolio architecture and make
the smallest changes required to add the tax domain.

Likely affected areas include:

```text
prisma/schema.prisma
libs/common/src/lib/dtos/
libs/common/src/lib/interfaces/
apps/api/src/app/activities/
apps/api/src/app/import/
apps/api/src/app/export/
apps/api/src/app/tax/           (proposed)
existing FX and stock-split services
```

Changes to shared architecture should be coordinated before implementation.

## 21. Planned Testing Strategy

Iteration 1 defined the expected test coverage, but application tests were not
implemented as part of the design phase.

Backend tests should verify expected numeric results for:

- dividend withholding: positive, zero, and unknown;
- multiple BUYs and SELLs;
- partial FIFO lot consumption;
- one SELL consuming several FIFO lots;
- average-cost pool changes;
- partial and complete average-cost disposal;
- same-date ordering;
- fractional quantities;
- BUY and SELL fees;
- stock splits;
- missing historical FX;
- insufficient quantity/history;
- tax-relevant exclusions;
- cross-year acquisitions and disposals;
- yearly-summary reconciliation;
- CSV/PDF reconciliation.

Tests should assert exact expected values and diagnostics, not only successful
execution.

## 22. Iteration 1 Outcome

Iteration 1 produced an implementation-ready design for the tax feature without
changing the working Ghostfolio tax/performance behavior prematurely.

The main architecture decisions are:

1. extend the existing `Order` activity model rather than create a second
   transaction system;
2. persist only tax-specific source metadata such as withholding and tax
   relevance;
3. derive FIFO lots, average-cost state, realized gains, yearly summaries, and
   exports from authoritative source activities;
4. share one deterministic normalized input pipeline across FIFO and average
   cost;
5. keep tax calculation logic separate from existing performance calculations;
6. preserve source identifiers, original currencies, and calculation traces;
7. treat missing historical data explicitly instead of silently substituting
   zero or a 1:1 FX rate;
8. make yearly summaries and exports consume the common calculation results
   rather than recalculating independently.

These decisions provide the design baseline for Iteration 2 backend development.

## Design Documents Used for This Section

This report section consolidates the completed Iteration 1 tax documents:

```text
project-docs/iteration-1/tax/transaction-dividend-data-model.md
project-docs/iteration-1/tax/withholding-tax-schema.md
project-docs/iteration-1/tax/fifo-capital-gains-spec.md
project-docs/iteration-1/tax/average-cost-capital-gains-spec.md
project-docs/iteration-1/tax/tax-lot-data-model.md
project-docs/iteration-1/tax/yearly-tax-summary-data-structure.md
project-docs/iteration-1/tax/tax-relevant-filtering-spec.md
project-docs/iteration-1/tax/tax-export-format-spec.md
```

No backend tax functionality is claimed as implemented in this Iteration 1
report section.
