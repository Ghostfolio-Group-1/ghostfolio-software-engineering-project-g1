# UI-to-API integration harness

Renders the React screens against a **running** API, with one shared fixture
portfolio, so a contract change on either side fails here instead of at the
demo. Unit tests (`jest.config.ts`) stay fast and never need a database.

## What it checks

| Screen                                | Route(s)                                   | Assertion                                                    |
| ------------------------------------- | ------------------------------------------ | ------------------------------------------------------------ |
| `DashboardOverviewPage`               | `GET /api/v1/dashboard/overview`           | every card settles, no error card, exact realized gain shown |
| `RiskDashboardCard` (+ client loader) | `GET /api/v1/risk/score`, `/concentration` | both responses parse; the card renders the live grade        |
| `TaxLotsScreen`                       | `GET /api/v1/tax/lots`                     | settles into a table, no error                               |
| `DividendWithholdingScreen`           | `GET /api/v1/tax/dividends?year=2025`      | settles into a table, no error                               |

## Fixture

`fixtures/portfolio.json`: two `MANUAL` stocks, a buy of each, one partial
sell and one dividend, plus prices for each symbol. Every run signs up its
own user (`POST /api/v1/user`), imports the activities (`POST /api/v1/import`)
under run-specific symbols and posts the prices
(`POST /api/v1/market-data/MANUAL/:symbol`), so runs never share data.
`expected` holds the values the screens must show (FIFO: 480 proceeds − 400
cost − 0.40 allocated buy fee − 1 sell fee = 78.6 USD).

Imported `MANUAL` symbols have no asset class, so the Risk stock bucket can be
empty; the Risk check covers parsing and rendering, not severities.

## Run it

Against the demo environment (see `project-docs/iteration-3/deployment.md`):

```
docker compose -f docker/docker-compose.demo.yml up --build -d
INTEGRATION_API_URL=http://localhost:3333 npx jest -c libs/react-ui/jest.integration.config.ts
```

Without `INTEGRATION_API_URL` the suite is skipped. CI runs it in the
`Demo environment` workflow right after the smoke test.

## How it works

- `jsdom-with-fetch.ts`: the jsdom test environment plus Node's `fetch`, so the
  screens' real data layer (`requestApi`, `useApiData`) calls the API.
- `api-session.ts`: builds the same `AuthenticatedFetch` the Angular host
  passes in (relative `/api` paths, `Authorization` added).
- Unit tests keep `testEnvironment: 'node'` with per-file
  `/** @jest-environment jsdom */`, as in the test-tooling decision.
