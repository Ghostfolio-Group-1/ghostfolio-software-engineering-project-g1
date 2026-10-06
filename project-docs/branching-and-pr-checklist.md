# Ghostfolio — Branching Strategy & PR Review Checklist

_Author: Raniya Shaikh | Iteration 1 | Sep 25, 2026_

This document defines the team's branching model and the PR checklist to follow going into Iteration 2, building on `testing-framework.md` and `api-conventions.md`.

## 1. Branching Model

- **`main`** is always deployable — no direct commits.
- Everyone branches off `main` per issue/task, using the naming pattern:
  ```
  feature/<short-description>
  ```
  e.g. `feature/risk-health-score`, `feature/tax-fifo-calc`, `feature/dashboard-aggregation`.
- Personal working branches (like `raniya`, `tharun`, `arthur` used in Iteration 1) are fine for design/docs work, but once Iteration 2 implementation starts, each new piece of work should get its own `feature/...` branch off `main` rather than continuing to pile commits onto one long-lived personal branch.
- Merge into `main` via pull request only — never a direct push.

## 2. PR Review Checklist

Every pull request must satisfy all of the following before merging:

- [ ] **Linked to a GitHub issue** — no PR without a corresponding tracked task.
- [ ] **Tests included and passing** — per `testing-framework.md`'s convention: at least one unit test per new service function, colocated as `*.spec.ts`.
- [ ] **Follows the API conventions** from `api-conventions.md` if the PR touches an endpoint — response envelope, URL naming, error shape, and shared data primitives (dates, currency, percentages).
- [ ] **Reviewed by at least one other team member** — no self-merging.
- [ ] **No direct commits to `main`** — everything flows through a PR.

## 3. PR Template

This checklist should live as a GitHub PR template (`.github/pull_request_template.md`) so it auto-populates every new PR description. _Note: adding this file may require repo admin access — flag with whoever has admin if it can't be added directly._

## 4. What This Unlocks Next

- **Iteration 2:** every implementation PR (risk, tax, charts, dashboard) is checked against this list before merge.
- Builds directly on `testing-framework.md` (test coverage expectation) and `api-conventions.md` (API contract conventions) — this checklist is the enforcement mechanism for both.
