# What-If Simulation — Data Structure

**Author:** sesha siva sankar (member 1)
**Task date:** Wed, Sep 23
**Task:** Design "what-if" simulation data structure (drop-by-X% on a holding)

---

## 1. What it does, in plain words

- The investor picks one holding and says "what if this drops by 30%?".
- The app answers three things, without touching any real data:
  - What happens to my total portfolio value?
  - What happens to my health score?
  - Which warnings appear, disappear or change color?
- It is a **read-only calculation**. Nothing is saved, nothing in the database changes.

## 2. The idea that keeps it simple

The what-if does not need its own scoring logic. It reuses everything already specced:

1. Take the real holdings.
2. Make a **copy** and shrink one holding in the copy.
3. Run the same rules and the same score calculator on the copy.
4. Put the "before" and "after" side by side.

So if the rules change later (new threshold, new rule), the what-if changes with them for free.

## 3. What it reads (inputs)

Everything comes from data Ghostfolio already has. Nothing new is stored. From each holding (`PortfolioPosition` in the codebase):

- `assetProfile.symbol` and `assetProfile.dataSource` (to identify the holding)
- `assetProfile.name`, `assetProfile.assetSubClass`, `assetProfile.sectors`, `assetProfile.countries`, `assetProfile.currency` (the rules group by these)
- `valueInBaseCurrency` (the current value, this is the number we shrink)
- `allocationInPercentage` (recomputed for the copy)
- `investment` (used by rules based on money put in, these stay unchanged)

Plus from the portfolio summary: the cash balance, and the cached volatility data from Friday's spec.

## 4. The request

```ts
interface WhatIfRequest {
  dataSource: string; // e.g. "YAHOO"
  symbol: string; // e.g. "AAPL"
  dropPercentage: number; // decimal: 0.30 means a 30% drop
}
```

- One holding at a time in v1. That matches the task, and it avoids extra rules about what happens when two shocks overlap.
- `dropPercentage` follows Raniya's convention that percentages are decimals, not strings like "30%".
- Valid range: greater than 0 and up to 1. A value of 1 means a total loss of that holding.
- Only drops in v1. "What if it goes up?" is a small extension later (allow negative values), but nobody asked for it.

## 5. How the copy is built (step by step)

1. Load the current holdings, the same snapshot the health score uses.
2. Find the holding by `dataSource` + `symbol`. If it isn't there (or it's closed), stop with an error.
3. Work out its new value: `valueAfter = valueBefore × (1 − dropPercentage)`.
4. Copy all holdings and replace that one value in the copy.
5. Recompute the weights for every holding in the copy: `allocation = value / newTotalOfHoldings`. Every other holding's **share** goes up because the total got smaller, even though its value did not change.
6. New portfolio value = new total of holdings + cash. Cash doesn't change.
7. Run the rules and the score calculator on the copy.
8. Compare with the real result and build the answer.

### Which rules get re-run?

A market drop changes what things are **worth**. It does not change what you **paid** or your **fees**. So rules split into two groups:

| Group                               | Rules                                                                                                                                                                | In the what-if                          |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Based on **value**                  | concentration (stock, sector, country, currency), asset-class and market clusters, account concentration, cash allocation, target deviation, emergency-fund coverage | Re-evaluated on the copy                |
| Based on **money invested or paid** | base-currency investment rule, fee ratio, buying power, emergency-fund setup                                                                                         | Left as they are (they can't change)    |
| Volatility                          | needs the weights (which changed) and the cached covariance matrix                                                                                                   | Re-evaluated using the cache, see below |

- **Volatility:** the covariance data is cached nightly (Friday's spec). The what-if only needs to plug in the new weights, which is cheap. If the cache is missing, the volatility rule is listed under `skippedRules` instead of guessing.

## 6. The answer

```ts
interface WhatIfResult {
  scenario: {
    dataSource: string;
    symbol: string;
    name: string;
    dropPercentage: number;
  };
  portfolio: {
    valueBefore: Money;
    valueAfter: Money;
    change: Money; // negative when the value drops
    changePercentage: number; // decimal
  };
  holding: {
    valueBefore: Money;
    valueAfter: Money;
    allocationBefore: number; // share of holdings, decimal
    allocationAfter: number;
  };
  score: {
    before: number | null;
    after: number | null;
    change: number | null;
  };
  categories: Array<{
    key: string;
    scoreBefore: number;
    scoreAfter: number;
  }>;
  ruleChanges: Array<{
    // only rules whose result actually changed
    ruleKey: string;
    severityBefore: 'GREEN' | 'YELLOW' | 'RED' | 'NO_DATA';
    severityAfter: 'GREEN' | 'YELLOW' | 'RED' | 'NO_DATA';
    actualBefore: number;
    actualAfter: number;
  }>;
  newWarnings: RiskWarning[]; // appear after the drop
  resolvedWarnings: RiskWarning[]; // disappear after the drop
  changedWarnings: RiskWarning[]; // still there but a different level
  skippedRules: Array<{ ruleKey: string; reason: string }>;
  calculatedAt: string; // ISO 8601
}

interface Money {
  amount: number;
  currency: string; // ISO code, e.g. "USD"
}
```

- `Money`, decimals and ISO dates all follow Raniya's shared conventions.
- Sending only the rules that changed keeps the answer small and makes the UI easy: it just lists what moved.
- `RiskWarning` is the same object from the Sep 22 threshold doc, so the UI can reuse one component.

## 7. Worked example (numbers are exact)

The portfolio:

| Holding             | Type  | Value       | Share of holdings |
| ------------------- | ----- | ----------- | ----------------- |
| AAPL                | stock | 30,000      | 33.3%             |
| MSFT                | stock | 20,000      | 22.2%             |
| GOOGL               | stock | 10,000      | 11.1%             |
| VTI                 | ETF   | 30,000      | (not a stock)     |
| Cash                |       | 10,000      |                   |
| **Total holdings**  |       | **90,000**  |                   |
| **Portfolio value** |       | **100,000** |                   |

Before the drop, using the Sep 22 limits (yellow above 10%, red above 25%) for single stocks. The ETF is skipped by the single-stock rule:

- AAPL 33.3% is **RED**
- MSFT 22.2% is **YELLOW**
- GOOGL 11.1% is **YELLOW**

**Scenario: AAPL drops 40%** (`dropPercentage = 0.40`)

- AAPL: 30,000 × 0.60 = **18,000**
- Total holdings: 90,000 − 12,000 = **78,000**
- Portfolio value: 78,000 + 10,000 = **88,000**, a change of **−12,000 (−12.0%)**
- Cash share: 10,000 / 88,000 = **11.4%** (was 10.0%), still green

Single-stock shares on the copy:

| Holding | Before       | After         |
| ------- | ------------ | ------------- |
| AAPL    | 33.3% RED    | 23.1% YELLOW  |
| MSFT    | 22.2% YELLOW | **25.6% RED** |
| GOOGL   | 11.1% YELLOW | 12.8% YELLOW  |

Two things to notice, and both are why the result shape has separate lists for changed warnings:

- The value fell 12%, but the **concentration risk in AAPL improved** because its share shrank.
- MSFT **turned red without anyone touching it**. It didn't change, but the total got smaller, so its share went up.

So the UI must not just say "score went down" or "score went up". It has to show which rules moved and why.

## 8. Errors and edge cases

| Situation                                  | Behavior                                                                          | Error code                      |
| ------------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------- |
| Holding not found or already closed        | Stop, tell the user                                                               | `RISK_WHATIF_HOLDING_NOT_FOUND` |
| `dropPercentage` ≤ 0, > 1, or not a number | Stop, validation error                                                            | `RISK_WHATIF_INVALID_DROP`      |
| Total loss (`dropPercentage = 1`)          | Allowed. The holding's value becomes 0 and its share becomes 0                    | none                            |
| Empty portfolio                            | Nothing to simulate                                                               | `RISK_WHATIF_HOLDING_NOT_FOUND` |
| Same stock held in several accounts        | Already one holding at portfolio level, so the drop applies to the whole position | none                            |
| Volatility cache missing                   | Volatility goes into `skippedRules`, the rest still works                         | none                            |
| Restricted view                            | Money amounts are hidden (null), percentages and severities are still returned    | none                            |
| Holding has no sector or country data      | Same handling as the real score (goes to an "uncategorized" bucket)               | none                            |

## 9. Rules for implementation

- **Pure function:** takes holdings in, returns a result out. No writes to the database or to any cache.
- **Same code path as the real score.** No copy of the rule logic anywhere. If it drifted, the what-if would quietly disagree with the real score.
- **No network calls:** everything it needs is already loaded (holdings, cash, cached volatility), so it should answer fast.
- **Safe to repeat:** running the same request twice gives the same answer.

## 10. Not in v1 (on purpose)

- Several holdings dropping at once.
- Gains ("what if it goes up").
- Dropping a whole sector or asset class.
- Saving or naming scenarios.

All of these can be added later by widening the request. None of them change the result shape.

## 11. Where this plugs in

- The Friday API contract exposes this as `POST /api/v1/risk/what-if`.
- The Sep 24 wireframe shows it as one panel: pick a holding, drag a slider, see the before and after.
- The class diagram in doc 06 uses `WhatIfScenario` and `WhatIfResult`, matching this doc. The field is named `dropPercentage` (decimal) everywhere.
