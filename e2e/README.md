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
