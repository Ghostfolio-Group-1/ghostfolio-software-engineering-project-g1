# Iteration 2 GitHub Audit — Preliminary through Oct 30, 2026

**Project:** Ghostfolio Extension — Portfolio Risk, Tax, Performance and Dashboard Analytics
**Iteration:** 2 — Backend Development
**Audit period:** October 2–30, 2026
**Iteration reporting period:** October 2–31, 2026
**Audit prepared for:** Issue #173
**Prepared by:** Tharun Swaminathan, Scrum Master — Iteration 2
**Repository snapshot:** `main` at `1b5972140`

## 1. Audit Status

This document is the preliminary GitHub audit used for the October 30 Iteration 2 retrospective.

The official reporting period continues through October 31. Therefore, this audit must be refreshed after the end of October 31 before the final November 1 submission.

This document does not treat planned work as completed work.

A task is treated as completed only where repository evidence supports the result through issues, commits, pull requests, reviews, CI, tests, or merge history.

The audit also distinguishes between:

```text
Direct meeting evidence
= actual meeting notes, attendance records, screenshots, calendar/chat evidence.

Team-provided scheduling evidence
= confirmed cancellation or shortened-meeting information.

GitHub-reconstructed Scrum evidence
= issues, PRs, reviews, commits, CI, merges and blockers showing
  the development state around a Scrum checkpoint.
```

GitHub activity can reconstruct development state and technical decisions. It cannot by itself prove meeting attendance or the exact discussion that occurred during a Scrum ceremony.

---

## 2. Existing Progress Report Cutoff

The provided Iteration 2 progress-report draft states that its report data is current through approximately October 21, 2026.

Review of the document confirms that most substantive completed activity is recorded through October 21.

Some later dates appear in planned schedules or future-work descriptions, but those references should not be interpreted as completed repository activity.

For the final report, the existing PDF should therefore be treated as an older progress snapshot rather than the authoritative final Iteration 2 state.

The final report must be reconciled against GitHub through October 31.

---

## 3. Repository-Wide Pull Request Summary

GitHub search for pull requests created between October 2 and October 30 returned:

| Repository identity | Team attribution                    | PRs created | PRs merged | Not merged as of audit |
| ------------------- | ----------------------------------- | ----------: | ---------: | ---------------------: |
| `TharunSwaminathan` | Tharun                              |          20 |         20 |                      0 |
| `sesha456`          | Sesha                               |          17 |         16 |                      1 |
| `Raniyafs`          | Raniya                              |          22 |         21 |                      1 |
| `Error404IsFound`   | Arthur / shared account attribution |          20 |          8 |                     12 |
| **Total**           |                                     |      **79** |     **65** |                 **14** |

Of the 14 PRs not merged:

- 13 are currently open;
- 1, PR #89, was closed without merge.

The `Error404IsFound` account is used for work attributed by the team to Arthur. The final report should preserve this GitHub-identity limitation rather than rewriting repository attribution as if GitHub independently identifies the individual user.

---

## 4. Current Open Pull Requests

The following Iteration 2-period pull requests remain open at the Oct 30 audit point:

| PR   | Area                                      | Current audit status                          |
| ---- | ----------------------------------------- | --------------------------------------------- |
| #50  | Charts / organization documentation       | Open                                          |
| #69  | Charts module / formatting work           | Open                                          |
| #70  | Charts API contract / time-range DTO      | Open                                          |
| #105 | Charts return comparison                  | Open                                          |
| #123 | Tax FIFO lot acquisition-date behavior    | Open                                          |
| #127 | Tax FIFO asset-isolation test             | Open                                          |
| #142 | Tax FIFO row-per-lot test                 | Open                                          |
| #151 | Tax FIFO user-isolation test              | Open; later work overlaps/replaces part of it |
| #153 | Tax FIFO user/null-account isolation      | Open; related to Issue #158                   |
| #160 | Charts benchmark comparison               | Open                                          |
| #162 | Architecture as-built documentation       | Open; related to Issue #161                   |
| #167 | Charts drawdown endpoint                  | Open                                          |
| #170 | Charts Iteration 2 as-built documentation | Open                                          |

These PRs must not be reported as merged functionality unless their GitHub state changes before the final October 31 audit.

### Important Charts dependency

PR #170 currently documents an as-built charts contract that includes:

