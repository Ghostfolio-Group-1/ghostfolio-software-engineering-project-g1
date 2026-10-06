# Ghostfolio — Target Modular Architecture

_Author: Raniya Shaikh | Iteration 1 | Sep 17, 2026_

This document proposes the target architecture for the four new features (Portfolio Health & Risk, Tax Metrics, Upgraded Performance Charts, Unified Dashboard) plus the React migration, building on `architecture-baseline.md`.

## 1. Target Layering

```
Presentation (React components)
        ↓
API / Controller layer   — per feature, one *.controller.ts
        ↓
Service / Business-logic layer — per feature, one *.service.ts (+ supporting services)
        ↓
Data access layer — Prisma
```

This is the same pattern already used by the existing `portfolio` module (controller → module → service → DTOs → Prisma), extended into a clear SOA-style boundary: each feature is a self-contained module that only exposes its data through its own controller/API layer.

## 2. Module Ownership & Folder Locations

Following the existing `apps/api/src/app/<feature>/` convention:

| Feature                              | Owner  | Folder                        | Contents                                                                                                                         |
| ------------------------------------ | ------ | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Portfolio Health & Risk              | Sesha  | `apps/api/src/app/risk/`      | `risk.controller.ts`, `risk.module.ts`, `risk.service.ts`, supporting services (e.g. concentration, volatility), DTOs            |
| Tax Metrics & Calculations           | Tharun | `apps/api/src/app/tax/`       | `tax.controller.ts`, `tax.module.ts`, `tax.service.ts`, supporting services (e.g. FIFO calc, tax-lot tracking), DTOs             |
| Upgraded Performance Charts          | Arthur | `apps/api/src/app/charts/`    | `charts.controller.ts`, `charts.module.ts`, `charts.service.ts`, supporting services (e.g. benchmark comparison, drawdown), DTOs |
| Unified Portfolio Overview Dashboard | Raniya | `apps/api/src/app/dashboard/` | `dashboard.controller.ts`, `dashboard.module.ts`, `dashboard.service.ts`, aggregation logic, DTOs                                |

Each module follows the same internal shape as `portfolio`: a controller for HTTP endpoints, a module for DI wiring, a service (plus any supporting sub-services) for business logic, and DTOs defining request/response contracts.

## 3. Dashboard Access Boundary

**Decision: the dashboard module calls the other three modules only through their public API/controller layer — never their services directly.**

Rationale:

- Matches the project's stated goal of moving toward SOA/3-tier MVC — a service-to-service backdoor between features defeats the purpose of the module boundary.
- Keeps each feature module independently testable and replaceable; the dashboard becomes a consumer like any other client of the risk/tax/charts APIs.
- Forces the API conventions (Sep 21) and API contracts (Sep 25, per-feature) to actually be used and validated early, rather than bypassed internally.

Cross-cutting concerns (guards, interceptors, filters) continue to wrap every module the same way they do today — no change needed there.

## 4. Shared Code

- `libs/` remains the home for genuinely shared code (types, utils, constants) used by more than one feature module or by both `apps/api` and `apps/client`.
- Prisma schema extensions for risk, tax, and dashboard data live in the existing `prisma/` folder as new models/migrations, following the current data-layer convention — no separate persistence mechanism per feature.

## 5. What This Unlocks Next

- **Sep 18 (React migration scope):** the Presentation layer above maps directly onto the shared React component library — each feature owner ports their own module's UI once their backend module exists.
- **Sep 21 (API conventions):** will formalize the shape of the DTOs/response envelope referenced above, applied consistently across all four folders listed in Section 2.
- **Sep 22–23 (Dashboard spec):** will use the API-only access boundary defined here — the dashboard's data model will be built from whatever fields risk/tax/charts choose to expose through their controllers, not their internal service logic.
