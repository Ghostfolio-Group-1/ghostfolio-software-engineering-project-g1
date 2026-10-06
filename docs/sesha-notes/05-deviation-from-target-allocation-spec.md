# Deviation-from-Target-Allocation — Logic Spec

**Author:** sesha siva sankar (member 1)
**Date:** Mon, Sep 21
**Task:** Spec deviation-from-target-allocation logic

---

## 1. This one's different from every rule so far

Every rule I've specced so far (currency/asset-class/market cluster risk, concentration,
volatility, cash allocation) compares a holding's actual ratio against a **fixed
band or ceiling that WE define** (e.g. "equities should be 78%-82%"). This task is
different: it's comparing a portfolio against **a target THE USER defines** — "I want 60%
stocks / 40% bonds," and the rule just tells them how far off they currently are.

That's an important distinction because it changes where the "correct" number comes
from — not a hardcoded default, but user input. So before I can spec the comparison logic,
I first need to spec where that target actually lives, because (confirmed by checking
`prisma/schema.prisma`) **nothing like this exists in the data model today.** No
`targetAllocation` table, no target fields anywhere. This is new, not an extension of an
existing rule.

## 2. Where the target lives

Two options, same tradeoff I've hit in earlier specs:

- **Option A — new Prisma table**: a proper `TargetAllocation` model, one row per
  user+category+target%. More structured, but needs a migration, and this feature might
  still change shape before it's final.
- **Option B — reuse the existing settings JSON blob**: every X-Ray rule's threshold
  config already lives in `user.settings.xRayRules` (confirmed in Tuesday's read-through —
  `settings` is a `Json` field on `User`, per `prisma/schema.prisma:20`). A
  `user.settings.targetAllocation` key would follow the exact same pattern, no migration
  needed.

**Going with Option B for v1** — same reasoning as every other spec this week: reuse what
the codebase already does instead of inventing a new pattern, and it's easy to promote to
a real table later if the feature grows (e.g. if we want target allocation _history_ over
time, which a JSON blob can't do well — flagging that as the point where we'd need to
switch to Option A).

### 2.1 Shape of the stored target

```jsonc
// user.settings.targetAllocation
{
  "isActive": true,
  "groupBy": "assetClass", // "assetClass" | "sector" | "country" | "currency" | "symbol"
  "targets": [
    { "key": "EQUITY", "percentage": 0.6 },
    { "key": "FIXED_INCOME", "percentage": 0.3 },
    { "key": "CASH", "percentage": 0.1 }
  ]
}
```

- `groupBy` reuses the exact same grouping attributes Thursday's concentration spec
  already defined (asset class, sector, country, currency, symbol) — no new grouping
  logic needed, just point it at whichever attribute the user picked.
