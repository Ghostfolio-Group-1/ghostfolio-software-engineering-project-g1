# Tax Decision Record — DR-1 to DR-3

**Owner:** Tharun Swaminathan
**Iteration:** 2 — Backend Development
**Date:** October 2, 2026
**Issue:** #45 — Close DR-1–3 and create Scrum notes template
**Status:** Approved for implementation planning
**Scope:** Tax behavior decisions only; no backend code in this document

## Purpose

Iteration 1 left several tax behaviors that had to be made explicit before backend implementation could begin. This record closes DR-1 through DR-3:

- DR-1 — net-dividend nullability
- DR-2 — currency handling
- DR-3 — same-date ordering tie-breaker

The decisions below are based on the completed Iteration 1 tax specifications and the current Ghostfolio activity model.

Tax coding remains gated until DR-4 through DR-6 are also closed on Oct 5.

## DR-1 — Net-Dividend Nullability

### Question

What should `netDividend` contain when the source dividend has no known withholding-tax value?

Relevant source states:

```text
withholdingTax = null
withholdingTax = 0
withholdingTax > 0
```

### Decision

`netDividend` is nullable.

```text
grossDividend = quantity × unitPrice
```

If:

```text
withholdingTax = null
```

then:

```text
netDividend = null
withholdingTaxRate = null
```

If:

```text
withholdingTax = 0
```

then:

```text
netDividend = grossDividend
withholdingTaxRate = 0
```

If:

```text
withholdingTax > 0
```

then:

```text
netDividend = grossDividend - withholdingTax
```

and, when `grossDividend > 0`:

```text
withholdingTaxRate = withholdingTax / grossDividend
```

### Meaning

The design distinguishes:

```text
null = unknown
0 = known zero
```

A historical or imported dividend with no withholding information must not be reported as though the system knows that no tax was withheld.

### Rationale

Treating unknown withholding as zero would create a false tax result.

Example:

```text
grossDividend = 100 USD
withholdingTax = null
```

Correct tax-reporting result:

```text
grossDividend = 100 USD
withholdingTax = null
netDividend = null
```

The gross dividend remains known even when the net value is not.

### Consequences

- `netDividend` must be nullable in tax-domain result interfaces.
- yearly net-dividend totals can become unavailable/incomplete when source withholding is unknown;
- exports must preserve the difference between unknown and zero;
- frontend code must not render `null` as `0`.

### Implementation Impact

The future `DividendRecord` keeps:

```text
grossDividend
withholdingTax
withholdingTaxRate
netDividend
```

as separate values.

Only the withholding amount is persisted. `netDividend` and `withholdingTaxRate` are derived.

The existing activity `fee` remains separate.

### Test Impact

At minimum, cover:

```text
gross = 100, withholding = 15 -> net = 85
gross = 100, withholding = 0  -> net = 100
gross = 100, withholding = null -> net = null, rate = null
```

Also verify that the rate calculation never divides by zero.

## DR-2 — Currency Handling

### Question

Which currency owns the stored withholding value, and how should tax-domain amounts behave when source, asset, and base currencies differ?

### Decision

The persisted `withholdingTax` amount uses the same transaction currency as the source activity.

Example:

```text
activity.currency = USD
withholdingTax = 15
```

means:

```text
15 USD withheld
```

The original stored amount is never overwritten by an asset-currency or base-currency conversion.

Tax calculations may additionally derive:

```text
transaction-currency value
asset-profile-currency value
base-currency value
```

when those conversions are available.

### Historical Conversion Rule

When a converted value is required, reuse Ghostfolio's existing historical currency-conversion path for the activity date.

Conceptually:

```text
source amount
+ source currency
+ target currency
+ activity date
-> converted amount
```

The tax feature does not maintain a separate exchange-rate database.

### Missing FX Rule

Missing historical FX data must remain explicit.

Do not convert missing FX to:

```text
0
```

and do not assume:

```text
1 source unit = 1 target unit
```

unless source and target currencies are actually the same.

If conversion is unavailable:

```text
converted value = null / unavailable
```

and the tax result carries an appropriate diagnostic, for example:

```text
MISSING_BASE_CURRENCY_CONVERSION
```

The original transaction-currency amount remains valid.

### Same-Currency Rule

