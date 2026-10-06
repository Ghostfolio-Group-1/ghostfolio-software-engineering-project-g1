# UML Diagrams — Proposed Ghostfolio Features

**Author:** sesha siva sankar (member 1)
**Date:** Sun, Sep 20
**Scope:** use case, class and activity diagrams for the proposed features (risk, tax, charts) plus the unified dashboard

---

## 0. How I built these

Followed the requirements engineering lecture (Module 2.2) step by step:

- **Step 1 — actors:** who or what talks to the system from the outside.
- **Step 2 — use cases:** what each actor gets out of the system (use case diagram).
- **Step 3 — object model:** the domain classes, attributes and links between them (class diagram).
- **Step 4 — behavior:** the flow of one scenario from start to end (activity diagram).

Things I lined up with the team's docs so we don't contradict each other:

- Tharun's `withholdingTax` field on dividend activities and his FIFO working-lot fields.
- Arthur's `TimeRangeSelection` and `ChartSeriesResponse` types.
- Raniya's rule that the dashboard only calls the risk, tax and charts modules through their APIs, never their services.
- My own docs 02 to 05 for the health score, concentration, volatility, cash and target-deviation logic.

Diagrams are Mermaid, so GitHub renders them straight from this file. Mermaid has no stick figures, so actors show as boxes tagged «actor».

---

## 1. Actors

- **Investor** — the human user. Views scores, charts and tax numbers, and sets preferences.
- **Market Data Provider** — external system (Yahoo, CoinGecko and so on). Supplies price history and benchmark prices.
- **Scheduler** — system actor. Runs the nightly job that refreshes the cached volatility numbers (the lecture asks "are there scheduled processes?", and there is one).

---

## 2. Use case diagram

- One box for the whole extension, split into four groups.
- Dotted arrows are «include» (the use case always calls the other one).
- Investor is the main actor; the other two only touch the data-heavy use cases.

```mermaid
flowchart LR
    investor["«actor»<br/>Investor"]
    provider["«actor»<br/>Market Data Provider"]
    scheduler["«actor»<br/>Scheduler"]

    subgraph system["Ghostfolio Extension"]
        subgraph risk["Portfolio Health and Risk"]
            R1(["View health score"])
            R2(["View risk dashboard"])
            R3(["Set target allocation"])
            R4(["Configure warning thresholds"])
            R5(["Run what-if simulation"])
            R6(["Calculate health score"])
            R7(["Estimate volatility"])
            R8(["Refresh volatility cache"])
        end

        subgraph tax["Tax Metrics and Calculations"]
            T1(["Record withholding tax on dividend"])
            T2(["Mark transaction as tax relevant"])
            T3(["Choose cost-basis method"])
            T4(["View realized capital gains"])
            T5(["View tax lots"])
            T6(["View yearly tax summary"])
            T7(["Export tax records"])
            T8(["Calculate realized gains"])
        end

        subgraph charts["Upgraded Performance Charts"]
            C1(["Zoom, pan and pick time range"])
            C2(["Toggle value, invested capital or cash"])
            C3(["Compare total return vs price return"])
            C4(["View contribution chart"])
            C5(["Compare against benchmark"])
            C6(["View drawdown chart"])
        end

        subgraph dash["Unified Dashboard"]
            D1(["View unified overview dashboard"])
        end
    end

    investor --- R1
    investor --- R2
    investor --- R3
    investor --- R4
    investor --- R5
    investor --- T1
    investor --- T2
    investor --- T3
    investor --- T4
    investor --- T5
    investor --- T6
    investor --- T7
    investor --- C1
    investor --- C2
    investor --- C3
    investor --- C4
    investor --- C5
    investor --- C6
    investor --- D1

    R7 --- provider
    C5 --- provider
    R8 --- scheduler

    R1 -.->|"«include»"| R6
    R2 -.->|"«include»"| R6
    R5 -.->|"«include»"| R6
    R6 -.->|"«include»"| R7
    R8 -.->|"«include»"| R7

    T4 -.->|"«include»"| T8
    T6 -.->|"«include»"| T8
    T8 -.->|"«include»"| T3
    T5 -.->|"«include»"| T8

    D1 -.->|"«include»"| R1
    D1 -.->|"«include»"| T6
    D1 -.->|"«include»"| C2
```

Reading notes:

