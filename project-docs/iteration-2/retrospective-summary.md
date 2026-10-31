# Iteration 2 Retrospective Summary

**Date:** October 30, 2026
**Time:** 3:30–4:30 PM CT
**Scrum Master:** Tharun Swaminathan
**Iteration:** 2 — Backend Development
**Related issue:** #173

## Purpose

This document records the Iteration 2 retrospective using the authoritative Iteration 2 sprint plan, the Oct 30 GitHub audit, repository evidence, pull-request review history, CI/test evidence, and retrospective preparation material.

The retrospective is evidence-based. Claims about completed work, issues, reviews, CI, tests, pull requests, and blockers are checked against GitHub wherever possible.

GitHub-reconstructed development evidence is kept separate from direct meeting evidence. Repository activity can show what work was completed and what technical decisions changed, but it is not used to invent attendance or exact meeting dialogue.

---

## Evidence Reviewed

The retrospective used the following evidence:

- Iteration 2 sprint plan;
- Oct 30 GitHub audit prepared under Issue #173;
- merged and open pull requests;
- linked GitHub issues;
- pull-request review history;
- corrective commits following review feedback;
- CI and build results;
- Iteration 2 Scrum notes;
- final tax validation evidence;
- integration-pass evidence;
- Oct 29 tax demonstration preparation;
- Iteration 2 retrospective draft generated from GitHub PR data;
- Iteration 2 report assembled through PR #175.

The GitHub audit is recorded in:

```text
project-docs/iteration-2/evidence/github-audit-2026-10-30.md
```

The audit remains an Oct 30 snapshot. A final repository refresh is required after Oct 31 because the official Iteration 2 reporting period continues through the end of that day.

---

## Iteration 1 Retrospective Actions Review

The Iteration 2 sprint plan carried five specific actions forward from the Iteration 1 retrospective.

Their status was checked against repository evidence.

| Iteration 1 action                                                                    | Owner(s)               | Due                          | Iteration 2 assessment                      | Evidence / explanation                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------- | ---------------------- | ---------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Retroactively review PR #28 and PR #29 and address review findings                    | Sesha; Arthur; Raniya  | Review Oct 2; fixes by Oct 6 | **Partially done**                          | Sesha posted written retroactive reviews on both PRs on Oct 2. PR #28 requested a filename cleanup. PR #29 identified duplicate documentation files and requested follow-up cleanup. The reviews are verified, but complete evidence that every requested cleanup was subsequently merged was not established in this audit. |
| File Tax, Charts and Dashboard backlogs as GitHub issues                              | Tharun; Arthur; Raniya | Oct 2–5                      | **Partially done**                          | Tax and Dashboard adopted issue-linked implementation work. Charts did not consistently use the same issue-first process, and multiple Charts PRs lacked linked issues.                                                                                                                                                      |
| Require at least one independent approval on every PR and establish branch protection | Sesha; Raniya          | Oct 2                        | **Done at repository-control level**        | The active `Protect Main` ruleset requires a pull request, at least one approving review, and the required `Lint and format`, `Unit tests`, and `Build` checks.                                                                                                                                                              |
| Resolve shared-account commit identity                                                | Arthur                 | Oct 2                        | **Not done**                                | Iteration 2 Charts work continued to appear under the `Error404IsFound` GitHub identity, so the individual-attribution problem remained.                                                                                                                                                                                     |
| Compile retrospectives from GitHub state rather than self-report                      | Tharun                 | Oct 30                       | **Completed for retrospective preparation** | The Oct 30 audit was reconstructed from GitHub issues, PRs, reviews, CI, tests, and merge state under Issue #173 rather than relying only on team recollection.                                                                                                                                                              |

### Evidence Notes

The original Iteration 1 retrospective specifically required:

- written reviews of PR #28 and PR #29;
- issue-based backlogs for Tax, Charts, and Dashboard;
- independent PR review and branch protection;
- correction of the shared-account identity problem;
- an evidence-based Iteration 2 retrospective.

For PR #28, the retroactive review approved the technical content but requested that:

```text
project-docs/iteration-1/audit/design-architecture-charts copy.md
```

be renamed to the canonical filename.

For PR #29, the review identified duplicate documentation files and requested follow-up cleanup.

The repository-control action was more successful. The active `Protect Main` ruleset requires:

```text
Pull request before merge
At least one approving review
Lint and format
Unit tests
Build
```

The shared-account identity action was not successfully completed because Charts activity continued to use `Error404IsFound`.

