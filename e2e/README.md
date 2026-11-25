# Risk module browser E2E (Playwright)

Exercises the real `/risk` route (mounted via `gf-react-host`, PR #260) in
a real browser against the demo environment, using the four seeded demo
users from `scripts/seed-risk-demo-data.mts`. Not part of the normal
unit/lint CI - it needs a live app + database.

## Run it

1. Start the demo stack (see `project-docs/iteration-3/deployment.md`):
   ```
   cp .env.demo.example .env.demo   # fill in the three secrets
   docker compose -f docker/docker-compose.demo.yml up --build -d
   ```
2. Seed the four demo users:
   ```
   ALLOW_RISK_DEMO_SEED=yes npx dotenv-cli -e .env.demo -- npx tsx scripts/seed-risk-demo-data.mts
   ```
3. Run the tests:
   ```
   npm run e2e
   ```
4. Screenshots land in `e2e/screenshots/` (git-ignored, not committed). A
   full HTML report lands in `playwright-report/` - open
   `playwright-report/index.html` to click through every step.

## Manual walkthrough (if you want to screenshot it yourself)

1. Open `http://localhost:3333`.
2. Click **Sign in** (top right of the header).
3. In the dialog, paste one of the four demo login tokens into **Security
   Token** and click **Sign in**:
   - `demo-risk-concentrated` - one stock ~90% of holdings, everything RED
   - `demo-risk-balanced` - diversified, no RED anywhere (exact score/grade
     can drift over time in a long-running environment - see "A note on
     currency conversion" in `docs/testing/seed-risk-demo-data.md`)
   - `demo-risk-empty` - no holdings, score shows as unavailable
   - `demo-risk-target` - a target allocation configured and deviated from
4. Once signed in, go to `http://localhost:3333/en/risk` (there's no
   nav-menu link to it yet - type the URL directly). Note the `/en/` -
   this app's build is locale-prefixed (`/en`, `/es`, `/uk`, ...); only the
   bare `/` auto-redirects to your locale, every other deep link
   (including `/risk`, same as `/home` or `/portfolio`) needs the prefix
   when you type it directly into the address bar. Clicking a link
   _inside_ the already-loaded app doesn't have this problem - only a
   fresh page load/typed URL does.
5. The Risk card loads the live score, grade, and indicators from
   `GET /api/v1/risk/score` and `/risk/concentration`. For the "empty"
   user, instead of a score you'll see a message explaining why none is
   available - that's expected, not an error.
6. Sign out (avatar menu, top right → **Log out**) before trying the next
   token, so the session doesn't carry over.

## What the automated test checks

For each of the four demo users: signs in through the real header dialog
(not an API shortcut), loads `/risk`, waits for the card to settle (either
a visible score or the empty-state message), asserts neither the
`gf-react-host` fallback nor the card's generic error card nor a raw error
code ever reaches the page, and checks a scenario-specific invariant (e.g.
Grade F / Overall Red for the concentrated user, no Red indicator anywhere
for the balanced user). Screenshots are taken at every step except
immediately after typing the token (the field can render it as plain
text): landing page, sign-in dialog, signed in, risk page loading, risk
page loaded.

## Route smoke test (every React route, runs in CI)

`tests/route-smoke.spec.ts` signs up a fresh user (no seed data), signs in
through the header dialog and opens every route that mounts a React screen
through `gf-react-host` (`/en/dashboard`, `/en/risk`). It fails if a screen
never appears, if the host fallback ("This section could not be loaded")
shows, or if the browser logs any error. Because it runs against the
production build in the `Demo environment` workflow, it catches the #264
class of bug that unit tests cannot (#266). Add a route to `ROUTES` when a
new screen is mounted.

Run only this file locally: `npx playwright test -c e2e/playwright.config.ts route-smoke`.

## Unified Dashboard journey

`tests/dashboard.spec.ts` signs up its own user, imports the integration
fixture portfolio (`libs/react-ui/integration/fixtures/portfolio.json`),
signs in through the header dialog and walks the journey:

1. `/en/dashboard`: all three cards load from one `GET /dashboard/overview`;
   Tax shows `78.6 USD`, Performance shows `1,055.00` (both worked out by hand
   from the fixture), Risk shows each stock share the API sent.
2. Risk card -> `/en/risk`: `GET /risk/concentration` equals the card's data.
3. Tax card -> Portfolio > Tax analytics > Realized gains: same sales as the card.
4. Performance card -> `/en/home`: the chart's latest value is 1055.

A second test signs up a user who sells more than they hold, so only the Tax
section fails: one error card, the partial-failure notice names Tax, and
Risk and Performance still render.

The cards have no links to their feature pages yet, so the journey opens each
page directly; the click-through step is reported as **BLOCKED** in the test
annotations until the cards get links.

## Charts journey

`tests/charts.spec.ts` signs up its own user, imports the integration fixture
portfolio, signs in, and walks `/en/home`:

1. Open the chart: Max series and drawdown both load (drawdown shares the
   range toggle; see #356).
2. Change range to YTD: series latest value is still 1055.
3. Toggle series to invested capital, then cash (cash is all 0).
4. Drawdown on that YTD range shows max drawdown 0.00%.

**BLOCKED** on the same journey (test annotations):

- Benchmark comparison — screen and `GET /charts/benchmark-comparison` are
  still on open PR #160.
- Return comparison — `GET /charts/return-comparison` is still on open PR
  #105; there is no React screen on `main`.

The UI-to-API half of the same sprint walk lives in
`libs/react-ui/integration/charts-journey.integration.tsx` (series → toggles
→ drawdown against the running demo API). Both halves ship in one PR.

## Cross-feature run on a clean environment

Runs every spec (route smoke, Risk, Tax, Dashboard, and Charts)
together against a fresh database, the same way the CI `E2E tests` job does:

```
docker compose -f docker/docker-compose.demo.yml -f docker/docker-compose.e2e.yml down -v
docker compose -f docker/docker-compose.demo.yml -f docker/docker-compose.e2e.yml up --build -d
until curl -fsS http://localhost:3333/api/v1/health >/dev/null; do sleep 5; done
./scripts/seed-e2e-users.sh
npm run e2e
```

`docker/docker-compose.e2e.yml` publishes the demo Postgres on
`127.0.0.1:5433` only, so `scripts/seed-e2e-users.sh` can seed the
`demo-risk-*` users into the same database the API uses. Disposable demo
database only; never point it at a shared one.
