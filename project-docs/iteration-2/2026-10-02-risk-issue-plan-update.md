# Risk Issue Plan Update — Sprint Planning Day

**Author:** Sesha Siva Sankar (member 1)
**Date:** Fri, Oct 2, 2026
**Task:** Iteration 2 Sprint Plan, Fri Oct 2 row — sync with main, review PR #28/#29, move risk issues into the Iteration 2 milestone, file the Oct 5-22 risk tasks as issues

---

## 1. Sync with main

Local `sesha` branch fast-forwarded from `ecf9aba52` to `d7e49e0f9` (current `main` tip), which includes PR #28 (Arthur's chart docs, via a filename-fixed re-add) and PR #29 (Raniya's architecture/dashboard/testing docs). No conflicts — `sesha` had no commits of its own ahead of `main`.

## 2. Retroactive review of PR #28 and PR #29

Per the Iteration 1 retrospective action table, reviewed both with written comments on GitHub (not in a separate Markdown file, per Section 1.3's rule that reviews happen on the PR):

- **PR #28** ([comment](https://github.com/Error404IsFound/ghostfolio-software-engineering-project-g1/pull/28#issuecomment-5951953576)): the only change is `design-architecture-charts copy.md` — a filename left over from the revert/re-add sequence documented in the Iteration 1 audit. Content is fine; requested a same-day follow-up PR to rename it to drop the " copy" suffix.
- **PR #29** ([comment](https://github.com/Error404IsFound/ghostfolio-software-engineering-project-g1/pull/29#issuecomment-5951953889)): core docs (API conventions, dashboard field spec, aggregation model, architecture docs) are solid — the risk API contract was already built against the API-conventions and dashboard-field-spec docs in Iteration 1 with no changes needed. Found one real issue: three files (`design-architecture-charts.md`, `risk-design-architecture-report-section.md`, `tax-design-architecture-report-section.md`) at the top level of `project-docs/` are byte-identical duplicates of docs that already exist under `project-docs/iteration-1/<feature>/`. Confirmed with `diff`, not assumed. Requested a follow-up PR to delete the three top-level duplicates and keep the nested copies as canonical.

Both PRs are already merged (this is a retroactive review per the sprint plan, since they merged before today's reviewer-ring rule took effect), so these are follow-up requests, not blocking changes.

## 3. Risk issues moved into the Iteration 2 milestone

No action needed — issues #18-26 were already filed directly into the correct milestones when created (8 into Iteration 2, 1 — the React dashboard — into Iteration 3), confirmed via `gh api .../milestones`.

## 4. Oct 5-22 risk tasks filed as issues

Added one issue per daily task from the Sesha/Risk column of the sprint plan's daily table, Mon Oct 5 through Thu Oct 22 (14 issues, matching the "each task fits one day and has an issue" rule from Sprint Planning):

| Date       | Issue                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mon Oct 5  | [#30](https://github.com/Error404IsFound/ghostfolio-software-engineering-project-g1/issues/30) ConcentrationRule — single stock                         |
| Tue Oct 6  | [#31](https://github.com/Error404IsFound/ghostfolio-software-engineering-project-g1/issues/31) Replace placeholder test; sector + country concentration |
| Wed Oct 7  | [#32](https://github.com/Error404IsFound/ghostfolio-software-engineering-project-g1/issues/32) Currency and asset-class exposure calculators            |
| Thu Oct 8  | [#33](https://github.com/Error404IsFound/ghostfolio-software-engineering-project-g1/issues/33) ExposureService -> RiskSummary                           |
| Fri Oct 9  | [#34](https://github.com/Error404IsFound/ghostfolio-software-engineering-project-g1/issues/34) Volatility input model + std-dev function                |
| Mon Oct 12 | [#35](https://github.com/Error404IsFound/ghostfolio-software-engineering-project-g1/issues/35) VolatilityRule.evaluate()                                |
| Tue Oct 13 | [#36](https://github.com/Error404IsFound/ghostfolio-software-engineering-project-g1/issues/36) CashAllocationRule.evaluate()                            |
| Wed Oct 14 | [#37](https://github.com/Error404IsFound/ghostfolio-software-engineering-project-g1/issues/37) TargetDeviationRule + TargetAllocation input             |
| Thu Oct 15 | [#38](https://github.com/Error404IsFound/ghostfolio-software-engineering-project-g1/issues/38) HealthScoreCalculator.calculate()                        |
| Fri Oct 16 | [#39](https://github.com/Error404IsFound/ghostfolio-software-engineering-project-g1/issues/39) WarningThreshold model + validation                      |
| Mon Oct 19 | [#40](https://github.com/Error404IsFound/ghostfolio-software-engineering-project-g1/issues/40) Threshold engine -> warnings                             |
| Tue Oct 20 | [#41](https://github.com/Error404IsFound/ghostfolio-software-engineering-project-g1/issues/41) What-if simulator                                        |
| Wed Oct 21 | [#42](https://github.com/Error404IsFound/ghostfolio-software-engineering-project-g1/issues/42) What-if endpoint                                         |
| Thu Oct 22 | [#43](https://github.com/Error404IsFound/ghostfolio-software-engineering-project-g1/issues/43) Volatility cache refresh job                             |

Each issue links back to its Iteration 1 design doc and to the relevant Iteration 1 epic issue (#18-25) for traceability, and states the Definition of Done from the sprint plan (merged PR linked via "Closes #n", numeric tests passing in CI, reviewed by Tharun).

## 5. Not done today, flagged for the standup

- The two follow-up PRs requested in the PR #28/#29 reviews (filename fix, duplicate-file cleanup) are Arthur's and Raniya's to open, not mine — listed here so they aren't lost before the next standup.
- This PR itself is **not self-merged**, per Section 1.1 rule 4 ("never merge your own PR without an approval") — requesting Tharun as reviewer per the reviewer ring (Section 1.3).