---

## What Went Well

The retrospective preparation material and GitHub audit identified several strengths.

### GitHub and Process

- Repository activity was substantially more traceable than in Iteration 1.
- Workload was reasonably distributed across the team.
- Development activity remained steady through October.
- Pull-request turnaround was generally fast.
- The reviewer rotation was actively used.
- Independent reviews frequently resulted in corrective commits rather than simple approvals.
- The retrospective preparation data found 31 PRs that received a `changes requested` review, showing that reviews were being used to identify real problems.

### Code Review

Review feedback directly improved implementation quality.

Examples included:

- duplicate-position aggregation in the Risk concentration calculation;
- additional numeric Risk tests;
- health-score scope correction;
- what-if pipeline corrections;
- volatility trading-day and date-alignment corrections;
- average-cost corrections;
- yearly-summary corrections;
- CSV/PDF export corrections;
- documentation corrections before final Tax merge.

### Backend Delivery

The core Iteration 2 backend features were substantially delivered.

For Tax, the merged backend included:

- withholding-tax persistence;
- DividendRecord derivation;
- FIFO tax lots;
- FIFO partial and multi-lot consumption;
- FIFO realized gains;
- average-cost pooling;
- average-cost realized gains;
- FIFO / average-cost method selection;
- tax-lot endpoint;
- tax-relevant filtering;
- yearly tax summary;
- CSV export;
- PDF export;
- final Tax README and decision-record reconciliation.

Risk completed its major rule, score, what-if, and volatility/covariance work.

Dashboard integration progressed to a working aggregation layer and HTTP overview endpoint.

Charts delivered the core chart-series functionality during the sprint and the drawdown endpoint subsequently merged on Oct 30 after the feature freeze.

### Testing and Integration

Numeric financial and risk calculations were generally supported with explicit numeric assertions.

Integration Pass #2 recorded:

```text
E2E suites: 4 / 4 passed
E2E tests: 47 / 47 passed

Full API suite:
93 suites passed
1 suite skipped

641 tests passed
1 test skipped

API build:
passed
```

The skipped API test was an existing upstream Ghostfolio placeholder rather than an Iteration 2 feature failure.

### Documentation and Transparency

Known limitations were generally documented rather than hidden.

For example:

- mixed-currency cost-basis limitations remained explicit;
- unavailable tax values were not silently converted to zero;
- risk `NO_DATA` behavior was documented;
- unfinished Chart functionality remained distinguishable from merged functionality;
- final Tax documentation was completed before code freeze.

---

## Problems / What Did Not Go Well

The audit also identified several process and technical weaknesses.

### Shared Contract Regression

The shared `withholdingTax` model change introduced through PR #72 temporarily broke the production build because one existing `export.service.ts` mapping was not updated.

Sesha's hotfix PR #78 corrected the missing field mapping.

The incident showed that a shared model/schema change requires validation against the complete production build, not only feature-focused tests.

### Stale Issue State

Several GitHub issue states did not match actual implementation state.

The clearest Tax example is Issue #53:

```text
Issue #53:
Open

PR #120:
Merged implementation of the average-cost running pool
```

This creates unnecessary ambiguity when producing progress reports and retrospectives.

### Open and Late PRs

The retrospective PR data showed that a significant open backlog remained late in the sprint, particularly in Charts.

Several older Charts PRs remained open for extended periods.

This made it harder to determine the actual as-built state and increased reporting cleanup near the end of the sprint.

### PR Size

Some pull requests became large enough to make review more difficult.

Smaller issue-scoped PRs would make review faster and reduce the risk that unrelated behavior is reviewed together.

### Missing Labels

The retrospective draft found that many PRs lacked useful feature labels.

This made filtering repository activity by feature or iteration more difficult than necessary.

### Shared GitHub Identity

Arthur's work continued to appear under the shared `Error404IsFound` identity.

This reduced the clarity of individual contribution attribution.

### Scrum Evidence

The repository contains strong implementation evidence but incomplete detailed meeting documentation.

The Scrum notes contain detailed early-sprint entries but do not provide complete attendance, blocker, and next-action records for every later Scrum ceremony.

GitHub can reconstruct development state around those dates but cannot independently prove meeting attendance or exact spoken discussion.

### Documentation Lag

The earlier Iteration 2 progress report became substantially stale after approximately Oct 21.

Implementation continued rapidly while the report tables and architecture descriptions were not refreshed at the same pace.