If source and target currency are identical, pass the amount through unchanged. No exchange-rate lookup is required.

### Precision Rule

This decision does not close the rounding question.

Internal tax arithmetic remains high precision. Final rounding and serialization behavior is closed by DR-6 on Oct 5.

### Shared API Note

This decision defines tax currency semantics, not a tax-specific JSON number format.

The implementation must follow the team's shared API conventions rather than inventing a separate serialization rule.

### Consequences

- persisted withholding remains traceable to the source transaction;
- derived conversions never mutate source data;
- yearly portfolio totals can use the selected base currency;
- missing FX can make a base-currency result incomplete without destroying the known transaction-currency result.

### Implementation Impact

Normalized tax inputs should carry enough context to identify:

```text
transactionCurrency
assetCurrency
baseCurrency
activityDate
```

Conversion belongs in the shared tax normalization/calculation pipeline rather than being repeated independently by FIFO, average cost, yearly summary, CSV export, and PDF export.

### Test Impact

Cover:

- same-currency passthrough;
- transaction currency different from base currency;
- historical conversion using the activity date;
- missing historical conversion;
- multiple currencies;
- no silent zero fallback;
- no silent 1:1 fallback.

## DR-3 — Same-Date Ordering Tie-Breaker

### Question

If two tax-relevant activities have the same timestamp/date, what deterministic order should FIFO and average cost use?

### Decision

Tax activities are ordered by:

```text
1. activity.date ascending
2. activity.id ascending
```

The full stored activity timestamp is used first.

If two activities have the exact same timestamp, the activity ID is the deterministic secondary key.

### Rationale

Cost-basis calculations are sequence-sensitive.

A stable second key prevents results from changing because of database return order, runtime behavior, or fixture ordering.

This also aligns with the activity ordering pattern identified in the current Ghostfolio implementation during Iteration 1.

### Limitation

The ID tie-breaker provides deterministic software behavior. It is not a jurisdiction-specific legal ordering rule.

If the project later requires an explicit user-defined execution sequence, that would be a separate feature.

### Consequences

FIFO and average cost must consume the same normalized ordering.

Individual calculators must not implement different sorting rules.

Yearly summaries and exports consume calculated results instead of re-sorting source transactions.

### Implementation Impact

The common tax normalization step should expose activities already ordered by:

```text
date ASC
id ASC
```

### Test Impact

Cover:

- different dates;
- same calendar date with different timestamps;
- identical timestamps with different IDs;
- multiple BUYs at the same timestamp;
- BUY and SELL at the same timestamp;
- repeated execution producing identical results.

## Decision Summary

| Decision | Final Rule                                                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| DR-1     | Unknown withholding means `netDividend = null`; known zero withholding means `netDividend = grossDividend`.                                       |
| DR-2     | Persist withholding in transaction currency; derive other currencies using historical conversion; missing FX stays unavailable with a diagnostic. |
| DR-3     | Deterministic activity order is `date ASC`, then `id ASC`.                                                                                        |

## Implementation Gate

The following decisions remain scheduled for Oct 5:

```text
DR-4 — fee treatment
DR-5 — average-cost pool scope
DR-6 — rounding / decimal-safe output rule
```

Do not implement tax behavior that depends on DR-4 through DR-6 before they are closed.

The first planned tax coding PR remains Oct 6.

## Related Iteration 1 Design Sources

```text
project-docs/iteration-1/tax/withholding-tax-schema.md
project-docs/iteration-1/tax/fifo-capital-gains-spec.md
project-docs/iteration-1/tax/average-cost-capital-gains-spec.md
project-docs/iteration-1/tax/tax-lot-data-model.md
project-docs/iteration-1/tax/yearly-tax-summary-data-structure.md
project-docs/iteration-1/tax/tax-design-architecture-report-section.md
```

## Oct 5 Addendum — DR-4 to DR-6

**Owner:** Tharun Swaminathan
**Date:** October 5, 2026
**Issue:** #52 — Close DR-4–6 and file remaining tax issues
**Status:** Decisions closed for backend implementation
**Scope:** Tax calculation behavior only; no production code in this update

This addendum closes the remaining tax decisions required before the first tax coding PR. It supersedes the earlier Oct 2 `Implementation Gate` text that said DR-4 through DR-6 were still open.

