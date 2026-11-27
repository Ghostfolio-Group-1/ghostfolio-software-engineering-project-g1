# Iteration 3 Scrum Notes

**Scrum Master:** Arthur Elly Lim  
**Sprint:** Iteration 3 — Frontend, Visualization, Testing and Refinement  
**Sprint window:** November 2 – December 5, 2026

## Purpose

Live evidence log for Iteration 3 Scrum ceremonies. Prefer GitHub state over memory.

For each working day, record attendance (when known), merged/open PRs, current issues, blockers, and next actions. Do not mark work done unless Definition of Done is met.

## Definition of Done Reminder

```text
GitHub issue
+ implementation/tests
+ PR + independent review
+ green CI
+ merge to main
+ evidence recorded
```

## Daily Standup Template

```markdown
## YYYY-MM-DD — Daily Standup

**Time:** (as scheduled)

### Attendance

- Sesha:
- Tharun:
- Arthur:
- Raniya:

### PR Check From Previous Working Day

- Unmerged PRs:
- Waiting for review:
- Failed CI:

### Sesha — Risk

### Tharun — Tax

### Arthur — Charts / Scrum Master

### Raniya — Architecture / QA / Dashboard

### GitHub State Readout

- Open PRs / late work / blockers:

### Evidence

- Links:
```

---

## Week 4 notes (Nov 23–27)

Direct attendance was not filed for every day. Entries below are GitHub-reconstructed around the QA plan and Charts owner deliverables.

### 2026-11-23 — Monday (usability polish + QA part 1)

**Plan:** Owner usability checklists; Raniya QA Part 1 (Risk / Tax).

**Arthur — Charts**

- Yesterday / recent: series four-state tests in flight; live journey work.
- Today: **Polish chart interactions; fix QA bugs logged today.**
  - Focus ring on range / kind / waterfall toggles (client CSS zeroed `button:focus` outline).
  - Chart-mark contrast on light theme (`#0d7377`); waterfall legend uses body text + swatch.
  - Named groups for kind toggle and waterfall breakdown.
  - Checklist: `docs/testing/charts-usability-checklist-2026-11-23.md`.
  - Regression specs on chart-wrapper, interactive-chart, chart-series-card, waterfall-card.
- PR: #338 (`fix(charts): restore the keyboard ring and chart-mark contrast`).
- Blockers: benchmark still #160; pointer readout #226.

**Team evidence:** QA Part 1 PR #345 / #340; Tax QA #339; Risk checklist #336.

### 2026-11-24 — Tuesday (QA part 2 — Charts + Dashboard)

**Plan:** Raniya QA Part 2 on Overview charts and Unified Dashboard.

**Arthur — Charts**

- QA rows C-01–C-08 logged in `docs/testing/qa-log.md`.
- Failures owned: C-01 (#353 layout clip), C-05 (#338), C-07 (#356 not mounted), C-06 shared #342.
- Passes: C-02 range, C-03 series, C-04 empty.
- BLOCKED: C-08 benchmark (#160, #105).
- Parallel: **Fix Charts QA bugs; add a regression test for each** track — empty-day fix already merged (#334); four-state component coverage (#313 / later #363); live integration journey (#327).

**Team evidence:** QA Part 2 PR #358 / #352.

### 2026-11-25 — Wednesday (regression + 6 PM freeze)

**Plan:** Re-test FAIL rows; freeze bug-fix work at 6 PM CT.

**Arthur — Charts**

- C-06 re-tested PASS with dark-theme / host fixes (#342, #295).
- C-01 / C-05 / C-07 still open or PR-open at freeze table in QA log.
- Overview scrollable host (#295) removes the vertical-centre clip that made C-01 / drawdown mount unsafe.
- Any Charts merge after 6 PM → record **late**.

**Scrum Master:** Confirm freeze table owners; no silent scope expansion on BLOCKED rows.

### 2026-11-26 — Thursday (late follow-ups)

**Arthur — Charts**

- **Last Charts bug fixes** on the integration + browser journey branch (#364):
  - Mount `DrawdownCard` under `InteractiveChart` (partial #356; waterfall stays unmounted).
  - Merge `main` for `embedded` Overview prop; forward `embedded` into drawdown.
  - E2E seed must use `authToken` for API Authorization (not `accessToken`).
  - Read Playwright response bodies immediately (`waitForApiEnvelope`) so navigation does not drop `Network.getResponseBody`.
- Reviews: Raniya approved journey intent; leave #356 open for waterfall; mark #364 late.

**Scrum Master:** Post-freeze PRs need explicit approval; keep docs honest about late status.

### 2026-11-27 — Friday (docs)

**Arthur — Charts / Scrum Master**

- **Docs only: draft the Charts section and the Scrum summary.**
  - `project-docs/iteration-3/charts-report-section.md`
  - `project-docs/iteration-3/scrum-meetings-summary.md`
  - This notes file (Week 4 filled)
  - Ensure usability checklist path referenced by QA log exists on the docs branch
- Next: push docs PR; chase #338 / #364 CI + review; refresh notes after Sprint Review (Dec 3).

---

## Open Charts tracker (as of Nov 27 draft)

| Item                            | State                                     |
| ------------------------------- | ----------------------------------------- |
| #338 keyboard / contrast        | PR open                                   |
| #353 Overview clip              | Addressed with #295; confirm C-01 re-test |
| #356 drawdown + waterfall mount | Drawdown via #364; waterfall still open   |
| #364 integration + browser E2E  | PR open, late                             |
| #160 / #105 benchmark & return  | BLOCKED                                   |
| #226 pointer readout            | Open                                      |

Update this table when PRs merge or issues close.
