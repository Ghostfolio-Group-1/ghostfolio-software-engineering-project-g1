# Iteration 2 Scrum Notes

**Scrum Master:** Tharun Swaminathan
**Sprint:** Iteration 2 — Backend Development
**Sprint Window:** October 2 – November 1, 2026

## Purpose

This file is the live evidence log for Iteration 2 Scrum ceremonies.

The notes must be based on GitHub state rather than memory or self-report.

For each working day, record:

- date;
- attendance;
- merged PR links;
- current issue/task;
- blockers;
- next actions;
- relevant CI/evidence links.

Do not mark work "done" unless the Definition of Done can be verified.

## Definition of Done Reminder

A development task is done when:

```text
GitHub issue exists
+ implementation/tests completed
+ PR opened
+ independent reviewer approval
+ CI green
+ PR merged to main
+ issue/evidence link recorded
```

For Tharun's PRs, the assigned reviewer is Arthur unless a substitute is recorded.

## Daily Standup Template

```markdown
## YYYY-MM-DD — Daily Standup

**Time:** 9:30–9:45 AM CT

### Attendance

- Sesha:
- Tharun:
- Arthur:
- Raniya:

### PR Check From Previous Working Day

- Unmerged PRs:
- PRs waiting for review:
- Failed CI:
- Action owner / deadline:

### Sesha — Risk

- Yesterday merged PR:
- Today's issue:
- Blockers:
- Next action:

### Tharun — Tax / Scrum Master

- Yesterday merged PR:
- Today's issue:
- Blockers:
- Next action:

### Arthur — Charts

- Yesterday merged PR:
- Today's issue:
- Blockers:
- Next action:

### Raniya — Architecture / QA / Dashboard

- Yesterday merged PR:
- Today's issue:
- Blockers:
- Next action:

### GitHub State Readout

- Open PRs:
- PRs waiting for review:
- Issues closed since last standup:
- CI status:
- Work >1 working day late:
- Substitute reviewer assignments:

### Evidence

- PR links:
- Issue links:
- CI links:
- Other evidence:

### Next Actions

-
```

# 2026-10-02 — Sprint Start

## Scheduled Ceremonies

```text
Daily Standup: 9:30–9:45 AM CT
Sprint Planning: 3:30–5:00 PM CT
```

## Attendance

Complete from the actual meetings:

```text
Sesha:
Tharun:
Arthur:
Raniya:
```

Do not infer attendance from GitHub activity.

## Tharun — Tax / Scrum Master

**Current issue:**

```text
#45 — [Tax][Iteration 2] Close DR-1–3 and create Scrum notes template
```

**Oct 2 task:**

```text
Create Scrum notes template
Close DR-1 — net-dividend nullability
Close DR-2 — currency handling
Close DR-3 — same-date ordering tie-breaker
File first withholding-tax implementation issue
File first FIFO implementation issue
```

**Coding gate:**

```text
No tax implementation before DR-1–6 are closed.
DR-4–6 are scheduled for Oct 5.
```

**Branch:**

```text
tharun/2026-10-02-45-tax-decisions
```

**Reviewer:**

```text
Arthur
```

## Evidence Available at Start

```text
Issue #45 exists on GitHub.
Issue #46 exists for the Oct 6 withholdingTax schema/DTO work.
Issue #47 exists for the Oct 9 FIFO ordering and TaxLot creation work.
main was pulled before the work branch was created.
The Oct 2 branch was created from current main.
Git identity was checked before committing:
  user.name  = Tharun Ravi Kumar
  user.email = ravikutn@mail.uc.edu
```

## Evidence To Add Before Closing Oct 2

```text
Withholding implementation issue: #46 — Add nullable withholdingTax to Order and DTOs
FIFO implementation issue: #47 — Implement FIFO ordering and TaxLot creation
Decision-record commit:
PR:
Arthur review:
CI/check result:
Merge commit:
Issue #45 closed:
```

## Blockers / Risks

Record only actual blockers.

At task start, the tax implementation gate is a planned dependency rather than an unexpected blocker:

```text
DR-4–6 must close on Oct 5 before tax coding begins.
```

If any Oct 2 work remains unmerged by the next standup, record it as the first standup item.

## Sprint Planning Notes — 2026-10-02

Complete live during the 3:30–5:00 PM meeting.

### Attendance

```text
Sesha:
Tharun:
Arthur:
Raniya:
```

### Iteration 1 Controls Confirmed

```text
[ ] daily issue -> branch -> commit -> PR -> review -> merge
[ ] one short-lived branch per issue/day
[ ] no direct push to main
[ ] reviewer ring confirmed
[ ] branch protection confirmed
[ ] CI requirement confirmed
[ ] no same-file collisions
[ ] late-work escalation confirmed
[ ] honest GitHub-state reporting confirmed
```

### Dependencies / Shared Files

```text
Risk:
Tax:
Charts:
Architecture / Dashboard:
```

### Capacity / Absences

```text
Sesha:
Tharun:
Arthur:
Raniya:
Reviewer substitutes:
```

### Monday Tasks Confirmed

```text
Sesha:
Tharun:
Arthur:
Raniya:
```

### Decisions / Actions

```text
1.
2.
3.
```

### Evidence

```text
Planning notes:
GitHub board/milestone:
Branch-protection evidence:
PR-template evidence:
Automation/workflow evidence:
```

## Weekly Friday Notes Commit

Every Friday, commit the accumulated Scrum notes through a PR.

Before committing, verify:

