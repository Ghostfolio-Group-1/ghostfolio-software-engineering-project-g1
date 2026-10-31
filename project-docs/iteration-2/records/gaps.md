# Gaps — Everything NOT RECORDED Across This Record Set

> **Historical snapshot, last updated Oct 22, 2026.** The report's
> [section 4](../report/iteration-2-report.md) is the current, full-iteration source of truth;
> items below that read as open may already be resolved there. Kept as the evidence trail for
> the shared-account caveat and other day-by-day findings behind section 4.

**Date flagged: 2026-10-08** (all items below, unless otherwise noted)
**Updated: 2026-10-08 end of day** — item 8 resolved (PR #82 merged); item 4 reconfirmed still open
(PR #83 repeated the same unlinked-issue pattern and was still approved/merged); item 22 added
(PR #86 opened today, awaiting review).
**Updated: 2026-10-16** — item 22 reconfirmed: PR #86 still has zero reviews 8 days after opening.
New item 23 added: a growing backlog of approved-but-unmerged PRs. New item 24 added: PR #70 has
been CI-red and untouched for 10 days. See the full detail in each item below and in deviations.md
D-9/D-10.
**Updated: 2026-10-19** — new item 26 added: HealthScoreCalculatorService/ThresholdEngineService
unwired into risk.module.ts/risk.controller.ts, pending Raniya Shaikh's input. New item 27 added:
today's naming-consistency fix kept as untracked local changes, commit/PR deferred to 2026-10-20.
See deviations.md D-11/D-12.
**Updated: 2026-10-21** — item 26 RESOLVED (RiskEvaluationService built and wired into
risk.module.ts as part of #42). New item 28: PR #138 needed a same-day rework after
CHANGES_REQUESTED. New item 29: scenario.name missing from the what-if response. New item 30:
docs/sesha-notes/02 and 07 were never reconciled on health-score categories/weights. New item 31:
PortfolioVolatility has no real nightly-volatility data source yet. See deviations.md D-13.
**Updated: 2026-10-22** — verification pass against GitHub requested by the team ("did any PRs
merge since Oct 16?"). Item 28 RESOLVED (PR #138 approved and merged 01:04:11Z after 4 review
rounds total). Item 29 RESOLVED (scenario.name fixed in the same rework). D-9's approved-but-
unmerged PRs #95/#108/#113/#118 confirmed merged 2026-10-16, same day as originally flagged. New
item 32: issue #41 is functionally done (by #138) but was never linked/closed. New item 33: issue
#43 (volatility cache job) confirmed not started. New item 34: PR #105 is still unmerged, the one
D-9 item that never cleared. See deviations.md D-9/D-13/D-14/D-15 and sprint-backlog.csv's updated
T-34/T-35/T-37/T-38/T-39/T-40/T-41/T-42/T-43 rows.

This file is the honest summary of everything that could NOT be verified from GitHub (`gh`/`git`)
or committed repo docs while building `project-facts.md`, `product-backlog.csv`,
`sprint-backlog.csv`, `deviations.md`, `scrum-meetings.md`, `retrospective.md`, `github-audit.csv`,
`test-log.csv`, `architecture-log.md`, `iteration-3-inputs.md`, and `demo-log.md`. Per the spec's
own rule, nothing below was inferred or invented to fill the gap — it is listed here instead.

Items are grouped by severity for triage, since some block specific report sections outright.

---

## BLOCKING — Cover Page

1. **Report due date.** No document gives an explicit "report due" date distinct from the sprint
   end date (Nov 1) or the "Final Report Review Call" (Oct 31) listed in `scrum-notes.md`'s
   Ceremony Index. **Who can supply it:** whoever (instructor/course) sets the actual due date —
   likely Tharun Swaminathan (Scrum Master) or the team as a whole would know this from the course
   syllabus, which isn't in the repo.

2. **Iteration 3 Scrum Master — single-source confirmation.** Arthur Elly Lim is named in
   `report-cover-page.md` (an Iteration-1-era doc) but no Iteration-3-specific document
   corroborates this independently. **Who can supply it:** Arthur Elly Lim or Tharun Swaminathan
   (current Scrum Master) could confirm/reconfirm this in a fresh doc.

## BLOCKING — GitHub Collaboration / Audit

3. **Arthur Elly Lim's commits are not independently attributable from git/GitHub identity.**
   All of his Oct 2–8 activity is recorded under the shared `Error404IsFound` GitHub login, with
   commit author emails split between a personal Gmail address (`syntx404ae@gmail.com`) and the
   GitHub noreply address tied to that login. There is no way, from `gh`/`git` alone, to prove
   that every one of these commits/PRs/reviews was actually performed by Arthur and not another
   team member also using that shared account. This is flagged explicitly in `project-facts.md`,
   `github-audit.csv`, `deviations.md` (D-4, D-5), and `architecture-log.md`, per the task's
   explicit instruction. **Who can supply resolution:** Arthur Elly Lim would need to start
   committing under his own personal GitHub account for future iterations; retroactively, only
   the team's own memory of who was at the keyboard could resolve past commits, which GitHub
   cannot verify.

4. **Charts feature has zero filed GitHub issues — still true as of 2026-10-08 close, and the
   pattern repeated today.** `gh issue list` returns no `[Charts]`-titled or `feature:charts`-
   labeled issue at all. PR #83 (merged 2026-10-08T15:44:40Z, Raniya Shaikh reviewing) is the Oct 8
   instance: its body has `## Closes` / `Closes #` with the issue number left blank, and it was
   approved and merged without that being raised as a blocker. Every PR touching charts work (#50,
   #69, #70, #76, #83) lacks a "Closes #"/"Part of #" reference. **Who can supply it:** Arthur Elly
   Lim (owner of the charts feature) needs to file these issues retroactively or going forward;
   Tharun Swaminathan (Scrum Master) is positioned to enforce it per the team's own Definition of
   Done — and reviewers (today, Raniya Shaikh) could also decline to approve until an issue link is
   added.

5. **Direct pushes to `main` / force pushes.** `gh`/`git` as queried in this pass surfaced no
   evidence either way beyond what merge-commit history shows (i.e., no bypass of the PR process
   was visible in the commit graph). This is not the same as a confirmed "zero direct pushes"
   finding — a full server-side audit log (e.g. GitHub's organization audit log, which requires
   org-admin access this session does not have) was not queried. **Who can supply it:** a repo/org
   admin (likely Raniya Shaikh, who set up the branch-protection ruleset, or whoever has admin
   rights) could pull the GitHub audit log.

6. **Issue comment authorship/counts per member per day.** `github-audit.csv` notes this was not
   queried per-issue in this pass (would require 44 separate `gh issue view <n> --json comments`
   calls). **Who can supply it:** re-run a per-issue comment query; any team member can also just
   look at the Issues tab.

7. **Branch creation timestamps (as opposed to first-commit timestamps).** `git`/`gh` don't expose
   a branch-creation event distinct from its first commit's timestamp in the data pulled here.
   `github-audit.csv`'s per-day branch columns are therefore inferred from first-commit dates, not
   a true "branch created at" timestamp. **Who can supply it:** GitHub's events API
   (`gh api repos/.../events`) might carry `CreateEvent` records if still within retention —
   not queried in this pass.

## BLOCKING — Quality Assurance / Testing

8. ~~**The "151/152 passing" claim is disputed, not resolved.**~~ **RESOLVED 2026-10-08.** PR #82
   (Sesha Siva Sankar review, APPROVED 2026-10-08T21:46:05Z; merged 2026-10-09T03:20:59Z) retracted
   the claim in `project-docs/testing-framework.md` and replaced it with a dated table of actual
   per-run counts (Oct 5/Oct 7, by project), explicitly attributing the Oct 7 `api` suite failures
   to the PR #72 `withholdingTax` build break rather than real test regressions. `main` no longer
   carries the unverifiable claim.

9. **No coverage report found anywhere in CI.** `gh run list`/`statusCheckRollup` only exposes
   pass/fail per named check (`build`, `build_and_push`); no coverage percentage or per-module
   coverage artifact was found. **Who can supply it:** whoever owns the CI workflow (Raniya
   Shaikh, per PR #49) would need to add a coverage-reporting step if the report wants per-module
   numbers.

10. **"Integration pass #1 / #2" terminology could not be located anywhere** — not in issues, PRs,
    or docs searched. **Who can supply it:** whoever originally used that phrase (not identified)
    — possibly this refers to something not yet written down, or a different project's
    terminology; worth asking the team directly before assuming it applies here.

11. **Individual test names/assertions for `withholding-tax-migration.spec.ts`** were not
    extracted (file's existence was confirmed, content was not read line-by-line in this pass due
    to time). **Who can supply it:** re-run `git show` on that file; Tharun Swaminathan (tax
    owner) would also know its contents directly.

12. **The exact isolated withholding-tax-persistence test count** (as opposed to the full
    `test:api` suite total of 254 tests/58 suites reported in PR #80's body) was not separately
    confirmed. **Who can supply it:** Tharun Swaminathan, or re-run the specific spec file.

## NON-BLOCKING but material

13. **`scrum-notes.md` has no entries for Oct 6, 7, or 8**, despite the Ceremony Index scheduling
    standups on all three dates (Oct 8 additionally marked "Week 1 Check"). This means attendance,
    facilitator, live blockers, and whether the Oct 7 CI incident (PR #72 breaking `main`) was
    raised at a standup are all NOT RECORDED for those three days. **Who can supply it:** Tharun
    Swaminathan (Scrum Master, owns the weekly notes commit per the file's own "Weekly Friday Notes
    Commit" rule — the next one may be due around Oct 9, which could explain rather than excuse
    the gap).

14. **Attendance fields in the Oct 2 and Oct 5 entries that DO exist are also blank templates** —
    the `Sesha:`/`Tharun:`/`Arthur:`/`Raniya:` lines were never filled in with actual names/notes,
    even though the entries exist. **Who can supply it:** whoever ran those two meetings
    (presumably Tharun Swaminathan) would need to backfill from memory, or the team accepts this
    as a permanent gap.

15. **Priority and estimate fields are not set on any of the 44 GitHub issues reviewed** — no
    label or custom field carries this info, so every row of `product-backlog.csv` shows "NOT
    RECORDED" for both. **Who can supply it:** each feature owner, retroactively adding
    priority/estimate labels or fields to their own issues.

16. **Per-issue change history (edits, retitles, reassignments)** was not pulled — would require
    `gh issue view --json timeline` or similar per issue, not done in this pass for all 44 issues.
    **Who can supply it:** re-run a per-issue timeline query if the report needs this level of
    detail.

17. **Retrospective and in-class demo have not happened yet** — both files say so explicitly
    (`retrospective.md`, `demo-log.md`), with planned dates Oct 30 and Oct 29 respectively, per
    `scrum-notes.md`'s Ceremony Index. This is expected given the sprint is only on day 7 of 31,
    not a gap in evidence-gathering.

18. **Deployment view (file #9, architecture-log.md Section 5).** No infra/deployment-config
    change was found in the Oct 2–8 window beyond CI workflow and branch-protection setup, and no
    deployment target (staging/production host, container registry, etc.) was identified in the
    repo to describe. **Who can supply it:** Raniya Shaikh (architecture/CI owner) likely knows
    whether a deployment view exists outside this repo (e.g. in a separate ops doc or hosting
    dashboard) that wasn't searched here.

19. **Architecture diagram source files' last-updated dates** — `architecture-baseline.md`,
    `target-architecture.md`, and the integration design doc were not touched by any Oct 2–8
    commit, so they are stale relative to the code changes logged in `architecture-log.md`, but no
    one has explicitly flagged or scheduled their update. **Who can supply it:** Raniya Shaikh
    (architecture owner) — likely the right person to decide whether/when these need refreshing.

20. **Whether the Oct 7 CI incident (PR #72/#78) was escalated per `scrum-notes.md`'s own rule**
    ("CI red on main -> fix before new work") — the fix did happen same-evening, but no recorded
    decision/triage note confirms this followed a deliberate team process versus one person
    noticing and fixing it solo. **Who can supply it:** Sesha Siva Sankar (who opened the hotfix)
    or Tharun Swaminathan (Scrum Master) could clarify how this was actually handled in real time.

21. **Branch naming for Raniya's `raniya/2026-10-02-setup-ci-governance` branch** has no issue
    number component, unlike the pattern used from Oct 5 onward. Not flagged as a problem by any
    reviewer in the data pulled, but noted here for completeness since the task asked to verify
    naming-pattern compliance.

22. **PR #86 (Tharun Swaminathan, #84 DividendRecord) awaiting review - still open 8 days later.**
    Opened 2026-10-08, reviewer requested is `Error404IsFound` per the reviewer ring. As of
    2026-10-16, `gh pr view 86 --json reviews` returns zero reviews - no comment, no approval, no
    changes-requested. CI is green (`SUCCESS,SUCCESS`). **Who can supply it:** Arthur Elly Lim (via
    the shared account) to review.

23. **Approved-but-unmerged PRs are piling up.** As of 2026-10-16, five open PRs show
    `reviewDecision: APPROVED` with CI green but are not merged: #95 (Sesha, opened 2026-10-12,
    approved 2026-10-12 - 4 days unmerged), #105 (Arthur/Error404IsFound, opened 2026-10-14),
    #108 (Sesha, opened 2026-10-14), #113 (Sesha, opened 2026-10-15), #118 (Arthur/Error404IsFound,
    opened 2026-10-15). This session's own merge attempts via `gh pr merge` are blocked by a
    permission restriction on the assistant account, so Sesha's three (#95/#108/#113) require a
    human clicking "Merge" in the GitHub UI; #105/#118 being unmerged by Arthur's account is
    NOT RECORDED as to cause (could be deliberate batching, could be the same kind of blocker, or
    simple inattention - not verifiable from `gh` data alone). **Who can supply it:** whoever owns
    merge responsibility for the team - either designate someone with merge rights to clear the
    approved queue regularly, or confirm Arthur's reason for not merging #105/#118.

24. **PR #70 (Arthur/charts, Reconcile chart API contract) has been CI-red and untouched for
    10 days.** `CHANGES_REQUESTED` by Tharun Swaminathan on 2026-10-06T14:45:31Z citing both
    failing CI and architecture/process issues (see deviations.md D-4 family). As of 2026-10-16,
    `gh pr checks 70` still shows `build (22.23.2)=FAILURE` and `build_and_push=FAILURE` on the
    same stale run from October 6 - no new commits, no new CI run. This is the longest-stalled PR
    in the repository (10 days since review, longer since open). **Who can supply it:** Arthur Elly
    Lim needs to either fix and re-push, or the team needs to decide whether to close/abandon this
    PR given its age.

25. **sprint-backlog.csv's Oct 9-16 window only has Sesha's own tasks (T-34 through T-39) fully
    backfilled.** Tharun's, Raniya's, and Arthur's tasks across that same window (roughly PRs
    #92, #94, #98, #99, #101, #104, #105, #107, #109, #111, #112, #116, #117, #118 - a large
    merged/in-review set) were not individually backfilled with reviewer/timing detail in this
    pass, matching the same scale of effort as the original Oct 2-8 backfill. **Who can supply
    it:** a dedicated backfill pass per the same method as the original (gather raw `gh pr
list`/`gh pr view` data for each PR, then write rows), ideally run again once this set of
    approved-but-unmerged PRs clears.

26. ~~**HealthScoreCalculatorService and ThresholdEngineService are not wired into
    risk.module.ts/risk.controller.ts.**~~ **RESOLVED 2026-10-21.** Built as part of the #42
    what-if work (deviations.md D-13): `RiskEvaluationService` now runs the 7 warning-threshold
    rules against real holdings, and `HealthScoreCalculatorService`/`ThresholdEngineService`/
    `RiskEvaluationService` are all registered providers in `risk.module.ts`. No conflict with
    Raniya's work in that file — the change was additive only.

27. **2026-10-19 naming-consistency fix (D-11) is sitting as untracked local changes, not yet
    committed or PR'd.** Per team decision made same day, this work (renames across
    exposure.service.ts, threshold-engine.service.ts, health-score-calculator.service.ts,
    risk.controller.ts, and their specs) is being held back from commit/PR until 2026-10-20.
    **Who can supply it:** Sesha Siva Sankar, tomorrow.

28. ~~**PR #138 (#42, what-if endpoint) required a same-day rework after CHANGES_REQUESTED.**~~
    **RESOLVED 2026-10-22T01:04:11Z.** 2026-10-21: Tharun Swaminathan's review found the first
    version only diffed a caller-supplied before/after pair rather than computing the shocked state
    itself, used holdings-only portfolio value instead of holdings-plus-cash, and had no
    endpoint/DTO/module wiring or integration test. Took 3 more `CHANGES_REQUESTED` rounds after
    that (per-holding warning diffing, an unreachable DTO-level validation range, `scenario.name`,
    a real merge conflict against PR #141, and a `NO_DATA`-inflates-score scoring bug) before
    approval and merge — see deviations.md D-13 for the full round-by-round history.

29. ~~**`scenario.name` is missing from the what-if response.**~~ **RESOLVED** as part of item 28's
    final rework — read directly off the matched holding's `assetProfile.name`, no extra lookup
    needed.

30. **docs/sesha-notes/02-health-score-data-model.md and 07-warning-threshold-rules.md were never
    reconciled.** Found 2026-10-21 while building RiskEvaluationService. 02's category/weight table
    (Fees, Emergency Fund, Buying Power, 8 categories) is written against Ghostfolio's older X-Ray
    rule catalog, not the 7-rule set 07/warning-threshold.model.ts actually define and that the risk
    API evaluates. RiskEvaluationService currently uses equal per-rule weights within 4 provisional
    categories (concentration, cash, volatility, targetAllocation) rather than invent precision that
    isn't settled. **Who can supply it:** Sesha Siva Sankar (health score) and whoever owns 07
    (also Sesha) would need to agree on one category/weight table for the actual 7-rule set.

31. **PortfolioVolatility has no real data source.** No nightly volatility cache/service exists
    anywhere in the codebase (searched 2026-10-21 while building RiskEvaluationService), so the
    rule always evaluates as NO_DATA until that pipeline is built — correctly handled per the
    existing NO_DATA invariant, but it means volatility-based warnings/health-score contributions
    are not actually live yet. **Who can supply it:** whoever builds the nightly volatility
    pre-computation job referenced in docs/sesha-notes/04-volatility-cash-allocation-spec.md. Issue
    #43 ("Volatility cache refresh job (Redis, TTL)") is the tracked follow-up and is still OPEN,
    not started, as of 2026-10-22 (see item 33).

32. **Issue #41 is functionally done but was never linked or closed.** Found 2026-10-22 while
    verifying current state against GitHub for the team. #41 ("What-if simulator: copy holdings,
    apply drop-by-X% shock") describes exactly what `WhatIfService.calculateWhatIf()` (PR #138,
    closing #42) already does, but no PR was ever opened under #41's own number, and #41 is still
    `OPEN`. See deviations.md D-14. **Who can supply it:** the team needs to decide whether to
    close #41 referencing #138, or confirm its scope is genuinely separate and still needed.

33. **Issue #43 (volatility cache refresh job) has not been started.** Confirmed `OPEN` via
    `gh issue view` on 2026-10-22, the same day its title tag (`[Thu Oct 22]`) marks as its planned
    date. This is the direct blocker behind item 31 (`PortfolioVolatility` always NO_DATA).
    **Who can supply it:** whoever picks up #43 next — no owner assigned as of this check.

34. **PR #105 is still approved and unmerged, 8+ days after D-9 flagged it.** Re-checked
    2026-10-22: `reviewDecision: APPROVED`, but `mergeStateStatus`/`mergeable` both read `UNKNOWN`
    rather than a clean `MERGEABLE`, and it was never merged when the other 4 PRs in the same D-9
    batch (#95, #108, #113, #118) all cleared on 2026-10-16. **Who can supply it:** Arthur Elly
    Lim/Error404IsFound (the PR's author) or whoever has merge rights to clear it or investigate
    the `UNKNOWN` mergeable state.

---

## Summary table (quick reference)

| #   | Gap                                         | Severity              | Who can supply          |
| --- | ------------------------------------------- | --------------------- | ----------------------- |
| 1   | Report due date                             | Blocking (Cover Page) | Course/syllabus; Tharun |
| 2   | Iteration 3 SM — single-source confirm      | Blocking (Cover Page) | Arthur / Tharun         |
| 3   | Arthur's shared-account attribution         | Blocking (Audit)      | Arthur (going forward)  |
| 4   | Charts has 0 filed issues                   | Blocking (Audit)      | Arthur / Tharun         |
| 5   | Direct-push/force-push server audit log     | Blocking (Audit)      | Org admin (Raniya?)     |
| 6   | Issue comment authorship per day            | Blocking (Audit)      | Re-query; any member    |
| 7   | True branch-creation timestamps             | Blocking (Audit)      | Re-query events API     |
| 8   | "151/152" claim — RESOLVED 2026-10-08       | Resolved              | Raniya (PR #82 merged)  |
| 9   | No CI coverage report                       | Blocking (QA)         | Raniya (CI owner)       |
| 10  | "Integration pass #1/#2" not found          | Blocking (QA)         | Unknown — ask team      |
| 11  | withholding-tax-migration.spec.ts contents  | Blocking (QA)         | Tharun                  |
| 12  | Isolated withholding-tax test count         | Blocking (QA)         | Tharun                  |
| 13  | Oct 6/7/8 standups missing                  | Material              | Tharun                  |
| 14  | Oct 2/5 attendance blank                    | Material              | Tharun                  |
| 15  | No priority/estimate on issues              | Material              | Each feature owner      |
| 16  | Per-issue change history not pulled         | Material              | Re-query if needed      |
| 17  | Retro/demo not yet held                     | Expected, not a gap   | N/A — scheduled later   |
| 18  | Deployment view undocumented                | Material              | Raniya                  |
| 19  | Architecture diagrams stale                 | Material              | Raniya                  |
| 20  | CI-incident escalation process unclear      | Material              | Sesha / Tharun          |
| 21  | One branch name off-pattern                 | Minor                 | Raniya                  |
| 22  | PR #86 awaiting review - 8 days, 0 reviews  | Material              | Arthur                  |
| 23  | 5 approved PRs unmerged (oldest 4 days)     | Material              | Merge-rights owner      |
| 24  | PR #70 CI-red + untouched 10 days           | Material              | Arthur                  |
| 25  | Oct 9-16 backlog only has Sesha's tasks     | Material              | Next backfill pass      |
| 26  | Health score/threshold engine unwired       | Resolved              | Sesha (2026-10-21)      |
| 27  | Oct 19 naming fix untracked, PR deferred    | Minor                 | Sesha (tomorrow)        |
| 28  | PR #138 needed rework (4 review rounds)     | Resolved              | Tharun (approved)       |
| 29  | scenario.name missing from what-if response | Resolved              | Sesha (fixed)           |
| 30  | Docs 02/07 health-score category mismatch   | Material              | Sesha                   |
| 31  | PortfolioVolatility has no real data source | Material              | Whoever builds nightly  |
| 32  | Issue #41 done but never linked/closed      | Material              | Team decision           |
| 33  | Issue #43 not started                       | Material              | Unassigned              |
| 34  | PR #105 still unmerged (8+ days)            | Material              | Arthur / merge-rights   |
