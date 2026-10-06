# Risk API Contract

**Author:** sesha siva sankar (member 1)
**Task date:** Fri, Sep 25
**Task:** Write API contract for risk endpoints (request/response shapes)

---

## 1. What this is

- The exact requests and responses for the risk module, so Iteration 2 (backend) and Iteration 3 (React) can be built without guessing.
- It follows Raniya's `api-conventions.md` (Sep 21) and reconciles with her `dashboard-field-spec.md` (Sep 22), as she asked me to do today.
- Everything here is a specification. No code is written yet.

## 2. Conventions applied (from Raniya's doc)

| Convention        | How the risk API follows it                                                     |
| ----------------- | ------------------------------------------------------------------------------- |
| Response envelope | Every response is `{ "data": ..., "meta": {...}, "error": null }`               |
| URL prefix        | `/api/v1/risk/...`, kebab-case for multi-word names                             |
| Dates             | ISO 8601 strings (`"2026-09-26"` or `"2026-09-26T09:14:00Z"`)                   |
| Money             | `{ "amount": 1234.56, "currency": "USD" }`, never a formatted string            |
| Percentages       | Decimals (`0.0725` is 7.25%)                                                    |
| Errors            | `data: null`, `error: { code, message }`, code prefixed by feature (`RISK_...`) |
| Lists             | Paginated with `?page=1&pageSize=25` and `meta: { page, pageSize, total }`      |
| DTO files         | One per endpoint in `apps/api/src/app/risk/`, named `get-...`, `update-...`     |

One small extension: the what-if endpoint is a POST that only calculates, so its DTO is `run-what-if.dto.ts`. Her `get-` and `update-` names don't fit a calculation.

## 3. Endpoint overview