This resulted in late-sprint cleanup work to reconcile the report with the repository.

---

## Audit Comparison

Retrospective statements were checked against:

```text
project-docs/iteration-2/evidence/github-audit-2026-10-30.md
```

The preliminary audit found substantial repository activity across all four feature areas.

Important findings included:

- Issue #53 remained open despite its implementation merging through PR #120.
- PR #89 was closed without merge, so its records-backfill files were not authoritative `main` evidence.
- several older Dashboard issues remained open despite later merged functionality;
- detailed Scrum documentation was weaker than implementation evidence;
- the old progress-report status tables were stale relative to the second half of the sprint.

Two Charts items changed after the initial audit snapshot:

- PR #167, implementing `GET /api/v1/charts/drawdown`, merged on Oct 30 after the feature freeze;
- PR #170, finalizing the Iteration 2 Charts as-built documentation, also merged on Oct 30.

Architecture PR #162 remained open at the latest Oct 30 verification point and therefore should not be treated as merged architecture evidence until its state changes.

The shared Iteration 2 report was assembled and merged through PR #175.

A final Oct 31 GitHub refresh is still required before submission.

---

## Iteration 3 Actions

The retrospective draft proposed several process improvements based on the GitHub audit.

The following actions are the recommended Iteration 3 follow-ups.

| Action                                                                                                    | Owner                                          | Target date                              | Evidence / reason                                                                                                                |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Review all stale/open PRs and merge, update, or close each one                                            | Arthur as Scrum Master with each feature owner | First review Nov 6                       | A substantial open PR backlog remained near the end of Iteration 2                                                               |
| Require at least one approval and green required CI before merge                                          | Arthur                                         | Entire Iteration 3                       | Independent review caught real defects and the Oct 7 shared-contract regression showed the cost of insufficient final validation |
| Add a feature/iteration label to each new PR where repository labels support it                           | Each PR author; Arthur monitors                | Starting Nov 2                           | Many Iteration 2 PRs lacked useful labels                                                                                        |
| Keep PRs small and tied to one issue or coherent task                                                     | All feature owners                             | Entire Iteration 3                       | Large PRs were harder to review and increased correction cost                                                                    |
| Reconcile GitHub issue state immediately after merge and add status comments to genuine carry-over issues | Each feature owner; Arthur checks at Scrum     | Starting Nov 2; checked continuously     | Completed implementation and issue state were not always synchronized                                                            |
| Maintain Scrum notes containing attendance, current issue, blockers, merged PRs, and next actions         | Arthur                                         | First weekly review Nov 6 and continuing | Development evidence was much stronger than meeting evidence in Iteration 2                                                      |

The sprint plan requires three to five final actions. If the team formally selected fewer than the six recommendations above, Section 5 of the final report should contain only the actions actually agreed by the team.

---

## Scrum Master Handover

The planned Scrum Master rotation is:

```text
Iteration 1: Sesha Siva Sankar
Iteration 2: Tharun Swaminathan
Iteration 3: Arthur Elly Lim
```

Arthur Elly Lim is the planned Iteration 3 Scrum Master.

The Iteration 3 report and Scrum process should therefore use Arthur as the Scrum Master unless the team records a different decision.

---

## Sprint Review Follow-Up

The Oct 29 Tax evidence and report drafts were prepared before the Sprint Review and merged through PR #169.

The Tax demonstration was prepared to cover:

- withholding and dividends;
- FIFO;
- average cost;
- tax lots;
- tax-relevant filtering;
- yearly summary;
- CSV export;
- PDF export;
- known limitations;
- Tax test and CI evidence.

Before the review, the Tax test folder was rerun:

```text
Test Suites: 16 passed, 16 total
Tests:       218 passed, 218 total
Snapshots:   0 total
Time:        15.939 s
```

The 218-test run includes `tax.e2e.spec.ts`, so the result must not be described as unit-only testing.

PR #169 was subsequently reviewed, approved, and merged.

PR approval verifies the documentation merge. It does not independently prove the formal Sprint Review's accepted/not-accepted result.

### Sprint Review Acceptance Evidence

No separate direct Sprint Review acceptance record has been identified in the evidence reviewed for this document.

Therefore:

```text
Tax story acceptance:
Not independently verified from a direct Sprint Review record.

Formal Sprint Review feedback:
Not independently verified.

Follow-up actions:
No additional Sprint Review-specific Tax action is claimed without direct evidence.
```