- **Risk:** "View health score", "View risk dashboard" and "Run what-if simulation" all need a fresh score, so each includes "Calculate health score". That in turn includes "Estimate volatility", which is the only place the Market Data Provider is needed.
- **Tax:** every number the investor sees (gains, lots, yearly summary) goes through "Calculate realized gains", which always uses the chosen cost-basis method (FIFO or average cost).
- **Charts:** these stay simple. The one outside dependency is the benchmark prices.
- **Dashboard:** it does not calculate anything itself. It pulls the health score, yearly tax summary and the value chart from the three feature APIs.

---

## 3. Class diagrams (analysis object model)

- Domain-level classes only, the way the lecture describes it: user-level concepts, not final code classes.
- Existing Ghostfolio classes are tagged `«existing»`. Everything else is new.
- Split into four diagrams (one per feature) so each one stays readable.

### 3.1 Risk

Reuses Ghostfolio's existing abstract `Rule` (every X-Ray check already extends it), so the new checks are just new subclasses. That's the generalization and abstraction idea from the lecture.

```mermaid
    classDiagram
        class User {
            <<existing>>
            +id
            +settings
        }
        class Holding {
            <<existing>>
            +symbol
            +valueInBaseCurrency
            +allocationPercentage
        }
        class Rule {
            <<abstract, existing>>
            +getName() string
            +getSettings(userSettings) RuleSettings
            +evaluate(settings) EvaluationResult
        }
        class EvaluationResult {
            <<existing>>
            +evaluation string
            +value boolean
        }
        class ClusterRiskRule {
            <<existing>>
            +thresholdMin
            +thresholdMax
        }
        class ConcentrationRule {
            +groupBy ConcentrationType
            +thresholdMax
        }
        class VolatilityRule {
            +lookbackDays
            +thresholdMin
            +thresholdMax
        }
        class CashAllocationRule {
            +thresholdMin
            +thresholdMax
        }
        class TargetDeviationRule {
            +thresholdMax
        }
        class ConcentrationType {
            <<enumeration>>
            STOCK
            SECTOR
            COUNTRY
            CURRENCY
        }
        class HealthScoreCalculator {
            +calculate(results, weights) HealthScore
        }
        class HealthScore {
            +score number
            +grade string
            +activeWeight number
            +calculatedAt date
        }
        class CategoryScore {
            +key string
            +name string
            +weight number
            +score number
        }
        class RuleScore {
            +ruleKey string
            +weight number
            +passed boolean
            +message string
        }
        class TargetAllocation {
            +isActive boolean
            +groupBy string
        }
        class TargetEntry {
            +key string
            +percentage number
        }
        class WarningThreshold {
            +ruleKey string
            +isActive boolean
            +thresholdMin number
            +thresholdMax number
            +redThresholdMin number
            +redThresholdMax number
        }
        class RiskWarning {
            +severity Severity
            +message string
        }
        class Severity {
            <<enumeration>>
            GREEN
            YELLOW
            RED
        }
        class WhatIfScenario {
            +symbol string
            +dropPercentage number
        }
        class WhatIfResult {
            +valueBefore number
            +valueAfter number
            +scoreBefore number
            +scoreAfter number
        }

        Rule <|-- ClusterRiskRule
        Rule <|-- ConcentrationRule
        Rule <|-- VolatilityRule
        Rule <|-- CashAllocationRule
        Rule <|-- TargetDeviationRule
        Rule ..> EvaluationResult : returns
        ConcentrationRule --> ConcentrationType

        HealthScoreCalculator o-- Rule : runs many
        HealthScoreCalculator ..> HealthScore : creates
        HealthScore "1" *-- "1..*" CategoryScore
        CategoryScore "1" *-- "1..*" RuleScore
        HealthScore "1" --> "0..*" RiskWarning
        RiskWarning --> Severity

        User "1" --> "0..1" TargetAllocation : owns
        TargetAllocation "1" *-- "1..*" TargetEntry
        User "1" --> "0..*" WarningThreshold : configures
        TargetDeviationRule ..> TargetAllocation : reads
        RiskWarning ..> WarningThreshold : triggered by

        WhatIfScenario ..> Holding : shocks one
        WhatIfScenario --> WhatIfResult : produces
        WhatIfResult ..> HealthScoreCalculator : re-scores with
```

- `HealthScore` is composed of `CategoryScore`, which is composed of `RuleScore`. They have no life outside the score, so I used composition (filled diamond).
- `HealthScoreCalculator` only aggregates rules (empty diamond). The rules exist on their own.
- `TargetDeviationRule` is the only rule that depends on user input (`TargetAllocation`). If the user never set a target, that rule simply doesn't run.

