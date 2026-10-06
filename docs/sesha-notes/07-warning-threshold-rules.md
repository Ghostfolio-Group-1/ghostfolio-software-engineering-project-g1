# Warning-Threshold Rules — Green / Yellow / Red

**Author:** sesha siva sankar (member 1)
**Task date:** Tue, Sep 22
**Task:** Define warning-threshold rules (e.g. more than 25% in one stock)

---

## 1. What problem this solves

- X-Ray today is pass or fail. My notes from Sep 15 said the same thing: there is no "warning" or "medium risk" state.
- The proposal wants a red, yellow and green dashboard and warnings like "more than 25% in one stock".
- So this doc answers three questions:
  - When does something turn yellow, and when does it turn red?
  - Where do the numbers live, and can the user change them?
  - What does a warning actually look like when the app shows it?

## 2. The big idea: pass/fail and warnings are the same line, seen two ways

The rules from my Sep 17 to Sep 21 docs already have a pass/fail line (`thresholdMax`, `thresholdMin`). Warnings add a second, harsher line on top. I'm keeping them tied together so there is one source of truth.

- **Green** — inside the pass/fail line. The rule passes.
- **Yellow** — past the pass/fail line, but not by much. The rule fails, and the user gets a "watch this" warning.
- **Red** — past the harsher line. The rule fails, and the user gets an "act on this" warning.

The invariant that keeps everything consistent:

> A rule fails if and only if its severity is yellow or red.

That also settles the number that looked like a clash between my docs and the proposal:

- My Sep 17 doc defaulted single stock to 10% (the fail line).
- The proposal's example says 25%.
- Both are right. 10% is where it turns **yellow**, and 25% is where it turns **red**.

## 3. Severity levels

| Level     | Meaning                              | Counts against score? |
| --------- | ------------------------------------ | --------------------- |
| `GREEN`   | Within the limit                     | No                    |
| `YELLOW`  | Past the limit, worth watching       | Yes (rule fails)      |
| `RED`     | Far past the limit, needs action     | Yes (rule fails)      |
| `NO_DATA` | Could not be checked (see section 8) | No, and not counted   |

- `NO_DATA` is a fourth state on purpose. A user with no target allocation set, or a brand new stock with almost no price history, should not be shown a fake green.
- The score stays binary in v1 (yellow and red both fail). An easy v2 idea is partial credit, for example yellow counts as half. I'm parking that because it changes the score formula from Sep 16.

## 4. How severity is worked out

There are three shapes of check. Every rule fits exactly one.

### 4.1 Ceiling checks (higher is worse)

Used by: single stock, sector, country, currency concentration, and target-allocation deviation.

```
if value > redMax        -> RED
else if value > max      -> YELLOW
else                     -> GREEN
```

- `max` is the existing `thresholdMax` (the pass/fail line).
- `redMax` is the new harsher line.
- Comparisons are strictly greater than, same as the existing X-Ray rules ("fail if above the maximum"). A value exactly on the line gets the softer level.

### 4.2 Band checks (too high and too low are both bad)

Used by: volatility and cash allocation.

```
if value inside [min, max]              -> GREEN
else if value inside [redMin, redMax]   -> YELLOW
else                                    -> RED
```

- `min` and `max` are the existing `thresholdMin` and `thresholdMax`.
- `redMin` and `redMax` are the new outer edges.

### 4.3 The overall health score

Higher is better here, so it is a floor check. These bands are fixed constants in v1, not user settings. The same bands are used for each category's own sub-score (a category where half the rules fail scores 50, which is red).

| Score  | Severity |
| ------ | -------- |
| 80–100 | GREEN    |
| 60–79  | YELLOW   |
| 0–59   | RED      |

## 5. Default numbers

All ratios are decimals (0.25 means 25%), following Raniya's API conventions. These are my gut-check defaults, so the team should sanity-check them, same as the weights on Sep 16.

| Rule key                                          | Shape   | Green          | Yellow                      | Red                       |
| ------------------------------------------------- | ------- | -------------- | --------------------------- | ------------------------- |
| `SingleStockConcentration`                        | ceiling | ≤ 0.10         | > 0.10 up to 0.25           | > 0.25                    |
| `SectorConcentration`                             | ceiling | ≤ 0.30         | > 0.30 up to 0.50           | > 0.50                    |
| `CountryConcentration`                            | ceiling | ≤ 0.50         | > 0.50 up to 0.75           | > 0.75                    |
| `CurrencyClusterRiskCurrentInvestment` (existing) | ceiling | ≤ 0.50         | > 0.50 up to 0.75           | > 0.75                    |
| `TargetAllocationDeviation`                       | ceiling | ≤ 0.05 (5 pts) | > 0.05 up to 0.10           | > 0.10 (10 pts)           |
| `PortfolioVolatility` (annualized)                | band    | 0.10 – 0.25    | 0.05 – 0.10 or 0.25 – 0.35  | below 0.05 or above 0.35  |
| `CashAllocation`                                  | band    | 0.02 – 0.15    | 0.005 – 0.02 or 0.15 – 0.30 | below 0.005 or above 0.30 |

Two things worth noting in that table:

- The currency rule already exists in X-Ray with a 50% default, so it keeps its key and its `thresholdMax` becomes the yellow line. Only the red line is new.
- Target deviation is checked **per bucket**, so one rule can produce several warnings (one for each bucket that is off).