```text
GET /api/v1/charts/drawdown
```

However, the implementation PR for that endpoint, #167, remains open at this audit point.

Therefore, the final charts documentation must be checked again before submission. An endpoint must not be described as merged/as-built unless the implementation is actually present on `main`.

---

## 5. Closed Without Merge

### PR #89 — Iteration 2 records backfill

Sesha created PR #89 to backfill a large `project-docs/iteration-2/records/` evidence system.

The PR contained useful audit findings, including observations about missing Scrum records, chart issue linkage, shared-account attribution, and earlier test-count claims.

However:

```text
PR #89 status: closed
Merged: no
```

Therefore, files introduced only by PR #89 are not part of `main` and must not be treated as authoritative repository evidence for the final submission.

Its findings may be independently re-verified against GitHub, but the unmerged files themselves should not be cited as current repository state.

---

# 6. Tharun — Tax Metrics and Tax Calculations

## 6.1 Pull Request Record

All 20 PRs created by `TharunSwaminathan` during the audit period were merged.

The tax delivery chain is:

| PR   | Main purpose                                        |
| ---- | --------------------------------------------------- |
| #48  | DR-1–3 and Scrum notes setup                        |
| #59  | DR-4–6 and remaining tax backlog                    |
| #72  | nullable `withholdingTax` schema and DTO support    |
| #80  | withholding persistence and validation              |
| #86  | derived DividendRecord                              |
| #92  | FIFO ordering and BUY-derived tax lots              |
| #98  | FIFO partial-sell lot consumption                   |
| #104 | FIFO realized-gain calculation                      |
| #109 | FIFO edge cases and insufficient holdings           |
| #117 | FIFO realized-gains API                             |
| #120 | average-cost running pool                           |
| #126 | average-cost realized gains                         |
| #132 | shared FIFO / average-cost calculator method switch |
| #139 | derived tax-lot tracker and API                     |
| #147 | tax-relevant activity filtering                     |
| #148 | yearly tax summary                                  |
| #152 | deterministic CSV tax export                        |
| #159 | deterministic PDF tax export                        |
| #164 | final tax README and decision-record reconciliation |
| #169 | tax demo evidence and report drafts                 |

## 6.2 Tax Decisions

Before implementation, DR-1 through DR-6 established the main tax contracts.

Important decisions included:

```text
DR-1
Unknown withholding remains null rather than becoming zero.

DR-2
Transaction currency is preserved.
Historical conversion must not be invented when FX data is unavailable.

DR-3
Activities use deterministic timestamp ASC, then activity ID ASC ordering.

DR-4
Gross and fee-adjusted tax results remain separate.

DR-5
Average-cost scope is userId + symbolProfileId.

DR-6
Financial calculations use decimal-safe arithmetic without intermediate
presentation rounding.
```

The DR-5 decision corrected an earlier account-aware Iteration 1 assumption to match the authoritative Iteration 2 sprint plan.

## 6.3 Implemented Tax Scope

Repository evidence confirms implementation of:

- withholding-tax storage and validation;
- derived gross, withholding and net dividend values;
- FIFO tax lots;
- FIFO partial and multi-lot consumption;
- FIFO realized gains;
- proportional BUY/SELL fee allocation;
- insufficient-holdings and ordering edge cases;
- realized-gain API behavior;
- average-cost pooling;
- average-cost realized gains;
- FIFO/average-cost method selection;
- tax-lot API behavior;
- tax-relevant activity filtering;
- yearly tax summaries;
- CSV tax export;
- PDF tax export;
- deterministic decimal serialization;
- diagnostics and incomplete-result handling.

## 6.4 Review-Driven Corrections

Review feedback resulted in additional tax commits throughout the sprint.

Examples visible in Git history include:

- average-cost review corrections before PR #120 merged;
- method-switch review corrections before PR #132 merged;
- tax-relevance review corrections before PR #147 merged;
- yearly-summary review corrections before PR #148 merged;
- CSV-export review corrections before PR #152 merged;
- PDF-export review corrections before PR #159 merged;
- final documentation review corrections before PR #164 merged;
- evidence/report corrections before PR #169 merged.

This is useful retrospective evidence because it demonstrates that review comments resulted in concrete follow-up commits rather than automatic approval.

## 6.5 Final Tax Validation

Final Oct 28 tax validation recorded:

