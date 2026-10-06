# Ghostfolio — Current Architecture Baseline

_Author: Raniya Shaikh | Iteration 1 | Sep 16, 2026_

This document maps the current structure of the Ghostfolio codebase as a baseline for planning the target modular architecture (Sep 17) and the React migration scope (Sep 18).

## 1. Top-Level Structure

The repo is an Nx-style monorepo split into apps and shared libraries:

| Folder                  | Purpose                                                               |
| ----------------------- | --------------------------------------------------------------------- |
| `apps/api`              | Backend server (NestJS)                                               |
| `apps/client`           | Frontend application                                                  |
| `libs/`                 | Shared code imported by both api and client (types, utils, constants) |
| `prisma/`               | Database schema and migrations — the data access layer                |
| `docker/`, `Dockerfile` | Deployment/infrastructure config                                      |
| `project-docs/`         | Existing project documentation                                        |
| `test/`                 | End-to-end / integration tests                                        |

## 2. Backend Layering (`apps/api/src`)

The backend follows a standard NestJS layered structure:

```
src/
├── app/                  ← feature modules (API + business logic)
│   ├── portfolio/
│   ├── user/
│   ├── symbol/
│   ├── subscription/
│   └── ... (one folder per feature)
├── services/             ← cross-feature business logic
├── models/                ← data shapes (paired with Prisma)
├── dtos/                  ← shared request/response contracts
├── guards/                ← auth checks (cross-cutting)
├── interceptors/          ← request/response transformation (cross-cutting)
├── middlewares/           ← cross-cutting request handling
├── filters/                ← error handling (cross-cutting)
├── decorators/, helper/, errors/, events/   ← supporting utilities
└── main.ts                ← application entry point / wiring
```

**The three core layers:**

1. **API / Controller layer** — `*.controller.ts` files (e.g. `portfolio.controller.ts`). Defines HTTP endpoints and delegates to services. This is where incoming requests are received.
2. **Business logic / Service layer** — `*.service.ts` files (e.g. `portfolio.service.ts`). Contains the actual calculations and logic. Services can depend on other, smaller services (see trace below).
3. **Data access layer** — Prisma (`prisma/`), used by services to read/write the database.

Each feature also has a `*.module.ts` file (e.g. `portfolio.module.ts`) — this is NestJS's dependency-injection wiring, declaring what belongs to the feature and connecting controller → service.

**Cross-cutting concerns** (guards, interceptors, middlewares, filters) wrap around these layers rather than being a layer themselves — e.g. a guard checks auth before a request reaches a controller; an interceptor can transform a response after a service returns it.

## 3. One-Feature Trace: `portfolio`

Traced as the reference example for how a request flows end-to-end:

```
HTTP Request
   ↓
portfolio.controller.ts      (API layer — defines the endpoint)
   ↓
portfolio.module.ts          (wiring — injects the service into the controller)
   ↓
portfolio.service.ts         (business logic — the core calculation/logic)
   ↓ (may call)
current-rate.service.ts      (supporting service — exchange rate data)
rules.service.ts             (supporting service — business rule validation)
calculator/                  (sub-logic, e.g. return calculations)
   ↓
Prisma (data layer)
   ↓
Response shaped by a DTO (e.g. get-holdings.dto.ts, get-performance.dto.ts —
one DTO per endpoint, defining the exact request/response contract)
```

**Key pattern:** each feature module has its own set of DTOs defining exactly what shape of data each endpoint accepts/returns. This is the existing convention my Sep 21 API-conventions task will need to standardize across risk, tax, and chart modules.

## 4. Frontend (`apps/client`)

Not yet explored in depth — to be covered as part of the Sep 18 UI framework evaluation / React migration scoping task. Noted here as the fourth architectural layer (Presentation), currently consuming the API layer above via HTTP.

## 5. Implications for the Target Architecture (Sep 17)

- The existing `app/<feature>/` pattern (controller + module + service + DTOs) is a clean, reusable template — the new risk, tax, chart, and dashboard modules should follow this same shape rather than inventing a new one.
- Cross-cutting concerns (guards, interceptors, filters) are already centralized and reusable — new feature modules should plug into these rather than duplicating logic.
- Prisma is the existing data layer standard — any new data models for risk/tax/dashboard features should be added as Prisma schema extensions, not a separate persistence mechanism.
- The dashboard module (my Sep 22–23 task) will need to call the risk, tax, and chart modules' services or their public API layer — this baseline supports deciding that boundary in the target architecture doc.
