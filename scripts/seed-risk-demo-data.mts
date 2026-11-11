import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { createHmac } from 'node:crypto';

// Seeds demo users/holdings that exercise every Risk dashboard state for
// the Nov 12 demo: each severity, an empty portfolio, and a configured
// target allocation. Idempotent (upserts on a fixed id per user) and safe
// to re-run. See docs/testing/seed-risk-demo-data.md for how to run this
// and what each account demonstrates.
//
// Uses dataSource: MANUAL for every symbol with a MarketData row set
// directly, so no external price-gathering call is needed to see live
// data - this script is the data, not a trigger for Ghostfolio's normal
// background price fetch.

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL
});

const prisma = new PrismaClient({ adapter });

const PRICE_DATE = new Date('2026-11-06T00:00:00.000Z');

// This script writes fixed, documented login tokens (docs/testing/seed-
// risk-demo-data.md) into whatever database DATABASE_URL points at. That's
// fine for a disposable local/dev database, but it must never run against
// production or a shared environment - requiring an explicit opt-in env
// var (rather than e.g. sniffing the URL for "localhost") means it fails
// safely by default instead of guessing.
function assertSafeToSeed(): void {
  if (process.env.ALLOW_RISK_DEMO_SEED !== 'yes') {
    throw new Error(
      'Refusing to seed: ALLOW_RISK_DEMO_SEED is not set to "yes". This ' +
        'script writes fixed, publicly-documented login tokens into ' +
        'DATABASE_URL - only run it against a disposable local/dev ' +
        'database, never production or a shared environment. Set ' +
        'ALLOW_RISK_DEMO_SEED=yes once you have confirmed that.'
    );
  }
}

// Matches UserService#createAccessToken exactly (apps/api/src/app/user/
// user.service.ts) so a plaintext token generated here can log in through
// the client's existing "Security Token" field via POST /auth/anonymous.
function hashAccessToken(plaintext: string): string {
  const salt = process.env.ACCESS_TOKEN_SALT;

  if (!salt) {
    throw new Error(
      'ACCESS_TOKEN_SALT is not set - required to seed a working login token for each demo user.'
    );
  }

  return createHmac('sha512', salt).update(plaintext).digest('hex');
}

interface SeedSymbol {
  // ISO country code for the Risk module's CountryConcentration rule - each
  // symbol needs its own, not a portfolio-wide default (see the fix note on
  // the balanced user below).
  country: string;
  currency: string;
  id: string;
  name: string;
  price: number;
  sector: string;
  symbol: string;
}

const SYMBOLS: SeedSymbol[] = [
  {
    id: 'demo-risk-sym-aapl',
    country: 'US',
    currency: 'USD',
    name: 'Apple Inc.',
    price: 180,
    sector: 'Technology',
    symbol: 'DEMO-AAPL'
  },
  {
    id: 'demo-risk-sym-msft',
    country: 'US',
    currency: 'USD',
    name: 'Microsoft Corp.',
    price: 320,
    sector: 'Technology',
    symbol: 'DEMO-MSFT'
  },
  {
    id: 'demo-risk-sym-jnj',
    country: 'US',
    currency: 'USD',
    name: 'Johnson & Johnson',
    price: 150,
    sector: 'Healthcare',
    symbol: 'DEMO-JNJ'
  },
  {
    id: 'demo-risk-sym-pg',
    country: 'US',
    currency: 'USD',
    name: 'Procter & Gamble',
    price: 140,
    sector: 'Consumer Staples',
    symbol: 'DEMO-PG'
  },
  {
    id: 'demo-risk-sym-sap',
    country: 'DE',
    currency: 'EUR',
    name: 'SAP SE',
    price: 130,
    sector: 'Technology',
    symbol: 'DEMO-SAP'
  },
  // The 6 below are fictional - standing in for a non-US, non-Technology
  // name in their sector/currency so the "balanced" user below can be
  // diversified across sector, country and currency, not just added up to
  // look busy. Everything here is dataSource MANUAL and prefixed DEMO-, so
  // nothing here is presented as a real security.
  {
    id: 'demo-risk-sym-eutec',
    country: 'FR',
    currency: 'EUR',
    name: 'Demo European Technology Co.',
    price: 100,
    sector: 'Technology',
    symbol: 'DEMO-EUTEC'
  },
  {
    id: 'demo-risk-sym-eufin',
    country: 'DE',
    currency: 'EUR',
    name: 'Demo European Financials Co.',
    price: 100,
    sector: 'Financials',
    symbol: 'DEMO-EUFIN'
  },
  {
    id: 'demo-risk-sym-euind',
    country: 'FR',
    currency: 'EUR',
    name: 'Demo European Industrials Co.',
    price: 100,
    sector: 'Industrials',
    symbol: 'DEMO-EUIND'
  },
  {
    id: 'demo-risk-sym-usenr',
    country: 'US',
    currency: 'USD',
    name: 'Demo US Energy Co.',
    price: 100,
    sector: 'Energy',
    symbol: 'DEMO-USENR'
  },
  {
    id: 'demo-risk-sym-usmat',
    country: 'US',
    currency: 'USD',
    name: 'Demo US Materials Co.',
    price: 100,
    sector: 'Materials',
    symbol: 'DEMO-USMAT'
  },
  {
    id: 'demo-risk-sym-euutil',
    country: 'DE',
    currency: 'EUR',
    name: 'Demo European Utilities Co.',
    price: 100,
    sector: 'Utilities',
    symbol: 'DEMO-EUUTIL'
  }
];

