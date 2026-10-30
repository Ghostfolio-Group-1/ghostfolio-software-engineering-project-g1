# Tax Metrics and Tax Calculations — Iteration 2

**Owner:** Tharun Swaminathan
**Iteration:** 2 — Backend Development
**Period:** October 2–29, 2026

## 1. Objective and Scope

The objective of the tax work in Iteration 2 was to convert the tax design from Iteration 1 into a deterministic, traceable, and testable backend implementation.

The work focused on portfolio tax analytics rather than jurisdiction-specific tax filing rules. The completed backend covers withholding tax and dividend records, FIFO and average-cost capital-gain calculations, derived tax lots, tax-relevant activity filtering, yearly tax summaries, and CSV/PDF reporting.

Financial calculation logic was kept separate from the user interface and export rendering layers. This was important because the same calculated result can later be reused by the React frontend without duplicating tax calculations.

## 2. Tax Decision Gate

Tax implementation did not begin until the open design questions from Iteration 1 were resolved.

DR-1 through DR-6 defined the behavior for:

- unknown versus known-zero withholding tax;
- transaction and reporting currency handling;
- deterministic same-date activity ordering;
- BUY and SELL fee treatment;
- average-cost pool scope;
- decimal-safe calculation and rounding behavior.

DR-1 through DR-3 were closed through PR #48, and DR-4 through DR-6 were closed through PR #59.

Closing these decisions before implementation reduced the risk of different parts of the tax module applying inconsistent financial rules.

The final as-built behavior was reconciled with these decisions again at the Oct 28 code freeze in PR #164.

## 3. Withholding Tax and Dividend Records

The first implementation stage added a nullable `withholdingTax` value to the existing Ghostfolio activity model rather than creating a separate dividend-tax table.

The implementation preserves an important distinction:

```text
withholdingTax = 0
```

means withholding is known to be zero, while:

```text
withholdingTax = null
```

means the withholding value is unknown.

This prevents missing financial information from being silently treated as zero.

For a dividend activity, gross dividend is calculated as:

```text
grossDividend = quantity × unitPrice
```

When withholding is known:

```text
netDividend = grossDividend - withholdingTax
```

When withholding is unknown, the net dividend also remains unavailable.

The activity fee is stored and reported separately from withholding tax.

The schema and DTO support were introduced in PR #72, persistence and validation were added in PR #80, and the derived `DividendRecord` calculation was added in PR #86.

## 4. FIFO Cost Basis and Realized Gains

FIFO was implemented as a derived calculation over existing BUY and SELL activities.

Activities are processed deterministically using:

```text
1. activity date/time ascending
2. activity ID ascending
```

Acquisition lots are created from BUY activities and consumed chronologically when SELL activities are processed.

The FIFO calculation scope is:

```text
userId + accountId + symbolProfileId
```

This prevents a sale from consuming a lot belonging to another user, account, or asset.

The implementation supports partial lot consumption and sales that span more than one acquisition lot. It also keeps the source BUY and SELL activity IDs so each result can be traced back to the transactions that produced it.

For each matched quantity:

```text
grossRealizedGain =
    grossProceeds
    - grossAcquisitionValue
```

The fee-adjusted result is calculated separately:

```text
realizedGainAfterActivityFees =
    grossRealizedGain
    - allocatedBuyFee
    - allocatedSellFee
```

BUY and SELL fees are allocated proportionally. Any decimal allocation residual is reconciled on the final allocation so the allocated total remains equal to the original source fee.

One numeric test case used during development was:

```text
BUY 100 @ 10, fee 2
BUY 50 @ 12, fee 1
SELL 120 @ 15, fee 3
```

The FIFO calculation produces:

```text
gross cost basis = 1240
gross proceeds = 1800
gross realized gain = 560
allocated BUY fees = 2.4
allocated SELL fee = 3
realized gain after fees = 554.6
remaining quantity in second lot = 30
```

FIFO ordering and initial lots were implemented in PR #92, partial lot consumption in PR #98, realized gains in PR #104, and edge-case handling in PR #109.