```text
attendance from the actual meeting
PR numbers from GitHub
issue state from GitHub
CI links
blockers / late work
```

Do not replace missing evidence with assumptions.

## Escalation Notes

Record these when they occur:

```text
PR not merged by next 9:30 AM -> first standup item
review not completed within required window -> assign substitute reviewer
task >1 working day late -> blocker + re-plan same day
no commit for a planned day -> record reason
CI red on main -> fix before new work
direct push/shared-account commit -> record and correct per team process
```

## Iteration 2 Ceremony Index

```text
Oct 02 — Standup + Sprint Planning
Oct 05 — Standup
Oct 06 — Standup
Oct 07 — Standup
Oct 08 — Standup + Week 1 Check
Oct 09 — Standup
Oct 12 — Standup
Oct 13 — Standup
Oct 14 — Standup
Oct 15 — Standup + Mid-Sprint Review
Oct 16 — Standup
Oct 19 — Standup
Oct 20 — Standup
Oct 21 — Standup
Oct 22 — Standup + Week 3 Check / Demo Rehearsal
Oct 23 — Standup
Oct 26 — Standup
Oct 27 — Standup
Oct 28 — Standup + Code Freeze
Oct 29 — Standup + Sprint Review
Oct 30 — Standup + Retrospective
Oct 31 — Final Report Review Call
```

# 2026-10-05 — Daily Standup / Tax Decision Gate

**Time:** 9:30–9:45 AM CT

## Attendance

Fill from the actual meeting. Do not infer attendance from GitHub activity.

```text
Sesha:
Tharun:
Arthur:
Raniya:
```

## Previous Work / PR Check

Verified repository evidence:

```text
PR #48 — [Tax][Iteration 2] Close DR-1–3 and add Scrum notes
Status: merged
Merge commit: c80ad512a36513da28fd1f1c64deed87f78274cf
Issue #45: linked by the PR
```

GitHub records the approval on PR #48 under the shared `Error404IsFound` account. If the team attributes that review to Arthur, keep the repository identity limitation visible in the evidence rather than rewriting the GitHub record.

## Sesha — Risk Review Assigned to Tharun

```text
PR #51 — [Risk] Single-stock concentration rule
Issue #30
Reviewer: Tharun
```

Initial review found that duplicate positions for the same symbol were not aggregated.

Sesha updated PR #51 with commit:

```text
2c062a0 — aggregate single-stock concentration by symbol
```

The re-review found that the blocking issue was corrected and a numeric regression test was added for:

```text
AAPL 6% + AAPL 6% = 12% concentration
```

Final approval/merge evidence should be added only after GitHub shows the submitted approval and green checks.

## Tharun — Tax / Scrum Master

**Current issue:**

```text
#52 — [Tax][Mon Oct 5] Close DR-4–6 and file remaining tax issues
```

**Branch:**

```text
tharun/2026-10-05-52-tax-decisions
```

**Oct 5 task:**

```text
Close DR-4 — fee treatment
Close DR-5 — average-cost pool scope
Close DR-6 — decimal-safe rounding rule
File remaining tax issues
Update tax decision record
```

### DR-5 Sprint-Plan Correction

The authoritative Iteration 2 sprint plan specifies the average-cost pool as:

```text
user + asset
```

Therefore DR-5 uses:

```text
userId + symbolProfileId
```

This supersedes the provisional Iteration 1 account-aware average-cost proposal.

Issue #52 currently contains an older acceptance-criteria line saying the average-cost scope is "account-aware". That line must be corrected in GitHub before #52 is closed.

## Existing Tax Issues

```text
#46 — [Tax][Tue Oct 6] Add nullable withholdingTax to Order and DTOs
#47 — [Tax][Fri Oct 9] Implement FIFO ordering and TaxLot creation
#52 — [Tax][Mon Oct 5] Close DR-4–6 and file remaining tax issues
```

## Remaining Issue Evidence To Record Today

Fill the real GitHub issue numbers after creation:

```text
Average-cost implementation: #53 — [Tax][Fri Oct 16] Implement average-cost running pool
Tax-lot tracker: #54 — [Tax][Wed Oct 21] Add derived tax-lot tracker and view endpoint
Tax-relevant flag/filter: #55 — [Tax][Thu Oct 22] Add tax-relevant activity flag and filtering
Yearly tax summary: #56 — [Tax][Fri Oct 23] Implement YearlyTaxSummary with numeric tests
CSV export: #57 — [Tax][Mon Oct 26] Implement CSV tax export with golden-file test
PDF export: #58 — [Tax][Tue Oct 27] Implement PDF tax export and tax export tests
```

## Blockers / Risks

```text
- No tax calculation code should start until #52 is reviewed and merged.
- Shared decimal/API serialization belongs to Raniya; tax code must consume the shared convention rather than edit the shared contract independently.
- Issue #52 wording must be corrected from account-aware average-cost scope to user + asset before closure.
```

## Next Actions

```text
1. Finalize DR-4–6 in the tax decision record.
2. File remaining tax implementation issues and record their numbers here.
3. Run documentation checks.
4. Commit with #52 reference.
5. Push branch and open PR.
6. Request Arthur review.
7. Merge only after approval and green CI.
8. Pull latest main before starting #46 on Oct 6.
```

## Evidence To Add Before Closing Oct 5

```text
Decision-record commit:
Remaining issue numbers:
PR:
Arthur review:
CI/check result:
Merge commit:
Issue #52 closed:
PR #51 review/merge result:
```
