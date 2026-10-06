# Ghostfolio — React Migration Plan

_Author: Raniya Shaikh | Iteration 1 | Sep 18, 2026_

This document evaluates the current frontend framework and scopes the migration path toward a new React-based component architecture, building on `architecture-baseline.md` and `target-architecture.md`.

## 1. Current Framework

**Angular.** Confirmed by:

- `ngsw-config.json` (Angular Service Worker config)
- `proxy.conf.json`, `localhost.cert`/`.pem` (standard Angular CLI dev-server artifacts)
- `main.ts`, `polyfills.ts`, `styles.scss`, `index.html` at the `apps/client/src` level — the standard Angular CLI project shape

Exact version to be confirmed from the root `package.json` (`@angular/core` dependency) as needed.

## 2. Current Structure

`apps/client/src/app/` is organized **by type, not by feature**:

```
app/
├── adapter/
├── components/
├── core/
├── directives/
├── interfaces/
├── pages/        ← ~23 top-level route pages
├── services/
└── util/
```

This is the opposite of the backend's structure (feature-first, one self-contained folder per feature — see `target-architecture.md`).

**Pages inventory** (`app/pages/`): about, accounts, admin, api, auth, blog, demo, faq, features, home, i18n, landing, markets, open, **portfolio**, pricing, public, register, resources, user-account, webauthn, zen.

Of these, **`portfolio`** is the one directly relevant to this group's work — risk, tax, charts, and the dashboard all surface in or near it. Most of the rest (about, blog, faq, landing, pricing, register, webauthn, zen, demo) are marketing/account/auth pages, out of scope for this migration. `markets`, `resources`, `user-account`, and `admin` are lower priority and not part of Iteration 1–3 scope.

## 3. Migration Strategy: Incremental

A full rewrite in three iterations isn't realistic. Instead:

- Build a **shared React component library** alongside the existing Angular frontend.
- Each feature owner ports their own feature's UI into React as part of their own frontend work in Iteration 2/3 — per the sprint plan's Cross-Cutting Rule.
- The existing Angular app keeps running throughout; React components are introduced feature-by-feature rather than as a single cutover.
- New React code follows a **feature-first** structure (mirroring the backend's `app/risk/`, `app/tax/`, `app/charts/`, `app/dashboard/` layout), not the current Angular app's type-first pattern — keeps frontend and backend organization consistent as four people each own a vertical slice.

## 4. Shared Component Library (Raniya scaffolds and owns)

Minimum set of primitives feature owners will import rather than rebuild:

- **Layout shell** — page wrapper, nav/header consistent across features
- **Card** — the basic container used for dashboard widgets and feature panels
- **Table** — for holdings, tax records, transaction lists
- **Chart wrapper** — a thin React wrapper around whatever charting library Arthur's chart work settles on, so every feature renders charts consistently
- **Theming** — shared colors/spacing tokens, consistent with the current Angular app's look during the transition

## 5. What This Unlocks Next

- **Iteration 2/3:** Sesha, Tharun, and Arthur each port their feature's UI into React using this shared library, inside their own feature folder (`app/risk/`, `app/tax/`, `app/charts/` on the frontend, paired with their backend modules).
- **Sep 22–23 (Dashboard spec):** the dashboard's React implementation will assemble these shared components (cards, tables, charts) into the aggregated view defined by the dashboard's API contract.
