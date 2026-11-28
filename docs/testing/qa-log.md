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
- Risk (Sesha): `docs/testing/risk-usability-checklist-2026-11-23.md` (#336)
- Tax (Tharun): `docs/testing/tax/2026-11-23-tax-qa.md` (#339)

## Part 2 — Charts and Unified Dashboard (Tue Nov 24)

Tester: Raniya. Date: 2026-11-24. Browser: Chrome. Same clean stack and seeded
users as part 1, rebuilt from `main` at `4b2314a01`.

### Clean deployment

| ID   | Test                      | Steps                                                                 | Expected                                                         | Result | Issue                                                 |
| ---- | ------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------- | ------ | ----------------------------------------------------- |
| P-01 | Deploy from a clean stack | `down -v`, `up --build -d`, wait for `/api/v1/health`, seed the users | API healthy, 5 demo users seeded, no manual steps; time recorded | PASS   | healthy after 332s (image build 309s), 5 users seeded |
| P-02 | Smoke test the routes     | `./scripts/demo-smoke.sh`                                             | Every route OK, script exits 0                                   | PASS   | 9 routes OK, exit 0                                   |

### Charts (Overview page chart)

| ID   | Test                   | User           | Steps                                                        | Expected                                                                                   | Result      | Issue                                                         |
| ---- | ---------------------- | -------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ----------- | ------------------------------------------------------------- |
| C-01 | Chart loads            | `concentrated` | Open Overview                                                | Portfolio value line; starts at 0 the day before the first buy; whole line inside the card | FAIL        | #353 card top clipped at 100% zoom; buttons unreachable       |
| C-02 | Range toggle           | `concentrated` | Click YTD, 1Y, 5Y, Max                                       | Each redraws the date range; no error, no line cut off                                     | PASS        | only reachable zoomed out (see C-01)                          |
| C-03 | Series toggle          | `concentrated` | Click Portfolio value, Invested capital, Cash                | Title and line change each time; range choice kept                                         | PASS        |                                                               |
| C-04 | Empty portfolio        | `empty`        | Open Overview                                                | Empty message, no crash; toggles still usable                                              | PASS        |                                                               |
| C-05 | Keyboard use           | `concentrated` | Tab to the range and series toggles; Enter / Space to select | Every toggle reachable, focus ring visible                                                 | FAIL        | no focus ring on range or series buttons; fix in open PR #338 |
| C-06 | Dark theme             | `concentrated` | macOS Dark, reload Overview                                  | Chart card follows the dark theme                                                          | FAIL        | #342                                                          |
| C-07 | Drawdown and waterfall | `rich`         | Look for the drawdown and contribution (waterfall) charts    | Both can be opened from the app                                                            | FAIL        | #356 not mounted on any page                                  |
| C-08 | Benchmark comparison   | `rich`         | Compare the portfolio with a benchmark                       | Benchmark line shown                                                                       | **BLOCKED** | #160, #105                                                    |

C-06 was seen on Nov 23 (white chart card on a dark page, same cause as
R-09). C-08 is blocked because the benchmark route is not on `main`.

### Unified Dashboard (`/en/dashboard`)

| ID   | Test                   | User           | Steps                                                    | Expected                                                                           | Result      | Issue                                                                                           |
| ---- | ---------------------- | -------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------- |
| D-01 | Three cards render     | `concentrated` | Open `/en/dashboard`                                     | Portfolio risk, Tax and Performance cards, each with data; no "unavailable" notice | PASS        | Tax card 'No data yet' (no sales for this user)                                                 |
| D-02 | Same portfolio total   | `concentrated` | Compare Performance latest value, Overview, Risk what-if | Same portfolio value in all three (10,640 USD in the what-if)                      | FAIL        | #355 10,140 vs 10,640 vs 9,640                                                                  |
| D-03 | Risk card matches page | `concentrated` | Compare the Portfolio risk card with `/en/risk`          | Same holdings and the same Red severity                                            | PASS        | same data; card says High or OK, Risk page says Red or Green                                    |
| D-04 | Tax card matches page  | `rich`         | Compare the Tax card with Realized gains (FIFO)          | Same sales and gains; amounts formatted                                            | PASS        | same sales as Realized gains; raw amounts (#344); heading 'Mixed currencies' reads like a value |
| D-05 | Empty portfolio        | `empty`        | Open `/en/dashboard`                                     | Each card shows its empty state, no error notice                                   | PASS        |                                                                                                 |
| D-06 | One source down        | automated      | Integration test `dashboard-flow` (Tax service throws)   | HTTP 200, Tax card unavailable, Risk and Performance present, Retry shown          | PASS        | automated: Demo environment run 45469078724 on main (green)                                     |
| D-07 | Card opens its page    | `concentrated` | Click each card                                          | Opens the Risk, Tax or Charts page                                                 | **BLOCKED** | #354                                                                                            |
| D-08 | Keyboard use           | `concentrated` | Tab through the page                                     | Every control reachable, focus visible                                             | PASS        |                                                                                                 |
| D-09 | Dark theme             | `concentrated` | macOS Dark, reload `/en/dashboard`                       | Cards follow the dark theme                                                        | FAIL        | #342                                                                                            |
| D-10 | No raw errors          | all            | Watch every screen above                                 | No `DASHBOARD_…` code or stack trace                                               | PASS        |                                                                                                 |

D-07 is blocked because the cards have no links to their feature pages yet.

### Resilience drill (supplementary S4)

| ID   | Test          | User           | Steps                                                             | Expected                                                                                 | Result | Issue                                                            |
| ---- | ------------- | -------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------- |
| X-02 | Redis stopped | `concentrated` | `docker stop gf-demo-redis`, reload `/en/dashboard`, then restart | Slower answer or a section unavailable; no crash; recovers after restart (time recorded) | FAIL   | #357 all cards stuck on Loading 20s+; recovered 3s after restart |

### Part 2 summary

| Area       | Planned | PASS | FAIL | BLOCKED |
| ---------- | ------- | ---- | ---- | ------- |
| Deployment | 2       | 2    | 0    | 0       |
| Charts     | 8       | 3    | 4    | 1       |
| Dashboard  | 10      | 7    | 2    | 1       |
| Resilience | 1       | 0    | 1    | 0       |
| **Total**  | 21      | 12   | 7    | 2       |

Bug issues filed: #353 (C-01) and #356 (C-07) for Arthur; #355 (D-02), #354 (D-07 card links) and #357 (X-02) for Raniya. C-05 is fixed by open PR #338; C-06 and D-09 are #342.

## Regression run (Wed Nov 25)

Tester: Raniya. Date: 2026-11-25. Run on this PR (`main` plus the #342 fix; main has since taken the equivalent fix from #295, and this PR keeps its 4 regression tests)
before the 6 PM freeze, so CI covers all four features: Risk, Tax, Charts and
the Dashboard.

| Check                                         | Workflow         | Run         | Result                    |
| --------------------------------------------- | ---------------- | ----------- | ------------------------- |
| Lint and format, unit, component tests, build | Build code       | 45680046804 | PASS                      |
| Integration tests (demo-smoke + harness), E2E | Demo environment | 45680046633 | PASS                      |
| Clean rebuild of the demo stack with this PR  | local            | -           | PASS (healthy after 438s) |

### QA failures at the freeze

Every FAIL from parts 1 and 2 has a merged fix or an owned issue.

| Rows                   | Issue | Owner                 | State at freeze                                                                                               | Re-test on Nov 25                                                                                                                                                                                                          |
| ---------------------- | ----- | --------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-07                   | #341  | Sesha                 | CLOSED                                                                                                        | PASS (scores shown out of 100; Change label shown)                                                                                                                                                                         |
| R-04                   | #343  | Sesha                 | CLOSED                                                                                                        | PASS (warning shows real share and points off target)                                                                                                                                                                      |
| R-09, T-09, C-06, D-09 | #342  | Raniya, Arthur        | Fixed in #295; tests here                                                                                     | PASS (dark cards on Risk, Tax, Overview, Dashboard)                                                                                                                                                                        |
| T-07 (T-04, T-06)      | #344  | Tharun                | CLOSED (#349)                                                                                                 | Merged 4:07 PM, after this run; not re-tested                                                                                                                                                                              |
| C-01                   | #353  | Arthur                | OPEN                                                                                                          | -                                                                                                                                                                                                                          |
| C-05                   | #338  | Arthur                | PR OPEN                                                                                                       | -                                                                                                                                                                                                                          |
| C-07                   | #356  | Arthur                | OPEN                                                                                                          | -                                                                                                                                                                                                                          |
| D-02                   | #355  | Raniya, Arthur, Sesha | Risk side fixed here (post-freeze, Nov 26, PR #365 - late work, flagged to Raniya/Arthur per Tharun's review) | Risk what-if now reports 10,140, matching Charts' 10,140 (the #323 cash-double-count fix applies here too - see what-if.service.spec.ts); Overview's separate 9,640 figure is still unreconciled, open for Arthur/Overview |
| X-02                   | #357  | Raniya                | OPEN                                                                                                          | -                                                                                                                                                                                                                          |
| D-07 (BLOCKED)         | #354  | Raniya                | OPEN                                                                                                          | -                                                                                                                                                                                                                          |
