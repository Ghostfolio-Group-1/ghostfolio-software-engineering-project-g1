# Deviations — Iteration 2 (feeds: Sprint Backlog — Deviations)

> **Historical snapshot, built Oct 2–22, 2026.** Superseded by the report's own
> [section 2.2 Deviations from plan](../report/iteration-2-report.md), which is the current,
> full-iteration source of truth. Kept here only as the day-by-day evidence trail behind it.

Source: GitHub PRs/reviews/CI runs via `gh`, cross-referenced with `project-docs/iteration-2/scrum-notes.md`.
Standup-link columns are NOT RECORDED where `scrum-notes.md` has no entry for that date (see `gaps.md` —
the file has only Oct 2 and Oct 5 standups written; Oct 6, 7, 8 standups were not found in the committed doc).

---

## D-1 — PR #51 (Issue #30, single-stock concentration) required rework before merge

- **Date noticed:** 2026-10-05
- **Task ID:** T-30 (sprint-backlog.csv)
- **Owner:** Sesha Siva Sankar
- **Planned:** Merge single-stock concentration rule with numeric tests, same day.
- **What happened:** Tharun Swaminathan's review (`CHANGES_REQUESTED`, 2026-10-05T17:52:40Z) found duplicate positions for the same symbol were not aggregated before the concentration check.
- **Reason:** Implementation bug caught in review, not a planning error.
- **Decision taken:** Fix same day — commit `2c062a0` ("aggregate single-stock concentration by symbol, not by position") plus a new regression test (AAPL 6% + AAPL 6% = 12%).
- **Who decided:** Tharun Swaminathan (reviewer) requested the fix; Sesha Siva Sankar implemented it.
- **New date:** None needed — re-approved and merged same day (2026-10-05T18:03:45Z / T18:04:14Z).
- **Raised at standup:** NOT RECORDED. `scrum-notes.md`'s Oct 5 entry documents this rework narratively ("Initial review found that duplicate positions... re-review found the blocking issue was corrected") but the entry's "Attendance" field is an unfilled template, so it cannot be confirmed this was raised live at the 9:30 standup versus written up after the fact. See `gaps.md`.

## D-2 — PR #71 (Issue #31, sector + country concentration) required rework before merge

- **Date noticed:** 2026-10-06
- **Task ID:** T-31
- **Owner:** Sesha Siva Sankar
- **Planned:** Replace the `risk.service.spec.ts` placeholder and ship sector/country concentration same day.
- **What happened:** Tharun Swaminathan's review (`CHANGES_REQUESTED`, 2026-10-06T14:44:55Z) was followed by commit `a6b2542` ("add real coverage to risk.service.spec.ts per review") and a follow-up commit `4ac11ce` ("correct Healthcare figures in sector FX test title").
- **Reason:** Review found insufficient test coverage in the replaced placeholder spec.
- **Decision taken:** Same-day rework; re-approved 2026-10-06T15:36:46Z, merged 2026-10-06T15:58:18Z.
- **Who decided:** Tharun Swaminathan (reviewer).
- **New date:** None needed.
- **Raised at standup:** NOT RECORDED — no scrum-notes.md entry exists for Oct 6. See `gaps.md`.

## D-3 — PR #72 (Issue #46, withholdingTax schema) broke `main`'s production build for ~18.5 hours

