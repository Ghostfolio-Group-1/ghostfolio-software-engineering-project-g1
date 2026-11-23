# Iteration 3 — QA log

QA Execution Plan (Rev 2), Nov 23–25. The manual QA pass is led by Raniya,
and every member tests. Each row records one planned test, with its tester,
date and result.

Results:

- **PASS**: seen working as expected.
- **FAIL**: not as expected. Every FAIL has a bug issue (see "Issue").
- **BLOCKED**: can't be tested yet because the feature or endpoint doesn't
  exist. A BLOCKED row is never counted as a pass.

Environment: a clean demo stack on `main` at `2db37bc3f`:

```
docker compose -f docker/docker-compose.demo.yml -f docker/docker-compose.e2e.yml down -v
docker compose -f docker/docker-compose.demo.yml -f docker/docker-compose.e2e.yml up --build -d
./scripts/seed-e2e-users.sh
```

The demo users come from `docs/testing/seed-risk-demo-data.md`. Sign in at
`http://localhost:3333` with the user's Security Token. Tokens are not
written here.

## Part 1 — Risk and Tax screens (Mon Nov 23)

Tester: Raniya. Date: 2026-11-23. Browser: Chrome.

### Risk (`/en/risk`)

| ID   | Test                       | User           | Steps                                                           | Expected                                                                                                 | Result | Issue                                         |
| ---- | -------------------------- | -------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------- |
| R-01 | Concentrated portfolio     | `concentrated` | Open `/en/risk`                                                 | Grade F, Overall Red, concentration warnings listed                                                      | PASS   |                                               |
| R-02 | Balanced portfolio         | `balanced`     | Open `/en/risk`                                                 | No Red indicator anywhere (currency may be Yellow)                                                       | PASS   |                                               |
| R-03 | Empty portfolio            | `empty`        | Open `/en/risk`                                                 | Overall No data, score "-", message "No risk score is available because there are no active risk rules." | PASS   |                                               |
| R-04 | Target allocation          | `target`       | Open `/en/risk`                                                 | Target Allocation Red (all holdings EQUITY vs 50/50 target)                                              | PASS   | #343 deviation shown as share in warning text |
| R-05 | What-if simulation         | `concentrated` | Holding to shock AAPL, Drop percentage 50, Run simulation       | Result shows "Scenario: … (-50%)" with Before and After scores; no error                                 | PASS   | score change 0 unlabelled, see #341           |
| R-06 | What-if validation         | `concentrated` | Drop percentage empty, then 150, then 0; Run simulation         | "Enter a drop percentage." / "…greater than 0% and at most 100%."; no result, no crash                   | PASS   | old result stays visible under the error      |
| R-07 | Severity labels and colour | `concentrated` | Read every indicator                                            | Each colour also has a word (Red / Yellow / Green / No data); same colours as the Dashboard Risk card    | PASS   | #341 score numbers unlabelled                 |
| R-08 | Keyboard use               | `concentrated` | Tab through the page, then run a what-if with the keyboard only | Every control reachable, focus visible, Enter runs the simulation                                        | PASS   |                                               |
| R-09 | Dark theme                 | `concentrated` | Switch the appearance to Dark, reload `/en/risk`                | All text readable; no white card on a dark page                                                          | FAIL   | #342 Auto theme renders React light           |
| R-10 | No raw errors              | all            | Watch every screen above                                        | No `RISK_…` code, stack trace or "Risk data is unavailable"                                              | PASS   |                                               |

### Tax (`/en/portfolio/tax`)

| ID   | Test                         | User    | Steps                                                              | Expected                                                                                                   | Result      | Issue                                                                      |
| ---- | ---------------------------- | ------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------- |
| T-01 | Empty user, four tabs        | `empty` | Open each tab: Tax lots, Realized gains, Dividends, Yearly summary | Each tab shows its empty message (for example "No FIFO tax lots available"), no error card                 | PASS        |                                                                            |
| T-02 | Empty user, year change      | `empty` | Yearly summary, pick another year                                  | Year changes; disposals and dividends both 0                                                               | PASS        | empty year shows a message instead of 0 totals                             |
| T-03 | Lots and status filter       | `rich`  | Tax lots, set Lot status to OPEN, then back to all                 | OPEN shows only open lots; all shows open, partially consumed and closed lots                              | PASS        | rich user has no CLOSED lots; both options switch, OPEN view hides nothing |
| T-04 | FIFO vs average cost         | `rich`  | Realized gains, switch Cost-basis method FIFO → Average cost       | Method label changes; the cost basis and gain columns change for at least one sale; proceeds stay the same | PASS        | #344 average-cost values unrounded                                         |
| T-05 | Dividend withholding missing | `rich`  | Dividends tab                                                      | Withholding shows as unavailable, not as 0.00                                                              | PASS        |                                                                            |
| T-06 | Yearly summary 2026          | `rich`  | Yearly summary, year 2026, FIFO                                    | Disposal count > 0; gross proceeds and realized gain match the 2026 sales in Realized gains                | PASS        | #344 raw warning codes shown; base totals Not available (missing FX)       |
| T-07 | Money formatting             | `rich`  | Read every money column                                            | Two decimals, currency shown, negatives marked, no NaN / undefined / long floats                           | FAIL        | #344 raw decimals, no 2dp or grouping                                      |
| T-08 | Keyboard use                 | `rich`  | Tab through the tabs, method, year and status controls             | Every control reachable, focus visible, tabs switch with Enter / Space                                     | PASS        |                                                                            |
| T-09 | Dark theme                   | `rich`  | Dark appearance, reload, open all four tabs                        | All text and table rows readable                                                                           | FAIL        | #342 same cause as R-09                                                    |
| T-10 | CSV / PDF export             | `rich`  | Export from the Tax workspace                                      | File opens in Excel / Sheets; PDF readable                                                                 | **BLOCKED** | #190                                                                       |
| T-11 | Tax-relevance filter         | `rich`  | Filter realized gains by tax relevance                             | Only tax-relevant sales shown                                                                              | **BLOCKED** | #242                                                                       |

T-10 is blocked because there is no public, authenticated download endpoint
or UI download flow on `main` (#190, #155). T-11 is blocked because there is
no agreed API contract for a tax-relevance query parameter (#242).

### Part 1 summary

| Area      | Planned | PASS | FAIL | BLOCKED |
| --------- | ------- | ---- | ---- | ------- |
| Risk      | 10      | 9    | 1    | 0       |
| Tax       | 11      | 7    | 2    | 2       |
| **Total** | 21      | 16   | 3    | 2       |

Bug issues filed: #341, #343 (Risk, Sesha); #344 (Tax, Tharun); #342 (shared React host, Raniya; covers R-09 and T-09).

## Module usability checklists (each owner, Nov 23)

- Charts (Arthur): `docs/testing/charts-usability-checklist-2026-11-23.md` (#338)
- Risk (Sesha): link when merged
- Tax (Tharun): link when merged

## Part 2 — Charts and Unified Dashboard (Tue Nov 24)

To be added.

## Regression run (Wed Nov 25)

To be added with the CI link.
