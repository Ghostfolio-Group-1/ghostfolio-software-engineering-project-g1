# react-ui

Shared React component library for the risk, tax, charts and dashboard features. Architecture and ownership: `project-docs/iteration-3/architecture-3-tier-soa.md`.

Import with the path alias `@ghostfolio/react-ui/<folder>/<file>`, for example `@ghostfolio/react-ui/card/card`.

## Shared primitives (owned by Raniya)

| Folder            | Exports                                                             | Use for                                                    |
| ----------------- | ------------------------------------------------------------------- | ---------------------------------------------------------- |
| `layout-shell/`   | `LayoutShell`                                                       | Page wrapper with title                                    |
| `theme/`          | `ThemeProvider`, `useTheme`, `lightTheme`, `darkTheme`              | Light / dark theme                                         |
| `tokens/`         | `designTokens`, `px`                                                | Colours, spacing, font sizes, radii                        |
| `card/`           | `Card`                                                              | Container for any panel                                    |
| `dashboard-card/` | `DashboardCard`, `DashboardCardStatus`                              | Card with loading / error / empty / ready states           |
| `button/`         | `Button`                                                            | Primary / secondary actions                                |
| `table/`          | `Table`, `TableColumn`                                              | Row data (lots, gains, holdings)                           |
| `chart-wrapper/`  | `ChartWrapper`, `ChartPoint`                                        | Line charts                                                |
| `data/`           | `AuthenticatedFetch`, `requestApi`, `ApiRequestError`, `useApiData` | Calling `/api/v1/*` through the host's authenticated fetch |

## Feature folders

Each feature screen lives in its own folder named `<feature>-<screen>/` (for example `tax-lots/`, `risk-dashboard/`, `charts-series/`, `dashboard-page/`) and is owned by that feature's developer.

## Tests

`npx nx test react-ui`
