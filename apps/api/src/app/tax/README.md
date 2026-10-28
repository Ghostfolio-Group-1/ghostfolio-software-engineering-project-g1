# Tax Analytics Backend

This directory contains the backend tax analytics implementation added for the Ghostfolio extension project.

The module provides deterministic and traceable tax-related analytics for dividends, withholding tax, realized capital gains, tax lots, yearly summaries, and CSV/PDF reporting.

The implementation is intended for portfolio analytics and record review. It does not implement jurisdiction-specific tax filing rules and must not be treated as personal tax advice.

## Main Responsibilities

The tax backend currently supports:

- dividend and withholding-tax records;
- FIFO cost-basis calculation;
- FIFO tax-lot tracking;
- average-cost calculation;
- realized-gain calculation;
- tax-relevant activity filtering;
- yearly tax summaries;
- historical base-currency conversion for yearly summaries;
- CSV tax export;
- PDF tax export;
- warnings and diagnostics for incomplete results.

Financial calculations are kept outside the UI and export renderers.

## Architecture

The tax implementation is kept inside:

```text
apps/api/src/app/tax/
```

The main responsibilities are separated as follows.

### Data Access

`tax-data.service.ts`

Loads activities needed by the tax feature.

Tax activities must satisfy both:

```text
Ghostfolio's normal analysis rules
AND
isTaxRelevant = true
```

Draft activities, activities excluded from analysis, and activities in excluded accounts are not silently included in tax calculations.

The data service also detects mixed tax history where excluded BUY or SELL activities may make a later tax calculation incomplete.

### Dividend Records

`dividend-record.ts`

Creates a tax-domain dividend record from a Ghostfolio DIVIDEND activity.

The main values remain separate:

```text
grossDividend
withholdingTax
netDividend
activityFee
```

Gross dividend is calculated as:

```text
grossDividend = quantity × unitPrice
```

If withholding is known:

```text
netDividend = grossDividend - withholdingTax
```

If withholding is unknown:

```text
withholdingTax = null
netDividend = null
```

A known zero withholding amount is different from an unknown amount.

```text
0    = known zero
null = unknown
```

The source activity fee is not treated as withholding tax.

### FIFO Tax Lots

`fifo-tax-lot.ts`

FIFO uses acquisition lots created from BUY activities.

The calculation scope is:

```text
userId
+ accountId
+ symbolProfileId
```

A SELL therefore cannot consume a lot from:

- another user;
- another account;
- another asset.

Lots are consumed chronologically.

Tax activities are ordered by:

```text
1. activity date/time ascending
2. activity ID ascending
```

The second rule provides deterministic behavior when activities have exactly the same timestamp.

FIFO lot states include:

```text
OPEN
PARTIALLY_CONSUMED
CLOSED
```

The lot tracker keeps source activity IDs and related SELL activity IDs so lot usage remains traceable.

### FIFO Realized Gains

`fifo-realized-gain.ts`

FIFO realized-gain calculation keeps gross values and fees separate.

For each matched quantity:

```text
grossRealizedGain =
    grossProceeds
    - grossAcquisitionValue
```

The fee-adjusted analytics value is:

```text
realizedGainAfterActivityFees =
    grossRealizedGain
    - allocatedBuyFee
    - allocatedSellFee
```

BUY and SELL fees are allocated proportionally.

When the last allocation for a source activity is processed, any decimal residual is assigned to that final allocation so allocated fee totals reconcile with the original source fee.

A SELL that exceeds available holdings produces an explicit error instead of silently dropping unmatched quantity.

### Average Cost

`average-cost.ts`

`average-cost-realized-gain.ts`

Average cost maintains a running pool scoped by:

```text
userId
+ symbolProfileId
```

Account ID is intentionally not part of the average-cost pool key.

The pool tracks:

```text
quantity
grossCost
acquisitionFeePool
sourceActivityIds
```

BUY activities increase the pool.

SELL activities reduce the pool proportionally.

For realized gains:

```text
grossRealizedGain =
    grossProceeds
    - grossCostBasis
```

and:

```text
realizedGainAfterActivityFees =
    grossRealizedGain
    - allocatedAcquisitionFees
    - sellFee
```

The calculation uses the actual before/after pool transition rather than independently recalculating the cost reduction in another layer.

After full liquidation, remaining cost and acquisition-fee pool values are reset exactly to zero.

### Calculation Method Selection

`tax-calculator.ts`

The shared calculator boundary supports:

```text
FIFO
AVERAGE_COST
```

FIFO remains the default method when no method is supplied.

The calculation engines remain separate while sharing the same service boundary.

## Fees

Attached BUY and SELL activity fees are kept separate from gross proceeds and gross cost basis.

The tax module therefore distinguishes:

```text
gross cost basis
gross sale proceeds
gross realized gain
activity fees
realized gain after activity fees
```

Standalone FEE activities are not automatically assigned to a BUY or SELL because the existing source model does not provide an authoritative link between that fee and a specific trade.

The software does not guess such a relationship.

## Yearly Tax Summary

`yearly-tax-summary.ts`

The yearly summary combines:

- dividend records;
- withholding values;
- realized gains;
- activity fees;
- base-currency conversions;
- source diagnostics.

The summary includes:

```text
gross dividends
withholding tax
net dividends
gross sale proceeds
gross cost basis
gross realized gain
activity fees
realized gain after activity fees
dividend count
disposal count
```

Results are also retained by transaction currency.

Only records belonging to the requested UTC year are included.

### Base-Currency Conversion