```text
Tax suites: 16 / 16 passed
Tax tests: 218 / 218 passed

API lint:
0 errors

Format:
passed

API build:
passed

git diff checks:
passed
```

The Oct 29 Sprint Review rehearsal repeated the tax-folder test run:

```text
Test Suites: 16 passed, 16 total
Tests:       218 passed, 218 total
Snapshots:   0
Time:        15.939 s
```

The folder run includes:

```text
apps/api/src/app/tax/tax.e2e.spec.ts
```

which contains 20 E2E tests.

Therefore, the 218 figure must not be described as unit-only testing.

## 6.6 Tax Issue-State Inconsistencies

### Issue #53

Issue #53 remains open in GitHub.

However, PR #120:

```text
feat(tax): implement average-cost running pool (#53)
```

was merged on Oct 17.

Therefore the audit classification is:

```text
Implementation:
completed and merged.

GitHub issue state:
stale/open.

Action:
reconcile issue state before final submission.
```

The final report must not call the average-cost pool unfinished merely because Issue #53 remains open.

### Issues #154 and #155

Issues #154 and #155 remain open and represent tax/export trace improvements:

```text
#154
Carry asset identity through yearly tax results and export traces.

#155
Build engine-to-export trace adapter with reconciliation invariants.
```

No final merged closing implementation has been established in this audit.

They should therefore remain visible as unresolved/open work unless GitHub changes before Oct 31.

### Issue #158 / PR #153

Issue #158 concerns FIFO separation by user and unassigned account.

Related PR #153 remains open at this audit point.

This should remain an unresolved/open repository item until merge evidence exists.

---

# 7. Sesha — Portfolio Health and Risk

## 7.1 Pull Request Summary

Sesha created:

```text
17 PRs
16 merged
1 closed without merge
```

The closed-without-merge item is PR #89, the records-backfill PR discussed earlier.

## 7.2 Risk Implementation Progress

Repository evidence shows risk work progressing through:

- single-stock concentration;
- sector and country concentration;
- currency and asset-class exposure;
- exposure summary integration;
- volatility input/model behavior;
- volatility threshold rule;
- cash-allocation rule;
- target-deviation behavior;
- health-score calculation;
- warning-threshold configuration;
- warning/severity engine;
- what-if simulation;
- volatility cache / covariance calculation.

Risk implementation used numeric unit tests for financial/risk calculations.

## 7.3 Review Evidence

Several risk PRs show concrete review-driven changes.

### Duplicate position concentration

During review of the single-stock concentration work, duplicate positions for the same symbol were identified as an error case.

The follow-up implementation aggregated the positions and added numeric regression coverage such as:

```text
AAPL 6% + AAPL 6% = 12% concentration
```

### Health score scope correction

Review of health-score work identified severity as outside the health-score calculator's current issue scope.

A follow-up commit removed severity behavior from that calculator and added a regression case for inactive categories.

### What-if engine — PR #138

The what-if implementation received multiple review corrections before merge.

Follow-up work addressed:

- real risk-rule orchestration rather than relying on caller-supplied results;
- per-holding warning changes rather than only retaining the worst bucket;
- proper feature-specific validation/error-envelope behavior;
- scenario naming;
- `NO_DATA` rules being excluded from active health-score weight rather than incorrectly behaving like passing rules.

The final PR merged after those changes.

## 7.4 Volatility Cache — PR #144

The volatility-cache implementation added:

- aligned price/return processing;
- covariance calculation;
- portfolio volatility from the covariance matrix;
- Redis caching;
- nightly refresh behavior;
- graceful `NO_DATA` behavior.

Review discovered two technical problems:

1. a calendar-day lookback did not reliably provide the required number of trading days;
2. aligning precomputed returns only by end-date could pair returns representing different underlying intervals.

The corrective commit changed the lookback and moved alignment to the price level before calculating returns.

Regression tests were added for:

- realistic weekday/trading-day history;
- missing middle trading-day alignment;
- short-history `NO_DATA`.

This is strong evidence that independent review materially improved calculation correctness.

## 7.5 Known Risk Limitations / Carry-Over

Risk documentation identified remaining design limitations, including:

- provisional category weighting where older health-score documentation did not align exactly with the implemented seven-rule set;
- risk-tolerance-adjusted threshold behavior remaining outside Iteration 2 v1;
- some user-specific threshold activation/override behavior outside current scope.

