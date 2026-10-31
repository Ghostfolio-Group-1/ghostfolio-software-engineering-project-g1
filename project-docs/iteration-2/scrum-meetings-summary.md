# Scrum Meetings Summary — Iteration 2

**Scrum Master:** Tharun Swaminathan
**Iteration:** 2 — Backend Development
**Sprint window:** October 2 – November 1, 2026
**Related retrospective/audit issue:** #173

## 1. Scrum Process

Iteration 2 used an evidence-based development process centered on GitHub issues, short-lived branches, pull requests, independent review, CI, and recorded test evidence.

The Iteration 2 sprint plan required weekday Scrum meetings and additional checkpoints including:

- Sprint Planning;
- Week 1 Check;
- Mid-Sprint Review;
- Week 3 Check / Demo Rehearsal;
- code freeze;
- Sprint Review;
- retrospective;
- final report review.

The working Scrum process expected the team to review:

1. previous merged or still-open pull requests;
2. each member's current issue/task;
3. review or CI blockers;
4. work that was more than one working day late;
5. next actions and reviewer assignments.

The Definition of Done required:

```text
GitHub issue
+ implementation/tests
+ pull request
+ independent review
+ green CI
+ merge to main
+ recorded evidence
```

For Tharun's tax work, Arthur was the assigned reviewer unless a substitute reviewer was recorded.

---

## 2. Evidence Classification

This summary uses three types of evidence.

### Direct Meeting Evidence

Direct meeting evidence includes:

- completed Scrum notes;
- attendance records;
- screenshots;
- meeting/calendar records;
- other contemporaneous meeting records.

### Team-Provided Scheduling Evidence

Team-provided scheduling evidence is used for known meeting-duration changes caused by academic commitments.

It is not treated as GitHub evidence.

### GitHub-Reconstructed Scrum Evidence

Where detailed meeting notes are unavailable, repository activity is used to reconstruct the development state around the checkpoint.

This includes:

- GitHub issues;
- pull requests;
- review comments;
- corrective commits;
- CI results;
- test results;
- merge history;
- open blockers.

GitHub-reconstructed evidence can show what work was being completed, what technical decisions were implemented, and what review corrections occurred.

It does not independently prove meeting attendance or the exact words discussed in a Scrum meeting.

---

## 3. Meeting Schedule Adjustments

The normal Iteration 2 weekday Scrum meeting duration was approximately 30 minutes.

Academic commitments required the following adjustments:

| Date           | Meeting status                          | Reason                                                      |
| -------------- | --------------------------------------- | ----------------------------------------------------------- |
| Oct 2          | Cancelled                               | Sesha, Tharun, and Arthur had examinations                  |
| Oct 8          | Shortened to approximately 15 minutes   | Sesha academic commitment                                   |
| Oct 13         | Shortened to approximately 15 minutes   | Tharun academic commitment                                  |
| Oct 16         | Shortened to approximately 15 minutes   | Raniya academic commitment                                  |
| Oct 22         | Shortened to approximately 15 minutes   | Arthur academic commitment                                  |
| Other weekdays | Normal approximately 30-minute schedule | Normal sprint schedule                                      |
| Nov 1          | No regular Scrum meeting                | Sunday/submission deadline and Tharun + Arthur examinations |

These schedule changes are recorded from team-provided scheduling information.

Where detailed meeting notes are missing, this report reconstructs development status from GitHub rather than inventing attendance or meeting dialogue.

---

## 4. October 2 — Sprint Start

The regular Oct 2 Scrum meeting was cancelled because Sesha, Tharun, and Arthur had examinations.

The cancellation should not be interpreted as an undocumented or missed Scrum meeting.

Repository evidence shows that Iteration 2 development and planning activity still began on Oct 2.

For Tharun's tax and Scrum Master work, the initial issue was:

```text
#45 — [Tax][Iteration 2] Close DR-1–3 and create Scrum notes template
```

The Oct 2 tax scope included:

- creation of the Iteration 2 Scrum notes structure;
- DR-1 for dividend/withholding nullability;
- DR-2 for currency handling;
- DR-3 for deterministic same-date ordering;
- creation of the first withholding-tax implementation issue;
- creation of the first FIFO implementation issue.

Related issues included:

```text
#46 — withholdingTax schema and DTO work
#47 — FIFO ordering and TaxLot creation
```

Tax implementation remained deliberately gated until DR-1 through DR-6 were resolved.

PR #48 later merged the DR-1 through DR-3 decision-record and Scrum-note work.

Classification:

```text
Meeting status:
Cancelled because of academic/exam commitments.

Development status:
Iteration 2 repository work continued.

Evidence:
Team-provided scheduling evidence
+ GitHub-reconstructed development evidence.
```

Sprint Planning was separately scheduled for Oct 2 under the sprint plan. The repository does not contain enough direct evidence to reconstruct its attendance or exact discussion, so those details are not invented here.

---

## 5. October 5 — Tax Decision Gate

The Oct 5 Scrum notes contain the next detailed repository-backed entry.

Repository evidence showed:

```text
PR #48 — merged
Issue #45 — linked to the completed decision-record work
```

Tharun's current task became:

```text
#52 — [Tax][Mon Oct 5] Close DR-4–6 and file remaining tax issues
```

The work covered:

- DR-4 — fee treatment;
- DR-5 — average-cost pool scope;
- DR-6 — decimal-safe calculation;
- creation of the remaining Iteration 2 tax backlog.

A planning inconsistency was identified.

An earlier proposal described average-cost calculation as account-aware, while the authoritative Iteration 2 sprint plan required:

```text
user + asset
```

The final DR-5 scope therefore became:

```text
userId + symbolProfileId
```

The remaining planned tax issues included:

```text
#53 — average-cost running pool
#54 — tax-lot tracker
#55 — tax-relevant filtering
#56 — yearly tax summary
#57 — CSV export
#58 — PDF export
```

The Oct 5 notes also contain review evidence for Sesha's risk work.

Tharun's review identified that duplicate positions for the same symbol were not being aggregated in the single-stock concentration calculation.

The follow-up implementation added aggregation and numeric regression coverage for:

```text
AAPL 6% + AAPL 6% = 12% concentration
```

This is an early example of independent review producing a concrete calculation correction.

---

## 6. Week 1 — October 6–9

A complete direct meeting transcript is not available for every Week 1 Scrum meeting.

Development state is therefore reconstructed from GitHub.

### Tax

Week 1 tax work progressed from decision records into the first persisted tax data.

PR #72 added nullable `withholdingTax` support to the shared Order/activity contract.

The semantics preserved the distinction between:

```text
null
unknown withholding

0
known zero withholding

positive value
known withholding amount
```

Later tax work added withholding persistence and the derived dividend record.

### CI / Shared Contract Incident

The shared `withholdingTax` contract change exposed an important integration problem.

PR #72 updated the schema and several constructed Order/Activity objects but missed one existing mapping in:

```text
export.service.ts
```

This caused a TypeScript production-build failure on `main`.

Sesha created hotfix PR #78 to include the real `withholdingTax` value in the export mapping.

This incident became an Iteration 2 process lesson:

> A shared model/schema change must be validated against the complete production build, not only feature-specific tests.

### Charts

Arthur's merged chart work included PR #76, which added the shared time-range resolver and reconciled chart date behavior with real Ghostfolio contracts.

PR #83 then mapped existing performance history into the shared chart-series response.

### Week 1 Check — October 8

The Oct 8 Scrum meeting was shortened to approximately 15 minutes because of Sesha's academic commitment.

The repository does not contain a complete direct transcript of the checkpoint.

GitHub activity nevertheless shows that by this stage:

- tax withholding work was being integrated;
- chart time-range and series contracts were developing;
- shared-contract compatibility had already exposed one production-build issue;
- risk backend work had started moving from specifications into calculation services.

---

## 7. Week 2 — October 12–16

### October 13 Schedule Adjustment

