# Iteration 3 Inputs (feeds: User Stories for New Sprint)

Source: `gh api .../milestones`, `gh issue list --milestone "Iteration 3"`, `project-docs/report-cover-page.md`,
`project-docs/iteration-2/scrum-notes.md`. Iteration 2 is not finished (today is 2026-10-08 of a
Oct 2 – Nov 1 sprint), so most of this file is necessarily forward-looking and thin — flagged
per-field rather than invented.

## Revised Goals

NOT RECORDED. No document was found revising the software vision statement or Iteration 3 scope
beyond what is already in `project-docs/report-cover-page.md`'s original Iteration 1 vision
paragraph (quoted in full in `project-facts.md`).

## Backlog Changes for Iteration 3

NOT RECORDED as an explicit "changes" list. The only concrete Iteration-3-milestoned backlog item
found via `gh api .../milestones` (milestone id 3, 1 open issue, 0 closed, due 2026-12-05) is:

- **Issue #26** — "[Risk][Iteration 3] Build the risk dashboard as React components" (OPEN)

## Tasks Remaining from Iteration 2 (as of 2026-10-08, with 23 days left in the sprint)

Per `product-backlog.csv` / `sprint-backlog.csv`, the following Iteration-2-milestoned issues are
still OPEN and not yet started or in progress:

- **Risk:** #32 (in progress, PR #77 approved/unmerged), #33, #34, #35, #36, #37, #38, #39, #40, #41, #42, #43
- **Tax:** #47, #53, #54, #55, #56, #57, #58
- **Dashboard:** #62, #63, #64, #65, #66, #67, #68, #81 (PR #82 open/unmerged)
- **Charts:** no issues exist to enumerate (see `deviations.md` D-5 / `gaps.md`) — but PRs #69, #70, #83 represent unmerged charts work that would also need to roll forward if not completed by Oct 31/Nov 1.

Whether any of these will formally carry over into Iteration 3 versus simply being finished within
Iteration 2's remaining time is NOT RECORDED — no re-planning decision has been made yet (the
sprint isn't over).

## Sprint Goal for Iteration 3

NOT RECORDED. No document states an Iteration 3 sprint goal. The closest available signal is Issue
#26's own text, which frames Iteration 3 as the point where "Backend logic (Issues 1-8) [is]
already complete" and the work shifts to wiring React dashboard components to finished APIs — but
this is scoped to the risk feature specifically, not a team-wide sprint goal statement.

## Selected User Stories for Iteration 3 (filed so far)

| Issue                                              | Owner                            | Priority                             | Estimate                             | Acceptance Criteria (verbatim from issue body)                                                                                            |
| -------------------------------------------------- | -------------------------------- | ------------------------------------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| #26 — Build the risk dashboard as React components | Sesha Siva Sankar (risk feature) | NOT RECORDED (no priority field set) | NOT RECORDED (no estimate field set) | "Every component's data maps to the exact API field listed in the wireframe's Section 4 table; no displayed value lacks a backing field." |

No Iteration-3 issues have been filed yet for tax, charts, or dashboard.

## Per-Story Components / Information Flow / Major Methods (where documented)

For Issue #26 (the only filed Iteration 3 story): components named are `RiskScoreGauge`,
`CategoryScoreBar`, `WarningList`, `ConcentrationPanel`, `MetricCard`, `TargetAllocationCard`,
`WhatIfPanel`/`WhatIfResult`, `ThresholdSettingsForm`, plus two components requested from Raniya's
shared library (`SeverityBadge`, `BandMeter`). Dependency stated explicitly: "Issue 7 (API must
exist first)" — i.e. this story is blocked on Issue #24 (risk API contract), which is still OPEN
in Iteration 2 as of 2026-10-08. Design source: `docs/sesha-notes/09-risk-dashboard-wireframe.md`.

## Workload Balance

NOT RECORDED as an analyzed/decided allocation for Iteration 3. Observationally (not a plan, just
a GitHub-state fact): risk has 1 Iteration-3-milestoned issue; tax, charts, and dashboard each have
0 filed so far.

## "Substantial Unique Feature" for Iteration 3

NOT RECORDED. No document identifies which Iteration 3 story is the "substantial unique feature."

## Scrum Meeting Dates for Iteration 3

NOT RECORDED. `scrum-notes.md`'s "Iteration 2 Ceremony Index" only schedules ceremonies through
"Oct 31 — Final Report Review Call" (end of Iteration 2); no Iteration 3 ceremony calendar exists
yet in any committed doc.

## Scrum Master for Iteration 3

**Arthur Elly Lim** — this is independently confirmed in `project-docs/report-cover-page.md`'s
team table ("Member 3 | Arthur Elly Lim | Upgraded Performance Charts | Scrum Master — Iteration
3"). No second, Iteration-3-specific document (planning doc, issue, or scrum-notes entry) exists
yet to corroborate this a second time from fresh Iteration 3 material — it rests on the one
Iteration 1-era cover-page doc. Given that Arthur's Iteration 2 charts work has so far shown no
filed GitHub issues and repeated reviewer-flagged process/shared-account issues (see
`deviations.md` D-4/D-5), this is worth the team revisiting explicitly before Iteration 3 starts
rather than assuming it carries forward silently. See `gaps.md`.