These should be reported as limitations rather than silently described as completed functionality.

---

# 8. Raniya — Dashboard, Architecture, Integration and QA

## 8.1 Pull Request Summary

Raniya created:

```text
22 PRs
21 merged
1 currently open
```

The open PR is:

```text
#162 — Document as-built service boundaries for Iteration 2
```

## 8.2 Shared Architecture / API Work

Raniya's Iteration 2 work included shared integration responsibilities such as:

- API/module skeletons;
- shared API conventions;
- risk, tax and charts data-layer wiring;
- reusable React/dashboard components;
- shared integration fixtures;
- E2E scaffolding;
- cross-feature endpoint tests;
- dashboard aggregation;
- integration passes;
- report assembly.

These shared changes enabled feature-specific services to integrate without each feature owner creating incompatible contracts.

## 8.3 Dashboard Aggregation

PR #141 merged dashboard aggregation behavior.

The dashboard was changed so that a source failure does not necessarily fail the whole overview.

Each section can be represented as:

```text
available
or
unavailable
```

with feature-specific error handling.

This replaced the earlier progress-report statement that no dashboard aggregation module existed.

## 8.4 Dashboard HTTP Endpoint

PR #146 merged:

```text
GET /api/v1/dashboard/overview
```

along with E2E behavior.

The tests included:

- all sections available;
- numeric tax value carried through the integrated fixture;
- individual source failure producing an unavailable section;
- unexpected failure returning `DASHBOARD_OVERVIEW_FAILED`;
- authentication and authorization cases;
- charts loading failures returning the charts error envelope.

Therefore, any older report statement describing dashboard aggregation as not yet implemented is stale.

## 8.5 Dashboard Coverage

PR #150 added dashboard unit tests and recorded coverage evidence.

For the dashboard files covered in that evidence, the PR reported:

```text
dashboard-overview.ts:
100% statements
100% branches
100% functions
100% lines

dashboard.controller.ts:
100% statements
100% branches
100% functions
100% lines

dashboard-overview.schema.ts:
100% statements
100% branches
100% functions
100% lines
```

This should replace older descriptions that only discuss a dashboard plan or skeleton.

## 8.6 Integration Pass #1

Integration Pass #1 covered all backend areas and dashboard integration.

The recorded E2E scope included:

```text
risk
tax
charts
dashboard
```

The pass reported:

```text
4 / 4 E2E suites passed
47 / 47 E2E tests passed
```

The full API suite and build were also checked.

No cross-feature integration bug required a new feature correction from that pass.

## 8.7 Integration Pass #2

Integration Pass #2 was completed before the code freeze.

Recorded results:

```text
4 / 4 E2E suites passed
47 / 47 E2E tests passed

Full API suite:
93 suites passed
1 suite skipped

641 tests passed
1 test skipped

API build:
passed
```

The skipped API test was an existing upstream Ghostfolio placeholder rather than an Iteration 2 feature failure.

The pass used application baseline:

```text
25bea2186
```

The evidence PR subsequently merged through #166.

## 8.8 Architecture Documentation Inconsistency

The new Iteration 2 report skeleton links:

```text
project-docs/iteration-2/architecture-as-built.md
```

However, the related architecture PR:

```text
#162
```

is still open at this audit point.

Therefore, the final report currently contains an evidence dependency that is not yet on `main`.

Action before final submission:

```text
Either:
merge #162 after review and green CI,

or:
remove/reword the final-report reference so it does not claim an
unmerged file exists on main.
```

---

# 9. Arthur — Performance Charts

## 9.1 GitHub Identity Limitation

Arthur's repository work is associated with:

```text
Error404IsFound
```

The team attributes this account to Arthur for Iteration 2 work.

The final report should make the attribution limitation visible where appropriate rather than claiming that GitHub itself records the personal identity as "Arthur."

## 9.2 Pull Request Summary

The account created:

```text
20 PRs
8 merged
12 currently not merged
```

The eight verified merged PRs include:

```text
#76  shared time-range resolver
#83  performance history -> ChartSeriesResponse mapping
#90  chart-series edge cases
#101 invested-capital and cash sampling
#112 FIFO lot-cost-basis test/support change
#118 open FIFO lots by remaining shares
#137 FIFO account-isolation test
#143 omit closed FIFO lots from open-lot list
```

