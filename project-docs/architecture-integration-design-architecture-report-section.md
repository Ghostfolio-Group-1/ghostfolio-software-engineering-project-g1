# Architecture, Integration & QA — Design and Architecture

**Owner:** Raniya Shaikh
**Iteration:** 1 — Design & Data Modelling
**Report Section Date:** September 30, 2026
**Status:** Design complete for Iteration 1; backend/frontend implementation planned for Iteration 2–3

## 1. Overview

This section covers the cross-cutting architecture, integration, and QA design work for the Ghostfolio extension: the current-state architecture baseline, the target modular architecture, the React migration plan, shared API conventions, the Unified Portfolio Overview Dashboard's design, the testing framework scaffold, and the branching/PR process. The goal of Iteration 1 was to produce a coherent foundation that the risk, tax, and chart feature modules — and the dashboard that ties them together — can all build on without redesign in Iteration 2.

## 2. Existing Architecture Baseline

Ghostfolio is an Nx-style monorepo split into `apps/api` (NestJS backend) and `apps/client` (Angular frontend), with shared code in `libs/` and the database schema in `prisma/`.

The backend follows a standard NestJS layered structure: feature modules under `apps/api/src/app/<feature>/`, each with a `*.controller.ts` (API layer), `*.service.ts` (business logic, with supporting sub-services as needed), a `*.module.ts` (dependency-injection wiring), and `*.dto.ts` files defining request/response contracts. Cross-cutting concerns (guards, interceptors, middlewares, filters) wrap around these layers rather than forming a layer of their own. The existing `portfolio` module was used as the reference trace for this pattern.

The frontend, by contrast, is organized by type rather than by feature (`components/`, `pages/`, `services/`, etc.), with roughly 23 top-level pages — only one of which (`portfolio`) is directly relevant to this project's scope.

## 3. Target Modular Architecture

The target architecture extends the existing `portfolio` module pattern to the four new features, moving the project toward an SOA/3-tier MVC structure:

```
Presentation (React)
      |
API / Controller layer (per feature)
      |
Service / Business-logic layer
      |
Data access layer (Prisma)
```

Each feature — risk (Sesha), tax (Tharun), charts (Arthur), and dashboard (Raniya) — gets its own module folder under `apps/api/src/app/<feature>/`, following the same controller/module/service/DTO shape as `portfolio`.

**Key architectural decision:** the dashboard module calls the other three feature modules only through their public API/controller layer, never their services directly. This preserves the SOA-style module boundary and ensures the API conventions (Section 4) are actually exercised rather than bypassed internally.

## 4. Shared API Conventions

To keep the four feature APIs consistent — particularly for the dashboard, which merges data from all three — a shared convention was defined ahead of each feature's formal API contract:

- **Response envelope:** `{ data, meta, error }` on every endpoint.
- **URL naming:** `/api/v1/<feature>/...`, versioned from the start.
- **Shared data primitives:** ISO 8601 dates, currency as `{ amount, currency }` rather than formatted strings, percentages as decimals.
- **Error shape:** `{ code, message }`, with feature-prefixed error codes.
- **Pagination:** standard `page`/`pageSize`/`total` meta for list endpoints.

This was proposed before Sesha's, Tharun's, and Arthur's formal API contracts existed, using the existing `portfolio` DTO pattern as the baseline, and was circulated for their feedback.

## 5. React Migration Plan

The current frontend (Angular) will not be rewritten in one cutover. Instead, a shared React component library is being scaffolded alongside the existing Angular app, and each feature owner will port their own feature's UI into React as part of their Iteration 2/3 work — per the sprint plan's Cross-Cutting Rule. New React code follows a feature-first structure (`app/risk/`, `app/tax/`, `app/charts/`, `app/dashboard/`), mirroring the backend rather than continuing the frontend's existing type-first pattern.

The shared component library (scaffolded and owned by Raniya) provides: a layout shell, card, table, chart wrapper, and shared theming — primitives each feature owner imports rather than rebuilds.

## 6. Unified Portfolio Overview Dashboard

The dashboard's field spec draws from what each feature has drafted so far: risk's health score and top concentration risk; tax's gross/net dividend YTD and realized gains YTD; charts' total return and benchmark delta. Because this was specified ahead of the other features' formal API contracts (due Sep 25), two tax fields (`netDividendYTD`, `realizedGainsYTD`) were explicitly modeled as `null` pending Tharun's withholding and FIFO design work, rather than guessed at.

The aggregation response nests data by feature (`data.risk`, `data.tax`, `data.charts`) to preserve traceability to each source module, and the dashboard service is designed to call all three feature APIs in parallel. A wireframe was produced showing a top-level KPI row plus one detail card per feature, with pending tax fields shown explicitly rather than hidden, so the UI won't need rework once those fields land.

## 7. Testing Framework

Jest (via `ts-jest`) is already configured for both `apps/api` and `apps/client`. The existing convention — colocated `*.spec.ts` files next to their source — was confirmed and extended with a placeholder example (`risk.service.spec.ts`) as a copy-paste template for the other feature owners. A new integration test folder (`apps/api/src/test/integration/`) was created, since no e2e/integration project existed previously. Going into Iteration 2, every new service function is expected to have at least one unit test.

## 8. Branching Strategy & PR Checklist

`main` stays always-deployable; work happens on `feature/<short-description>` branches merged via pull request. Every PR must: link to an issue, include passing tests, follow the shared API conventions where applicable, be reviewed by at least one other team member, and never commit directly to `main`.

## 9. Integration & QA Notes for Iteration 2

- The API-conventions-before-contracts and dashboard-spec-before-contracts ordering (Sections 4, 6) were flagged as process risks in standup as they occurred, and are intended to be reconciled once all three feature contracts are finalized.
- GitHub Issues was found to be disabled for the repo through much of Iteration 1, which delayed backlog population across all four features; it was enabled partway through the iteration.
- The consolidated project backlog (`project-backlog.md`) tracks filed and planned issues across all four features for Iteration 2 planning.

## 10. Iteration 1 Outcome

The architecture, integration, and QA design work for Iteration 1 produced: a documented baseline of the existing codebase, a target modular architecture extending the existing module pattern to four new features, a phased React migration plan, shared API conventions, a dashboard field spec and wireframe, a validated testing scaffold, and a branching/PR process — providing the foundation the other three features and Iteration 2 implementation build on.

## Design Documents Used for This Section

```text
project-docs/architecture-baseline.md
project-docs/target-architecture.md
project-docs/react-migration-plan.md
project-docs/api-conventions.md
project-docs/dashboard-field-spec.md
project-docs/dashboard-aggregation-model.md
project-docs/wireframe.svg
project-docs/testing-framework.md
project-docs/branching-and-pr-checklist.md
```