interface SeedHolding {
  quantity: number;
  symbolId: string;
}

interface SeedUser {
  /** Plaintext login token for POST /auth/anonymous - not stored as-is. */
  accessToken: string;
  cashBalance: number;
  /** A short label printed to the console once seeded. */
  demonstrates: string;
  holdings: SeedHolding[];
  id: string;
  targetAllocation?: {
    groupBy: 'assetClass';
    targets: { key: string; percentage: number }[];
  };
}

const SEED_USERS: SeedUser[] = [
  {
    id: 'demo-risk-user-concentrated',
    accessToken: 'demo-risk-concentrated',
    cashBalance: 500,
    demonstrates:
      'RED concentration (one stock is most of the portfolio) + warnings',
    holdings: [
      { quantity: 50, symbolId: 'demo-risk-sym-aapl' }, // ~90% of holdings
      { quantity: 2, symbolId: 'demo-risk-sym-msft' }
    ]
  },
  {
    id: 'demo-risk-user-balanced',
    accessToken: 'demo-risk-balanced',
    cashBalance: 800,
    // Verified against the real RiskEvaluationService (not asserted on
    // faith - see the PR #225 review): no RED anywhere. Sector and cash
    // land clearly GREEN; single-stock, country and currency sit just
    // above their GREEN boundary (YELLOW) because the worst bucket in each
    // is ~50-51% against a 50% GREEN ceiling - an inherent result of only
    // having two home currencies (USD/EUR) to split 10 holdings across,
    // not a bug. (The original version of this account wrongly tagged
    // every symbol's country as "US", including DEMO-SAP, which actually
    // produced ~86-100% RED country/currency concentration - the opposite
    // of what "balanced" was supposed to demonstrate.)
    demonstrates:
      'No RED anywhere: GREEN sector mix and cash ratio, YELLOW (not RED) single-stock/country/currency concentration',
    holdings: [
      { quantity: 5, symbolId: 'demo-risk-sym-aapl' },
      { quantity: 7, symbolId: 'demo-risk-sym-sap' },
      { quantity: 9, symbolId: 'demo-risk-sym-eutec' },
      { quantity: 6, symbolId: 'demo-risk-sym-jnj' },
      { quantity: 6, symbolId: 'demo-risk-sym-pg' },
      { quantity: 9, symbolId: 'demo-risk-sym-eufin' },
      { quantity: 10, symbolId: 'demo-risk-sym-euind' },
      { quantity: 10, symbolId: 'demo-risk-sym-usenr' },
      { quantity: 10, symbolId: 'demo-risk-sym-usmat' },
      { quantity: 9, symbolId: 'demo-risk-sym-euutil' }
    ]
  },
  {
    id: 'demo-risk-user-empty',
    accessToken: 'demo-risk-empty',
    cashBalance: 0,
    demonstrates:
      'Empty portfolio: every rule NO_DATA, score null, unavailableReason NO_ACTIVE_RULES',
    holdings: []
  },
  {
    id: 'demo-risk-user-target',
    accessToken: 'demo-risk-target',
    cashBalance: 1000,
    demonstrates:
      'Target allocation configured and deviated from it (TargetAllocationDeviation severity)',
    holdings: [
      { quantity: 10, symbolId: 'demo-risk-sym-aapl' },
      { quantity: 4, symbolId: 'demo-risk-sym-msft' },
      { quantity: 4, symbolId: 'demo-risk-sym-jnj' }
    ],
    targetAllocation: {
      groupBy: 'assetClass',
      // Actual holdings are all EQUITY; splitting the target 50/50 against
      // FIXED_INCOME (which this account holds none of) guarantees a large,
      // visible deviation without depending on exact share counts.
      targets: [
        { key: 'EQUITY', percentage: 0.5 },
        { key: 'FIXED_INCOME', percentage: 0.5 }
      ]
    }
  }
];

