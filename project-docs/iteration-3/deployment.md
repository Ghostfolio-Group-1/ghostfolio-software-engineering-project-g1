# Deployment — demo environment (Iteration 3)

_Owner: Raniya Shaikh · Rev 2 plan, Mon Nov 9 (deployment / environment setup)_

The demo runs from one environment: a container built from this repository (NestJS API + Angular client with the React screens), Postgres 15 and Redis, started with Docker Compose.

## Files

| File                                     | Purpose                                                                                                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `docker/docker-compose.demo.yml`         | Builds the image from the repo (`ghostfolio/ghostfolio:demo`) and runs it with Postgres and Redis; health checks on all three |
| `.env.demo.example`                      | Every environment variable the demo needs, with placeholders. Copy to `.env.demo` (git-ignored)                               |
| `scripts/demo-smoke.sh`                  | Signs up a fresh user and checks that every Iteration 3 route answers 200 with the shared envelope                            |
| `.github/workflows/demo-environment.yml` | CI build check: builds the image, starts the stack, runs the smoke test, then tears it down                                   |

## Environment variables

| Variable                                            | What it is                                   | Demo value                              |
| --------------------------------------------------- | -------------------------------------------- | --------------------------------------- |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Database name, user and password             | `ghostfolio-demo`, `ghostfolio`, secret |
| `DATABASE_URL`                                      | Connection string built from the three above | as in the example                       |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`        | Cache connection                             | `redis`, `6379`, secret                 |
| `ACCESS_TOKEN_SALT`, `JWT_SECRET_KEY`               | Token signing secrets                        | random strings                          |

Secrets are never committed. `.env.demo` is in `.gitignore`; CI generates random values for each run.

## Run it

```sh
cp .env.demo.example .env.demo        # replace the CHANGE_ME values
docker compose -f docker/docker-compose.demo.yml up --build -d
./scripts/demo-smoke.sh               # waits for the API, then checks every route
```

Open http://localhost:3333 and click **Get Started** to create a demo user. The first build takes 10–15 minutes; later builds reuse the dependency layer.

Stop it with `docker compose -f docker/docker-compose.demo.yml down` (add `-v` to delete the demo database).

## Smoke test

`scripts/demo-smoke.sh` checks, for a freshly signed-up user:

- `GET /api/v1/health`
- `GET /api/v1/dashboard/overview`
- `GET /api/v1/risk/score`, `GET /api/v1/risk/concentration`
- `GET /api/v1/tax/realized-gains`, `GET /api/v1/tax/lots`
- `GET /api/v1/charts/series?range=max`, `GET /api/v1/charts/drawdown?range=max`

Each must answer HTTP 200 with `"error":null`. It runs in CI on every PR that changes the Dockerfile, Compose files, dependencies or Prisma schema, and on every push to `main`. The Wed Nov 11 smoke test of every screen and the Thu Nov 12 demo run on this environment.

## CI

The `Demo environment` workflow builds only `linux/amd64`, so it stays within a normal CI run. It is not a required check yet; it becomes one if it stays green through the demo build.

## UI-to-API integration harness

After the smoke test, the same workflow renders the React screens against the
running API with a shared fixture portfolio (`libs/react-ui/integration/`). Run
it locally against the demo environment with
`INTEGRATION_API_URL=http://localhost:3333 npx jest -c libs/react-ui/jest.integration.config.ts`.

## Before the demo

- [ ] #227 (shared React host) is merged, so the build includes the React screens. demo-smoke.sh only checks the JSON API, not the served frontend.
- [ ] Demo build and smoke test is green on main.
- [ ] Open the client in a browser and check each React screen renders.
