# Risk — 5-minute demo script

Mon Nov 30 task (Iteration 3 Sprint Plan Rev2 Section 5): demo script for the Dec 1 recorded
segment and Dec 3 Sprint Review. Done ahead of schedule on Nov 27. Uses the seeded demo
users from `docs/testing/seed-risk-demo-data.md` (`demo-risk-user-concentrated`,
`-balanced`, `-empty`, `-target`, `-rich`).

## 0:00 - 0:45 | Dashboard card and indicators

- Log in as `demo-risk-concentrated`. Open the Unified Dashboard.
- Point out the Risk card's health score and the red/yellow/green concentration indicator -
  colour comes straight from the Risk engine's severity, not a UI guess (#223, #281).
- Click through to `/en/risk`.

## 0:45 - 2:00 | Risk dashboard: concentration and thresholds

- Walk the concentration breakdown (stock/sector/country/currency) - every bucket is RED for
  this concentrated, single-stock-heavy user.
- Open the thresholds screen: show a field's label, toggle a threshold's Active checkbox off
  and on - call out that this exact path (label spacing, toggle-off state) had two QA fixes this
  iteration (#336's label fix, #307's toggle-off test), so it's deliberately being shown here, not
  dodged.
- Switch user to `demo-risk-target`: show the Target Allocation deviation warning with the real
  percentage and points-off-target wording (#343, fixed and regression-tested in #348).

## 2:00 - 3:30 | What-if simulator

- Back to `demo-risk-concentrated`. Open the what-if form.
- Enter an invalid drop percentage (e.g. 150) - show the validation error, no crash, old result
  stays visible underneath (QA R-06).
- Run a real what-if (AAPL, -20%): show the before/after health score and warning differences.
- State the portfolio-value figure out loud and note it now matches the Dashboard/Charts total
  for the same user (10,140, not the old double-counted 10,640) - this is the #323/#355/#362/#365
  fix, the single biggest Risk bug this iteration.

## 3:30 - 4:15 | Empty and edge states

- Switch to `demo-risk-empty`: show the NO_DATA state - score "-", "No risk score is available
  because there are no active risk rules," no crash, no blank screen.
- Briefly show dark theme on any screen (R-09/#342, fixed) and keyboard-only navigation on the
  thresholds page (R-08/QA pass, PASS).

## 4:15 - 5:00 | Wrap-up

- One slide/sentence on test coverage: 19 API unit spec files + 15 React spec files + E2E
  journeys, 97.6%/93.7% line coverage on Risk API/React respectively (see
  `risk-test-output.md`), full chain (unit -> component -> integration -> E2E) green in CI.
- State what's still open going into Dec: PR #365 (Risk-side regression test for #355) awaiting
  Arthur's and Raniya's sign-off, and #355 itself staying open for the still-unreconciled Overview
  figure - owned by Arthur/Overview, not Risk.