The account therefore contributed both chart work and additional tax/FIFO verification work.

## 9.3 Chart Functionality Verified on Main

Merged chart-related work includes:

- time-range resolution;
- custom date handling;
- performance-history mapping;
- daily/weekly sampling behavior;
- chart-series API behavior;
- invested-capital series;
- cash series;
- chart E2E integration through Raniya's QA work.

PR #76 corrected chart-contract assumptions to match real Ghostfolio API behavior.

PR #83 mapped existing performance history into the shared chart response model.

PR #90 added chart-series edge-case behavior.

PR #101 added invested-capital and cash sampling aligned with portfolio-value dates.

## 9.4 Current Open Chart Work

The following chart PRs remain open:

```text
#50
#69
#70
#105
#160
#167
#170
```

Important examples:

```text
#105
total-return versus price-return comparison

#160
benchmark comparison endpoint

#167
drawdown endpoint

#170
Iteration 2 as-built chart documentation
```

These should remain open/carry-over items unless merged before the final audit.

## 9.5 Documentation Risk

PR #170 currently intends to describe `/charts/drawdown` as an as-built endpoint.

Because PR #167 is still open, the final chart README must be checked against actual `main` before #170 is merged.

No documentation should claim that an open endpoint PR is already part of the as-built backend.

---

# 10. GitHub Issue Audit

GitHub search returned:

```text
65 issues created between Oct 2 and Oct 30
```

Current state:

```text
51 closed
14 open
```

The open issues identified in the current audit include:

| Issue | Area         | Audit interpretation                                                      |
| ----- | ------------ | ------------------------------------------------------------------------- |
| #173  | Scrum        | Current Oct 30 retrospective/audit task                                   |
| #161  | Architecture | Related PR #162 still open                                                |
| #158  | Tax          | Related PR #153 still open                                                |
| #155  | Tax          | Export trace adapter unresolved                                           |
| #154  | Tax          | Asset identity/export trace unresolved                                    |
| #110  | Dashboard    | Issue state requires reconciliation with later merged dashboard-card work |
| #68   | Dashboard    | React dashboard page / frontend carry-over                                |
| #67   | Dashboard    | Integration tracking; reconcile against later integration evidence        |
| #66   | Dashboard    | Aggregation/testing tracking; reconcile with later merged work            |
| #65   | Dashboard    | Aggregation start tracking; later implementation exists                   |
| #64   | Dashboard    | Earlier dashboard skeleton tracking; later implementation exists          |
| #63   | Dashboard    | Shared chart-wrapper tracking; reconcile with merged component work       |
| #62   | Dashboard    | Shared Card tracking; reconcile with merged component work                |
| #53   | Tax          | Stale issue state; implementation merged in PR #120                       |

## 10.1 Open Does Not Always Mean Unimplemented

Issue state and implementation state must be treated separately.

Example:

```text
Issue #53:
open

PR #120:
merged implementation
```

Therefore the final report must not simply count open issues as unfinished functionality.

Open issues should be divided into:

```text
A. genuinely unresolved work;
B. carry-over/deferred work;
C. stale issue-state where implementation already merged;
D. current reporting/retrospective work.
```

This classification should be repeated in the Oct 31 final check.

---

# 11. CI/CD and Pipeline Audit

## 11.1 Main Build Regression — PR #72 / PR #78

PR #72 added the nullable `withholdingTax` field to the shared Activity/Order contract.

The implementation updated several manually constructed activities.

After merge, a production build failure was found because one existing mapping in:

```text
export.service.ts
```

had not been updated for the new field.

The failure was a TypeScript contract error.

Sesha created hotfix PR #78:

```text
fix(export): include withholdingTax in export.service.ts activity map
```

The PR passed the actual withholding value through the export mapping and restored type/build compatibility.

Audit interpretation:

```text
Cause:
shared data-contract change missed one existing construction/mapping path.

Impact:
main production build failure.

Resolution:
hotfix PR #78.

Process lesson:
shared model/schema changes require production build validation,
not only feature-focused unit tests.
```

## 11.2 CI Workflow Improvement

Later Iteration 2 work strengthened CI by separating checks such as:

```text
lint / format
unit tests
build
```

and running the pipeline on shared repository changes.