The Oct 13 Scrum meeting was shortened to approximately 15 minutes because of Tharun's academic commitment.

### Tax — FIFO Development

Repository evidence shows FIFO progressing through:

```text
#92 — deterministic FIFO ordering / BUY lots
#98 — partial-sell lot consumption
#104 — realized gains
#109 — edge cases
#117 — realized-gains API
```

The FIFO engine established:

- chronological acquisition-lot consumption;
- deterministic same-timestamp ordering;
- partial-lot consumption;
- multi-lot disposal;
- traceable acquisition cost basis;
- explicit insufficient-holdings handling;
- gross and fee-adjusted realized gains.

### Risk

Risk functionality developed through:

- volatility rule behavior;
- cash-allocation rule;
- target-deviation rule;
- health-score calculation;
- warning-threshold configuration.

Independent review caused additional changes.

Examples include:

- adding inclusive-boundary volatility tests;
- correcting target-allocation test data;
- removing warning severity from the health-score layer when it was outside the issue's scope;
- adding regression coverage for inactive categories.

### Dashboard / Integration

Raniya progressed shared infrastructure and integration work.

This included:

- shared data-layer wiring;
- chart API wiring;
- reusable dashboard-card work;
- integration fixtures;
- test scaffolding.

### Mid-Sprint Review — October 15

The sprint plan scheduled the Mid-Sprint Review on Oct 15.

A complete meeting transcript is unavailable, so exact discussion is not reconstructed.

GitHub state around this point shows that the project had moved from initial contracts into working backend calculations:

```text
Tax:
FIFO engine and API substantially implemented.

Risk:
multiple risk rules and health-score behavior implemented.

Charts:
shared time-range and chart-series behavior implemented.

Integration:
shared fixtures and backend wiring progressing.
```

This repository state supports the conclusion that Week 3 could focus on remaining calculation methods, integration, edge cases, and API completeness rather than starting the core backend from scratch.

---

## 8. October 16 — Start of Average-Cost Work

The Oct 16 Scrum meeting was shortened to approximately 15 minutes because of Raniya's academic commitment.

GitHub evidence shows the tax area moving from FIFO into average cost.

PR #120 implemented the average-cost running pool.

The implemented scope followed the corrected DR-5 rule:

```text
userId + symbolProfileId
```

rather than an account-specific pool.

Review feedback resulted in follow-up changes before merge.

The repository currently still shows Issue #53 as open even though PR #120 merged its implementation.

For reporting purposes:

```text
Implementation:
completed and merged.

Issue state:
stale/open.
```

This issue-state inconsistency became one of the findings in the Oct 30 GitHub audit.

---

## 9. Week 3 — October 19–22

Week 3 completed major backend integration work.

### Tax

Tax milestones included:

```text
#126 — average-cost realized gains
#132 — FIFO / average-cost method switch
#139 — derived tax-lot tracker and API
#147 — tax-relevant activity filtering
```

The calculation engines were now available through a common method-selection path.

### Risk

Risk progressed into the complete what-if pipeline.

PR #138 initially exposed several gaps and received multiple rounds of review-driven corrections.

The final merged implementation addressed:

- real risk-rule orchestration;
- shocked-copy comparison;
- per-holding warning changes;
- feature-specific validation behavior;
- scenario naming;
- correct exclusion of `NO_DATA` rules from active health-score weighting.

### Volatility Cache

PR #144 added the covariance/volatility cache.

Review identified two important numerical/data problems:

1. the history lookback used calendar days where the requirement depended on trading days;
2. aligning independently calculated returns by only their end dates could pair returns representing different intervals.

The corrected implementation:

- expanded the calendar lookback;
- aligned prices first;
- calculated returns only after the aligned trading dates were known;
- added regression tests for missing trading days and short history.

This is strong evidence that code review materially improved financial/risk calculation correctness.

### Dashboard

PR #141 merged dashboard aggregation.

Each dashboard section could now be:

```text
available
or
unavailable
```

without one source failure necessarily failing the complete dashboard.

PR #146 then added:

```text
GET /api/v1/dashboard/overview
```

with E2E coverage and shared error-envelope behavior.

---

## 10. October 22 — Week 3 Check / Demo Rehearsal

The Oct 22 Scrum meeting was shortened to approximately 15 minutes because of Arthur's academic commitment.

A complete meeting transcript is not available.

The development state at the checkpoint can nevertheless be reconstructed from GitHub.

### Risk

Repository evidence showed:

- the what-if pipeline completed after multiple review corrections;
- the volatility/covariance cache completed after trading-day and alignment corrections.

### Tax

By the checkpoint:

- FIFO was implemented;
- average cost was implemented;
- method selection was implemented;
- tax-lot tracking was implemented;
- tax-relevant filtering was being completed.

### Dashboard / Integration

By the checkpoint:

- dashboard aggregation was merged;
- per-section failure behavior existed;
- the dashboard overview endpoint and E2E coverage were being completed.

### Checkpoint Interpretation

The repository supports the conclusion that the project had moved from primary backend implementation toward:

- final integration;
- yearly/export work;
- final edge-case testing;
- documentation;
- code-freeze preparation.

This is GitHub-reconstructed checkpoint evidence and is not presented as a transcript of the actual meeting.

---

## 11. Week 4 — October 23–28

### Tax Completion

The remaining tax roadmap was completed through:

```text
#148 — yearly tax summary
#152 — CSV tax export
#159 — PDF tax export
#164 — final tax README / decision reconciliation
```

Review feedback resulted in additional commits for yearly-summary, CSV, PDF, and documentation work before final merges.

### Dashboard / QA

PR #150 added dashboard unit tests and coverage evidence.

Integration Pass #1 then exercised:

```text
risk
tax
charts
dashboard
```

with:

```text
4 / 4 E2E suites passed
47 / 47 E2E tests passed
```

Integration Pass #2 repeated the cross-feature verification before code freeze.

Recorded results were:

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

The skipped test belonged to an existing upstream Ghostfolio placeholder and was not recorded as an Iteration 2 feature failure.

---

## 12. Code Freeze — October 28

The Iteration 2 sprint plan set the feature/code freeze for Oct 28 at 6:00 PM CT.

For tax, final validation recorded:

```text
16 / 16 tax suites passed
218 / 218 tax tests passed

API lint:
0 errors

format:
passed

API build:
passed
```

PR #164 finalized the tax backend README and as-built decision-record reconciliation.

Integration Pass #2 provided the final repository-wide backend verification evidence before freeze.

After the freeze, tax work shifted to:

- demonstration preparation;
- evidence collection;
- report drafting.

No new tax feature behavior was introduced through PR #169.

---

## 13. Sprint Review — October 29

The Sprint Review was scheduled for Oct 29 from 3:30–4:30 PM CT.

The planned tax demonstration covered:

- withholding and dividends;
- FIFO;
- average cost;
- tax lots;
- tax-relevant filtering;
- yearly summary;
- CSV;
- PDF;
- known limitations;
- numeric test evidence.

Before the review, the complete tax-folder run was repeated:

```text
Test Suites: 16 passed, 16 total
Tests:       218 passed, 218 total
Snapshots:   0
Time:        15.939 s
```

This run includes:

```text
apps/api/src/app/tax/tax.e2e.spec.ts
```

with 20 E2E tests.

PR #169 contained the pre-Sprint-Review tax evidence and report drafts.

Arthur subsequently approved and merged PR #169.

However, PR approval is evidence that the documentation PR was accepted for merge. It is not automatically evidence of the formal Sprint Review's story-acceptance result.

Therefore the following fields must still be filled only from direct Sprint Review evidence:

```text
Tax story acceptance:
Pending direct meeting evidence.

Sprint Review feedback:
Pending direct meeting evidence.

Follow-up actions:
Pending direct meeting evidence.
```

---

## 14. October 30 — Audit and Retrospective Preparation

Issue #173 was opened for the Oct 30 Scrum Master wrap-up work:

