# React library audit — Wed Nov 4, 2026

_Owner: Raniya Shaikh · Iteration 3, Week 1_

Checks that every feature screen builds on the shared React library (`libs/react-ui`) and fixes the gaps found. Snapshot of `main` at the start of the day (after #193 and #195).

## Feature code in the library

| Feature   | Files on `main`                   | Uses shared library?                | Notes                                                                                                                                                               |
| --------- | --------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tax       | `tax-lots/use-tax-lots.ts` (#195) | Yes — data hook only, no screen yet | Takes the host's authenticated fetch and keeps decimal strings; matches the shared data pattern below. Placement under `libs/react-ui/src/lib/tax-lots/` confirmed. |
| Risk      | —                                 | —                                   | Risk dashboard card (#26) not started on `main`.                                                                                                                    |
| Charts    | —                                 | —                                   | Chart data hook not started on `main`.                                                                                                                              |
| Dashboard | —                                 | —                                   | Dashboard page (#68) starts Thu Nov 5.                                                                                                                              |

No feature screen yet renders its own card, button, layout or theme, so there is nothing to migrate onto the primitives. The gaps are in the library itself.

## Gaps found and fixed in this PR

| Gap                                    | Why it matters                                                                                                            | Fix                                                                                                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No shared data layer                   | Every feature would write its own fetch / envelope / error handling (the tax hook already has its own copy).              | `data/api-request.ts`: `AuthenticatedFetch`, `requestApi<T>()`, `ApiRequestError { status, code }`. `data/use-api-data.ts`: `useApiData(load, isEmpty)` returning a `DashboardCardStatus` plus `reload()`. |
| No `Table`                             | The React migration plan lists Table as a core primitive; tax lots, realized gains and the yearly summary are all tables. | `table/table.tsx`: generic `Table<Row>` with typed columns, right alignment for numbers, empty row, caption, theme colours. Renders values as given (decimal strings unchanged).                           |
| README listed only 2 of the primitives | Teammates could not see what to import.                                                                                   | `libs/react-ui/README.md` lists every primitive, the data layer, the folder convention and the import alias.                                                                                               |

## Rules for feature screens (from this audit)

- Wrap each screen in `Card` (or `DashboardCard` when it has loading / error / empty states) inside the host's `LayoutShell` and `ThemeProvider`.
- Fetch through `requestApi` / `useApiData` with the host's `AuthenticatedFetch`; do not call `fetch` directly or read tokens.
- Use `Table` for row data and `ChartWrapper` for series; do not add styled HTML tables or chart elements in feature folders.
- New shared primitives are added by Raniya; feature folders stay with their owner.

## Tests

`npx nx test react-ui`: all suites pass, including 16 new tests (6 `requestApi`, 5 `useApiData`, 5 `Table`). `npx nx lint react-ui` passes.