The yearly summary uses Ghostfolio's existing historical exchange-rate service.

Dividend values use the DIVIDEND activity date.

Realized-gain summary values use the SELL date.

If:

```text
transactionCurrency == baseCurrency
```

the conversion rate is:

```text
1
```

If a required historical conversion cannot be obtained, the affected base-currency value remains unavailable instead of becoming zero.

The summary then contains a diagnostic and is marked incomplete.

## Completeness and Diagnostics

Tax calculations distinguish between a valid zero and unavailable information.

Examples of conditions that can make a result incomplete include:

- unknown dividend withholding;
- missing historical base-currency conversion;
- excluded BUY or SELL history that may affect basis-dependent calculations;
- partially matched realized-gain information where applicable.

Results expose:

```text
isComplete
warnings
errors
```

Known transaction-currency values are preserved even when a corresponding base-currency value is unavailable.

## Tax-Relevant Filtering

Only activities explicitly marked:

```text
isTaxRelevant = true
```

are included in tax calculations.

This condition is applied in addition to Ghostfolio's existing account and analysis exclusions.

The mixed-history diagnostic checks whether excluded investment activity exists in the same relevant tax scope before or at a taxable SELL.

For FIFO, scope includes:

```text
user + account + asset
```

For average cost, scope includes:

```text
user + asset
```

## CSV Export

`tax-export.ts`

CSV export consumes existing yearly tax results and method-specific trace data.

It does not recalculate FIFO, average cost, withholding, or yearly totals.

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

The output uses a fixed column order and deterministic row ordering.

Unknown values are emitted as empty fields rather than being converted to zero.

Decimal values are serialized as plain decimal strings.

The filename format is:

```text
ghostfolio-tax-<year>-<method>.csv
```

## PDF Export

`tax-pdf-report.ts`

`tax-pdf-export.ts`

PDF export uses the same authoritative yearly summary and trace information rather than performing financial calculations inside the renderer.

The report contains:

1. report metadata;
2. yearly tax summary;
3. dividend details;
4. realized-gain details;
5. FIFO or average-cost trace information;
6. warnings and errors;
7. report note.

The renderer uses:

```text
pdf-lib 1.17.1
```

The dependency is pinned exactly.

PDF metadata dates are supplied deterministically from the report generation date rather than from the current system time.

Unknown values use:

```text
Not available
```

Fields that do not apply use:

```text
Not applicable
```

These are kept distinct from numeric zero.

The filename format is:

```text
ghostfolio-tax-<year>-<method>.pdf
```

## Numeric Precision

Tax calculation values use `Big` decimal arithmetic.

Relevant values include:

- quantity;
- unit price;
- proceeds;
- cost basis;
- withholding;
- fees;
- FIFO allocations;
- average-cost pool values;
- realized gains;
- converted tax values.

Intermediate tax calculations are not rounded for presentation.

Rounded or formatted presentation values are never fed back into later financial calculations.

Exports preserve calculated decimal values as strings.

## Current HTTP API

The live tax controller currently exposes:

```text
GET /api/v1/tax/realized-gains
GET /api/v1/tax/lots
```

Realized gains support:

```text
GET /api/v1/tax/realized-gains?method=FIFO
GET /api/v1/tax/realized-gains?method=AVERAGE_COST
```

If `method` is omitted, FIFO is used.

The tax-lot endpoint currently represents FIFO tax lots.

Yearly-summary, CSV-export, and PDF-export functionality exists in the tax service/domain layer but is not currently exposed through separate public HTTP endpoints.

Those integrations belong to later application/frontend work rather than the Iteration 2 backend calculation implementation.

## Known Limitations

### Mixed-Currency Cost-Basis Calculations

Historical base-currency conversion is implemented for yearly summary values.

The FIFO and average-cost cost-basis engines do not currently normalize different transaction currencies before calculating basis.

FIFO requires compatible BUY and SELL transaction currencies.

Average cost requires activities within one pool to use a compatible transaction currency.

If conversion would be required, the engines fail explicitly rather than assuming a conversion rate or silently using `1:1`.

Adding pre-calculation historical FX normalization is future work and was not added during the Iteration 2 code-freeze documentation task.

### Asset Identity in Realized-Gain Export Data

Current yearly realized-gain records primarily retain SELL activity identity and calculation trace information.

They do not yet contain a complete asset-identity contract equivalent to the dividend record.

This should be extended upstream rather than guessed inside CSV or PDF serializers.

### Jurisdiction Rules

The module intentionally does not determine:

- legal tax-lot selection requirements;
- jurisdiction-specific taxable-gain adjustments;
- statutory tax rates;
- wash-sale rules;
- official filing-form values.

The implemented results are portfolio tax analytics.

## Testing

Financial calculations have numeric unit tests covering normal cases and important edge conditions.

To run the tax test suite:

```powershell
npx jest --config apps/api/jest.config.ts apps/api/src/app/tax --runInBand
```

Repository checks used during Iteration 2 include:

```powershell
npx nx run api:lint
npx nx format:check
npx nx run api:build
git diff --check
```

Do not claim a check passed unless its command was actually run successfully for the relevant change.

## Decision Record

The authoritative Iteration 2 tax decisions are documented in:

```text
project-docs/iteration-2/tax-decision-record.md
```

DR-1 through DR-6 define:

```text
DR-1  withholding/net-dividend nullability
DR-2  currency handling
DR-3  deterministic activity ordering
DR-4  fee treatment
DR-5  average-cost pool scope
DR-6  decimal-safe precision and rounding
```