```text
[Scrum][Fri Oct 30] Compile Iteration 2 retrospective and meeting summary
```

The Oct 30 GitHub audit reviewed repository activity across all four team areas.

The preliminary audit found:

```text
PRs created Oct 2–30:
79

Merged:
65

Open:
13

Closed without merge:
1

Issues created:
65

Issues currently open:
14
```

Important audit findings included:

- Issue #53 remains open despite merged implementation in PR #120;
- PR #89 was closed without merge and its backfill records are not evidence on `main`;
- architecture PR #162 remains open while the report skeleton references its planned file;
- several chart PRs remain open;
- PR #170 must not describe drawdown as merged while implementation PR #167 remains open;
- several older dashboard issues have stale/open states despite later implementation;
- detailed Scrum meeting evidence is weaker than repository implementation evidence.

The audit is stored in:

```text
project-docs/iteration-2/evidence/github-audit-2026-10-30.md
```

It is preliminary because the official reporting period continues through Oct 31.

---

## 15. Retrospective — October 30

The Iteration 2 retrospective is scheduled for Oct 30 from 3:30–4:30 PM CT.

The GitHub audit provides evidence for the retrospective rather than relying only on memory.

Evidence-supported retrospective candidates include:

### Potential strengths

- core backend features were delivered;
- independent reviews produced real corrective commits;
- numeric financial/risk testing was used extensively;
- cross-feature integration was verified before freeze;
- known limitations were documented rather than hidden.

### Potential problems

- a shared contract change caused a temporary production-build regression;
- issue states were not always reconciled after implementation merged;
- several chart PRs remained open late in the sprint;
- detailed Scrum-note evidence was incomplete;
- progress-report documentation became stale as the sprint changed rapidly;
- report evidence links were created before every referenced document was merged.

These are audit findings only.

The final retrospective must record the actual team-agreed:

- strengths;
- problems;
- three to five Iteration 3 actions;
- action owners;
- target dates;
- Scrum Master handover result.

Those outcomes are recorded separately in:

```text
project-docs/iteration-2/retrospective-summary.md
```

after the meeting.

---

## 16. Scrum Evidence Limitation

Iteration 2 has strong implementation evidence but incomplete direct meeting documentation.

The repository strongly supports:

```text
issues
branches
PRs
review comments
corrective commits
CI
tests
merges
technical decisions
```

However, it does not contain complete attendance and discussion records for every planned Scrum ceremony.

The final report therefore uses the following distinction:

```text
Development completion:
verified through GitHub, tests, reviews, merges and CI.

Meeting scheduling:
reported from direct/team-provided scheduling evidence.

Meeting attendance:
reported only when direct evidence exists.

Development state around meetings:
reconstructed from GitHub when direct notes are incomplete.

Exact spoken discussion:
not reconstructed from GitHub.
```

This allows the final Iteration 2 report to remain evidence-based without discarding useful repository history.

---

## 17. October 31 Final Refresh

This summary is not the final end-of-iteration repository snapshot.

Before the November 1 submission, GitHub must be checked again after Oct 31.

The final refresh should verify:

- new PRs created or merged;
- currently open PRs;
- stale issues;
- final CI;
- architecture PR #162;
- chart PRs #160, #167, and #170;
- tax PR #153 / Issue #158;
- final report review outcome;
- any new screenshots/evidence.

The final report must not describe work as completed unless the Oct 31 repository state supports the claim.

---

## 18. Summary

Iteration 2 used a stronger repository-driven development process than Iteration 1.

The project generated substantial traceable evidence through:

- GitHub issues;
- short-lived feature branches;
- pull requests;
- independent review;
- corrective commits;
- numeric tests;
- CI;
- integration passes;
- merged documentation.

The strongest evidence supports the implementation and integration progress of the backend.

The weaker area was meeting-documentation completeness.

Rather than fabricating missing meeting minutes, this summary uses GitHub history to reconstruct development state while keeping attendance and exact conversation separate.

This provides a defensible evidence trail for the Iteration 2 retrospective and final report.
