# Risk demo data

`scripts/seed-risk-demo-data.mts` seeds four demo users, each showing a
different Risk dashboard state, for the Thu Nov 12 team demonstration.
Idempotent — every row is keyed by a fixed id and upserted, so re-running it
is safe and just refreshes the data.

**Not run against a live database in this session** — Docker wasn't running
in the sandbox this was written in. Please run it and confirm it works
before the demo.

## What it seeds

Every symbol uses `dataSource: MANUAL` with its own `MarketData` row set
directly, so nothing needs a live price-gathering call to show real
numbers.

| User id                       | Login token              | Demonstrates                                                                                                                                                       |
| ----------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `demo-risk-user-concentrated` | `demo-risk-concentrated` | RED concentration — one stock is ~90% of holdings, plus the warnings it produces                                                                                   |
| `demo-risk-user-balanced`     | `demo-risk-balanced`     | Mostly GREEN — five diversified holdings, healthy cash ratio                                                                                                       |
| `demo-risk-user-empty`        | `demo-risk-empty`        | Empty portfolio — every rule `NO_DATA`, score `null`, `unavailableReason: NO_ACTIVE_RULES`                                                                         |
| `demo-risk-user-target`       | `demo-risk-target`       | A target allocation is configured (50% EQUITY / 50% FIXED_INCOME) and visibly deviated from, since every holding is EQUITY — exercises `TargetAllocationDeviation` |

## How to run it

1. Start the dev stack: `docker compose -f docker/docker-compose.dev.yml up -d` (or however the team normally starts Postgres locally).
2. Make sure `DATABASE_URL` (and `DIRECT_URL` if set) in your `.env` points at that database — same as `npm run database:seed` uses.
3. Run the script:
   ```
   npx tsx scripts/seed-risk-demo-data.mts
   ```
   (`npx` fetches `tsx` on first run if it isn't already installed; no permanent dependency is added.)
4. You should see one line per seeded user, ending with a summary count.

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
