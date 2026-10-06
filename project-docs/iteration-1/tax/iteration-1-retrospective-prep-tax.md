# Iteration 1 Retrospective Prep — Tax Feature

**Prepared by:** Tharun Swaminathan
**Iteration:** 1 — Design & Data Modelling
**Date:** September 30, 2026
**Feature:** Tax Metrics & Tax Calculations
**Purpose:** Retrospective preparation and Iteration 2 handoff

> This document is preparation for the Iteration 1 retrospective. It does not
> claim that the retrospective meeting has already taken place. Meeting-specific
> details such as attendance, final team comments, and the board photo should be
> added after the actual retrospective.

## 1. Iteration 1 Objective

The purpose of Iteration 1 was to understand the existing Ghostfolio codebase,
design the tax feature in detail, and prepare an implementation-ready backlog
for Iteration 2.

No full tax backend implementation was planned for this iteration.

The tax work focused on:

- understanding Ghostfolio's existing transaction and dividend model;
- designing withholding-tax storage;
- specifying FIFO capital-gains calculations;
- specifying average-cost calculations;
- designing tax-lot and calculation-trace structures;
- designing yearly tax summaries;
- defining tax-relevant activity filtering;
- defining CSV/PDF tax exports;
- preparing implementation backlog items;
- peer-reviewing Arthur's chart data model;
- writing the tax Design and Architecture report section.

## 2. Completed Tax Deliverables

The following Iteration 1 tax documents were completed and merged:

```text
transaction-dividend-data-model.md
withholding-tax-schema.md
fifo-capital-gains-spec.md
average-cost-capital-gains-spec.md
tax-lot-data-model.md
yearly-tax-summary-data-structure.md
tax-relevant-filtering-spec.md
tax-export-format-spec.md
sep25-tax-github-issues.md
peer-review-arthur-chart-data-model.md
tax-design-architecture-report-section.md
```

The completed work provides the design baseline for the Iteration 2 tax backend.

## 3. Main Tax Design Decisions

The main decisions from Iteration 1 were:

1. Extend Ghostfolio's existing `Order` activity model instead of creating a
   separate tax transaction system.

2. Store only tax-specific source metadata such as:

   ```text
   withholdingTax
   isTaxRelevant
   ```

3. Keep gross dividend, withholding tax, withholding rate, net dividend, and
   activity fees separate.

4. Support:

   ```text
   FIFO
   AVERAGE_COST
   ```

   as separate calculation strategies over one normalized activity pipeline.

5. Use deterministic transaction ordering:

   ```text
   date ascending
   then activity id ascending
   ```

6. Reuse Ghostfolio's existing stock-split handling instead of building a second
   split system.

7. Keep missing historical FX values explicit instead of treating them as zero
   or assuming a 1:1 rate.

8. Derive rather than permanently persist:

   ```text
   FIFO lots
   FIFO matches
   average-cost state
   realized-gain records
   yearly summaries
   export data
   ```

9. Keep tax calculations separate from the existing performance/ROAI
   calculator.

10. Make yearly summaries and exports consume common tax results instead of
    recalculating FIFO or average cost independently.

## 4. What Went Well

### Repository-first design

The tax work started by reading the existing Ghostfolio transaction, dividend,
activity, import, currency, stock-split, and portfolio-calculation code.

This reduced the risk of designing a second system that did not fit the current
application.

### Clear tax feature ownership

The tax work stayed within Tharun's ownership while shared architecture changes
were identified for later coordination.

This avoided unnecessary changes to:

- Sesha's risk feature;
- Arthur's performance-chart feature;
- Raniya's shared React/dashboard architecture.

### Detailed calculation specifications

FIFO and average cost were defined with:

- inputs;
- ordering;
- formulas;
- fee handling;
- traceability;
- missing-data behavior;
- edge cases;
- planned tests.

This should reduce redesign during Iteration 2.

### Traceability was designed early

The design preserves source activity IDs and calculation traces.

FIFO can trace:

```text
SELL
-> FIFO match
-> BUY
```

Average cost can trace:

```text
activity
-> pool before
-> allocation
-> pool after
```

This will help both debugging and tax-report exports.

### Null and zero values were kept distinct

The withholding-tax design distinguishes:

```text
null = unknown
0 = known zero
```

The same general principle was applied to unavailable FX and incomplete yearly
summary values.

This prevents missing financial information from being silently reported as
zero.

### Existing Ghostfolio behavior was protected

The tax design avoids changing the existing ROAI/performance calculator to use
FIFO.