### DR-4 — Fee Treatment

#### Question

How should BUY and SELL activity fees affect gross cost basis, gross proceeds, and the fee-adjusted realized-gain analytics value?

#### Decision

Activity fees remain separate from the gross calculation.

For all cost-basis methods, keep these concepts distinct:

```text
gross cost basis
gross sale proceeds
gross realized gain
BUY fee allocation
SELL fee allocation
realized gain after activity fees
```

The gross result is:

```text
grossRealizedGain =
    grossProceeds
    - grossCostBasis
```

The fee-adjusted analytics result is:

```text
realizedGainAfterActivityFees =
    (grossProceeds - sellFeeAllocated)
    - (grossCostBasis + buyFeeAllocated)
```

The fee-adjusted value is an analytics result. It must not be described as a universally required jurisdiction-specific taxable gain.

#### FIFO Fee Allocation

For each FIFO match:

```text
buyFeeAllocated =
    originalBuyFee
    × matchedQuantity
    / originalBuyQuantity
```

and:

```text
sellFeeAllocated =
    originalSellFee
    × matchedQuantity
    / originalSellQuantity
```

If proportional allocation leaves a tiny decimal remainder, assign the residual to the final match for that source activity so the allocations reconcile exactly to the original fee.

#### Average-Cost Fee Treatment

Average cost keeps acquisition fees in a separate fee pool.

A BUY adds:

```text
acquisitionFeePoolNew =
    acquisitionFeePoolOld
    + buyFee
```

For a SELL:

```text
disposalRatio =
    sellQuantity
    / poolQuantityBeforeSell
```

and:

```text
buyFeesAllocated =
    acquisitionFeePool
    × disposalRatio
```

The pool is reduced by the allocated fee amount.

The SELL activity fee remains separate and is subtracted only in the fee-adjusted realized-gain result.

#### Standalone FEE Activities

A standalone `FEE` activity is not automatically assigned to a BUY or SELL.

The existing Ghostfolio source model does not identify which trade a standalone fee belongs to. Guessing that relationship would make tax results non-traceable.

A future explicit linkage feature could change this behavior.

#### Consequences

- gross and fee-adjusted results remain separately visible;
- attached BUY/SELL fees are traceable to source activities;
- FIFO fee allocations reconcile to the original fees;
- average-cost acquisition-fee state remains separate from gross cost;
- standalone fees do not silently alter cost basis.

#### Implementation Impact

FIFO, average cost, yearly summary, and exports must reuse the same fee semantics.

The existing Ghostfolio `Order.fee` source value remains authoritative. No second tax-only fee field is introduced.

#### Test Impact

At minimum, numeric tests must cover:

- zero fee;
- BUY fee only;
- SELL fee only;
- both BUY and SELL fees;
- FIFO partial-lot allocation;
- one SELL consuming multiple FIFO lots;
- average-cost partial disposal;
- exact reconciliation of allocated fees;
- fractional quantities;
- standalone FEE activity exclusion.

---

### DR-5 — Average-Cost Pool Scope

#### Question

Which activities belong to the same average-cost pool?

#### Authoritative Sprint-Plan Decision

The Iteration 2 sprint plan explicitly schedules the average-cost engine as:

```text
running pool scoped per user + asset
```

Therefore the initial average-cost pool key is:

```text
userId
+ symbolProfileId
```

Activities for the same user and same asset participate in one average-cost pool even when they belong to different Ghostfolio accounts.

Different users never share a pool.

Different assets never share a pool.

#### Superseded Iteration 1 Proposal

The Iteration 1 tax-lot design proposed a default scope of:

```text
userId
+ accountId
+ symbolProfileId
```

for general tax calculation scope.

For **average cost**, this Oct 5 decision supersedes that provisional account-aware proposal because the authoritative Iteration 2 sprint plan specifies `user + asset`.

This change is limited to the average-cost pooling decision. It does not silently redefine every other tax scope.

#### Why the Scope Is Explicit

Average-cost results depend on which acquisitions are included in the pool. The engine must not infer or vary the scope between runs.

This is an engineering rule for this project, not a jurisdiction-specific tax rule.

#### Consequences

