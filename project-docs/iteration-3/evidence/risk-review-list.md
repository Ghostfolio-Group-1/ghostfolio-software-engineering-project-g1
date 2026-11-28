# Risk — review list (evidence)

Mon Nov 30 task: per-PR review state, generated from `gh pr view <n> --json reviews` for every
merged Risk-feature PR (reviewer ring: Sesha -> Tharun). Done ahead of schedule on Nov 27.

| PR   | Merged     | Reviews (author:state, deduplicated)                                                                                                        |
| ---- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| #130 | 2026-10-21 | TharunSwaminathan:APPROVED                                                                                                                  |
| #138 | 2026-10-22 | TharunSwaminathan:APPROVED, TharunSwaminathan:CHANGES_REQUESTED                                                                             |
| #144 | 2026-10-22 | TharunSwaminathan:APPROVED, TharunSwaminathan:CHANGES_REQUESTED                                                                             |
| #193 | 2026-11-03 | TharunSwaminathan:APPROVED, TharunSwaminathan:CHANGES_REQUESTED                                                                             |
| #211 | 2026-11-04 | TharunSwaminathan:APPROVED, TharunSwaminathan:CHANGES_REQUESTED                                                                             |
| #213 | 2026-11-05 | TharunSwaminathan:APPROVED, TharunSwaminathan:CHANGES_REQUESTED                                                                             |
| #223 | 2026-11-06 | TharunSwaminathan:APPROVED                                                                                                                  |
| #222 | 2026-11-07 | Raniyafs:APPROVED, Raniyafs:CHANGES_REQUESTED, TharunSwaminathan:APPROVED, TharunSwaminathan:CHANGES_REQUESTED                              |
| #235 | 2026-11-09 | TharunSwaminathan:APPROVED                                                                                                                  |
| #225 | 2026-11-11 | Raniyafs:APPROVED, Raniyafs:CHANGES_REQUESTED, TharunSwaminathan:APPROVED, TharunSwaminathan:CHANGES_REQUESTED, TharunSwaminathan:COMMENTED |
| #260 | 2026-11-11 | TharunSwaminathan:APPROVED, TharunSwaminathan:CHANGES_REQUESTED                                                                             |
| #265 | 2026-11-11 | TharunSwaminathan:APPROVED, TharunSwaminathan:CHANGES_REQUESTED                                                                             |
| #271 | 2026-11-12 | TharunSwaminathan:APPROVED, TharunSwaminathan:CHANGES_REQUESTED                                                                             |
| #280 | 2026-11-12 | Error404IsFound:APPROVED, TharunSwaminathan:APPROVED, TharunSwaminathan:COMMENTED                                                           |
| #281 | 2026-11-12 | Error404IsFound:APPROVED, TharunSwaminathan:APPROVED, TharunSwaminathan:CHANGES_REQUESTED                                                   |
| #282 | 2026-11-12 | Error404IsFound:APPROVED, TharunSwaminathan:APPROVED, TharunSwaminathan:CHANGES_REQUESTED                                                   |
| #287 | 2026-11-15 | TharunSwaminathan:APPROVED, TharunSwaminathan:COMMENTED                                                                                     |
| #299 | 2026-11-16 | TharunSwaminathan:APPROVED                                                                                                                  |
| #307 | 2026-11-17 | TharunSwaminathan:APPROVED                                                                                                                  |
| #317 | 2026-11-19 | TharunSwaminathan:APPROVED, TharunSwaminathan:CHANGES_REQUESTED, TharunSwaminathan:COMMENTED                                                |
| #320 | 2026-11-20 | TharunSwaminathan:APPROVED, TharunSwaminathan:CHANGES_REQUESTED                                                                             |
| #330 | 2026-11-23 | TharunSwaminathan:APPROVED, TharunSwaminathan:CHANGES_REQUESTED, TharunSwaminathan:COMMENTED                                                |
| #336 | 2026-11-24 | TharunSwaminathan:APPROVED, TharunSwaminathan:COMMENTED                                                                                     |
| #348 | 2026-11-24 | TharunSwaminathan:APPROVED, TharunSwaminathan:COMMENTED                                                                                     |
| #362 | 2026-11-27 | TharunSwaminathan:APPROVED, TharunSwaminathan:CHANGES_REQUESTED                                                                             |
| #365 | open       | TharunSwaminathan:CHANGES_REQUESTED, TharunSwaminathan:COMMENTED (x2), Error404IsFound:CHANGES_REQUESTED; Raniyafs not yet reviewed         |
| #372 | open       | review requested from TharunSwaminathan, not yet reviewed                                                                                   |

Every merged Risk PR has at least one independent approval from the assigned reviewer
(Tharun, per the reviewer ring), consistent with the "nobody merges their own PR without an
approval" rule. #222/#225 additionally carry Raniya's review (shared-file / fixtures touch);
#280/#281/#282 additionally carry Arthur's (cross-feature nav/dashboard touch).