## 6. Where the numbers live

I'm reusing the place X-Ray already keeps thresholds instead of adding a second settings blob.

- Today: `user.settings.xRayRules[ruleKey]` holds `{ isActive, thresholdMax, thresholdMin }` (this is the `RuleSettings` shape in `x-ray-rules-settings.interface.ts`).
- Change: add two **optional** fields to that same shape.

```ts
interface RuleSettings {
  isActive: boolean;
  thresholdMax?: number; // existing: edge of green (top)
  thresholdMin?: number; // existing: edge of green (bottom)
  redThresholdMax?: number; // new: red starts above this
  redThresholdMin?: number; // new: red starts below this (band checks only)
}
```

- New keys get added to `XRayRulesSettings`: `SingleStockConcentration`, `SectorConcentration`, `CountryConcentration`, `PortfolioVolatility`, `CashAllocation`, `TargetAllocationDeviation`.
- If a user never customizes anything, the defaults from section 5 apply.
- Because `thresholdMax` is both the pass/fail line and the yellow line, changing it moves the score and the warning together. That is the point of the invariant in section 2.

### Validation (checked when the user saves, not on every calculation)

- Ceiling checks: `thresholdMax < redThresholdMax`.
- Band checks: `redThresholdMin < thresholdMin < thresholdMax < redThresholdMax`.
- Ratios must be between 0 and 1.
- If an override breaks the ordering, reject it with a clear error. Don't silently fix it (same reasoning as the target-allocation doc: silently rewriting a user's numbers is confusing).
- Omitting a red value is allowed. It falls back to the default red value, but never below the yellow value the user chose.

## 7. What a warning looks like

One warning is created for every bucket that is past its yellow line.

```jsonc
{
  "ruleKey": "SingleStockConcentration",
  "severity": "RED",
  "subject": { "type": "stock", "value": "AAPL" },
  "actual": 0.333,
  "threshold": 0.25, // the line that was crossed
  "message": "AAPL is 33.3% of your portfolio, above the 25% red limit."
}
```

Message templates, one per shape:

- Ceiling: `{subject} is {actual} of your portfolio, above the {threshold} {yellow|red} limit.`
- Band: `Your portfolio {metric} is {actual}, {above|below} the {threshold} {yellow|red} limit.`
- Target deviation: `{bucket} is {actual} of your portfolio, {n} points {above|below} your {target} target.`

### Ordering

1. RED before YELLOW.
2. Within a level, the biggest overshoot first (`actual / threshold`).
3. Ties broken alphabetically so the order is stable between refreshes.

The API returns all warnings. The dashboard card shows the first five and links to the rest.

### `topConcentrationRisk` (the field Raniya's dashboard needs)

Her spec asks for the single worst concentration across stock, sector, country and currency. Comparing "28% in a stock" with "55% in a country" directly isn't fair, because their limits differ. So:

1. Pick the concentration with the worst severity.
2. If severities tie, pick the one furthest past its own yellow line (`actual / yellow limit`).
3. If everything is green, still return the largest bucket, with severity GREEN, so the dashboard always has something to show.

## 8. Scope fixes and edge cases

### The single-stock rule must skip ETFs and funds (a correction to my Sep 17 doc)

- In Sep 17's doc I grouped "single stock" by symbol. That would flag a broad index ETF (say 40% of a portfolio in one total-market fund) as a red "single stock" problem, which is wrong. The fund is already diversified inside.
- I checked the schema: `AssetSubClass` has separate `ETF` and `MUTUALFUND` values.
- Fix: `SingleStockConcentration` only looks at holdings whose sub-class is `STOCK` or `CRYPTOCURRENCY`.
- The denominator is still the total value of all holdings, so 20,000 in one stock out of 90,000 total is 22%, no matter how much of the rest is ETFs.
- ETFs still count in the sector and country rules, because their sector and country weights are already split out per holding (that's the weighted-split logic from Sep 17).

### Other cases

- **Inactive rule:** produces no warnings and is not counted.
- **No holdings:** holding-based rules don't run (same as X-Ray today). Cash allocation still runs.
- **`NO_DATA`:** target deviation with no target set, volatility with fewer than about 20 days of price history, or a holding with no sector data. These return `NO_DATA`, never a fake green.
- **Rounding:** compare using the raw number, and only round for display. Otherwise 25.004% would show as "25%" and be red while a "25%" shown elsewhere is yellow.
- **No hysteresis in v1:** a value hovering right at a line can flip color between refreshes. I'm accepting that for v1 to keep the logic simple.
- **Restricted view:** percentages can be shown, but absolute money amounts are hidden (this matches how Ghostfolio already treats restricted views).

## 9. Open questions for the team

- Are the default numbers in section 5 acceptable? They are my judgment, not a formula.
- Should yellow count as half credit in the score later, or keep it binary?
- Volatility bands should really depend on the user's risk tolerance. I still didn't find that setting on the profile, so that stays a separate spec.

## 10. Where this plugs in

- Wednesday's what-if doc re-runs these same severity checks on simulated holdings.
- Friday's API contract returns `severity`, `warnings` and `topConcentrationRisk` from this doc.
- The Sep 24 wireframe uses one shared `SeverityBadge` for all three levels.
