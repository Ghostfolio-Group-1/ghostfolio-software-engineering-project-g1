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

Ghostfolio's normal analysis eligibility excludes draft activities, activities tagged to be excluded from analysis, and activities in excluded accounts. Tax calculations then apply the additional `isTaxRelevant = true` requirement.

The mixed-history diagnostic is narrower than those normal analysis exclusions. It first loads BUY and SELL activities that already satisfy Ghostfolio's normal analysis eligibility, then checks whether any of those activities have:

```text
isTaxRelevant = false
```

Therefore, `TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY` currently detects tax-relevance exclusions only. Draft activities, activities tagged exclude-from-analysis, and activities in excluded accounts are removed before this diagnostic is evaluated and do not themselves trigger this diagnostic.

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

A known zero withholding amount is different from an unknown amount:

```text
0    = known zero
null = unknown
```

The source activity fee is not treated as withholding tax.

`withholdingTaxRate` is not part of the current `DividendRecord` or `YearlyTaxSummary` contract. The CSV schema reserves a `withholdingTaxRate` column, but the serializer leaves it empty rather than deriving a new tax value.

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

There is no special BUY-before-SELL override. If a SELL and the BUY that would provide its holdings have the same timestamp and the SELL ID sorts first, the SELL is processed first and can fail with an insufficient-holdings error.

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

Method values are case-sensitive. Values such as `fifo` or `average_cost` are not normalized and result in an unsupported-method error.

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

DIVIDEND activity fees remain visible on individual dividend records and export rows. They are not included in yearly `totalActivityFees` or currency-summary `allocatedFees` totals. Those aggregate fee values currently represent BUY and SELL fees allocated to realized disposals.

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

All base-currency fields on a realized-gain row use the SELL date, including:

```text
gross proceeds
gross cost basis
gross realized gain
allocated activity fees
realized gain after activity fees
```

This is an Iteration 2 reporting convention, not an acquisition-date FX rule. For positions acquired on an earlier date, historical FX movement between the acquisition date and SELL date is therefore not separately reflected in the base-currency cost basis.

If:

```text
transactionCurrency == baseCurrency
```

the conversion rate is:

```text
1
```

If a required historical conversion cannot be obtained, the affected base-currency value remains unavailable instead of becoming zero.

The summary then contains an error diagnostic and is marked incomplete.

## Completeness and Diagnostics

Tax calculations distinguish between a valid zero and unavailable information.

The yearly summary always exposes:

```text
isComplete
warnings
errors
```

Current yearly-summary warning and diagnostic codes include:

```text
UNKNOWN_DIVIDEND_WITHHOLDING
PARTIAL_REALIZED_GAIN_RESULT
TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY
```

Current yearly-summary error codes include:

```text
MISSING_DIVIDEND_BASE_CURRENCY_CONVERSION
MISSING_REALIZED_GAIN_BASE_CURRENCY_CONVERSION
```

Examples of conditions that can make a yearly summary incomplete include:

- unknown dividend withholding;
- missing historical base-currency conversion;
- tax-relevance-excluded BUY or SELL history that may affect basis-dependent calculations;
- partially matched realized-gain information where applicable.

Known transaction-currency values are preserved even when a corresponding base-currency value is unavailable.

For the public `/tax/realized-gains` and `/tax/lots` responses, completeness is represented differently.

When no mixed-history diagnostic exists, `isComplete` and `diagnostics` are omitted.

When a mixed-history diagnostic exists, the response adds:

```text
isComplete: false
diagnostics: [...]
```

with the current diagnostic code:

```text
TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY
```

## Tax-Relevant Filtering

Only activities explicitly marked:

```text
isTaxRelevant = true
```

are included in tax calculations.

This condition is applied in addition to Ghostfolio's existing account and analysis exclusions.

The mixed-history diagnostic checks only normally eligible BUY and SELL activity with `isTaxRelevant = false` in the same tax scope before or at a tax-relevant SELL.

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

It does not recalculate FIFO, average cost, withholding, FX, or yearly totals.

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

Two reserved columns currently remain intentionally empty:

```text
withholdingTaxRate
assetCurrency
```

`withholdingTaxRate` remains empty because the authoritative tax-domain summary does not expose a withholding-rate value.

`assetCurrency` remains empty because the yearly tax summary does not currently provide an authoritative asset-currency value.

The serializer does not guess or independently derive either field.

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

PDF decimal formatting uses `Big#toFixed()` rather than `Big#toString()` so very small values remain plain decimal strings instead of switching to exponential notation.

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

