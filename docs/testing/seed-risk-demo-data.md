# Risk demo data

`scripts/seed-risk-demo-data.mts` seeds four demo users, each showing a
different Risk dashboard state, plus a fifth with a large, varied order
history, for the Thu Nov 12 team demonstration.
Idempotent — every row is keyed by a fixed id and upserted, so re-running it
is safe and just refreshes the data, including resetting a cash balance back
to 0 if it was previously nonzero, and fully replacing (not just re-pricing)
each user's orders if a script revision changes their holdings — any order
left over from a previous revision's holding count is deleted.

**Verified against a real throwaway Postgres + Redis database** (idempotence
across two runs, and the four calibrated users' actual Risk API responses) —
see the "balanced" row below for what that verification caught: single-stock
and country land GREEN, not YELLOW, and only currency lands YELLOW.

## Safety

This script writes five fixed, publicly-documented login tokens into
whatever database `DATABASE_URL` points at. It refuses to run unless
`ALLOW_RISK_DEMO_SEED=yes` is set, so it fails safely by default instead of
accidentally reaching production or a shared environment — see "How to run
it" below.

## What it seeds

Every symbol uses `dataSource: MANUAL` with its own `MarketData` row set
directly, so nothing needs a live price-gathering call to show real
numbers.

| User id                       | Login token              | Demonstrates                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `demo-risk-user-concentrated` | `demo-risk-concentrated` | RED concentration — one stock is ~90% of holdings, plus the warnings it produces                                                                                                                                                                                                                                                                                                                                                                                      |
| `demo-risk-user-balanced`     | `demo-risk-balanced`     | No RED anywhere — score 80 / grade B; single-stock and country sit at GREEN, currency sits at YELLOW (see "A note on currency conversion" below)                                                                                                                                                                                                                                                                                                                      |
| `demo-risk-user-empty`        | `demo-risk-empty`        | Empty portfolio — every rule `NO_DATA`, score `null`, `unavailableReason: NO_ACTIVE_RULES`                                                                                                                                                                                                                                                                                                                                                                            |
| `demo-risk-user-target`       | `demo-risk-target`       | A target allocation is configured (50% EQUITY / 50% FIXED_INCOME) and visibly deviated from, since every holding is EQUITY — exercises `TargetAllocationDeviation`                                                                                                                                                                                                                                                                                                    |
| `demo-risk-user-rich`         | `demo-risk-rich`         | A large, varied portfolio (50 symbols, ~140 BUY/SELL/DIVIDEND orders across 8 countries, 7 currencies — Germany and France both use EUR — and 10 sectors) — not calibrated to any particular severity, just enough volume to visually verify the Risk, Tax and Dashboard screens aren't sparse. Dividend records don't set an explicit withholding amount, so the Tax dividend-withholding view will show those as unavailable for this user — intentional, not a bug |

## How to run it

1. Start the dev stack: `docker compose -f docker/docker-compose.dev.yml up -d` (or however the team normally starts Postgres locally).
2. Make sure `DATABASE_URL` (and `DIRECT_URL` if set) in your `.env` points at that database — same as `npm run database:seed` uses.
3. Run the script, loading your `.env` the same way the project's own `test:*` scripts do (via `dotenv-cli`), with the safety opt-in set:
   ```
   ALLOW_RISK_DEMO_SEED=yes npx dotenv-cli -e .env -- npx tsx scripts/seed-risk-demo-data.mts
   ```
   On Windows PowerShell, set the env var first: `$env:ALLOW_RISK_DEMO_SEED = "yes"; npx dotenv-cli -e .env -- npx tsx scripts/seed-risk-demo-data.mts`.
   (`npx` fetches `tsx`/`dotenv-cli` on first run if either isn't already installed; no permanent dependency is added.)
4. You should see one line per seeded user, ending with a summary count.

## A note on currency conversion

The seed script also writes daily YAHOO `USD{EUR,GBP,JPY,CAD,AUD,INR}`
market-data rows (rate `1`) covering the rich-user order window through a
month past the seed price date. That stops Demo E2E from failing with
`No exchange rate has been found for EURUSD at …` when Tax/Risk/Charts load
multi-currency holdings. The rate is intentionally `1` so Risk severity
calibrations that were designed around 1:1 conversion stay stable; this is
coverage, not a realistic FX path.

The "balanced" account's 12 holdings are deliberately engineered — see the
comment on `demo-risk-user-balanced` in the script — so that every
concentration rule lands GREEN or YELLOW, never RED. Under the seeded 1:1
FX, single-stock (9.22%), country (42.8%) and sector (25.0%) all sit clearly
GREEN with real margin; currency is the one bucket that lands YELLOW (57.2%
against a 50% ceiling, with a real two-currency split, not a bug). Score 80
/ grade B.

Originally this account had only 10 holdings, and single-stock sat right at
the 10% ceiling (9.95%) with essentially no margin — fine on its own
(YELLOW isn't RED), but issue #323 showed that 3 simultaneous YELLOWs
(single-stock, country, currency) drop the health score's passed-rule
ratio low enough to roll up to Overall: RED, grade F, even though no
individual rule is RED. That bug was partly self-masking: a synthetic
CASH holding was being double-counted into totalValue, which artificially
kept single-stock's percentage under its ceiling. Fixing that
double-count (see `RiskEvaluationService`/`ExposureService`) correctly
raised every concentration percentage, pushing single-stock from
"barely GREEN" to YELLOW and breaking "no RED anywhere". With exactly 10
near-equal holdings, the largest one is mathematically forced to sit at
~10% (the average share), leaving no real margin regardless of exact
prices — so two more small, distinct-sector EUR holdings
(`demo-risk-sym-eureal`, `demo-risk-sym-eutele`) were added specifically to
widen the holding count and give single-stock concentration genuine
headroom, rather than relying on a precise, fragile quantity balance.
Treat the exact split as approximate until confirmed against a live run
with real rates.

## How to view each demo account

Each demo user gets a working login token (its `ACCESS_TOKEN_SALT`-hashed
form is what's stored — the table above lists the plaintext). Log in as any
of them directly through the client's existing "Security Token" field on
the sign-in screen (which calls `POST /api/v1/auth/anonymous`), using the
token from the table above, then open the Risk dashboard.

This requires `ACCESS_TOKEN_SALT` to be set in the environment the seed
script runs in _and_ the environment the API serves from, and for them to
match (the same salt the API's own login verification uses) — the script
throws clearly if `ACCESS_TOKEN_SALT` isn't set when it runs.

## Cleanup

There's no separate reset script — re-running the seed script is
idempotent and safe. To remove the demo data entirely, delete the five
users by id (cascades to their accounts/orders/settings per the schema's
`onDelete: Cascade`):

```sql
DELETE FROM "User" WHERE id IN (
  'demo-risk-user-concentrated',
  'demo-risk-user-balanced',
  'demo-risk-user-empty',
  'demo-risk-user-target',
  'demo-risk-user-rich'
);
```

The seeded `SymbolProfile`/`MarketData` rows (`demo-risk-sym-*` / symbols
starting `DEMO-`) are left in place since they're harmless and other demo
data may come to reuse them — delete them separately if that's ever a
problem.