| Method   | Path                               | Purpose                                           | Used by (wireframe #) |
| -------- | ---------------------------------- | ------------------------------------------------- | --------------------- |
| `GET`    | `/api/v1/risk/summary`             | Small summary for the unified dashboard           | Raniya's dashboard    |
| `GET`    | `/api/v1/risk/score`               | Full health score with categories and rules       | 1, 2, 3, 6, 7         |
| `GET`    | `/api/v1/risk/warnings`            | Yellow and red warnings, worst first              | 4                     |
| `GET`    | `/api/v1/risk/concentration`       | Top buckets for stock, sector, country, currency  | 5                     |
| `GET`    | `/api/v1/risk/target-allocation`   | The saved target and how far off each bucket is   | 8                     |
| `PUT`    | `/api/v1/risk/target-allocation`   | Set or replace the target                         | 8, 11                 |
| `DELETE` | `/api/v1/risk/target-allocation`   | Remove the target                                 | 8, 11                 |
| `GET`    | `/api/v1/risk/thresholds`          | Effective thresholds for every risk rule          | 11                    |
| `PUT`    | `/api/v1/risk/thresholds/:ruleKey` | Customize one rule's on/off and limits            | 11                    |
| `DELETE` | `/api/v1/risk/thresholds/:ruleKey` | Reset one rule to its defaults                    | 11                    |
| `POST`   | `/api/v1/risk/what-if`             | Simulate a drop on one holding (calculation only) | 9, 10                 |

## 4. Access rules

These reuse how Ghostfolio already protects its portfolio endpoints, so nothing new to invent.

- **Reads (`GET`):** need the `portfolio:read` scope, the same as `GET /api/v1/portfolio/report`. The user comes from the token, never from a URL or body, so one user can never ask for another user's data.
- **Money values:** need the `portfolio:read:values` scope. Without it (restricted view), every `Money` object is returned as `null`. Percentages, scores and severities are still returned.
- **Settings writes (`PUT`, `DELETE`):** need a logged-in user with the `updateUserSettings` permission, the same as `PUT /api/v1/user/setting`. They are rejected while impersonating another user.
- **`POST /what-if`:** it is a `POST` only because it has a body. It changes nothing, so it needs the same scope as a read, not the write permission.
- **Basic-subscription gating:** today's X-Ray report hides the individual rules for these users. I'm proposing the risk API does the same (rules hidden, score still shown). This is an open question, see section 11.

## 5. Shared types

```ts
type Severity = 'GREEN' | 'YELLOW' | 'RED' | 'NO_DATA';

interface Money {
  amount: number;
  currency: string; // ISO code
}

interface Thresholds {
  min?: number; // edge of green (bottom), band checks only
  max?: number; // edge of green (top)
  redMin?: number; // red starts below this, band checks only
  redMax?: number; // red starts above this
}

interface RiskWarning {
  ruleKey: string;
  severity: 'YELLOW' | 'RED';
  subject: {
    type: 'stock' | 'sector' | 'country' | 'currency' | 'bucket' | 'portfolio';
    value: string; // "AAPL", "Technology", "EQUITY", "volatility"
  };
  actual: number; // decimal
  threshold: number; // the line that was crossed
  message: string; // safe to show in the UI
}

interface RuleResult {
  key: string;
  name: string;
  isActive: boolean;
  passed: boolean | null; // null when NO_DATA
  severity: Severity;
  weight: number;
  actual: number | null;
  thresholds: Thresholds | null;
  message: string;
  details?: Record<string, unknown>; // rule-specific, e.g. { historyDays: 90 }
}
```

`Severity`, `Thresholds` and the warning message templates come from the Sep 22 threshold doc.

## 6. Endpoints in detail

### 6.1 `GET /api/v1/risk/summary`

The small payload for Raniya's dashboard. Cheap to render.

```json
{
  "data": {
    "healthScore": 72,
    "severity": "YELLOW",
    "topConcentrationRisk": {
      "type": "stock",
      "value": "AAPL",
      "percentage": 0.333,
      "severity": "RED"
    },
    "calculatedAt": "2026-09-26T09:14:00Z"
  },
  "meta": {},
  "error": null
}
```

- `healthScore` is `null` (and `severity` is `NO_DATA`) when no rules are active.
- `topConcentrationRisk` picks the worst concentration using the tie-break rules from the Sep 22 doc. It is `null` only when the portfolio has no holdings.

### 6.2 `GET /api/v1/risk/score`

The full score behind the big gauge and the category bars.

```json
{
  "data": {
    "score": 72,
    "grade": "C",
    "severity": "YELLOW",
    "activeWeight": 100,
    "unavailableReason": null,
    "excluded": [],
    "calculatedAt": "2026-09-26T09:14:00Z",
    "categories": [
      {
        "key": "concentration",
        "name": "Concentration",
        "weight": 15,
        "score": 45,
        "severity": "RED",
        "rules": [
          {
            "key": "SingleStockConcentration",
            "name": "Single stock concentration",
            "isActive": true,
            "passed": false,
            "severity": "RED",
            "weight": 5,
            "actual": 0.333,
            "thresholds": { "max": 0.1, "redMax": 0.25 },
            "message": "AAPL is 33.3% of your portfolio, above the 25% red limit."
          }
        ]
      },
      {
        "key": "volatility",
        "name": "Volatility",
        "weight": 10,
        "score": 100,
        "severity": "GREEN",
        "rules": [
          {
            "key": "PortfolioVolatility",
            "name": "Volatility estimate",
            "isActive": true,
            "passed": true,
            "severity": "GREEN",
            "weight": 10,
            "actual": 0.184,
            "thresholds": {
              "min": 0.1,
              "max": 0.25,
              "redMin": 0.05,
              "redMax": 0.35
            },
            "message": "Estimated annualized volatility is 18.4%, within the 10% to 25% band.",
            "details": { "historyDays": 90 }
          }
        ]
      }
    ]
  },
  "meta": {},
  "error": null
}
```

- Only two categories are shown to keep the example short. The real response has all of them, sorted by severity (RED, then YELLOW, then GREEN), then by weight.
- `grade`: A for 90 and up, B for 80, C for 70, D for 60, F below 60. This is the optional letter from the Sep 16 model, fixed here so the UI doesn't invent its own.
- `severity` uses the 80 / 60 bands from the Sep 22 doc.
- `excluded` lists categories that were left out and why, for example `{ "key": "concentration", "reason": "NO_HOLDINGS" }`, so the UI can explain a missing card.
- `unavailableReason` is `"NO_ACTIVE_RULES"` when the user switched everything off. In that case `score`, `grade` are `null` and `severity` is `NO_DATA`.
- For restricted-view users, or Basic subscribers, `rules` is `null` inside each category (the same pattern the X-Ray report uses). Score and category scores still come back.

### 6.3 `GET /api/v1/risk/warnings`

Query parameters:

| Name       | Type               | Default | Notes  |
| ---------- | ------------------ | ------- | ------ |
| `severity` | `RED` or `YELLOW`  | both    | Filter |
| `page`     | integer, 1 or more | 1       |        |
| `pageSize` | integer, 1 to 100  | 25      |        |

```json
{
  "data": [
    {
      "ruleKey": "SingleStockConcentration",
      "severity": "RED",
      "subject": { "type": "stock", "value": "AAPL" },
      "actual": 0.333,
      "threshold": 0.25,
      "message": "AAPL is 33.3% of your portfolio, above the 25% red limit."
    },
    {
      "ruleKey": "SingleStockConcentration",
      "severity": "YELLOW",
      "subject": { "type": "stock", "value": "MSFT" },
      "actual": 0.222,
      "threshold": 0.1,
      "message": "MSFT is 22.2% of your portfolio, above the 10% yellow limit."
    }
  ],
  "meta": { "page": 1, "pageSize": 25, "total": 3 },
  "error": null
}
```

- Sorted by severity (RED first), then by biggest overshoot, then alphabetically (Sep 22 doc).
- A rule that has several problem buckets (like target deviation) produces several warnings, one per bucket.

### 6.4 `GET /api/v1/risk/concentration`

Query: `limit` (integer, 1 to 20, default 5), the number of buckets returned per type.

```json
{
  "data": {
    "stock": {
      "thresholds": { "max": 0.1, "redMax": 0.25 },
      "buckets": [
        {
          "value": "AAPL",
          "name": "Apple Inc.",
          "percentage": 0.333,
          "severity": "RED"
        },
        {
          "value": "MSFT",
          "name": "Microsoft Corp.",
          "percentage": 0.222,
          "severity": "YELLOW"
        }
      ]
    },
    "sector": {
      "thresholds": { "max": 0.3, "redMax": 0.5 },
      "buckets": [
        {
          "value": "Technology",
          "name": "Technology",
          "percentage": 0.41,
          "severity": "YELLOW"
        }
      ]
    },
    "country": {
      "thresholds": { "max": 0.5, "redMax": 0.75 },
      "buckets": [
        {
          "value": "US",
          "name": "United States",
          "percentage": 0.48,
          "severity": "GREEN"
        }
      ]
    },
    "currency": {
      "thresholds": { "max": 0.5, "redMax": 0.75 },
      "buckets": [
        {
          "value": "USD",
          "name": "US Dollar",
          "percentage": 0.58,
          "severity": "YELLOW"
        }
      ]
    }
  },
  "meta": {},
  "error": null
}
```

- Buckets are sorted from largest to smallest.
- The `stock` group only contains individual securities (sub-class `STOCK` or `CRYPTOCURRENCY`), not ETFs or funds (Sep 22 doc).
- `sector` and `country` percentages use the weighted split from the Sep 17 doc, so a diversified ETF is spread across its sectors and countries.
- Holdings with no sector or country data are grouped under `"value": "UNKNOWN"` so the percentages still add up.
- This returns more than the score's rules do. The rules only need the largest bucket to pass or fail, but the dashboard wants the top few.

### 6.5 `GET /api/v1/risk/target-allocation`

When a target exists:

```json
{
  "data": {
    "isSet": true,
    "groupBy": "assetClass",
    "thresholds": { "max": 0.05, "redMax": 0.1 },
    "targets": [
      { "key": "EQUITY", "percentage": 0.6 },
      { "key": "FIXED_INCOME", "percentage": 0.3 },
      { "key": "CASH", "percentage": 0.1 }
    ],
    "buckets": [
      {
        "key": "EQUITY",
        "target": 0.6,
        "actual": 0.68,
        "deviation": 0.08,
        "severity": "YELLOW"
      },
      {
        "key": "FIXED_INCOME",
        "target": 0.3,
        "actual": 0.27,
        "deviation": -0.03,
        "severity": "GREEN"
      },
      {
        "key": "CASH",
        "target": 0.1,
        "actual": 0.05,
        "deviation": -0.05,
        "severity": "GREEN"
      }
    ]
  },
  "meta": {},
  "error": null
}
```

When nothing is set, the response is still a successful one: `"data": { "isSet": false, "groupBy": null, "thresholds": null, "targets": [], "buckets": [] }`. It isn't an error, and using `data: null` for a success would be confusing next to the error convention.

- `deviation` is signed. Positive means overweight, negative means underweight.
- A bucket that exists in the portfolio but not in the target is listed with `"target": 0` (the Sep 21 rule that missing buckets count as a 0% target).
- For `groupBy: "assetClass"`, valid keys are the values of the `AssetClass` enum plus `"CASH"` for the account cash balance.

### 6.6 `PUT /api/v1/risk/target-allocation`

Replaces the whole target.

```json
{
  "groupBy": "assetClass",
  "targets": [
    { "key": "EQUITY", "percentage": 0.6 },
    { "key": "FIXED_INCOME", "percentage": 0.3 },
    { "key": "CASH", "percentage": 0.1 }
  ]
}
```

Validation (rejects with `400` and does not save anything):

- `groupBy` is one of `assetClass`, `sector`, `country`, `currency`, `symbol`.
- At least one target, and each `key` appears only once.
- Every `percentage` is between 0 and 1.
- The percentages add up to exactly 1, allowing a rounding tolerance of 0.0001. It is rejected, not silently rescaled (Sep 21 doc).
- Every `key` is valid for the chosen `groupBy`.

Response: the same body as `GET /target-allocation` after saving.

### 6.7 `DELETE /api/v1/risk/target-allocation`

No body. Returns the `isSet: false` response. Deleting when nothing is set is fine and returns the same thing.

### 6.8 `GET /api/v1/risk/thresholds`

```json
{
  "data": [
    {
      "ruleKey": "SingleStockConcentration",
      "name": "Single stock concentration",
      "shape": "ceiling",
      "isActive": true,
      "isCustomized": false,
      "thresholds": { "max": 0.1, "redMax": 0.25 },
      "defaults": { "max": 0.1, "redMax": 0.25 }
    },
    {
      "ruleKey": "PortfolioVolatility",
      "name": "Volatility estimate",
      "shape": "band",
      "isActive": true,
      "isCustomized": true,
      "thresholds": { "min": 0.08, "max": 0.3, "redMin": 0.05, "redMax": 0.4 },
      "defaults": { "min": 0.1, "max": 0.25, "redMin": 0.05, "redMax": 0.35 }
    }
  ],
  "meta": { "page": 1, "pageSize": 25, "total": 7 },
  "error": null
}
```

- Covers the seven risk rules from the Sep 22 table. The 17 existing X-Ray rules keep their current settings screen.
- `shape` is `ceiling` or `band`, so the settings form knows whether to show one limit or a min/max pair.

### 6.9 `PUT /api/v1/risk/thresholds/:ruleKey`

```json
{
  "isActive": true,
  "thresholds": { "max": 0.15, "redMax": 0.3 }
}
```

- Both fields are optional, but at least one must be present.
- Validation follows the Sep 22 doc: ceiling checks need `max < redMax`; band checks need `redMin < min < max < redMax`; every value is between 0 and 1.
- Anything left out of `thresholds` keeps its current value.
- Response: the updated item in the same shape as one entry of `GET /thresholds`.
- Stored in `user.settings.xRayRules[ruleKey]` (`thresholdMax`, `thresholdMin`, `redThresholdMax`, `redThresholdMin`).

### 6.10 `DELETE /api/v1/risk/thresholds/:ruleKey`

Removes the override so the rule goes back to its defaults. Returns the default item (`isCustomized: false`).

### 6.11 `POST /api/v1/risk/what-if`

Request (from the Sep 23 doc):

```json
{
  "dataSource": "YAHOO",
  "symbol": "AAPL",
  "dropPercentage": 0.4
}
```

Response (numbers match the worked example in the Sep 23 doc; the score values are illustrative):

```json
{
  "data": {
    "scenario": {
      "dataSource": "YAHOO",
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "dropPercentage": 0.4
    },
    "portfolio": {
      "valueBefore": { "amount": 100000, "currency": "USD" },
      "valueAfter": { "amount": 88000, "currency": "USD" },
      "change": { "amount": -12000, "currency": "USD" },
      "changePercentage": -0.12
    },
    "holding": {
      "valueBefore": { "amount": 30000, "currency": "USD" },
      "valueAfter": { "amount": 18000, "currency": "USD" },
      "allocationBefore": 0.3333,
      "allocationAfter": 0.2308
    },
    "score": { "before": 72, "after": 70, "change": -2 },
    "categories": [
      { "key": "concentration", "scoreBefore": 45, "scoreAfter": 45 }
    ],
    "ruleChanges": [
      {
        "ruleKey": "SingleStockConcentration",
        "severityBefore": "RED",
        "severityAfter": "RED",
        "actualBefore": 0.3333,
        "actualAfter": 0.2564
      }
    ],
    "newWarnings": [],
    "resolvedWarnings": [],
    "changedWarnings": [
      {
        "ruleKey": "SingleStockConcentration",
        "severity": "YELLOW",
        "subject": { "type": "stock", "value": "AAPL" },
        "actual": 0.2308,
        "threshold": 0.1,
        "message": "AAPL is 23.1% of your portfolio, above the 10% yellow limit."
      },
      {
        "ruleKey": "SingleStockConcentration",
        "severity": "RED",
        "subject": { "type": "stock", "value": "MSFT" },
        "actual": 0.2564,
        "threshold": 0.25,
        "message": "MSFT is 25.6% of your portfolio, above the 25% red limit."
      }
    ],
    "skippedRules": [],
    "calculatedAt": "2026-09-26T09:14:00Z"
  },
  "meta": {},
  "error": null
}
```

- `ruleChanges` shows the rule's **worst** bucket before and after (here the rule stays RED overall because MSFT took over from AAPL), while `changedWarnings` shows the per-holding movement (AAPL down to yellow, MSFT up to red). The UI uses `changedWarnings` for the "What changed" list.
- Nothing is saved. Repeating the same request gives the same answer.

## 7. Errors

All errors use Raniya's shape: `data: null`, then `error: { code, message }`.

```json
{
  "data": null,
  "meta": {},
  "error": {
    "code": "RISK_TARGET_INVALID_SUM",
    "message": "Target percentages must add up to 100%. They currently add up to 95%."
  }
}
```

| HTTP | Code                            | When                                                                    |
| ---- | ------------------------------- | ----------------------------------------------------------------------- |
| 400  | `RISK_INVALID_QUERY`            | Bad `severity`, `page`, `pageSize` or `limit`                           |
| 400  | `RISK_TARGET_INVALID_SUM`       | Target percentages don't add up to 1                                    |
| 400  | `RISK_TARGET_DUPLICATE_KEY`     | The same key appears twice in the target                                |
| 400  | `RISK_TARGET_INVALID_KEY`       | A key isn't valid for the chosen `groupBy`                              |
| 400  | `RISK_THRESHOLD_INVALID_ORDER`  | Limits are in the wrong order (for example `redMax` below `max`)        |
| 400  | `RISK_THRESHOLD_OUT_OF_RANGE`   | A limit is below 0 or above 1                                           |
| 404  | `RISK_RULE_NOT_FOUND`           | `:ruleKey` isn't one of the seven risk rules                            |
| 400  | `RISK_WHATIF_INVALID_DROP`      | `dropPercentage` is 0 or less, above 1, or not a number                 |
| 404  | `RISK_WHATIF_HOLDING_NOT_FOUND` | The holding doesn't exist or is closed                                  |
| 500  | `RISK_CALC_FAILED`              | An unexpected calculation failure (the code Raniya used in her example) |

- Login and permission failures (401 and 403) come from the existing guards. They aren't feature-specific, so they should get shared codes like `AUTH_UNAUTHORIZED` from whoever builds the envelope filter (see section 9).
- Things that are not errors: an empty portfolio, no active rules, no target set, missing volatility history. These are successful responses with `NO_DATA`, `null` or `skippedRules`, so the page can always render.

## 8. Reconciled with Raniya's dashboard spec

Her `dashboard-field-spec.md` (Sep 22) marked the risk fields as provisional and asked for a check today. Result:

| Her field (`risk.*`)   | Comes from                                   | Status                                                            |
| ---------------------- | -------------------------------------------- | ----------------------------------------------------------------- |
| `healthScore`          | `GET /risk/summary` → `healthScore`          | Matches. Can be `null` when no rules are active                   |
| `topConcentrationRisk` | `GET /risk/summary` → `topConcentrationRisk` | Matches: same `type`, `value`, `percentage`, lowercase type names |

Fields I'm adding that her model doesn't have yet:

- `risk.severity` (overall green, yellow or red for the badge).
- `risk.topConcentrationRisk.severity`.
- `risk.calculatedAt` (so the card can say how fresh the number is).

She can add these to the aggregation model, or ignore them and the dashboard still works.

## 9. Non-functional expectations

From the lecture: a contract should say the constraints, not only the shapes.

- **Speed:** `summary`, `score`, `warnings` and `concentration` under about 1 second for up to 100 holdings. `what-if` under about 1 second. Both rely on the volatility numbers being pre-computed nightly, never calculated during the request.
- **Freshness:** volatility is as old as the last nightly run. The response's `calculatedAt` is when the score was calculated, and the volatility rule's `details` can carry its own `asOf` date.
- **Isolation:** every query is scoped to the user in the token.
- **Validation:** all input is validated with `class-validator` DTOs at the edge, the way existing Ghostfolio controllers do it.
- **No side effects on reads:** `GET` and `POST /what-if` never write.
- **Stable order:** lists have a deterministic order, so pages don't reshuffle between refreshes.

## 10. Implementation notes (for Iteration 2)

- **Module layout** (from Raniya's `target-architecture.md`): `apps/api/src/app/risk/` with `risk.controller.ts`, `risk.module.ts`, `risk.service.ts`, plus supporting services for concentration, volatility, the health score calculator and the what-if.
- **DTOs:** `get-risk-warnings.dto.ts`, `get-risk-concentration.dto.ts`, `update-target-allocation.dto.ts`, `update-risk-threshold.dto.ts`, `run-what-if.dto.ts`.
- **Settings storage:** `user.settings.xRayRules` (extended with `redThresholdMax` and `redThresholdMin`) and `user.settings.targetAllocation`. No database migration.
- **Existing settings endpoint:** `PUT /api/v1/user/setting` already accepts `xRayRules`. Once `RuleSettings` gets the new red fields, that path would accept them too, so the same validation must run there. The risk endpoints are the validated path.
- **The envelope doesn't exist yet.** I checked the code: existing controllers return their payload directly (for example `getReport` returns the report object, no wrapper), and the existing exception filters are specific to MCP and portfolio snapshots. So `{ data, meta, error }` needs a **shared response interceptor and exception filter**. This is cross-cutting, so I'd suggest Raniya builds it in Iteration 2 week 1 alongside the service boundaries, and all four modules use it. Old endpoints are untouched, so nothing existing breaks.

## 11. Open questions

- **Basic subscription:** mirror today's X-Ray behavior (rules hidden, score visible), or hide the risk score entirely? I assumed the first.
- **Grade letters:** are A/B/C/D/F at 90/80/70/60 fine, or should the letter be dropped and the badge used alone?
- **Caching the score:** compute per request (simple), or cache for a few minutes keyed by user? I left it as compute per request for v1.
- **Envelope owner:** confirm Raniya builds the shared interceptor and exception filter.
- **`CASH` key:** the target allocation uses `"CASH"` for the account cash balance, which isn't in the `AssetClass` enum. Worth a quick check that everyone is fine with a special key.
