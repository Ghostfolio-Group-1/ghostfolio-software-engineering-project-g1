# Test tooling decision — Fri Nov 6, 2026

_Owner: Raniya Shaikh · Iteration 3 plan Rev 2, Section 6 (confirmed at the Nov 6 Week 1 check)_

## Decision

| Layer       | Tool                                                                                                                | Status today                                                                                                                                                                                                                                                                                                                 | Used from                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Unit        | Jest (existing)                                                                                                     | In use, required check "Unit tests"                                                                                                                                                                                                                                                                                          | Now                                                                             |
| Component   | Jest + **React Testing Library** (`@testing-library/react`, `@testing-library/jest-dom`) with the jsdom environment | `libs/react-ui` runs Jest with `testEnvironment: 'node'`; `jest-environment-jsdom` is installed but only enabled per file (`/** @jest-environment jsdom */`, e.g. #219). Current component tests use `react-dom` `act` / `renderToStaticMarkup`. Adopting RTL needs the environment set to jsdom (per file or in the config) | Library added with the UI ↔ API harness (Tue Nov 10); component gap fill Nov 17 |
| Integration | Jest + supertest API suites with shared fixtures (`apps/api/src/testing/`); React screens against the running API   | API suites in use since Iteration 2                                                                                                                                                                                                                                                                                          | Harness Tue Nov 10; suites Nov 18                                               |
| End-to-end  | **Playwright** (Chromium)                                                                                           | Not installed                                                                                                                                                                                                                                                                                                                | Set up with the harness; journeys Thu Nov 19                                    |

## Why

- **React Testing Library** queries by role and label, so every component test also checks the accessibility basics Section 6.1 asks for (labels, roles). It runs on Jest, so there is no second test runner; the library's Jest environment must be switched to jsdom (project-wide in `jest.config.ts`, or per file) as part of the Nov 10 harness work.
- **Playwright** drives a real browser against the deployed demo build, records traces for failing runs (evidence for the QA log), and runs headless in GitHub Actions without extra services.
- Cypress was considered for end-to-end; Playwright was chosen because it is faster in CI, handles the Angular host and React islands in one page, and needs no paid dashboard for recordings.

## Rules that follow from this

- Component tests assert each state a screen has (loading, error, empty, success) and query by role or label, not by CSS or test ids where a role exists.
- Existing `act` / `renderToStaticMarkup` tests stay; new component tests use React Testing Library once it is installed.
- Every end-to-end journey runs on a clean environment from the deployment set up on Nov 10.