CSV and PDF presentation values use plain decimal serialization.

## Current HTTP API

The authenticated Tax controller exposes four public GET endpoints. All
require the `portfolio:read` scope and use the signed-in or impersonated user:

```text
GET /api/v1/tax/lots
GET /api/v1/tax/realized-gains?method=FIFO
GET /api/v1/tax/dividends?year=YYYY
GET /api/v1/tax/yearly-summary?year=YYYY&method=FIFO
```

The method is optional for realized gains and yearly summaries; omitted method
defaults to `FIFO`. These are the implemented HTTP endpoints, not merely backend
service methods. No public Tax CSV/PDF download routes are exposed yet.

Realized gains support:

```text
GET /api/v1/tax/realized-gains?method=FIFO
GET /api/v1/tax/realized-gains?method=AVERAGE_COST
```

If `method` is omitted, FIFO is used.

Method values are case-sensitive. The accepted values are exactly:

```text
FIFO
AVERAGE_COST
```

Values such as `fifo` or `average_cost` are not normalized and result in an unsupported-method error.

The tax-lot endpoint currently represents FIFO acquisition lots; the UI
disables average-cost selection for this view. Realized gains and yearly
summaries support both FIFO and AVERAGE_COST calculations.

The yearly-summary endpoint requires `year=YYYY` (UTC calendar year 1970–2100)
and accepts only `method=FIFO` or `method=AVERAGE_COST`. A missing, malformed,
or out-of-range year or invalid method returns HTTP `400` with
`TAX_INVALID_QUERY`. A calculation failure returns HTTP `422` with
`TAX_YEARLY_SUMMARY_FAILED`. The response includes yearly totals, currency
summaries, dividend records, realized-gain rows, completeness indicators,
warnings and errors. Financial amounts remain decimal strings or `null` if
unavailable; counts and the year are numbers.

The dividend endpoint requires an explicit integer UTC calendar year
(`1970`–`2100`, inclusive; no default). A missing, malformed, or out-of-range
year returns HTTP `400` with code `TAX_INVALID_QUERY`. It returns
`data.records[]` with source activity IDs, stored ISO UTC timestamps,
transaction currency, gross dividend, withholding, net dividend, and activity
fees. Tax amounts are decimal strings; unknown withholding and net remain
`null`, and known zero stays `"0"`. The endpoint uses `portfolio:read`
and the same tax-relevant, non-draft and non-excluded dividend filters as the
yearly summary. Year boundaries are UTC `[Jan 1, next Jan 1)`. React displays
`date.slice(0, 10)` without local-time conversion. Unexpected failures are
logged server-side, with the generic `TAX_DIVIDENDS_FAILED` envelope returned
to clients.

All four endpoints use Ghostfolio's shared API envelope.

Successful responses have the form:

```text
data: <tax response>
error: null
meta: {}
```

Calculation failures return HTTP `422 Unprocessable Entity` with:

```text
data: null
error:
  code: <tax error code>
  message: <error message>
meta: {}
```

Endpoint error codes are:

```text
TAX_REALIZED_GAINS_FAILED
TAX_LOTS_FAILED
TAX_DIVIDENDS_FAILED
TAX_YEARLY_SUMMARY_FAILED
TAX_INVALID_QUERY (HTTP 400, invalid dividend year or yearly-summary query)
```

The response schemas are the source of truth for the current HTTP contracts:

- [`contracts/tax-realized-gains.schema.ts`](./contracts/tax-realized-gains.schema.ts)
- [`contracts/tax-lots.schema.ts`](./contracts/tax-lots.schema.ts)
- [`contracts/tax-dividends.schema.ts`](./contracts/tax-dividends.schema.ts)
- [`contracts/tax-yearly-summary.schema.ts`](./contracts/tax-yearly-summary.schema.ts)

