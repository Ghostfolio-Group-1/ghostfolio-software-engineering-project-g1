# Scrum Meetings Summary — Iteration 2

**Scrum Master:** Tharun Swaminathan

**Iteration:** 2 — Backend Development

**Sprint window:** October 2 – November 1, 2026

## 1. Scrum Process

Iteration 2 used a more evidence-based Scrum process than Iteration 1.

The sprint plan required weekday standups at 9:30 AM CT, with additional Sprint Planning, weekly checks, a mid-sprint review, Sprint Review, retrospective, and final report review.

The planned daily standup format was:

1. check whether any pull request from the previous working day remained unmerged;
2. each team member identify the previous merged PR, current issue, and blockers;
3. the Scrum Master read the current GitHub state, including open PRs, reviews, closed issues, and CI;
4. record next actions and escalate work that was more than one working day late.

The Definition of Done required an issue, implementation and tests, a reviewed pull request, green CI, merge to `main`, and recorded evidence.

For Tharun's tax work, Arthur was the assigned reviewer unless a substitute reviewer was recorded.

## 2. Evidence Used for This Summary

This summary is based on:

- `project-docs/iteration-2/scrum-notes.md`;
- the authoritative Iteration 2 sprint plan;
- GitHub issues and merged pull requests;
- CI and integration evidence;
- the tax evidence collected for the Oct 29 Sprint Review.

Meeting attendance is not inferred from commits, pull requests, or issue activity.

The repository Scrum notes currently contain detailed meeting records for Oct 2 and Oct 5. Later ceremonies are listed in the ceremony index, but individual attendance, discussion, and meeting outcomes were not recorded in the same level of detail in the current Scrum-notes file.

For that reason, this report does not claim attendance or specific discussion for meetings where direct meeting evidence is missing.

## 3. Sprint Planning — October 2

Sprint Planning was scheduled for Oct 2 from 3:30–5:00 PM CT.

The planned meeting covered:

- Iteration 1 process problems;
- the daily issue/branch/PR workflow;
- the independent reviewer ring;
- Git identity;
- daily work assignments;
- dependencies and shared-file ownership;
- team capacity;
- Definition of Done;
- Scrum evidence requirements.

The repository notes show that Tharun's initial Scrum Master and tax task was Issue #45.

The Oct 2 tax work included:

- creation of the Iteration 2 Scrum notes template;
- closing DR-1 for dividend nullability;
- closing DR-2 for currency handling;
- closing DR-3 for deterministic same-date ordering;
- filing the first withholding-tax issue;
- filing the first FIFO issue.

The related tax implementation issues recorded were:

```text
#46 — withholdingTax schema and DTO work
#47 — FIFO ordering and TaxLot creation
```

The tax implementation remained intentionally gated until DR-4 through DR-6 were resolved.

PR #48 later merged the DR-1 through DR-3 decision record and Scrum notes work.

The current repository notes do not contain completed attendance fields for the Oct 2 standup or Sprint Planning meeting, so individual attendance is not reported here.

## 4. Daily Standup / Tax Decision Gate — October 5

The Oct 5 Scrum notes provide the next detailed recorded standup entry.

GitHub evidence showed that:

```text
PR #48 — merged
Issue #45 — linked to the completed decision-record work
```

Tharun's current task became Issue #52:

```text
[Tax][Mon Oct 5] Close DR-4–6 and file remaining tax issues
```

The work covered:

- DR-4 — fee treatment;
- DR-5 — average-cost pool scope;
- DR-6 — decimal-safe calculation rules;
- creation of the remaining Iteration 2 tax backlog.

A planning inconsistency was identified during this work.

The earlier wording suggested an account-aware average-cost pool, while the authoritative Iteration 2 sprint plan defined the scope as:

```text
user + asset
```

The final DR-5 rule therefore became:

```text
userId + symbolProfileId
```

This correction prevented implementation from following an outdated Iteration 1 assumption.

The remaining planned tax issues were recorded as:

```text
#53 — average-cost running pool
#54 — tax-lot tracker
#55 — tax-relevant filtering
#56 — yearly tax summary
#57 — CSV export
#58 — PDF export
```

The notes also identified process risks:

- tax implementation could not begin before the decision gate closed;
- shared API/decimal conventions belonged to the architecture area and should not be changed independently;
- the Issue #52 wording needed to be reconciled with the sprint plan.

The same Oct 5 notes also recorded Tharun's review of Sesha's risk PR #51. The initial review found that duplicate positions for the same symbol were not aggregated. A subsequent commit added aggregation and a numeric regression case for the combined concentration.

Attendance fields for the Oct 5 standup were also left uncompleted in the current repository notes, so attendance is not inferred.

## 5. Planned Weekday Standups

The Iteration 2 plan scheduled weekday standups from Oct 2 through Oct 30.

The planned dates were:

```text
Week 1:
Oct 2, 5, 6, 7, 8

Week 2:
Oct 9, 12, 13, 14, 15

Week 3:
Oct 16, 19, 20, 21, 22

Week 4:
Oct 23, 26, 27, 28, 29

Wrap-up:
Oct 30
```

The plan required each standup to use GitHub state rather than verbal progress alone.

However, the current `scrum-notes.md` does not contain individual written entries for all of these dates.

Therefore, this report distinguishes between:

```text
planned ceremony
```

and:

```text
ceremony directly evidenced by repository meeting notes
```

GitHub activity confirms that development work continued throughout these weeks, but GitHub development activity by itself is not treated as proof of meeting attendance.

## 6. Weekly Checks and Mid-Sprint Review

The sprint plan scheduled three major progress checks before the Sprint Review.

### Week 1 Check — October 8

The planned purpose was to verify:

- issues had been filed;
- CI was green;
- PR/review counts;
- Week 1 items had merged;
- late work was identified and re-planned.

The current Scrum-notes file does not contain a completed Oct 8 meeting record, so no specific attendance or meeting outcome is claimed here.

### Mid-Sprint Review — October 15

The planned mid-sprint review was intended to:

- demonstrate each backend engine using tests;
- compare actual progress with the sprint plan;
- refine the Week 3 and Week 4 backlog;
- make any necessary scope decisions.

The current Scrum-notes file does not contain a completed Oct 15 review record. Development evidence from GitHub should therefore be used separately when discussing work completed by that point.

### Week 3 Check / Demo Rehearsal — October 22

The planned purpose was to confirm that features were on track for the Oct 28 code freeze, rehearse each member's five-minute Sprint Review demonstration, and identify remaining bugs.

A detailed Oct 22 meeting entry is not present in the current Scrum-notes file, so this summary does not reconstruct the meeting from memory.

## 7. Development Progress Visible Through GitHub

Although the Scrum meeting log is incomplete, GitHub provides traceable evidence of the tax increment progressing through the sprint.

The main tax milestones were:

```text
Oct 2–5
Tax decision records DR-1 through DR-6 closed.

Oct 6–8
Withholding-tax schema, persistence, validation, and DividendRecord added.

Oct 9–15
FIFO ordering, lot consumption, realized gains, edge cases, and API added.

Oct 16–22
Average-cost calculation, method selection, tax-lot tracking,
and tax-relevant filtering added.

Oct 23–28
Yearly tax summary, CSV export, PDF export,
testing, documentation, and final code-freeze validation completed.
```

The completed tax work listed in this report was delivered through merged pull requests rather than being presented as direct changes to `main`.

Final Oct 28 tax validation recorded:

```text
16 / 16 tax suites passed
218 / 218 tax tests passed
API lint completed with 0 errors
format check passed
API build passed
```

The final integration pass recorded:

```text
4 / 4 E2E suites passed
47 / 47 E2E tests passed

93 API suites passed
1 API suite skipped

641 API tests passed
1 API test skipped
```

This GitHub and test evidence is used to support completion claims, but it is not used to invent missing Scrum attendance records.

## 8. Code Freeze — October 28

The Iteration 2 sprint plan set the feature/code freeze for Oct 28 at 6:00 PM CT.

For tax work, the planned final tasks were:

- final bug fixes;
- tax module README;
- final tax decision-record reconciliation;
- all tax implementation PRs merged before freeze.

PR #164 finalized the tax backend documentation and recorded the as-built behavior and known limitations.

The integration team also recorded a second full backend integration pass before freeze, including CI evidence.

After the freeze, Oct 29 work was limited to demo preparation, evidence, and documentation rather than new feature implementation.

## 9. Sprint Review — October 29

The Sprint Review was scheduled for Oct 29 from 3:30–4:30 PM CT.

The planned format required each feature owner to demonstrate their backend engine through tests or API calls, with approximately five minutes per feature.

For tax, the demo was prepared to cover:

- withholding and dividends;
- FIFO;
- average cost;
- tax lots;
- tax-relevant filtering;
- yearly summaries;
- CSV export;
- PDF export;
- known limitations;
- test and CI evidence.

Before the review, the complete tax test suite was rerun:

```text
Test Suites: 16 passed, 16 total
Tests:       218 passed, 218 total
Time:        15.939 s
```

The Sprint Review acceptance result and feedback should be recorded only after direct meeting evidence is available.

At the time this draft was prepared:

```text
Story acceptance: Pending direct Sprint Review record
Feedback: Pending direct Sprint Review record
Follow-up actions: Pending direct Sprint Review record
```

## 10. Retrospective and Wrap-Up

The Iteration 2 retrospective is scheduled for Oct 30 from 3:30–4:30 PM CT.

The sprint plan requires retrospective statements to be checked against a GitHub audit rather than relying on team memory.

The planned audit includes:

- PRs merged by member and date;
- independent reviews;
- direct pushes;
- issues opened and closed;
- CI runs and pass rate;
- late or unmerged work.

The retrospective is intended to produce three to five concrete actions for Iteration 3, each with an owner and date.

The final report review call is scheduled for Oct 31.

Because these activities occur after this Oct 29 draft, no retrospective outcome is reported here yet.

## 11. Scrum Evidence Limitation

A significant documentation limitation remains in Iteration 2.

The Scrum process required live notes containing:

```text
date
attendance
merged PR links
current issue
blockers
next actions
CI/evidence links
```

The repository contains the template and detailed entries for Oct 2 and Oct 5, but it does not currently contain complete individual entries for all later planned standups and review meetings.

For academic reporting, missing meeting evidence should remain identified as missing rather than reconstructed from memory.

GitHub issues, pull requests, reviews, CI runs, and tests can verify development progress, but they cannot independently verify meeting attendance or the exact discussion held during a Scrum ceremony.

This limitation should be considered in the Oct 30 retrospective and carried forward as a process improvement for Iteration 3.

## 12. Summary

Iteration 2 introduced a substantially stronger Scrum control model based on issues, short-lived branches, independent pull-request review, green CI, numeric testing, and GitHub evidence.

The repository provides strong evidence for implementation progress and the completed tax increment.

However, the meeting evidence is less complete than the development evidence because the Scrum-notes file was not updated with detailed entries for every planned ceremony.

The final Iteration 2 report should therefore make two separate claims:

```text
Development completion:
verified through GitHub, tests, reviews, merges, and CI.

Meeting attendance and discussion:
reported only where direct Scrum-note evidence exists.
```

This distinction keeps the final report consistent with the Iteration 2 rule that project evidence must be based on repository state rather than unsupported self-report.