### 3.2 Tax

Mostly new classes on top of Ghostfolio's existing activity (stored as `Order` in Prisma). The one new stored field is Tharun's `withholdingTax`.

```mermaid
classDiagram
    class Activity {
        <<existing, Order>>
        +id string
        +date date
        +type ActivityType
        +quantity number
        +unitPrice number
        +fee number
        +currency string
        +withholdingTax number nullable
        +isTaxRelevant boolean
    }
    class ActivityType {
        <<enumeration, existing>>
        BUY
        SELL
        DIVIDEND
        FEE
        INTEREST
        LIABILITY
    }
    class TaxCalculator {
        <<interface>>
        +calculate(activities) RealizedGain list
    }
    class FifoCalculator {
        +calculate(activities) RealizedGain list
    }
    class AverageCostCalculator {
        +calculate(activities) RealizedGain list
    }
    class CostBasisMethod {
        <<enumeration>>
        FIFO
        AVERAGE_COST
    }
    class TaxLot {
        +sourceActivityId string
        +acquiredAt date
        +initialQuantity number
        +remainingQuantity number
        +unitCost number
        +currency string
    }
    class RealizedGain {
        +sellActivityId string
        +quantity number
        +proceeds number
        +costBasis number
        +realizedGain number
        +method CostBasisMethod
    }
    class DividendRecord {
        +grossDividend number
        +withholdingTax number nullable
        +netDividend number
        +withholdingTaxRate number nullable
    }
    class YearlyTaxSummary {
        +year number
        +totalDividends number
        +totalWithholdingTax number
        +totalRealizedGain number
        +method CostBasisMethod
    }
    class TaxExport {
        +year number
        +format ExportFormat
        +generate() file
    }
    class ExportFormat {
        <<enumeration>>
        CSV
        PDF
    }

    Activity --> ActivityType
    TaxCalculator <|.. FifoCalculator
    TaxCalculator <|.. AverageCostCalculator
    TaxCalculator ..> CostBasisMethod : implements one
    TaxCalculator ..> Activity : reads BUY and SELL
    FifoCalculator "1" o-- "0..*" TaxLot : keeps open lots
    RealizedGain "*" --> "1..*" TaxLot : consumes
    Activity "1" --> "0..1" DividendRecord : derived when DIVIDEND
    YearlyTaxSummary "1" o-- "0..*" RealizedGain
    YearlyTaxSummary "1" o-- "0..*" DividendRecord
    TaxExport ..> YearlyTaxSummary : exports
    TaxExport --> ExportFormat
```