The yearly-summary HTTP response is serialized by
`tax-yearly-summary.serializer.ts` from the backend's decimal-safe domain
result. The `TaxExport` and PDF export services generate CSV/PDF content from
authoritative yearly results, but no public Tax CSV/PDF HTTP download routes
or working browser-download controls are available yet (Issue #190). Do not
represent these service methods as downloadable API endpoints.

## Known Limitations

### Mixed-Currency Cost-Basis Calculations

Historical base-currency conversion is implemented for yearly summary values.

The FIFO and average-cost cost-basis engines do not currently normalize different transaction currencies before calculating basis.

FIFO requires compatible BUY and SELL transaction currencies.

Average cost requires activities within one pool to use a compatible transaction currency.

If conversion would be required, the engines fail explicitly rather than assuming a conversion rate or silently using `1:1`.

Adding pre-calculation historical FX normalization is future work and was not added during the Iteration 2 code-freeze documentation task.

### Equal-Timestamp BUY/SELL Ordering

There is no special BUY-before-SELL override.

Activities with the same timestamp are ordered by activity ID. If a SELL ID sorts before the BUY that would provide its holdings, the SELL is processed first and can fail with an insufficient-holdings error.

This behavior is deterministic but is not an execution-sequence reconstruction or jurisdiction-specific ordering rule.

### Reserved Tax Export Fields

The CSV currently reserves:

```text
withholdingTaxRate
assetCurrency
```

Both remain empty because authoritative upstream values are not present in the current yearly tax-domain model.

### Realized-Gain Base-Currency FX Convention

All base-currency values on one realized-gain row use the SELL-date historical exchange rate.

This keeps the row internally reconcilable, but it does not apply a separate acquisition-date FX rate to cost basis.

### Asset Identity in Realized-Gain Export Data

Yearly realized-gain rows now retain the SELL activity ID and the upstream
`accountId` and `symbolProfileId` where available. The fields remain nullable
for supported historical/legacy cases; CSV/PDF serializers preserve source
identity rather than inventing missing asset identifiers. See the yearly-summary
response interface and export tests. This was improved in Tax PR #277.

### Jurisdiction Rules

The module intentionally does not determine:

- legal tax-lot selection requirements;
- jurisdiction-specific taxable-gain adjustments;
- statutory tax rates;
- wash-sale rules;
- official filing-form values.

The implemented results are portfolio tax analytics.

## Testing

Financial calculations are backend-authoritative and decimal-safe. The React
TaxWorkspace is mounted at `/en/portfolio/tax` through the shared authenticated
request adapter. Its four API-backed views are Tax lots, Realized gains,
Dividend withholding and Yearly summary. Screens have loading, success, error
and empty-state component tests; UI financial fields use API decimal strings,
not JavaScript floating-point tax calculations. The lot-status filter supports
open/all lots; it is **not** a tax-relevance selector (Issue #242).

Run tests from the repository root. In Windows PowerShell use `npx.cmd`, not
`npx`/`npm` when execution policy blocks the `.ps1` shims:

```powershell
# Backend Tax numeric, controller, and export tests
npx.cmd jest --config apps/api/jest.config.ts apps/api/src/app/tax --runInBand --testTimeout=15000

# React unit/component tests (includes shared features)
npx.cmd jest --config libs/react-ui/jest.config.ts --runInBand

# Live authenticated UI-to-API integration (running disposable demo API required)
docker compose -f docker/docker-compose.demo.yml ps
$env:INTEGRATION_API_URL = 'http://localhost:3333'
npx.cmd jest -c libs/react-ui/jest.integration.config.ts --runInBand

# Real Chromium browser tests with existing synthetic demo users seeded
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:3333'
npx.cmd playwright test -c e2e/playwright.config.ts --project=chromium
```

For live tests, the Docker demo API must be healthy and use a disposable,
pre-seeded database. The `demo-risk-empty` and `demo-risk-rich` browser accounts
are **synthetic only**. The React integration suite skips without
`INTEGRATION_API_URL`; inspect the reported test count, not just exit status.
The browser suite checks actual authenticated API responses and does not mock
Tax routes. The Tax browser journey does **not** cover CSV/PDF downloads, which
are still blocked (Issue #190).

Repository checks and full-project unit coverage can be run separately:

```powershell
# These run independently of the demo Docker services
npx.cmd nx run api:lint
npx.cmd nx format:check
npx.cmd nx run api:build
git diff --check

# Full-project coverage uses Nx and Jest. Run only on a stable machine.
# Nx --parallel=1 does not constrain Jest's worker processes.
```

On November 20, 2026 the local full-project coverage attempt was **not green**:
`api:test` had one 5-second Dashboard E2E timeout, while other projects
passed. A diagnostic single-worker retest and full lint/build verification
were deferred after repeated workstation crashes. Do not treat local test
passes as equivalent to green `main` CI. Evidence and exact counts:
[`docs/testing/tax/2026-11-20-regression.md`](../../../../../docs/testing/tax/2026-11-20-regression.md).

For the Tax browser test and seeding prerequisites, see
[`docs/testing/tax/2026-11-19-browser-e2e.md`](../../../../../docs/testing/tax/2026-11-19-browser-e2e.md).

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