This reduced the chance that a type/build failure would remain hidden behind feature-specific tests.

## 11.3 CSV Export Parallel-Test Observation

During CSV-export validation, parallel execution produced timeout-related E2E failures.

The affected suites and full API suite passed when rerun serially.

The final evidence should classify this as test execution/concurrency behavior rather than a confirmed financial-calculation defect.

## 11.4 PDF Dependency Observation

During Integration Pass #2 preparation, local PDF tests initially failed because `pdf-lib` was missing from the local installation after pulling the updated dependency tree.

Running:

```text
npm install
```

resolved the local dependency state.

CI was not affected.

This should not be reported as a production tax calculation bug.

## 11.5 Final Integration State

Before code freeze, repository evidence recorded:

```text
E2E:
4 / 4 suites passed
47 / 47 tests passed

Full API:
93 suites passed
1 skipped

641 tests passed
1 skipped

API build:
passed
```

This represents the strongest repository-wide backend verification point currently recorded for Iteration 2.

---

# 12. Review and Corrective-Commit Evidence

Independent PR review materially changed multiple implementations.

Examples include:

### Risk

- duplicate single-stock positions aggregated correctly;
- volatility threshold boundary tests added;
- target-allocation boundary/configuration corrections;
- health-score severity removed from the wrong layer;
- what-if endpoint/orchestration substantially corrected;
- `NO_DATA` removed from active health-score weighting;
- volatility trading-day/history alignment corrected.

### Tax

- average-cost review corrections;
- API/error-detail regression tests;
- method-switch corrections;
- filtering corrections;
- yearly-summary test corrections;
- CSV-export review corrections;
- PDF-export review corrections;
- final README/decision-record corrections;
- Oct 29 report/evidence clarification.

### Dashboard / QA

- API data-layer wiring was progressively aligned;
- common error envelopes were enforced;
- partial dashboard-source failure behavior was tested;
- shared fixtures and E2E scaffolding reduced duplicated integration setup.

### Charts

- chart API assumptions were reconciled with real Ghostfolio endpoints;
- preset/custom date behavior was aligned with upstream contracts;
- chart mapping and series edge cases were added through follow-up work.

These examples support a retrospective conclusion that review was not merely administrative: it produced measurable corrective changes.

---

# 13. Scrum Schedule and Evidence Reconstruction

## 13.1 Meeting Schedule Adjustments

Team-provided scheduling evidence records:

| Date           | Meeting status                                                                  |
| -------------- | ------------------------------------------------------------------------------- |
| Oct 2          | Cancelled — Sesha, Tharun and Arthur had exams                                  |
| Oct 8          | Shortened to approximately 15 minutes — Sesha academic commitment               |
| Oct 13         | Shortened to approximately 15 minutes — Tharun academic commitment              |
| Oct 16         | Shortened to approximately 15 minutes — Raniya academic commitment              |
| Oct 22         | Shortened to approximately 15 minutes — Arthur academic commitment              |
| Other weekdays | Normal approximately 30-minute schedule                                         |
| Nov 1          | No regular Scrum meeting — Sunday/submission deadline and Tharun + Arthur exams |

This scheduling information is team-provided evidence.

It should not be confused with GitHub evidence.

## 13.2 October 2

The Oct 2 regular Scrum meeting was cancelled because Sesha, Tharun and Arthur had examinations.

GitHub nevertheless confirms Iteration 2 activity began.

Examples include:

```text
Issue #45
Tax DR-1–3 and Scrum notes setup

Issue #46
Withholding-tax schema/DTO task

Issue #47
FIFO ordering / TaxLot task
```

Classification:

```text
Meeting:
cancelled.

Development:
continued through GitHub.

Attendance inference:
not required because the meeting was cancelled.
```

## 13.3 Dates Without Detailed Meeting Notes

Where the repository lacks a complete meeting transcript, the final report should use the following wording:

> A detailed meeting record is unavailable. Attendance and exact spoken discussion are therefore not reconstructed. Development state for this checkpoint is instead reconstructed from contemporaneous GitHub issues, pull requests, reviews, commits, CI results and merge history.

This permits evidence-based reconstruction without fabricating meeting minutes.

## 13.4 Example — October 22 Checkpoint

The Oct 22 Scrum meeting was shortened to approximately 15 minutes because of Arthur's academic commitment.

A complete transcript is not available.