- **Date noticed:** 2026-10-07 (build break existed from merge at 2026-10-07T01:09:22Z until fix PR #78 merged at 2026-10-07T19:45:48Z)
- **Task ID:** T-46 / T-hotfix-78
- **Owner:** Tharun Swaminathan (originating change); Sesha Siva Sankar (fix)
- **Planned:** PR #72 adds nullable `withholdingTax` to `Order`/DTOs, reviewed and merged cleanly.
- **What happened:** PR #72 made `withholdingTax` a required field on the Activity/Order type but did not update `export.service.ts`'s `activities.map()`, so `main` failed `build:production` with TS2322 (confirmed in PR #78's description, authored by Sesha). GitHub's own CI (`statusCheckRollup`) shows `build (22.23.2)=FAILURE` and `build_and_push=FAILURE` recorded on PR #72 itself at merge time — the break was visible in CI before merge and the PR was merged anyway.
- **Reason:** Incomplete call-site update; reviewer (Arthur, via the shared `Error404IsFound` account) approved despite the red CI status shown on the PR.
- **Decision taken:** Sesha opened an unplanned hotfix (`sesha/2026-10-07-hotfix-export-withholding-tax`, PR #78) adding `withholdingTax` to the `export.service.ts` destructure/return. Reviewed and approved by Tharun Swaminathan, merged 2026-10-07T19:45:48Z.
- **Who decided:** Sesha Siva Sankar opened the hotfix; Tharun Swaminathan approved it. No evidence found of a recorded team decision/triage meeting before the fix — this looks like an individual response to a broken build rather than a logged team decision.
- **New date:** N/A (same-day hotfix once picked up).
- **Raised at standup:** NOT RECORDED — no Oct 7 standup entry exists in `scrum-notes.md` to confirm this was raised live, despite `scrum-notes.md`'s own escalation rule stating "CI red on main -> fix before new work." Whether that rule was followed via a recorded process, or just fixed ad hoc, is NOT RECORDED. See `gaps.md`.
- **Secondary effect:** Two other Oct 7 branches (`raniya/2026-10-06-73-react-ui-scaffold` underlying PR #75, and `tharun/2026-10-07-79-withholding-persistence` underlying PR #80) show CI `FAILURE` entries in their check histories during this window, consistent with inheriting the broken `main` build; both note the dependency explicitly in their PR bodies.

## D-4 — PR #50 (Arthur/charts) — process violations identified by reviewer, unresolved as of Oct 8

- **Date noticed:** 2026-10-05 (review submitted; PR itself opened 2026-10-03)
- **Task ID:** T-arthur-oct3
- **Owner:** Arthur Elly Lim (committed through the shared `Error404IsFound` account)
- **Planned:** NOT RECORDED — no issue exists for this work, so there is no documented plan to compare against.
- **What happened:** Tharun Swaminathan's review (`CHANGES_REQUESTED`, 2026-10-05T21:17:04Z) explicitly cited five problems: (1) unfinished README with a placeholder note left in; (2) a shell-specific `package.json` script not safe on the team's Windows cmd environment; (3) chart endpoints documented under `/api/v1/portfolio/...` instead of the agreed `/api/v1/charts/...` boundary; (4) no PR description or linked issue; (5) continued use of the shared `Error404IsFound` account on a long-lived `arthur` branch, which the reviewer states violates Iteration 2's "attributable personal identity and short-lived issue/day branches" requirement.
- **Reason:** Charts work was not brought into the same issue-per-day / branch-per-issue process the other three features used from Oct 2 onward.
- **Decision taken:** NOT RECORDED. As of 2026-10-08 PR #50 is still OPEN with no further commits or re-review after the 2026-10-05 `CHANGES_REQUESTED` review.
- **Who decided:** N/A — no resolving decision found.
- **New date:** NOT RECORDED.
- **Raised at standup:** NOT RECORDED.
- **This is a standing, unresolved deviation**, not a one-time fixed item — see the related charts-feature governance gaps in `gaps.md`.

## D-5 — Charts feature has no filed GitHub issues for any Oct 2–8 work

- **Date noticed:** 2026-10-08 (observed while assembling this record set; the underlying condition has existed since the sprint started)
- **Task ID:** Applies to T-arthur-oct6-a, T-arthur-oct6-b, T-arthur-oct7, T-arthur-oct8, T-arthur-oct3
- **Owner:** Arthur Elly Lim
- **Planned:** Per the Definition of Done in `scrum-notes.md` ("GitHub issue exists + implementation/tests completed + PR opened + independent reviewer approval + CI green + PR merged to main + issue/evidence link recorded"), every task should trace to a GitHub issue.
- **What happened:** `gh issue list` returns zero issues with a `[Charts]` title prefix or a `feature: charts`/`feature:charts` label. All five of Arthur's PRs in this window (#50, #69, #70, #76, #83) either say "no linked issue" explicitly (PR #50 review) or simply contain no `Closes #`/`Part of #` reference.
- **Reason:** NOT RECORDED — no documented reason found.
- **Decision taken:** NOT RECORDED — no evidence this was escalated or a remediation plan agreed.
- **Who decided:** N/A.
- **New date:** NOT RECORDED.
- **Raised at standup:** NOT RECORDED — cannot be, since no Oct 6/7/8 standup entries exist in `scrum-notes.md`.

## D-6 — PR #61 (Issue #60) showed a failed/cancelled CI run before its final green run

- **Date noticed:** 2026-10-05
- **Task ID:** T-60
- **Owner:** Raniya Shaikh
- **Planned:** Module skeletons merge same day.
- **What happened:** `statusCheckRollup` on PR #61 shows two recorded runs: `build_and_push=CANCELLED` alongside `build (22.23.2)=SUCCESS`, and a later run with both `SUCCESS`. The merge went through on the passing run.
- **Reason:** NOT RECORDED (cancellation reason not available from `gh pr checks`/`statusCheckRollup` — could be a superseded run from a rapid push, not necessarily a failure).
- **Decision taken:** NOT RECORDED.
- **Who decided:** N/A.
- **New date:** N/A — merged same day, 2026-10-05T20:47:03Z.
- **Raised at standup:** NOT RECORDED.

## D-7 — Scrum notes stop after Oct 5; no Oct 6, 7, or 8 standup entries exist

- **Date noticed:** 2026-10-08, while assembling this record set.
- **Task ID:** Process-level, not tied to one task.
- **Owner:** Tharun Swaminathan (Scrum Master, Iteration 2) is the person who owns updating `scrum-notes.md` per its own instructions ("Weekly Friday Notes Commit... Every Friday, commit the accumulated Scrum notes through a PR").
- **Planned:** Per `scrum-notes.md`'s own "Iteration 2 Ceremony Index," standups were scheduled for Oct 06, 07, and 08 (Week 1 Check).
- **What happened:** `project-docs/iteration-2/scrum-notes.md` (485 lines) contains only the Oct 2 and Oct 5 standup/planning entries. No commit adds Oct 6/7/8 entries as of the latest `main` state queried (2026-10-08). The next scheduled "Weekly Friday Notes Commit" per the ceremony index would be around Oct 9 (not yet reached at time of writing), which may explain the gap rather than a missed obligation — but this cannot be confirmed from GitHub data alone.
- **Reason:** NOT RECORDED.
- **Decision taken:** NOT RECORDED.
- **Who decided:** N/A.
- **New date:** NOT RECORDED.
- **Raised at standup:** N/A — this is the absence of standups.
- See `scrum-meetings.md` and `gaps.md` for the full impact of this gap.

## D-8 — PR #77/#88 required a two-step branch update after PR #87 landed mid-flight

- **Date noticed:** 2026-10-08, while merging PR #77 and updating PR #88.
- **Task ID:** T-32 / T-33
- **Owner:** Sesha Siva Sankar
- **Planned:** PR #77 (Issue #32) would merge on its own schedule; PR #88 (Issue #33), stacked on top of it, would then update from `main` once and be ready for Tharun's review.
- **What happened:** PR #87 (Raniya, new required CI jobs - Lint and format / Unit tests / Build) merged into `main` while PR #77 was still open and running the old single `build` job. Tharun commented on PR #88 (2026-10-09T03:07:50Z) asking for PR #77 to be updated first so the new required checks would run, then merged, then PR #88 updated from `main` so its diff would narrow to just the Oct 8 changes. This required: (1) merging `main` into PR #77's branch, (2) letting PR #77 auto-merge once the new checks passed, (3) merging `main` into PR #88's branch a second time. An initial attempt to do step 1 accidentally included PR #88's own commit in PR #77's branch (a stale local branch pointer reused across both PRs) and had to be reset and redone before pushing.
- **Reason:** Timing - a third party's PR (#87) changing CI requirements landed in the window between PR #77 being opened and merged, requiring an unplanned update cycle on two dependent PRs.
- **Decision taken:** Update PR #77 from `main`, let it auto-merge, then update PR #88 from `main`; verify each diff before pushing rather than trusting the local branch state.
- **Who decided:** Sesha Siva Sankar, following Tharun Swaminathan's explicit sequencing request on PR #88.
- **New date:** N/A — resolved same day; PR #77 merged 2026-10-09T03:13:29Z, PR #88 merged 2026-10-09T03:46:58Z.
- **Raised at standup:** NOT RECORDED — no Oct 8 standup entry exists (see D-7).

## D-9 — Approved PRs are accumulating unmerged (5 as of 2026-10-16)

- **Date noticed:** 2026-10-16, while compiling the Oct 16 records update.
- **Task ID:** Process-level, spans multiple tasks (#95/T-34 volatility-rule, #105, #108/T-37, #113/T-38, #118).
- **Owner:** Sesha Siva Sankar (3 of the 5: #95, #108, #113); Arthur Elly Lim/Error404IsFound (2 of the 5: #105, #118).
- **Planned:** Each PR would be reviewed, approved, and merged same-day or next-day, matching the sprint's daily-task cadence.
- **What happened:** `gh pr list --json reviewDecision` on 2026-10-16 shows 5 open PRs with `reviewDecision: APPROVED` and all CI checks green, none merged: #95 (approved 2026-10-12, 4 days unmerged), #105 (opened 2026-10-14), #108 (opened 2026-10-14), #113 (opened 2026-10-15), #118 (opened 2026-10-15).
- **Reason:** For Sesha's three, this session's own `gh pr merge` calls are blocked by an assistant-account permission restriction ("Merge Without Review" denial, regardless of actual approval state) - a human has to click Merge in the GitHub UI instead. For Arthur's two (#105, #118), the cause is NOT RECORDED - could be the same kind of blocker on a different account, deliberate batching, or inattention; not verifiable from `gh` data alone.
- **Decision taken:** NOT RECORDED - no team decision found assigning merge responsibility or a cadence for clearing the approved queue.
- **Who decided:** N/A.
- **New date:** NOT RECORDED.
- **Raised at standup:** NOT RECORDED - no standup entries exist past Oct 5 (see D-7); this means the backlog has had no opportunity to be raised live.
- **MOSTLY RESOLVED 2026-10-22, verified via `gh pr view`/`gh issue view` in response to a direct question about current status.** 4 of the 5: #95 (issue #35) merged 2026-10-16T20:13:32Z, #108 (issue #37) merged 2026-10-16T20:13:38Z, #113 (issue #38) merged 2026-10-16T20:13:42Z, #118 merged 2026-10-16T15:44:20Z - all cleared the same day this deviation was logged, just after the snapshot that found them stuck. **#105 is still open and unmerged** as of 2026-10-22 (`reviewDecision: APPROVED`, `mergeStateStatus: UNKNOWN`) - still unresolved, cause still not recorded.

## D-10 — PR #70 has been CI-red and untouched for 10 days

- **Date noticed:** 2026-10-16, while compiling the Oct 16 records update.
- **Task ID:** T-arthur-oct6-b (see sprint-backlog.csv).
- **Owner:** Arthur Elly Lim (via shared account Error404IsFound).
- **Planned:** Reconcile the chart API contract with the real Ghostfolio API; add the TimeRangeSelection DTO.
- **What happened:** Tharun Swaminathan requested changes on 2026-10-06T14:45:31Z, citing both failing CI (`build (22.23.2)=FAILURE`, `build_and_push=FAILURE`) and architecture/process issues (wrong DTO location, wrong branch naming, batched commits - see the original PR #70 review text). As of 2026-10-16, `gh pr checks 70` still shows the identical failing run from October 6; no new commit has been pushed to address either the CI failure or the process feedback in the 10 days since.
- **Reason:** NOT RECORDED - no comment, commit, or status update from the PR author in the intervening 10 days.
- **Decision taken:** NOT RECORDED - the PR remains open with no resolution plan on record.
- **Who decided:** N/A.
- **New date:** NOT RECORDED.
- **Raised at standup:** NOT RECORDED - see D-7.
- This is the longest-stalled open PR in the repository as of this update.

## D-11 — Inconsistent verb naming across Sesha's own risk-domain services, found via self-audit

- **Date noticed:** 2026-10-19
- **Task ID:** T-sesha-oct19 (sprint-backlog.csv)
- **Owner:** Sesha Siva Sankar
- **Planned:** N/A — this was a self-initiated audit of already-merged/already-open risk-domain code, not a scheduled task.
- **What happened:** A review of `ExposureService`, `ThresholdEngineService`, and `HealthScoreCalculatorService` found three different verbs (`build*`, `compute*`, bare `calculate`) used for conceptually equivalent methods, with no consistent rule distinguishing a service's single orchestration entry point from its internal pure-derivation helpers.
- **Reason:** Naming drifted as the three services were implemented across separate day-tasks (#33, #38, #39-adjacent work) without a shared naming convention being written down.
- **Decision taken:** Standardized on `get*` for the one orchestration entry point a controller calls, and `calculate*` for internal/pure derivation methods. Renamed: `ExposureService.buildRiskSummary` to `getRiskSummary` (plus the call site in `risk.controller.ts` and both PR's existing specs, since this method is already merged to `main` and wired in); `ThresholdEngineService.computeSeverity` to `calculateSeverity` and `buildWarnings` to `calculateWarnings` (plus spec); `HealthScoreCalculatorService.calculate` to `calculateHealthScore` and its private `buildCategoryScores` to `calculateCategoryScores` (plus spec). Verified via a targeted Jest run scoped to the four risk spec files — 18/18 tests passed; one unrelated, pre-existing suite (`risk.controller.spec.ts`, failing only because of a shared-module TS compile error in `activities.service.ts` around a `withholdingTax` type mismatch) was left untouched since it predates and is unrelated to this change.
- **Who decided:** Sesha Siva Sankar (self-identified and self-fixed).
- **New date:** N/A — fix applied same day.
- **Raised at standup:** N/A — no standup exists for this date in `scrum-notes.md` (see D-7/gaps.md).
- **Status:** Per team decision, this work is being kept as untracked local changes today; it will be committed and a PR opened tomorrow (2026-10-20). Renaming `ExposureService.buildRiskSummary`/`risk.controller.ts`'s call site touches a file Raniya Shaikh owns (`risk.controller.ts`) — flagged here for her visibility since it's a mechanical rename, not a behavior change, but wasn't run past her before being made locally.

## D-12 — HealthScoreCalculatorService and ThresholdEngineService remain unwired into risk.module.ts/risk.controller.ts

- **Date noticed:** 2026-10-19, during the same self-audit as D-11.
- **Task ID:** Relates to #38 (T-38, HealthScoreCalculatorService) and the warning-threshold engine work (#39-adjacent, ThresholdEngineService) in sprint-backlog.csv.
- **Owner:** Sesha Siva Sankar.
- **Planned:** Per the Definition of Done, each service should ultimately be registered as a provider and reachable through the risk API, not just covered by its own unit spec.
- **What happened:** Both services exist with passing unit tests but are not declared as providers in `risk.module.ts` nor invoked from `risk.controller.ts`, unlike `ExposureService`/`ExposureCalculatorService` which are fully wired.
- **Reason:** `risk.module.ts`/`risk.controller.ts` are files Raniya Shaikh has also been working in; wiring this in without coordinating could conflict with changes she's making there.
- **Decision taken:** Held off on wiring pending a response from Raniya (contacted via WhatsApp same day); naming-consistency fix (D-11) proceeded first since it doesn't depend on her input.
- **Who decided:** Sesha Siva Sankar.
- **New date:** NOT RECORDED — pending Raniya's response.
- **Raised at standup:** N/A — no standup exists for this date (see D-7).
- **RESOLVED 2026-10-21.** Built as part of the #42 what-if work (see D-13): `RiskEvaluationService` was added as the orchestrator that runs the 7 warning-threshold rules against real holdings, and `HealthScoreCalculatorService`, `ThresholdEngineService`, and `RiskEvaluationService` are now all registered providers in `risk.module.ts`. Resolved without conflict with Raniya's work in that file, since the change was purely additive (new providers appended, no existing provider/controller signature touched beyond `RiskController`'s own constructor).

## D-13 — PR #138 (#42, what-if endpoint) was scoped too narrowly on first submission; reworked same day after review

- **Date noticed:** 2026-10-21.
- **Task ID:** T-sesha-oct21 (sprint-backlog.csv); issue #42.
- **Owner:** Sesha Siva Sankar.
- **Planned:** Ship `WhatIfService` covering the `POST /risk/what-if` contract (docs/sesha-notes/10, Section 6.11) and close #42 same day.
- **What happened:** The first version of `WhatIfService` only diffed a before/after pair the _caller_ supplied, rather than computing the shocked state itself — because the real pipeline turning holdings into rule results didn't exist anywhere in the codebase yet (see D-12, then still open). It also used holdings-only total value instead of holdings-plus-cash, didn't include the endpoint/DTO/module wiring, and derived `ruleChanges` actuals from warnings only (so GREEN rules showed `null` instead of a real number). Tharun's review (`CHANGES_REQUESTED`, 2026-10-21T17:04:15Z) caught all of this and gave a specific, itemized list of fixes, plus the explicit alternative of re-scoping the PR and keeping #42 open if the pipeline gap was a genuine blocker.
- **Reason:** The missing rule-evaluation pipeline (D-12) was treated as an acceptable scope boundary for a single day's task rather than something to build the same day; review correctly judged that boundary to be too narrow for what issue #42 and the Definition of Done actually require.
- **Decision taken:** Rather than re-scope and leave #42 open, built the missing piece same day: `RiskEvaluationService` (resolving D-12 as a byproduct), rewrote `WhatIfService` to build the shocked holdings copy internally and run the real pipeline on both states, fixed the cash-inclusive portfolio value, added the `POST /api/v1/risk/what-if` endpoint/DTO/module wiring, and added a real e2e test. Pushed as a follow-up commit to the same PR (#138) with a comment addressing each review point, and Tharun's review was re-requested.
- **Who decided:** Sesha Siva Sankar, after discussing with the user that the goal was "the module should work," not just closing the day's checkbox — the user explicitly chose "build it properly" over "re-scope and defer."
- **New date:** N/A — rework completed same day (2026-10-21); outcome of re-review NOT RECORDED as of this entry (pending).
- **Raised at standup:** N/A — no standup exists for this date (see D-7).
- **Known gaps carried forward, flagged rather than silently resolved:** (1) `scenario.name` (the symbol's display name) is not in the what-if response yet — no symbol-name lookup is available to `WhatIfService`. (2) `docs/sesha-notes/02-health-score-data-model.md`'s category/weight table is written against Ghostfolio's older 8-category X-Ray rule catalog, not the 7-rule set `07-warning-threshold-rules.md` actually defines and `RiskEvaluationService` evaluates — the two docs were never reconciled, so category weights are equal-per-rule placeholders. (3) `PortfolioVolatility` has no real data source (no nightly volatility cache exists anywhere in the codebase yet), so it always reports `NO_DATA` until that pipeline is built.
- **RESOLVED 2026-10-22T01:04:11Z — PR #138 merged, issue #42 closed.** Took 3 further `CHANGES_REQUESTED` rounds after this entry was written (4 total): (a) 19:07:55Z — per-holding warning diffing (the worst-bucket-only approach could turn a worst-subject handoff into a false resolved/new pair instead of two changed warnings), the `RunWhatIfDto` range decorator being unreachable under the real `ValidationPipe`, and `scenario.name` missing (gap 1 above, fixed by reading `assetProfile.name` directly, no lookup needed); (b) a real merge conflict in `risk.module.ts` against `main` after PR #141 merged and touched the same file — resolved by keeping both PRs' additions, exactly as both PRs' descriptions had anticipated; (c) 00:25:18Z — `NO_DATA` severities were marked `isActive: true` and so silently counted as a passed rule, inflating every health score (gaps 3 above, now fixed: `isActive: false` for `NO_DATA`, and generalized `skippedRuleKeys` to report any inactive rule). Approved and merged 01:03:56Z-01:04:11Z. Gap (2) — the 02/07 doc reconciliation — remains open; see gaps.md.

## D-14 — Issue #41 is functionally done but was never linked or closed

- **Date noticed:** 2026-10-22, during a verification pass requested by the team ("if any of these PRs have merged since Oct 16, tell me which").
- **Task ID:** #41 ("What-if simulator: copy holdings, apply drop-by-X% shock"), a sibling of #42 under the same parent story #23.
- **Owner:** Sesha Siva Sankar (the only person who has touched this area of the codebase).
- **Planned:** NOT RECORDED — no branch or PR was ever opened specifically under issue #41's own number; it's unclear whether #41 was meant to be done as a separate day-task or was always intended to be absorbed into #42's work.
- **What happened:** Issue #23's body (the shared parent story) describes exactly what #41 asks for — "copy holdings, shrink one holding's value, recompute weights for every holding in the copy, re-run [the] rules and [health score] calculator on the copy" — and that is precisely what `WhatIfService.calculateWhatIf()` (PR #138, closing #42) does: it builds the shocked holdings copy internally and reruns `RiskEvaluationService`/`HealthScoreCalculatorService` on both states. #41 itself is still `OPEN` on GitHub as of this check, with no PR ever referencing it by number.
- **Reason:** NOT RECORDED — most likely the two issues' scopes overlapped more than intended when they were filed (#30-oct2 sprint planning), and #42's implementation simply absorbed #41's piece without anyone noticing the two should have been linked.
- **Decision taken:** NOT RECORDED — flagged here rather than closed unilaterally, since closing someone else's (or even one's own) issue without the team's sign-off on whether the scopes really are equivalent is a judgment call, not a mechanical fact.
- **Who decided:** N/A — raised to the team for a decision (close #41 referencing #138, or confirm its scope is still separately needed).
- **New date:** NOT RECORDED.
- **Raised at standup:** N/A — no standup exists for this date (see D-7).

## D-15 — T-39's review timestamp was never captured even though the PR merged same day

- **Date noticed:** 2026-10-22, during the same verification pass as D-14.
- **Task ID:** T-39 (sprint-backlog.csv); issue #39, PR #119.
- **Owner:** Sesha Siva Sankar (implementation); Tharun Swaminathan (reviewer).
- **Planned:** Same-day review and merge, matching the sprint's usual cadence.
- **What happened:** The Oct 16 records pass recorded PR #119 as "opened today; review not yet submitted" and never came back to confirm the review/merge before this 2026-10-22 check. `gh issue view 39` and `gh pr list --search "closes #39"` now show it was approved and merged the same day (2026-10-16T20:13:19Z), but the exact review submission timestamp was not individually re-captured in this pass (only the merge timestamp, which is a reliable proxy for same-day approval given the sprint's PR-is-merged-right-after-approval pattern).
- **Reason:** The original Oct 16 records pass ended before PR #119's review landed, and no later pass went back to fill in the gap until this one — a narrower version of the same root cause as D-9 (approved-but-unmerged items not being re-checked promptly).
- **Decision taken:** Backfilled the merge timestamp and outcome in sprint-backlog.csv; left the review timestamp as "not individually captured" rather than guessing one.
- **Who decided:** Sesha Siva Sankar.
- **New date:** N/A.
- **Raised at standup:** N/A — no standup exists for this date (see D-7).
