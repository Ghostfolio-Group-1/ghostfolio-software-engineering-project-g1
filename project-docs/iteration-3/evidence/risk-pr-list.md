# Risk — merged PR list (evidence)

Mon Nov 30 task (Iteration 3 Sprint Plan Rev2 Section 5): PR-list evidence for the demo script
and report. Generated from `gh pr list --state merged --author sesha456`, done ahead of
schedule on Nov 27 at the user's request.

| #    | Merged         | Title                                                                                           |
| ---- | -------------- | ----------------------------------------------------------------------------------------------- |
| #130 | 2026-10-21     | refactor(risk): standardize get*/calculate* verb naming across risk services                    |
| #138 | 2026-10-22     | [Risk] What-if: shocked-copy health score diffing engine                                        |
| #144 | 2026-10-22     | [Risk] Volatility cache refresh job (covariance matrix, Redis, TTL)                             |
| #179 | 2026-10-31     | docs(report): fill section 4 GitHub collaboration and version-control audit                     |
| #181 | 2026-10-31     | docs(report): refresh counts after #179 merged into main                                        |
| #182 | 2026-10-31     | Oct 31 GitHub cleanup: close stale issues/PRs, refresh Section 4                                |
| #185 | 2026-10-31     | Fix PR/issue count wording in report evidence-rule paragraph                                    |
| #191 | 2026-11-02     | docs(iteration-3): log Nov 2 issue-work-only day                                                |
| #193 | 2026-11-03     | feat(risk): add GET /risk/score route                                                           |
| #211 | 2026-11-04     | feat(risk): add RiskDashboardCard with loading/error/empty states                               |
| #213 | 2026-11-05     | feat(risk): wire RiskDashboardCard to GET /risk/score and /risk/concentration                   |
| #223 | 2026-11-06     | feat(risk): add red/yellow/green indicator components                                           |
| #222 | 2026-11-07     | feat(risk): add remaining Risk API routes (thresholds, target-allocation, warnings)             |
| #235 | 2026-11-09     | fix(risk): import ConfigurationModule into RiskModule                                           |
| #225 | 2026-11-11     | test(risk): test plan, demo seed data, and a validateThresholds bug fix                         |
| #260 | 2026-11-11     | feat(client): mount the Risk dashboard through gf-react-host                                    |
| #265 | 2026-11-11     | fix(client): critical - gf-react-host silently breaks every mounted screen                      |
| #271 | 2026-11-12     | feat(risk): add demo-risk-user-rich with a large varied portfolio                               |
| #280 | 2026-11-12     | feat(risk): add a Risk tab inside the Portfolio section's nav                                   |
| #281 | 2026-11-12     | fix(risk): wire /risk/concentration severity to the threshold engine                            |
| #282 | 2026-11-12     | feat(risk): complete the Risk feature UI (what-if, warnings, target allocation, thresholds)     |
| #287 | 2026-11-15     | test(risk): close page-level error-coverage gaps in the Nov 12 screens                          |
| #299 | 2026-11-16     | test(risk): boundary-value unit tests for severity and what-if drop                             |
| #307 | 2026-11-17     | test(risk): exercise the threshold row Active-toggle-off path                                   |
| #317 | 2026-11-19     | test(risk): UI <-> API <-> service <-> data integration for what-if and indicators              |
| #320 | 2026-11-20     | test(risk): browser E2E for the full Risk-dashboard-to-what-if journey                          |
| #330 | 2026-11-23     | docs(risk): Week 3 check - full-suite run, README Testing section                               |
| #336 | 2026-11-24     | fix(risk): usability pass - label/contrast fixes, Customized badge polish                       |
| #348 | 2026-11-24     | fix(risk): correct unlabelled scores and wrong target-allocation wording                        |
| #362 | 2026-11-27     | fix(risk): last bug-fix-day fixes - Active label spacing + cash double-count                    |
| #365 | not yet merged | test(risk): confirm what-if inherits the #323 cash-exclusion fix (open, awaiting Arthur/Raniya) |
| #372 | not yet merged | docs(risk): draft Risk section of the report from merged PRs and QA log (open, awaiting Tharun) |

Not every row above is Risk-only (#179/#181/#182/#185/#191 are earlier report/cleanup docs PRs
authored by the same account); they are kept here for a complete, honest account history rather
than cherry-picked to look more Risk-heavy than it is.