This does not alter the GitHub evidence showing that the Tax backend itself was merged and tested.

---

## Retrospective Meeting Record

### Scheduled Meeting

**Date:** October 30, 2026
**Time:** 3:30–4:30 PM CT
**Facilitator:** Tharun Swaminathan

### Attendance

A reliable independent attendance record was not preserved in the repository evidence available for this summary.

The retrospective board reconstruction contains the four team-member names:

- Sesha Siva Sankar;
- Tharun Swaminathan;
- Arthur Elly Lim;
- Raniya Shaikh.

However, the reconstructed board is not used as independent proof of attendance.

If direct attendance evidence is available from calendar, Teams, chat, or meeting notes, the final report should use that evidence.

### Previous Retrospective Actions

Repository evidence produced the following assessment:

```text
PR #28 / #29 retroactive review:
Partially done

Tax / Charts / Dashboard issue backlogs:
Partially done

Independent review / branch protection:
Done at repository-control level

Shared-account identity:
Not done

Evidence-based retrospective:
Completed for Iteration 2 preparation
```

### What Went Well

Repository and retrospective-preparation evidence supports the following themes:

- stronger GitHub traceability than Iteration 1;
- reasonably balanced contribution levels;
- generally fast PR turnaround;
- functioning reviewer rotation;
- meaningful changes-requested reviews;
- strong Tax backend delivery;
- substantial Risk backend delivery;
- Dashboard integration;
- successful final cross-feature testing;
- improved evidence and documentation before submission.

### Areas for Improvement

The main improvement themes were:

- stale/open PR cleanup;
- stale issue-state reconciliation;
- smaller PR size;
- consistent feature labels;
- personal GitHub identity instead of a shared account;
- stronger Scrum-note evidence;
- more frequent progress-report updates;
- tighter synchronization between documentation and actual `main`.

---

## Retrospective Board Evidence

The Iteration 2 sprint plan requires retrospective evidence grouped by:

```text
Strengths
Weaknesses / problems
Actions
```

A visual retrospective board has been reconstructed for documentation from the evidence-backed retrospective preparation material.

Expected repository path:

```text
project-docs/iteration-2/retro-board.png
```

### Important Evidence Note

The board image is a **recreated visual summary**, not an original photograph captured during the meeting.

It should therefore be captioned in the final report as:

> **Recreated Iteration 2 retrospective board based on the Oct 30 retrospective preparation notes, GitHub audit, and recorded action items.**

It must not be described as an original meeting photograph.

If an original board photograph or screenshot is later available, that original evidence should replace the recreated image.

---

## Retrospective Evidence Checklist

- [x] Iteration 1 retrospective actions reviewed against GitHub evidence;
- [x] previous-action status assessed;
- [x] evidence-backed strengths identified;
- [x] evidence-backed problems / improvement areas identified;
- [x] GitHub audit used to correct stale repository claims;
- [x] Iteration 3 action candidates defined with owners and target dates;
- [x] planned Scrum Master handover to Arthur documented;
- [x] retrospective-board reconstruction prepared;
- [x] Sprint Review evidence limitation documented;
- [ ] direct attendance evidence added, if available;
- [ ] final Oct 31 GitHub refresh completed;
- [ ] final report checked against Oct 31 repository state.

---

## Current Repository Changes After the Initial Audit

After the initial Oct 30 retrospective audit:

- PR #167 merged the Charts drawdown endpoint;
- PR #170 merged the Charts Iteration 2 as-built documentation;
- PR #175 merged the shared Iteration 2 report assembly;
- architecture PR #162 remained open at the latest verification point.

These changes must be reflected in the final report and final Oct 31 audit.

---

## Current Status

The retrospective documentation now contains:

- the evidence-backed review of Iteration 1 actions;
- GitHub-derived strengths and weaknesses;
- review and CI lessons;
- Iteration 3 process actions;
- Scrum Master handover plan;
- Sprint Review evidence limitation;
- board reconstruction disclosure;
- post-audit repository changes.

The remaining items before final submission are:

```text
Final Oct 31 GitHub refresh
Final issue-state cleanup
Direct attendance evidence, if available
Final shared-report Section 5 update
Final test / Iteration 3 sections from Arthur
Final teammate evaluation section
Final PDF formatting and quality check
```

The final Iteration 2 report must not describe open, unmerged, planned, or reconstructed evidence as something independently verified when GitHub or direct meeting evidence does not support that claim.