async function seedSymbols() {
  for (const symbol of SYMBOLS) {
    await prisma.symbolProfile.upsert({
      create: {
        id: symbol.id,
        assetClass: 'EQUITY',
        assetSubClass: 'STOCK',
        countries: [{ code: symbol.country, weight: 1 }],
        currency: symbol.currency,
        dataSource: 'MANUAL',
        name: symbol.name,
        sectors: [{ name: symbol.sector, weight: 1 }],
        symbol: symbol.symbol
      },
      // Re-applies countries/sectors too, not just name - otherwise
      // re-running this script after fixing a symbol's classification (as
      // happened with DEMO-SAP's country, PR #225 review) would leave an
      // already-seeded database stuck on the old, wrong value.
      update: {
        countries: [{ code: symbol.country, weight: 1 }],
        name: symbol.name,
        sectors: [{ name: symbol.sector, weight: 1 }]
      },
      where: { id: symbol.id }
    });

    await prisma.marketData.upsert({
      create: {
        dataSource: 'MANUAL',
        date: PRICE_DATE,
        marketPrice: symbol.price,
        symbol: symbol.symbol
      },
      update: { marketPrice: symbol.price },
      where: {
        dataSource_date_symbol: {
          dataSource: 'MANUAL',
          date: PRICE_DATE,
          symbol: symbol.symbol
        }
      }
    });
  }
}

async function seedUser(seedUser: SeedUser) {
  const symbolById = new Map(SYMBOLS.map((symbol) => [symbol.id, symbol]));
  const accountId = `${seedUser.id}-account`;

  const hashedAccessToken = hashAccessToken(seedUser.accessToken);

  await prisma.user.upsert({
    create: {
      id: seedUser.id,
      accessToken: hashedAccessToken,
      provider: 'ANONYMOUS',
      role: 'DEMO'
    },
    update: { accessToken: hashedAccessToken },
    where: { id: seedUser.id }
  });

  await prisma.account.upsert({
    create: {
      id: accountId,
      currency: 'USD',
      name: 'Demo account',
      userId: seedUser.id
    },
    update: {},
    where: { id_userId: { id: accountId, userId: seedUser.id } }
  });

  // Always upserted, even for cashBalance: 0 - skipping the write when 0
  // (as this used to) meant re-running the script against an account that
  // already had a nonzero balance (e.g. from an earlier, different seed
  // revision) would leave that stale balance in place instead of resetting
  // it to the value this script now intends.
  await prisma.accountBalance.upsert({
    create: {
      accountId,
      date: PRICE_DATE,
      userId: seedUser.id,
      value: seedUser.cashBalance
    },
    update: { value: seedUser.cashBalance },
    where: { accountId_date: { accountId, date: PRICE_DATE } }
  });

  // Order ids are positional (`${seedUser.id}-order-${index + 1}`), so if a
  // revision of SEED_USERS changes a holding at a given position (e.g. the
  // balanced user's 2nd holding used to be MSFT, now SAP) or changes how
  // many holdings a user has, re-running against a database seeded by an
  // earlier revision must not leave a stale order around with the old
  // symbol/currency and only the new quantity/price - Tharun's review on
  // PR #225 caught update only setting quantity/unitPrice. Every field
  // that can legitimately change between revisions is updated, and any
  // order id beyond the current holding count is deleted, scoped strictly
  // to this one demo user via accountUserId.
  const currentOrderIds: string[] = [];

  for (const [index, holding] of seedUser.holdings.entries()) {
    const symbol = symbolById.get(holding.symbolId);

    if (!symbol) {
      throw new Error(`Unknown seed symbol id: ${holding.symbolId}`);
    }

    const orderId = `${seedUser.id}-order-${index + 1}`;
    currentOrderIds.push(orderId);

    await prisma.order.upsert({
      create: {
        id: orderId,
        accountId,
        accountUserId: seedUser.id,
        currency: symbol.currency,
        date: PRICE_DATE,
        fee: 0,
        quantity: holding.quantity,
        symbolProfileId: symbol.id,
        type: 'BUY',
        unitPrice: symbol.price,
        userId: seedUser.id
      },
      update: {
        accountId,
        currency: symbol.currency,
        date: PRICE_DATE,
        fee: 0,
        quantity: holding.quantity,
        symbolProfileId: symbol.id,
        type: 'BUY',
        unitPrice: symbol.price
      },
      where: { id: orderId }
    });
  }

  await prisma.order.deleteMany({
    where: {
      accountUserId: seedUser.id,
      id: { notIn: currentOrderIds, startsWith: `${seedUser.id}-order-` }
    }
  });

  await prisma.settings.upsert({
    create: {
      settings: {
        baseCurrency: 'USD',
        ...(seedUser.targetAllocation
          ? {
              targetAllocation: { isActive: true, ...seedUser.targetAllocation }
            }
          : {})
      },
      userId: seedUser.id
    },
    update: {
      settings: {
        baseCurrency: 'USD',
        ...(seedUser.targetAllocation
          ? {
              targetAllocation: { isActive: true, ...seedUser.targetAllocation }
            }
          : {})
      }
    },
    where: { userId: seedUser.id }
  });

  console.log(
    `Seeded ${seedUser.id} (login token: ${seedUser.accessToken}) - ${seedUser.demonstrates}`
  );
}

async function main() {
  assertSafeToSeed();
  await seedSymbols();

  for (const user of SEED_USERS) {
    await seedUser(user);
  }

  console.log(
    `\nDone. ${SEED_USERS.length} demo users seeded. See docs/testing/seed-risk-demo-data.md for how to impersonate each one and what it shows.`
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
