# Risk demo data

`scripts/seed-risk-demo-data.mts` seeds four demo users, each showing a
different Risk dashboard state, for the Thu Nov 12 team demonstration.
Idempotent — every row is keyed by a fixed id and upserted, so re-running it
is safe and just refreshes the data, including resetting a cash balance back
to 0 if it was previously nonzero.

**Verified against the real `RiskEvaluationService` logic (not just
asserted)** — see the "balanced" row below for what that verification
caught. The script itself still needs running against a real database at
least once before the demo to confirm the real `ExchangeRateDataService`
EUR/USD conversion lines up with the numbers quoted here (see "A note on
currency conversion" below).

## Safety

This script writes four fixed, publicly-documented login tokens into
whatever database `DATABASE_URL` points at. It refuses to run unless
`ALLOW_RISK_DEMO_SEED=yes` is set, so it fails safely by default instead of
accidentally reaching production or a shared environment — see "How to run
it" below.

## What it seeds

Every symbol uses `dataSource: MANUAL` with its own `MarketData` row set
directly, so nothing needs a live price-gathering call to show real
numbers.

| User id                       | Login token              | Demonstrates                                                                                                                                                       |
| ----------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `demo-risk-user-concentrated` | `demo-risk-concentrated` | RED concentration — one stock is ~90% of holdings, plus the warnings it produces                                                                                   |
| `demo-risk-user-balanced`     | `demo-risk-balanced`     | No RED anywhere — GREEN sector mix and cash ratio; single-stock/country/currency sit at YELLOW, not RED (see "A note on currency conversion" below)                |
| `demo-risk-user-empty`        | `demo-risk-empty`        | Empty portfolio — every rule `NO_DATA`, score `null`, `unavailableReason: NO_ACTIVE_RULES`                                                                         |
| `demo-risk-user-target`       | `demo-risk-target`       | A target allocation is configured (50% EQUITY / 50% FIXED_INCOME) and visibly deviated from, since every holding is EQUITY — exercises `TargetAllocationDeviation` |

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

The "balanced" account's 10 holdings are deliberately engineered — see the
comment on `demo-risk-user-balanced` in the script — so that every
concentration rule lands GREEN or YELLOW, never RED, confirmed by running
the actual holdings through `RiskEvaluationService` directly with the
exchange rate treated as 1:1. In the real app, `ExchangeRateDataService`
uses the database's real EUR/USD rate, which isn't exactly 1:1, and this
account's single-stock/country/currency buckets sit only slightly above
their GREEN boundary (~50-51% against a 50% ceiling). A real rate further
from 1:1 than assumed here could tip one of those from YELLOW to GREEN or
vice versa, but the margin to the next boundary up (RED at 75%/25%) is
large, so this should not produce a RED. Treat the exact split as
approximate until confirmed against a live run.

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
idempotent and safe. To remove the demo data entirely, delete the four
users by id (cascades to their accounts/orders/settings per the schema's
`onDelete: Cascade`):

```sql
DELETE FROM "User" WHERE id IN (
  'demo-risk-user-concentrated',
  'demo-risk-user-balanced',
  'demo-risk-user-empty',
  'demo-risk-user-target'
);
```

The seeded `SymbolProfile`/`MarketData` rows (`demo-risk-sym-*` / symbols
starting `DEMO-`) are left in place since they're harmless and other demo
data may come to reuse them — delete them separately if that's ever a
problem.