- `targets` must sum to 100% (validated on save, not on every evaluation — same as
  Ghostfolio's existing pattern of validating settings at write-time).
- Only one active target profile per user for v1 — not multiple named "strategies" (e.g.
  "retirement plan" vs "aggressive plan"). That's a reasonable v2 idea, but adding it now
  would complicate both storage and the UI for something nobody's asked for yet.

## 3. The deviation formula

```
1. Group current holdings by `groupBy` (same grouping helper as concentration/cluster
   rules already use).
2. For each bucket, compute actualPercentage = bucketValue / totalPortfolioValue.
3. For each target entry: deviation = actualPercentage - targetPercentage
   (signed -- positive means overweight, negative means underweight)
4. absoluteDeviation = |deviation|
5. Fail (per-bucket) if absoluteDeviation > thresholdMax (default 5 percentage points)
```

This is a **per-bucket** check, not one portfolio-wide number — e.g. "you're 4pts over on
Equity and 3pts under on Fixed Income" are two separate evaluations, not one blended
score. That mirrors how Asset Class Cluster Risk already reports Equity and Fixed Income
as two separate rules (per Tuesday's notes) rather than one combined stocks-vs-bonds
number — keeping the same granularity so results read consistently across the whole
report.

### 3.1 What if the user's targets don't cover every bucket that actually exists?

E.g. user set targets for Equity/Fixed Income/Cash, but also holds a Real Estate position
that isn't in their target list at all. Two reasonable options:

- Treat missing buckets as an implicit 0% target (so any Real Estate holding shows up as
  "100% over target, should be 0%") — this is what I'd default to, since it correctly
  flags that they own something outside their stated plan.
- Silently ignore buckets with no explicit target — simpler, but hides real drift from the
  user, so I'm not going with this.

## 4. Threshold — single value, not a band, and why

Unlike the market/asset-class cluster rules (which use bands because both directions can
be wrong relative to a fixed ideal), deviation from a _user's own target_ only needs one
`thresholdMax` — how far off is "too far," in either direction. The signed `deviation`
value already captures over vs. under; the pass/fail just cares about the absolute
distance. Default 5 percentage points, configurable, same override pattern as every other
rule (`user.settings.xRayRules` threshold overrides).

## 5. Output shape

```jsonc
{
  "key": "TargetAllocationDeviation",
  "name": "Target Allocation Deviation",
  "isActive": true,
  "value": false,
  "evaluation": "Equity is 68% of your portfolio, 8 points above your 60% target (threshold: 5 points).",
  "configuration": {
    "threshold": { "max": { "unit": "points", "value": 0.05 } }
  },
  "buckets": [
    {
      "key": "EQUITY",
      "actual": 0.68,
      "target": 0.6,
      "deviation": 0.08,
      "passed": false
    },
    {
      "key": "FIXED_INCOME",
      "actual": 0.27,
      "target": 0.3,
      "deviation": -0.03,
      "passed": true
    },
    {
      "key": "CASH",
      "actual": 0.05,
      "target": 0.1,
      "deviation": -0.05,
      "passed": true
    }
  ]
}
```

The extra `buckets` array is new compared to every other rule's output so far — none of
the earlier rules needed to report more than one number per evaluation. Worth flagging
this as a schema addition to `EvaluationResult` (or a rule-specific extension of it) rather
than assuming the existing interface covers it as-is.

## 6. How this folds into the Health Score model

This is the one category so far that's **entirely optional at the data level**, not just
at the "user turned it off" level — if a user has never set a target allocation, there's
nothing to evaluate, full stop (not even a fail). That's a different kind of "inactive"
than every other rule, which is always computable, just toggle-able.

- Weight: I'd suggest holding off on giving this a fixed weight in the shared 100-point
  pool at all (unlike every other category, which always contributes if active). Instead,
  when a user HAS set a target, add it in dynamically and **renormalize everyone else's
  weight down** to make room — similar to how inactive rules already get excluded and the
  rest rebalances (from Wednesday's model), just applied at the category level instead of
  the rule level.
- This keeps the score fair for users who never set a target (they're not missing points
  for a thing they never opted into) while still rewarding/penalizing it for users who
  did.

## 7. Edge cases

- **No target set at all**: category doesn't run, doesn't affect the score (see section 6)
  — different from "zero holdings," which is an empty-portfolio case other rules already
  handle.
- **Targets don't sum to 100%**: reject at save-time with a validation error, don't try to
  auto-normalize silently — silently rescaling a user's own stated targets would be
  confusing ("why does my 70/40 turn into 63/37 automatically").
- **`groupBy: "symbol"`**: technically supported by the formula, but worth flagging as a
  UX question for the team — setting an exact target % per individual stock is a much
  heavier ask for a user than per asset-class, so this might be something we gate behind
  "advanced mode" rather than exposing by default.

## 8. What's next

Tuesday's task is defining warning-threshold rules (e.g. ">25% in one stock") — that's
close to Thursday's concentration spec's job already, so tomorrow is likely more about
formalizing WHERE thresholds live and how they're presented as warnings in the UI, rather
than new math.
