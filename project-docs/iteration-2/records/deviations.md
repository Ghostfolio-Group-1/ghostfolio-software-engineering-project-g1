# Deviations — Iteration 2 (feeds: Sprint Backlog — Deviations)

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
