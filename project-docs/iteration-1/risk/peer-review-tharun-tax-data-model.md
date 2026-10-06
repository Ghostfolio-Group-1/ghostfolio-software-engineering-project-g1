# Peer Review — Tharun's Tax Data Model

**Reviewer:** Sesha Siva Sankar
**Feature Owner Reviewed:** Tharun Swaminathan — Tax Metrics & Tax Calculations
**Iteration:** 1 — Design & Data Modelling
**Scheduled Task:** September 29, 2026
**Review Finalized:** September 30, 2026
**Scope:** Design/documentation review only; no tax implementation changes

## Purpose

This peer review checks Tharun's tax design against the Iteration 1 sprint
requirements, the current `main` Ghostfolio implementation, and internal
consistency across his own eight documents. The goal is not to redesign the
tax feature. The goal is to identify anything that should be reconciled
before Iteration 2 implementation begins, matching the format Tharun himself
used to review Arthur's chart docs
(`project-docs/iteration-1/tax/peer-review-arthur-chart-data-model.md`), so
the team's peer-review documents stay consistent with each other.

## Sources Reviewed

### Tharun's docs (all merged to `main`)

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

### Current Ghostfolio implementation (cross-checked, not taken on faith)

```text
prisma/schema.prisma
apps/api/src/app/activities/activities.service.ts
apps/api/src/app/export/export.service.ts
apps/api/src/services/asset-profile-split/asset-profile-split.helper.ts
apps/api/src/app/portfolio/calculator/roai/portfolio-calculator.ts
libs/common/src/lib/interfaces/activities.interface.ts
libs/common/src/lib/dtos/create-order.dto.ts
package.json
```

## What Is Working Well

**Null-vs-zero discipline is applied with real rigor, end to end.** The
distinction between "unknown" (`null`) and "known zero" is introduced in
`withholding-tax-schema.md` and then actually carried through every
downstream doc without ever collapsing one into the other — including at the
aggregate level, where a single dividend with unknown withholding correctly
nulls the whole yearly total rather than silently summing only the known
values. This is the strongest piece of design work in the set, and it is the
same principle my own risk docs lean on for `NO_DATA` severity, so the two
features agree on how to handle missing data without having coordinated on
it directly.

**The mixed-history diagnostic in `tax-relevant-filtering-spec.md` catches a
real, non-obvious correctness issue.** Excluding a historical BUY or SELL
from tax relevance can silently corrupt the cost basis of a _later_ SELL
that is still included. The doc catches this and defines a conservative
completeness flag (`TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY`) instead of
producing a gain number that looks precise but is actually wrong. This is
exactly the kind of thing that is cheap to design correctly and expensive to
discover after implementation.

**Derive-don't-persist is a well-argued decision, not just a stated one.**
`tax-lot-data-model.md` explicitly lists why permanent FIFO-lot and
average-cost tables were rejected (staleness after historical edits, split
corrections, method changes, cascade complexity) rather than just asserting
the choice. That matches the same reasoning my own health-score design used
for keeping the score layer separate from the rule engine: recompute from a
single source of truth rather than caching something that can silently go
stale.

**The cross-year FIFO/average-cost rule forecloses a tempting implementation
bug.** `yearly-tax-summary-data-structure.md` explicitly warns against
loading only the selected year's activities before running the cost-basis
engine, with a worked cross-year example. This is the kind of mistake that
would pass casual testing and only surface on a real multi-year portfolio.

**Every codebase claim I checked held up.** I verified the `Order` model
fields, the activity `Type` enum, default activity ordering (date ascending,
then id ascending), the existing draft/excluded-account filtering, the
general `/export` endpoint's deliberately permissive defaults, the stock-split
normalization formula, and the CSV library already in `package.json` — all
matched exactly what Tharun's docs claim. This is not a review that found a
team guessing; the citations are accurate.

## Required Corrections / Questions Before Implementation

### 1. `AverageCostEvent` has three different shapes across three of your own docs

`average-cost-capital-gains-spec.md`'s "Average-Cost Event Output" section
uses `activityDate`, `activityType`, `grossCostPoolBefore`,
`grossCostPoolAfter`. `tax-lot-data-model.md`'s `AverageCostEvent` interface
uses `date`, `type`, `grossCostBefore`, `grossCostAfter` — no `activity`
prefix, no `Pool` in the name. `tax-export-format-spec.md`'s
`AVERAGE_COST_EVENT` row introduces a third set,
`poolQuantityBefore`/`poolQuantityAfter`, keeps `activityDate` (matching the
first doc, not the second), and drops the gross-cost-pool value entirely in
favor of unit-cost fields only.

No doc reconciles these. Is `tax-lot-data-model.md`'s interface meant to be
the canonical shape, with the Sep 18 and Sep 24 docs needing an update to
match it?

### 2. `TaxRealizedGainRecord` and `DividendRecord` disagree on how account/asset identity is stored

`TaxRealizedGainRecord` (`tax-lot-data-model.md`) stores account and asset
identity only inside a nested `scope: TaxCalculationScope` object — there is
no top-level `accountId` or `symbolProfileId`. `DividendRecord`
(`yearly-tax-summary-data-structure.md`) stores the same kind of identity as
flat `accountId`/`symbolProfileId` fields directly. The `tax-export-format-spec.md`
CSV row for `REALIZED_GAIN` then lists `accountId`/`symbolProfileId` as if
they were flat, matching `DividendRecord`'s style rather than the type they
are actually exporting.

Is the export-layer flattening an intentional, implicit mapping step, or
should `DividendRecord` and `TaxRealizedGainRecord` use the same identity
convention so the two records read consistently?