- the same asset in two accounts for one user contributes to one average-cost pool;
- account identity remains available on source activities for traceability;
- yearly summaries may aggregate results without creating a second average-cost pool definition;
- changing account metadata alone does not split an existing user+asset pool.

#### Implementation Impact

A deterministic internal key may be built from:

```text
userId
symbolProfileId
```

The average-cost strategy must receive activities grouped by this key.

FIFO may keep its own method-specific lot scope; DR-5 applies specifically to the average-cost pool.

#### Test Impact

Numeric tests must cover:

- one user / one asset;
- one user / same asset across multiple accounts;
- one user / multiple assets;
- multiple users;
- account-null and account-present activities for the same user+asset;
- deterministic replay producing the same pool result.

---

### DR-6 — Decimal-Safe Precision and Rounding

#### Question

Where does rounding occur, and how do we prevent floating-point drift in tax calculations?

#### Decision — One Rounding Rule

Use one rule across tax calculations:

```text
Convert calculation inputs to Big at the tax-engine boundary.
Do not round intermediate tax calculations.
Round only once when a human-facing presentation format explicitly requires it.
Never feed a rounded presentation value back into a calculation.
```

#### Internal Arithmetic

Use `Big` for:

```text
quantity
unit price
cost basis
proceeds
fees
withholding calculations
FIFO allocations
average-cost pool values
realized gains
currency-derived tax values
```

Do not use binary floating-point arithmetic for the calculation state when decimal-safe arithmetic is available.

#### Allocation Residuals

Proportional allocation can produce repeating decimals.

For a source amount split across multiple matches/events:

```text
allocate with Big
preserve full precision
assign any final decimal residual to the final allocation
```

This ensures:

```text
sum(allocations) = original source amount
```

without repeatedly rounding every match.

#### API Serialization

Raniya owns the shared API/data-contract work.

The Iteration 2 sprint plan schedules shared API decimals as strings. Tax code should follow that shared convention once available and must not create a conflicting tax-only serialization rule.

This decision defines tax arithmetic. It does not modify Raniya-owned shared files.

#### CSV / PDF / UI Presentation

Calculation results remain unrounded internally.

CSV should preserve the canonical decimal value required by the shared tax/export contract.

PDF/UI may format a decimal for readability, but formatting is presentation-only and must not change the stored source value or calculation result.

#### Consequences

- repeated calculations are deterministic;
- fractional quantities remain supported;
- fee allocations reconcile exactly;
- FIFO and average-cost calculations use the same precision policy;
- presentation formatting cannot change later tax calculations.

#### Implementation Impact

Every tax calculator must convert relevant numeric inputs to `Big` at its boundary and keep `Big` values through the calculation.

Conversion back to a public representation happens only at the API/export boundary and must follow the shared decimal contract.

#### Test Impact

Numeric tests must include:

- fractional quantities;
- repeating proportional allocations;
- multiple partial FIFO matches;
- average-cost partial disposals;
- values such as `0.1`, `0.2`, and `0.3` that expose binary floating-point drift;
- full pool/lot close with exact zero state;
- allocated fee totals equal to source fee;
- repeated calculation produces identical decimal output.

---

## Oct 5 Decision Summary

| Decision | Final Rule                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DR-1     | Unknown withholding keeps `netDividend = null`; known zero withholding gives `netDividend = grossDividend`.                                            |
| DR-2     | Withholding is stored in transaction currency; missing FX remains unavailable with a diagnostic.                                                       |
| DR-3     | Deterministic order is `date ASC`, then `id ASC`.                                                                                                      |
| DR-4     | Keep gross values and attached activity fees separate; expose a separate fee-adjusted gain; never guess standalone FEE linkage.                        |
| DR-5     | Average-cost pool scope is `userId + symbolProfileId` (`user + asset`), superseding the provisional account-aware average-cost scope from Iteration 1. |
| DR-6     | Use `Big`, no intermediate rounding, reconcile allocation residuals on the final allocation, and round only for presentation when required.            |

## Tax Coding Gate

DR-1 through DR-6 are now closed.

The tax coding gate is open for the first planned implementation task on Oct 6, provided the implementation task has its GitHub issue and follows the daily branch / PR / review process.

Shared API decimal serialization remains owned by Raniya and must be consumed rather than redefined by the tax feature.