- `TaxCalculator` is an interface with two implementations. The investor picks one, and everything downstream (summary, export) doesn't care which one ran.
- `withholdingTax` is nullable on purpose (Tharun's rule): null means unknown, zero means known and nothing was withheld. `DividendRecord` keeps that difference, so the yearly summary never treats "unknown" as zero.
- `isTaxRelevant` matches Tharun's confirmed Sep 23 field exactly: a non-nullable boolean, defaulting to true, on the activity.

### 3.3 Charts

Uses Arthur's `TimeRangeSelection` and `ChartSeriesResponse` as written in his zoom/pan spec. The other classes follow his Sep 17 to Sep 23 tasks.

```mermaid
classDiagram
    class TimeRangeSelection {
        +mode string
        +preset string
        +startDate date
        +endDate date
    }
    class ChartSeriesResponse {
        +kind ChartSeriesKind
        +granularity Granularity
        +startDate date
        +endDate date
    }
    class SeriesPoint {
        +date date
        +value number
    }
    class Granularity {
        <<enumeration>>
        DAILY
        WEEKLY
    }
    class ChartSeriesKind {
        <<enumeration>>
        portfolioValue
        investedCapital
        cash
    }
    class ReturnComparisonResponse {
        +priceReturn number list
        +totalReturn number list
    }
    class ContributionEntry {
        +symbol string
        +contributionAmount number
        +contributionPercentage number
    }
    class BenchmarkComparison {
        +benchmarkSymbol string
        +portfolioReturn number
        +benchmarkReturn number
    }
    class DrawdownPeriod {
        +peakDate date
        +troughDate date
        +recoveryDate date nullable
        +depthPercentage number
    }
    class MarketData {
        <<existing>>
        +symbol string
        +date date
        +marketPrice number
    }

    ChartSeriesResponse "1" *-- "1..*" SeriesPoint
    ChartSeriesResponse --> Granularity
    ChartSeriesResponse --> ChartSeriesKind
    ChartSeriesResponse ..> TimeRangeSelection : answers
    ReturnComparisonResponse ..> TimeRangeSelection : for a range
    BenchmarkComparison "1" o-- "2" ChartSeriesResponse : portfolio and benchmark
    BenchmarkComparison ..> MarketData : benchmark prices
    DrawdownPeriod ..> ChartSeriesResponse : found in value series
    ContributionEntry ..> TimeRangeSelection : for a range
```

- Zoom and pan never create a new concept. Both just become a `custom` `TimeRangeSelection` (Arthur's design), so the backend has one simple contract.
- Granularity comes back with the data (daily up to 2 years, weekly beyond that), so the chart knows how to space the x-axis.
- `kind` (`ChartSeriesKind`, per Arthur's confirmed design) tags a `ChartSeriesResponse` so the frontend can label the axis without guessing which of value, invested capital or cash it's looking at.
- Total return and price return are not a toggle. `ReturnComparisonResponse` returns both as aligned, indexed series in one response, so the chart draws both lines at once and the gap between them is the point of the feature.

### 3.4 Unified dashboard

Only aggregates. It holds small summaries of the three features and never reaches into their services.

```mermaid
classDiagram
    class DashboardOverview {
        +generatedAt date
        +getOverview() DashboardOverview
    }
    class RiskSummary {
        +score number
        +grade string
        +topWarnings list
    }
    class TaxSummaryCard {
        +year number
        +totalRealizedGain number
        +totalWithholdingTax number
    }
    class PerformanceSummary {
        +kind ChartSeriesKind
        +latestValue number
        +changePercentage number
    }
    class RiskApi {
        <<boundary, API>>
        +getScore() HealthScore
    }
    class TaxApi {
        <<boundary, API>>
        +getYearlySummary() YearlyTaxSummary
    }
    class ChartsApi {
        <<boundary, API>>
        +getSeries() ChartSeriesResponse
    }

    DashboardOverview "1" *-- "1" RiskSummary
    DashboardOverview "1" *-- "1" TaxSummaryCard
    DashboardOverview "1" *-- "1" PerformanceSummary
    DashboardOverview ..> RiskApi : calls
    DashboardOverview ..> TaxApi : calls
    DashboardOverview ..> ChartsApi : calls
```

- The three `«boundary, API»` classes are the public controllers of each feature module. That is exactly Raniya's access rule: the dashboard is just another client of those APIs.
- Each summary is a small slice of a bigger object (for example `RiskSummary` is a slice of `HealthScore`), so the dashboard stays light.

---

## 4. Activity diagrams

- Notation from the lecture: filled circle is start, ringed circle is end, rounded box is an action, diamond is a decision or merge, thick bar is fork or join.
- One diagram per feature, each for its most important scenario.

### 4.1 Risk — calculate the health score

```mermaid
flowchart TD
    s(( )):::start --> a1["Load open holdings, accounts and user settings"]
    a1 --> d1{"Any open holdings?"}
    d1 -- "No" --> a2["Leave out holding-based categories"]
    d1 -- "Yes" --> a3["Keep all categories"]
    a2 --> m1(("merge"))
    a3 --> m1
    m1 --> a4["Build the rule list for each category"]
    a4 --> f1["fork"]:::bar

    f1 --> b1["Run existing X-Ray rules"]
    f1 --> b2["Run concentration rules for stock, sector, country and currency"]
    f1 --> b3["Read cached volatility and check the band"]
    f1 --> b4["Check cash allocation, and target deviation only if a target is set"]

    b1 --> j1["join"]:::bar
    b2 --> j1
    b3 --> j1
    b4 --> j1

    j1 --> a5["Drop rules the user turned off"]
    a5 --> d2{"Any active rules left?"}
    d2 -- "No" --> a6["Return score = null with a reason"]
    a6 --> e1(((" "))):::endNode
    d2 -- "Yes" --> a7["Score = passed weight / active weight x 100"]
    a7 --> a8["Work out each category sub-score"]
    a8 --> a9["Map results to green, yellow or red with the user thresholds"]
    a9 --> a10["Create a warning for every breached threshold"]
    a10 --> a11["Return HealthScore to the dashboard"]
    a11 --> e2(((" "))):::endNode

    classDef start fill:#000,stroke:#000
    classDef endNode fill:#fff,stroke:#000,stroke-width:3px
    classDef bar fill:#000,stroke:#000,color:#fff
```

- The four rule groups are independent, so they can run in parallel (fork and join).
- The "no active rules" exit matters: a user who turned everything off gets `null`, not a fake 100.

### 4.2 Risk — run a what-if simulation

```mermaid
flowchart TD
    s(( )):::start --> a1["Investor picks a holding and a drop percentage"]
    a1 --> d1{"Holding exists and 0 < drop <= 100?"}
    d1 -- "No" --> a2["Show a validation error"]
    a2 --> a1
    d1 -- "Yes" --> a3["Copy the current holdings, real data is never changed"]
    a3 --> a4["Reduce that holding's value by the drop percentage"]
    a4 --> a5["Recalculate total portfolio value"]
    a5 --> a6["Re-run the health score on the copied holdings"]
    a6 --> a7["Compare with the real portfolio: value change, score change, new warnings"]
    a7 --> a8["Show the result"]
    a8 --> d2{"Try another scenario?"}
    d2 -- "Yes" --> a1
    d2 -- "No" --> e1(((" "))):::endNode

    classDef start fill:#000,stroke:#000
    classDef endNode fill:#fff,stroke:#000,stroke-width:3px
```

### 4.3 Tax — calculate realized gains and export

```mermaid
flowchart TD
    s(( )):::start --> a1["Investor picks a tax year and a cost-basis method"]
    a1 --> a2["Load BUY, SELL and DIVIDEND activities marked tax relevant"]
    a2 --> a3["Group activities by asset"]
    a3 --> d1{"Which method?"}
    d1 -- "FIFO" --> a4["Match each SELL against the oldest open lots"]
    d1 -- "Average cost" --> a5["Match each SELL at the running average cost"]
    a4 --> m1(("merge"))
    a5 --> m1
    m1 --> a6["Compute realized gain for every SELL"]
    a6 --> a7["Add dividends and withholding tax, unknown withholding stays unknown"]
    a7 --> a8["Build the yearly tax summary"]
    a8 --> a9["Show summary, gains and tax lots"]
    a9 --> d2{"Export?"}
    d2 -- "No" --> e1(((" "))):::endNode
    d2 -- "Yes" --> d3{"Format?"}
    d3 -- "CSV" --> a10["Generate CSV file"]
    d3 -- "PDF" --> a11["Generate PDF file"]
    a10 --> a12["Download the file"]
    a11 --> a12
    a12 --> e2(((" "))):::endNode

    classDef start fill:#000,stroke:#000
    classDef endNode fill:#fff,stroke:#000,stroke-width:3px
```

### 4.4 Charts — interact with the performance chart

```mermaid
flowchart TD
    s(( )):::start --> a1["Open the chart with the default preset range"]
    a1 --> a2["Request the series from the charts API"]
    a2 --> a3["Backend picks granularity from the range width: daily up to 2 years, weekly beyond"]
    a3 --> a4["Return ChartSeriesResponse"]
    a4 --> a5["Redraw the chart"]
    a5 --> d1{"What does the investor do?"}

    d1 -- "Zoom or pan" --> b1["Turn the new window into a custom TimeRangeSelection"]
    d1 -- "Pick a preset" --> b2["Build a preset TimeRangeSelection"]
    d1 -- "Toggle value, invested capital or cash" --> b3["Change the selected series type"]
    d1 -- "Switch total vs price return" --> b4["Change the return type"]
    d1 -- "Leave the page" --> e1(((" "))):::endNode

    b1 --> m1(("merge"))
    b2 --> m1
    b3 --> m1
    b4 --> m1
    m1 --> a2

    classDef start fill:#000,stroke:#000
    classDef endNode fill:#fff,stroke:#000,stroke-width:3px
```

- This one is a loop by design: every interaction ends up as a new request with a new selection, then a redraw.

---

## 5. Things to double check before this goes in the report

- **Names owned by teammates, now confirmed:** `isTaxRelevant` matches Tharun's Sep 23 doc exactly. Arthur's real names differ from my first guess: it's `ChartSeriesKind` (a lowercase string union: `portfolioValue`, `investedCapital`, `cash`), not `SeriesType`/`PORTFOLIO_VALUE`; and there is no `ReturnType` toggle at all — total return and price return come back together as one `ReturnComparisonResponse`, since the feature's value is seeing both lines at once. The diagrams above have been corrected to match.
- **Composite score endpoint:** the iteration plan has no build slot for `HealthScoreCalculator` in Iteration 2, so it should become its own backlog issue.
- **Rendering:** the diagrams render on GitHub. For the PDF report, paste each block into mermaid.live and export as PNG or SVG.