Repository state around this checkpoint shows:

### Risk

- PR #138 completing the what-if engine after multiple review corrections;
- PR #144 completing the volatility/covariance cache after review-driven fixes.

### Tax

- FIFO and average-cost engines already implemented;
- PR #132 merged method selection;
- PR #139 merged tax-lot tracking;
- PR #147 completing tax-relevant filtering.

### Dashboard

- PR #141 merged partial-failure dashboard aggregation;
- PR #146 delivered the dashboard HTTP endpoint and E2E coverage.

The repository therefore supports the checkpoint conclusion that core backend functionality was largely implemented and work was shifting toward final integration, exports, testing, documentation and code-freeze preparation.

This is GitHub-reconstructed Scrum evidence, not a claim that every item was verbally discussed in the meeting.

---

# 14. Existing Progress Report Corrections Required

The supplied Iteration 2 progress-report draft requires substantial updating.

## 14.1 Report cutoff

Correct the report's effective repository cutoff to approximately Oct 21 rather than assuming Oct 22 work was already completed.

## 14.2 Tax

Replace older future/open descriptions for:

- FIFO;
- average cost;
- tax lots;
- tax filtering;
- yearly summary;
- CSV;
- PDF.

These features were subsequently implemented through merged PRs.

## 14.3 Dashboard

Remove statements such as:

```text
Dashboard aggregation module not yet created.
```

Backend dashboard aggregation and the HTTP overview endpoint were subsequently merged.

## 14.4 Risk

Update the document to include:

- completed what-if pipeline;
- completed volatility cache/covariance work;
- review-driven corrections;
- known remaining risk limitations.

## 14.5 Charts

Do not automatically convert all open chart work into completed work.

The final report must distinguish:

```text
merged chart behavior
vs
open chart PRs
```

especially benchmark comparison, drawdown and final chart documentation.

## 14.6 Architecture

Do not cite `architecture-as-built.md` as merged evidence until PR #162 is actually merged.

## 14.7 Scrum Meeting Evidence

Replace unsupported detailed meeting claims with:

- direct meeting evidence where available;
- team-provided schedule exceptions;
- GitHub-reconstructed development state where direct notes are missing.

Do not fabricate attendance.

---

# 15. Important Repository Inconsistencies Identified

The preliminary audit identified the following inconsistencies:

1. **Issue #53 remains open although PR #120 merged its implementation.**
2. **PR #89 records-backfill material was closed without merge and should not be treated as main-branch evidence.**
3. **The report skeleton references `architecture-as-built.md`, but PR #162 remains open.**
4. **PR #170 intends to document drawdown as as-built while implementation PR #167 remains open.**
5. **Several older dashboard issues remain open although later dashboard implementation PRs have merged.**
6. **Some open FIFO test PRs overlap with functionality already represented by merged tax work and require final status reconciliation.**
7. **Arthur's contributions are represented through the `Error404IsFound` GitHub identity, so personal attribution has an evidence limitation.**
8. **Scrum repository notes contain much less meeting detail than the implementation history; development state can be reconstructed from GitHub but attendance cannot.**
9. **The older PDF's architecture and feature-status sections are stale relative to the final half of the sprint.**
10. **The sprint is not complete until Oct 31, so today's audit cannot be the final submission audit.**

---

# 16. Evidence-Based Retrospective Inputs

The following statements are supported strongly enough by repository evidence to bring into the Oct 30 retrospective.

## What Went Well Candidates

### 1. Strong delivery of core backend features

Tax, risk and dashboard backend functionality moved from design contracts into working services with tests and APIs.

### 2. Review feedback produced real corrections

Multiple PRs required additional commits after review.

The corrections included calculation correctness, boundary cases, API contracts and data-handling behavior.

### 3. Numeric financial/risk tests were consistently used

Financial calculations were generally supported by explicit numeric assertions rather than execution-only tests.

### 4. Cross-feature integration was verified before freeze

Both integration passes exercised risk, tax, charts and dashboard together.

The final pass was green.

### 5. Known limitations were documented instead of hidden

Examples include:

- mixed-currency cost-basis limitations;
- unresolved risk weighting/design questions;
- unavailable data handling;
- open chart functionality.

## Problem / Improvement Candidates

### 1. Shared model change caused a main build regression

The `withholdingTax` contract change exposed insufficient initial production-build coverage.

