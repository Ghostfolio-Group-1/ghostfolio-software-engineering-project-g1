# Risk module test coverage — sprint alignment

Source: TA Breakers Iteration 3 Sprint Plan Rev 2 (Thu Nov 5, 2026), Section 6
(Testing Strategy and QA) and Section 5 (Daily Plan). Tracking issue: #224.

## Current sprint

Iteration 3, Phase A (demo build), compressed into Fri Nov 6 – Wed Nov 11
ahead of the Thu Nov 12 team demonstration.

## Test layers and who owns them for Risk

| Layer       | Plan date                                  | Owner                               | What it covers for Risk                                                         |
| ----------- | ------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------- |
| Unit        | Mon Nov 16 (gap-fill; most already exists) | Sesha                               | Risk services (exposure, severity, what-if, thresholds) with numeric assertions |
| Component   | Tue Nov 17 (gap-fill)                      | Sesha                               | Every Risk component in all four states (loading, error, empty, success)        |
| Integration | Wed Nov 18                                 | Sesha (harness: Raniya, Tue Nov 10) | UI ↔ API ↔ service ↔ data for the what-if flow and the indicators               |
| End-to-end  | Thu Nov 19                                 | Sesha (harness: Raniya)             | Open the Risk dashboard → read indicators → run a what-if                       |
| Manual QA   | Nov 23–25                                  | Raniya leads; all members test      | QA log (Appendix C), one row per planned test                                   |

This issue (#224) is being worked ahead of the Nov 16-19 dates, the same way
#24 and #188 were worked ahead of Nov 9, per the team's compressed-schedule
slack. The Playwright/E2E and Docker CI portions are **not** pulled forward:
Raniya's UI-to-API integration harness and the Playwright/E2E tool choice are
her Nov 10 and Nov 6 deliverables respectively (#68; PR #221 is the Nov 6
tool-decision doc), and standing up a second Playwright setup today would
duplicate that work and risk disagreeing with it.

## Deliverables mapped to this issue

| Deliverable                                                              | Phase | Status                                                                                              |
| ------------------------------------------------------------------------ | ----- | --------------------------------------------------------------------------------------------------- |
| `docs/testing/module-analysis.md`                                        | 1     | This PR                                                                                             |
| `docs/testing/test-plan.md`                                              | 2     | This PR                                                                                             |
| `docs/testing/seed-risk-demo-data.md` + `scripts/seed-risk-demo-data.ts` | 3     | This PR                                                                                             |
| Backend/API test gap-fill                                                | 4     | This PR, scoped to real gaps found in the test plan — see "Existing coverage" in module-analysis.md |
| Playwright UI tests                                                      | 5     | Deferred — after Raniya's Nov 10 harness (#68)                                                      |
| Docker/CI workflow for Playwright                                        | 6     | Deferred — same reason                                                                              |

## Naming and process conventions used (from Section 1 of the plan)

- Branch: `sesha/2026-11-06-224-<topic>`, created from the latest `main`.
- One commit message per logical step, referencing #224.
- PR to `main` says "Closes #224" (or "References #224" if a follow-up PR is
  still needed for deferred items), carries the `feature: risk` and
  `iteration-3` labels, states `AI-assisted: no` (per standing project
  decision — see PR #213/#222/#223), and requests Tharun as reviewer (the
  Sesha → Tharun reviewer-ring pairing).
- Not merged by me; not pushed to `main` directly.