### 3. `FIFO_MATCH` export row field names drift from the `TaxLotMatch` interface

`TaxLotMatch` (`tax-lot-data-model.md`) names the acquisition-cost field
`grossAcquisitionValueAssetCurrency`/`grossAcquisitionValueBaseCurrency`, and
keeps `buyFeeAllocatedBaseCurrency` and `sellFeeAllocatedBaseCurrency` as
separate fields, plus a `matchId`. The `FIFO_MATCH` export row instead uses
`grossCostBasisBaseCurrency` for the same value, collapses both fee fields
into one undifferentiated `activityFeesBaseCurrency` column with no stated
rule for how they combine, uses `traceId` instead of `matchId`, and drops
`lotId` entirely with no note.

If the buy-fee and sell-fee columns are meant to be summed in the export,
that should be stated explicitly, since a reader of the export spec alone
would have no way to know the export's `activityFeesBaseCurrency` is derived
from two separate values, not one.

### 4. FIFO working-lot fee field was renamed between Sep 17 and Sep 21 without a note

`fifo-capital-gains-spec.md` calls the field `buyFeeAssetCurrency`/`buyFeeBaseCurrency`.
`tax-lot-data-model.md`'s `TaxLot` interface renames it to
`acquisitionFeeAssetCurrency`/`acquisitionFeeBaseCurrency`. This looks like a
reasonable refinement — `acquisitionFee` reads better once the same lot
concept is shared with average cost — but nothing flags the rename, so a
reader following the Sep 17 FIFO spec's exact field names into an
implementation would diverge from the Sep 21 canonical model. Low severity
on its own, but it is the same category of drift as items 1–3, and four
instances of unreconciled renames across eight related docs is worth a
single pass to align before Iteration 2.

### 5. FIFO oversell handling is the one place the spec's own tone shifts from prescriptive to optional

Every other branch in `fifo-capital-gains-spec.md` uses "must" or "should."
The oversell case says: "Match the valid portion **if desired**, but record:
`unmatchedQuantity` / error `INSUFFICIENT_OPEN_LOTS`." Later docs
(`yearly-tax-summary-data-structure.md`, `tax-relevant-filtering-spec.md`)
build diagnostic behavior on top of "the valid trace detail may still be
available," which reads as if partial matching is expected to happen. Is
partial matching on oversell actually required, or is it genuinely left to
Iteration 2 implementer discretion? If it's required, the wording should
probably firm up to match the rest of the spec's tone.

### 6. Reverse splits are listed as a planned test but not worked through

Both the FIFO and average-cost specs list "reverse split" among planned
tests, but the only worked example in either doc is a forward 2:1 split. The
stated formula is mathematically symmetric, so this is not a computation
bug, but neither doc says whether a fractional remaining lot quantity after
a reverse split (for example a 1:10 split leaving 0.3 shares) should simply
be carried at full precision, or whether there's an unstated expectation of
rounding somewhere. "Just keep the fraction, no special case" is a
defensible position for a tax-domain calculation, but it should be stated
rather than left implicit.

### 7. Minor: insufficient-pool partial match doesn't explicitly restate that the pool goes to zero

`average-cost-capital-gains-spec.md`'s "SELL With Insufficient Pool
Quantity" section sets `matchedQuantity = poolQuantity`, which implies the
pool ends at exactly zero, but doesn't say so the way the "full close"
section explicitly forces an exact zero. Documentation gap only, not a math
error — worth a one-line addition for symmetry with the full-close section.

## Cross-Check: `withholdingTax` and `isTaxRelevant` Against My Own Risk Docs

My UML diagrams (`docs/sesha-notes/06-uml-diagrams.md`) referenced these two
tax fields before your docs for them were confirmed on `main`, and flagged
both as assumptions pending your Sep 16 and Sep 23 docs. Now that both are
merged, I checked them directly:

- `withholdingTax` — confirmed exact match: nullable `Float` on the
  dividend activity, with null meaning unknown and zero meaning known-zero,
  exactly as my diagram assumed.
- `isTaxRelevant` — confirmed exact match, including the detail my diagram
  got right that it defaults to `true` and is a non-nullable boolean.

One thing your review of my own docs would have caught if I hadn't checked
it myself: my diagram's derived-rate field is named `withholdingRate`, but
your actual field is `withholdingTaxRate`. That's a naming mistake in my own
doc, not yours — I've corrected it (see the note at the end of this
document).

## Overall Assessment

This is a strong, repository-grounded design. Every codebase claim checked
out, the two hardest correctness issues in tax design (null-vs-zero, and
cost-basis continuity when history is excluded) were identified and handled
correctly rather than glossed over, and the explicit decision not to touch
the shared ROAI/performance calculator protects both the tax feature and the
charts feature from cross-contamination. The issues above are all naming and
reconciliation drift between your own docs, written across ten days as the
model evolved — not correctness bugs in the calculations themselves. A short
pass to pick one canonical name per concept (items 1–4) and firm up the two
ambiguous behaviors (items 5–6) would make the eight documents read as one
consistent model before Iteration 2 implementation starts.

---

**Self-correction applied as a result of this review:** `docs/sesha-notes/06-uml-diagrams.md`'s
`DividendRecord` class listed a derived field as `withholdingRate`; it has
been corrected to `withholdingTaxRate` to match the confirmed field name in
`withholding-tax-schema.md` and `yearly-tax-summary-data-structure.md`. The
"unconfirmed, check with Tharun" hedges on `isTaxRelevant` in
`06-uml-diagrams.md` and `07-warning-threshold-rules.md` have also been
removed, since both are now confirmed correct.