### 2. Issue-state maintenance was inconsistent

Some completed implementations still have open issues.

### 3. Too many old/open PRs remain in Charts

Open PRs make it harder to determine the true as-built state.

### 4. Scrum evidence was weaker than development evidence

Implementation activity is strongly traceable, but detailed attendance/discussion notes were not consistently maintained.

### 5. Documentation can become stale quickly

The older progress report is materially inconsistent with later sprint implementation.

### 6. Shared evidence dependencies must be merged before being cited

The architecture-as-built link is a current example.

These are retrospective inputs only.

The actual retrospective must decide which items the team accepts and what Iteration 3 actions are agreed.

---

# 17. Current Unresolved / Carry-Over Items

At the Oct 30 snapshot, unresolved work includes at least:

### Architecture

```text
PR #162 / Issue #161
As-built architecture documentation
```

### Charts

```text
PR #105
return comparison

PR #160
benchmark comparison

PR #167
drawdown

PR #170
charts as-built documentation

plus older open chart PRs requiring cleanup
```

### Tax

```text
Issues #154 and #155
export trace / asset identity improvements

Issue #158 / PR #153
FIFO user/null-account test work

several older open FIFO test PRs
```

### Scrum / Reporting

```text
Issue #173
Oct 30 audit + retrospective documentation
```

### Frontend / Iteration 3

Some dashboard/frontend work remains outside the Iteration 2 backend-completion scope and should be carried explicitly into Iteration 3 rather than described as an Iteration 2 backend failure.

---

# 18. October 31 Final Refresh Required

Before the final report is submitted, repeat the audit after the end of October 31.

Minimum final checks:

```text
1. Pull latest main.

2. Record final main SHA.

3. Re-run the PR search for Oct 2–31.

4. Re-run the issue search for Oct 2–31.

5. Check whether any of these merged:
   #105
   #153
   #160
   #162
   #167
   #170
   and other currently open PRs.

6. Reconcile stale issues:
   #53
   #62–68 where applicable
   #110
   #154
   #155
   #158
   #161
   #173

7. Confirm final CI state.

8. Check for any new failed workflow after Oct 30.

9. Check whether architecture-as-built.md is actually on main.

10. Check chart documentation against actual merged endpoints.

11. Update the retrospective result from the Oct 30 meeting.

12. Record the Oct 31 final report review result.

13. Update screenshots/figures to match final GitHub state.

14. Verify the final document against the Canvas assignment/rubric.

15. Remove all wording such as:
    planned
    pending
    upcoming
    to be completed
   where the final GitHub state now supports an actual result.
```

---

# 19. Canvas Verification Status

Canvas assignment verification is not completed by this GitHub audit.

The actual Iteration 2 Canvas assignment instructions and grading rubric must be checked separately.

Do not claim that the final report satisfies every Canvas requirement until the actual assignment page/rubric has been reviewed.

Current status:

```text
GitHub audit through Oct 30:
preliminary complete.

Oct 30 retrospective:
pending actual meeting outcome.

Oct 31 repository refresh:
required.

Canvas requirements audit:
pending Canvas assignment/rubric.

Final screenshot/visual review:
pending final report state.
```

---

# 20. Preliminary Audit Conclusion

The original progress report is no longer an accurate representation of the final half of Iteration 2.

Repository evidence shows that significant additional backend work was completed after its effective Oct 21 cutoff.

At the Oct 30 snapshot:

```text
Pull requests created:
79

Pull requests merged:
65

Pull requests open:
13

Pull requests closed without merge:
1

Issues created:
65

Issues currently open:
14

Final backend integration pass:
4 / 4 E2E suites passed
47 / 47 E2E tests passed

Full API suite:
93 suites passed
1 skipped

641 tests passed
1 skipped

API build:
passed
```

The strongest completed areas are the tax backend, risk backend and dashboard/backend integration.

The main report risks before submission are:

- stale issue states;
- unresolved/open chart PRs;
- unmerged architecture documentation;
- inconsistent Scrum meeting evidence;
- stale feature descriptions in the older PDF;
- final Oct 31 repository activity that has not happened yet.

The October 30 retrospective should use this audit as evidence rather than relying only on memory.

The final November 1 report must be refreshed against GitHub after October 31 and must not present open, unmerged or planned work as completed.