The final implementation explicitly reports insufficient holdings rather than silently dropping unmatched SELL quantities.

## 5. Average-Cost Calculation

Average cost was implemented as an alternative capital-gain method while keeping its calculation engine separate from FIFO.

The average-cost pool is scoped by:

```text
userId + symbolProfileId
```

Account ID is intentionally not part of the pool key. Therefore, the same user's holdings of the same asset across multiple accounts participate in one average-cost pool.

The pool tracks:

```text
quantity
grossCost
acquisitionFeePool
sourceActivityIds
```

BUY activities increase the pool. SELL activities reduce quantity, gross cost, and acquisition fees proportionally.

A full liquidation resets the remaining gross cost and acquisition-fee pool exactly to zero.

A representative tested example was:

```text
BUY 10 @ 100, fee 10
BUY 10 @ 200, fee 20
SELL 5 @ 250, fee 5
```

The result is:

```text
gross proceeds = 1250
gross cost basis = 750
gross realized gain = 500
allocated acquisition fees = 7.5
SELL fee = 5
realized gain after fees = 487.5
remaining quantity = 15
remaining gross cost = 2250
remaining acquisition-fee pool = 22.5
```

The running pool was implemented in PR #120 and average-cost realized gains in PR #126.

PR #132 then added a shared calculator boundary supporting:

```text
FIFO
AVERAGE_COST
```

FIFO remains the default when no method is supplied.

## 6. Tax-Lot Tracking and Tax-Relevant Filtering

PR #139 added a derived tax-lot tracker using the existing FIFO engine.

Tax-lot states are:

```text
OPEN
PARTIALLY_CONSUMED
CLOSED
```

The tracker preserves original quantities, consumed quantities, remaining quantities, acquisition information, and related source activity IDs.

A backend tax-lot endpoint was also added so the derived lot state can be retrieved without introducing a second persisted source of truth.

PR #147 added the `isTaxRelevant` activity flag.

Tax analytics require:

```text
Ghostfolio normal analysis eligibility
AND
isTaxRelevant = true
```

The flag applies only to tax analytics and does not modify normal portfolio calculations.

An additional diagnostic detects normally eligible BUY or SELL history that was excluded specifically through `isTaxRelevant = false` and may make later cost-basis calculations incomplete.

Instead of silently returning a complete-looking result, the API can report that the tax scope contains excluded investment history.

## 7. Yearly Tax Summary

PR #148 added the yearly tax summary.

For a requested year, the summary aggregates:

- gross dividends;
- withholding tax;
- net dividends;
- gross sale proceeds;
- gross cost basis;
- gross realized gains;
- allocated activity fees;
- realized gain after activity fees;
- dividend count;
- disposal count.

FIFO and average-cost results are both supported.

Historical BUY activity from earlier years is retained when required to determine the cost basis of a disposal occurring in the selected year.

The yearly summary also uses Ghostfolio's existing historical exchange-rate service for base-currency reporting.

Dividend values use the dividend activity date.

For a realized-gain row, Iteration 2 converts its base-currency values using the SELL date. This includes proceeds, cost basis, realized gain, allocated fees, and fee-adjusted realized gain.

If a required historical rate cannot be obtained, the value remains unavailable rather than being replaced with zero. The summary is then marked incomplete and includes an error diagnostic.

This preserves the difference between a genuine numeric zero and unavailable information.

## 8. CSV and PDF Export

PR #152 added deterministic CSV generation from the existing yearly summary and trace results.

The CSV layer does not independently recalculate FIFO, average cost, withholding, FX conversion, or yearly totals.

Supported row types include:

```text
SUMMARY
DIVIDEND
REALIZED_GAIN
FIFO_MATCH
AVERAGE_COST_EVENT
WARNING
ERROR
```

The output uses deterministic row and column ordering, preserves null versus zero values, and serializes decimals as plain decimal strings.

PR #159 added deterministic PDF reporting using `pdf-lib@1.17.1`.