This keeps tax cost basis separate from performance calculations and reduces
cross-feature regression risk.

### Work was committed and reviewed incrementally

The design documents were committed and merged through focused pull requests
instead of being introduced as one large change at the end.

That made the Iteration 1 history easier to review.

### Peer review found integration risks before coding

The chart peer review identified several places where proposed performance-chart
contracts did not fully match the existing Ghostfolio implementation.

Finding those issues during design is cheaper than fixing them after backend or
frontend code is written.

## 5. What Could Be Improved

### Shared architecture decisions should be finalized earlier

Some tax design points still depend on common project decisions, including:

- final tax service/module location;
- shared API error format;
- high-precision numeric serialization;
- date/time boundary convention;
- dashboard summary contract;
- shared React component behavior.

These should be agreed before Iteration 2 implementation reaches shared files.

### Branch synchronization should happen more frequently

During Iteration 1, team branches sometimes became behind `main`.

This made peer review harder because repository comparisons could include
unrelated changes.

For Iteration 2, branches should be synchronized before:

- starting a new issue;
- requesting review;
- opening a PR.

### Backlog documents and actual GitHub issues should be clearly distinguished

A Markdown backlog is useful documentation, but the team should make sure
required tasks are also represented as actual GitHub issues when the assignment
expects issue tracking.

The report should not claim issue numbers unless they are verified.

### Shared terminology should be standardized

Terms such as:

```text
gross gain
fee-adjusted gain
invested capital
base currency
incomplete result
```

should have one shared meaning across APIs, UI, reports, and documentation.

### Retrospective evidence should be collected during the iteration

Scrum meeting notes, issue links, screenshots, and board evidence are easier to
manage when collected continuously rather than reconstructed at the end.

## 6. Problems / Risks Identified

### Historical activity edits can change later tax results

A historical BUY or SELL can affect every later FIFO or average-cost result.

The implementation must recalculate the affected scope rather than update only
one result row.

### Tax-relevant exclusions can make history incomplete

Excluding historical investment activity can make later cost basis incomplete.

The system must preserve diagnostics such as:

```text
TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY
```

instead of silently repairing the source history.

### Missing FX data must remain visible

A missing historical conversion should not become:

```text
0
```

or:

```text
1:1 conversion
```

The affected base-currency result should remain unavailable.

### Shared architecture changes could affect other members

DTOs, shared interfaces, activity services, import/export logic, and React
components can affect other project areas.

Coordination is required before changing shared architecture.

## 7. Actions / Improvements for Iteration 2

### Action 1 — Start each issue with a repository check

Before implementation:

```text
read current behavior
find similar code
identify affected files
identify tests
confirm shared dependencies
```

### Action 2 — Keep calculation logic isolated

FIFO, average cost, withholding, yearly summaries, and exports should remain in
tax-domain services.

Do not put calculation logic into React components.

### Action 3 — Add numeric tests with implementation

Each financial calculation issue should include tests that assert exact expected
values.

Important cases include:

- zero values;
- multiple BUYs;
- multiple SELLs;
- partial FIFO lots;
- same-date ordering;
- fractional quantities;
- fees;
- stock splits;
- missing FX;
- insufficient history;
- null/zero withholding.

### Action 4 — Coordinate shared files before editing

Before changing:

```text
shared DTOs
shared interfaces
dashboard contracts
React component library
shared API conventions
```

coordinate with Raniya.

### Action 5 — Keep `main` and feature branches synchronized

Sync before starting major work and before creating PRs.

### Action 6 — Maintain Scrum notes during Iteration 2

Because Tharun is Scrum Master for Iteration 2, each Scrum note should include:

```text
date
attendance
progress
blockers
next actions
```

### Action 7 — Keep issue and commit scope small

Each daily task should map to a focused GitHub issue/commit as required by the
sprint plan.

## 8. Iteration 2 Tax Handoff

The planned tax backend sequence is:

```text
Week 1
Withholding-tax field + storage

Week 2
FIFO capital-gains engine

Week 3
Average-cost engine + tax-lot tracker

Week 4
Yearly summary + CSV/PDF export + unit tests
```

The implementation order should preserve dependencies.

Recommended dependency flow:

```text
source fields / normalization
        |
        v
FIFO + Average Cost
        |
        v
derived trace / tax-lot data
        |
        v
yearly summary
        |
        v
CSV/PDF export
        |
        v
integration/regression testing
```

## 9. Open Items to Confirm Before Iteration 2

These are coordination questions, not missing tax formulas.

### Shared API contract

