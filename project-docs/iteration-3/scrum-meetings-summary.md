# Scrum Meetings Summary — Iteration 3

**Scrum Master:** Arthur Elly Lim  
**Iteration:** 3 — Frontend, Visualization, Testing and Refinement  
**Sprint window:** November 2 – December 5, 2026 (reporting draft through Week 4 / Nov 27)  
**Handover source:** `project-docs/iteration-2/retrospective-summary.md` (Iteration 3 Scrum Master = Arthur)

## 1. Scrum Process

Iteration 3 kept the Iteration 2 Definition of Done:

```text
GitHub issue
+ implementation/tests
+ pull request
+ independent review
+ green CI
+ merge to main
+ recorded evidence
```

Ceremony expectations from the Iteration 3 sprint plan (Rev 2) included weekday standups, mid-sprint checks, Manual QA **Nov 23–25**, a **6 PM Nov 25** bug-fix freeze, Sprint Review, and final report work through early December.

Arthur’s Scrum Master actions from the Iteration 2 retrospective:

- clear stale/open PRs;
- require review + green CI before merge;
- keep PRs small and issue-linked;
- reconcile issue state after merge;
- maintain Scrum notes (attendance, current issue, blockers, merged PRs, next actions).

## 2. Evidence Classification

Same three classes as Iteration 2:

1. **Direct meeting evidence** — completed notes, attendance, screenshots.
2. **Team-provided scheduling evidence** — shortened/cancelled meetings for academic reasons.
3. **GitHub-reconstructed evidence** — issues, PRs, reviews, CI, merges when notes are incomplete.

This Week 4 section relies primarily on GitHub-reconstructed evidence plus the shared QA log. Exact spoken dialogue is not reconstructed.

## 3. Week structure (high level)

| Week | Calendar  | Focus                                                   |
| ---- | --------- | ------------------------------------------------------- |
| 1    | Nov 2–8   | React hosts, Charts range/series hooks, Tax/Risk wiring |
| 2    | Nov 9–15  | Drawdown/waterfall React cards; dashboard charts card   |
| 3    | Nov 16–22 | Live integration / E2E expansion; numeric chart tests   |
| 4    | Nov 23–27 | Manual QA, polish, freeze, late follow-ups, docs        |

Earlier weekday detail lives in `project-docs/iteration-3/daily-log/` (Sesha-focused Nov 2–9) and in feature PR history. The remainder of this file concentrates on **Week 4**, which owned QA and freeze.

---

## 4. Week 4 — November 23–27

### 4.1 Planned checkpoints

| Date              | Plan item                                  | Evidence used                                            |
| ----------------- | ------------------------------------------ | -------------------------------------------------------- |
| Mon Nov 23        | Module usability checklists (each owner)   | Risk #336, Tax #339, Charts checklist path (#338)        |
| Mon–Tue Nov 23–24 | QA pass parts 1–2                          | QA log PRs #345 / #358                                   |
| Wed Nov 25        | Regression run before 6 PM freeze          | QA log “Regression run”; #342 / #295                     |
| Thu–Fri Nov 26–27 | Late merges only with Scrum approval; docs | Open Charts #338, #364; Tax report #367; this docs draft |

### 4.2 Charts work logged this week

The Charts owner’s Week 4 titles (as shipped or opened):

| Theme                                               | What happened                                                                                              | PR / issue                                            |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Polish chart interactions; fix QA bugs logged today | Focus ring, named groups, chart-mark / waterfall text contrast; checklist + component regressions          | #338                                                  |
| Fix Charts QA bugs; add a regression test for each  | Empty-day-before-first-buy = 0 (+ tests); four-state chart views; live journey                             | #334, #313/#363, #327                                 |
| Last Charts bug fixes; Week 4 Scrum notes           | Overview layout/`embedded` via #295; drawdown mount + browser E2E; authToken / response-body E2E hardening | #295, #353, #356, #364                                |
| Docs only: Charts section + Scrum summary           | This documentation set                                                                                     | charts-report-section.md + this file + scrum-notes.md |

### 4.3 Cross-feature freeze snapshot (from QA log)

At the Wed Nov 25 freeze readout:

- C-06 dark theme: **PASS** after #342 / #295.
- C-01, C-05, C-07: still open or PR-open for Arthur (#353, #338, #356).
- C-08 benchmark: **BLOCKED** on #160 / #105.
- Risk R-07 / R-04: closed. Tax T-07: merged late (#349). Dashboard D-02 / D-07 / X-02: still open for Raniya (shared with feature owners where noted).

Work merged after 6 PM Nov 25 must be recorded as **late** (Charts #364 explicitly).

### 4.4 Scrum Master observations (Week 4)

**Strengths**

- Shared QA log with per-row issue links made freeze decisions evidence-based.
- Independent review still blocked weak regressions (example: Tax peer review on Risk what-if #365).
- Charts kept BLOCKED annotations for benchmark/return instead of inventing UI.

**Problems**

- Direct daily standup notes for Iteration 3 were thinner than repository evidence (same weakness as Iteration 2).
- Charts still had open PRs at freeze (#338, #364) and a partial #356 (drawdown vs waterfall).
- Overview layout bug (C-01) depended on host work (#295) as well as Charts-owned mount decisions.

**Next actions into final week**

1. Land or close #338 and #364 with reviewer + CI.
2. Leave #356 open until waterfall is mounted **or** split waterfall into its own issue.
3. Refresh this summary after December 3 Sprint Review.
4. Do not claim benchmark/return/waterfall HTTP as done on `main`.

---

## 5. Scrum Evidence Limitation

Iteration 3 has strong implementation and QA-log evidence. Direct attendance sheets for every weekday standup are incomplete in-repo.

Reporting rule (unchanged from Iteration 2):

```text
Development completion: GitHub + tests + CI + merges
Meeting scheduling: team-provided when noted
Attendance: only when direct evidence exists
Spoken discussion: not invented from GitHub
```

Live note template and Week 4 day stubs: `project-docs/iteration-3/scrum-notes.md`.

---

## 6. Summary

Iteration 3 moved every feature into React hosts with multi-layer tests and a coordinated Nov 23–25 QA window. Arthur served as Scrum Master while finishing Charts UI, tests, polish, and freeze follow-ups.

Week 4 closed the manual QA window, fixed several Charts defects with regression tests, left benchmark/return/waterfall honestly blocked or partial, and produced the Charts final-report section plus this Scrum summary for the December submission package.