The PDF includes the yearly summary, dividend details, realized gains, FIFO or average-cost trace information, warnings, errors, and report notes.

Like the CSV exporter, the PDF renderer consumes authoritative calculated results rather than duplicating financial calculations.

Unknown values are displayed as `Not available`, while fields that do not apply are displayed as `Not applicable`.

This keeps both cases distinct from numeric zero.

## 9. Decimal Safety and Traceability

Financial calculations use `Big` decimal arithmetic.

No presentation rounding is fed back into FIFO, average-cost, dividend, fee-allocation, or yearly-summary calculations.

The implementation also keeps financial outputs traceable to source activities wherever practical.

Traceability includes values such as:

- BUY activity IDs;
- SELL activity IDs;
- dividend activity IDs;
- acquisition dates;
- disposal dates;
- tax-lot usage;
- before/after average-cost pool state;
- excluded activity IDs used in incomplete-result diagnostics.

These choices make the calculation results easier to test and investigate.

## 10. Testing and Validation

Every financial calculation was accompanied by numeric test coverage.

The completed tax tests cover normal cases and edge conditions including:

- known-zero and unknown withholding;
- dividend gross/net calculations;
- partial FIFO sales;
- one sale consuming multiple lots;
- fee allocation and residual reconciliation;
- fractional quantities;
- insufficient holdings;
- same-timestamp activity ordering;
- realized losses;
- unknown and incompatible currencies;
- average-cost pool updates;
- full liquidation and re-entry;
- cross-account average-cost behavior;
- tax-relevant filtering;
- incomplete-result diagnostics;
- yearly aggregation;
- CSV reconciliation;
- PDF reconciliation and deterministic metadata.

Before the Oct 29 Sprint Review, the complete tax suite was rerun locally:

```text
Test Suites: 16 passed, 16 total
Tests:       218 passed, 218 total
Snapshots:   0 total
Time:        15.939 s
```

The final Iteration 2 backend integration pass also recorded:

```text
E2E suites: 4 / 4 passed
E2E tests: 47 / 47 passed

API suites: 93 passed, 1 skipped
API tests: 641 passed, 1 skipped
```

The skipped API test is an existing upstream Ghostfolio placeholder and was not recorded as an Iteration 2 feature failure.

The API build also completed successfully, and the integration freeze commit had successful GitHub CI results for build, unit tests, lint/format, and locale extraction.

## 11. Known Limitations

The final documentation records the current limitations instead of presenting incomplete functionality as finished.

The main Iteration 2 limitations are:

- `withholdingTaxRate` is not currently part of the authoritative dividend/yearly-summary model;
- the reserved CSV `withholdingTaxRate` column is therefore empty;
- authoritative `assetCurrency` is not available in the current yearly export model, so that reserved CSV field also remains empty;
- FIFO and average-cost engines do not perform historical FX normalization before their internal cost-basis calculations;
- incompatible or unknown calculation currencies fail explicitly rather than assuming an exchange rate;
- realized-gain base-currency reporting currently uses the SELL-date rate for cost basis as well as proceeds;
- same-timestamp ordering does not force BUY before SELL;
- if a SELL sorts before its supporting BUY at the same timestamp, an insufficient-holdings error can occur;
- yearly summary, CSV export, and PDF export are currently backend service/domain functionality rather than public download endpoints;
- jurisdiction-specific tax filing rules remain outside the project scope.

These limitations are documented for future work rather than hidden through fallback assumptions.

## 12. Iteration 2 Outcome

The planned Iteration 2 tax backend scope was completed through the Oct 28 code freeze and prepared for Sprint Review on Oct 29.

The implementation provides reusable backend services for dividend and withholding analytics, FIFO and average-cost realized gains, tax lots, tax filtering, yearly summaries, and deterministic reporting.

The backend calculation layer is now separated from presentation concerns and can be reused by the React tax screens planned for Iteration 3.

The Oct 29 Sprint Review result and any reviewer feedback will be added after the scheduled review.