Confirm:

- where tax interfaces live;
- how `Big`/high-precision values are serialized;
- common warning/error response shape.

### Date convention

Confirm one application-wide convention for yearly/date boundaries.

### Dashboard projection

Confirm which yearly tax values the Unified Dashboard consumes and how
incomplete/null values are shown.

### React integration

Confirm how the shared React component library will expose:

- activity field controls;
- tables;
- summary cards;
- export/download behavior.

### PDF implementation dependency

The Iteration 1 design did not choose a dedicated PDF library.

Choose the smallest compatible backend approach during Iteration 2 after checking
build compatibility, pagination, and testability.

## 10. Retrospective Board Content

The final retrospective board should be grouped into three areas.

### Strengths

```text
Clear feature ownership
Repository-first design
Detailed calculation specifications
Traceable tax calculations
Focused commits and PRs
Early peer review
Good separation between tax and performance logic
```

### Weaknesses / Problems

```text
Some branches became behind main
Shared API decisions were not all finalized early
Some design assumptions required later repository correction
Issue/backlog evidence should be kept more consistently
Cross-feature terminology needs stronger standardization
```

### Actions / Improvements

```text
Sync branches before work/review
Confirm shared contracts before implementation
Write numeric tests with each calculator
Keep financial logic out of frontend components
Maintain Scrum notes continuously
Use focused issue/commit scopes
Resolve shared date/currency/serialization conventions early
```

## 11. Board Photo Placeholder

Insert the actual Iteration 1 retrospective board photo or screenshot here after
the retrospective meeting.

```text
[PLACEHOLDER — ITERATION 1 RETROSPECTIVE BOARD PHOTO]

Board sections:
- Strengths
- Weaknesses / Problems
- Actions / Improvements

Replace this placeholder after the actual retrospective.
```

Do not present a generated/fake board image as evidence of a meeting that did not
occur.

## 12. Meeting Details Placeholder

Complete after the retrospective meeting:

```text
Date:
Time:
Attendees:
Scrum Master:
Main discussion points:
Agreed action items:
```

Only record actual attendance and discussion.

## 13. Evidence Checklist for Final Iteration 1 Report

Before the Iteration 1 report is finalized, verify:

- [ ] tax design documents are present on `main`;
- [ ] Sep 28 chart peer review is merged;
- [ ] Sep 29 tax Design/Architecture section is merged;
- [ ] tax backlog / GitHub issue evidence is available;
- [ ] Scrum meeting notes are available;
- [ ] retrospective board photo/screenshot is available;
- [ ] retrospective strengths/problems/actions are finalized by the team;
- [ ] no planned work is described as implemented work;
- [ ] no unverified test results are claimed;
- [ ] no unverified issue/PR numbers are added to the report.

## 14. Suggested Retrospective Summary for the Final Report

During Iteration 1, the team focused on understanding Ghostfolio's existing
architecture and defining the data models and calculation behavior required for
the new risk, tax, chart, and dashboard features. For the tax feature, the
repository-first approach worked well because it allowed the new design to reuse
the existing activity, currency, stock-split, import, and export patterns rather
than creating a separate transaction system.

A major strength of the iteration was the separation of feature ownership and
the use of detailed design documents before implementation. For tax analytics,
FIFO, average cost, withholding, tax lots, filtering, yearly summaries, and
exports were specified before backend coding begins.

The main areas for improvement are branch synchronization and earlier agreement
on shared contracts. Some design work depended on common decisions around API
interfaces, date handling, numeric serialization, and shared frontend
components. In Iteration 2, the team should confirm these shared conventions
early and keep feature branches synchronized with `main` before reviews and PRs.

The team will carry the completed Iteration 1 specifications into Iteration 2,
where the focus shifts from design to backend implementation and numeric unit
testing.

## 15. Iteration 1 Tax Status

```text
Design/model review                         COMPLETE
Withholding-tax schema                     COMPLETE
FIFO specification                         COMPLETE
Average-cost specification                 COMPLETE
Tax-lot model                              COMPLETE
Yearly summary design                      COMPLETE
Tax-relevant filtering design              COMPLETE
CSV/PDF export design                      COMPLETE
Implementation backlog document            COMPLETE
Arthur chart peer review                   COMPLETE
Tax Design/Architecture report section     COMPLETE

Backend implementation                     NOT STARTED — Iteration 2
React implementation                       NOT STARTED — Iteration 3
Final retrospective meeting/photo          PENDING actual retrospective
```

This status intentionally separates completed design work from future
implementation.
