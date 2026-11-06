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
    currency: 'USD',
    name: 'Apple Inc.',
    price: 180,
    sector: 'Technology',
    symbol: 'DEMO-AAPL'
  },
  {
    id: 'demo-risk-sym-msft',
    currency: 'USD',
    name: 'Microsoft Corp.',
    price: 320,
    sector: 'Technology',
    symbol: 'DEMO-MSFT'
  },
  {
    id: 'demo-risk-sym-jnj',
    currency: 'USD',
    name: 'Johnson & Johnson',
    price: 150,
    sector: 'Healthcare',
    symbol: 'DEMO-JNJ'
  },
  {
    id: 'demo-risk-sym-pg',
    currency: 'USD',
    name: 'Procter & Gamble',
    price: 140,
    sector: 'Consumer Staples',
    symbol: 'DEMO-PG'
  },
  {
    id: 'demo-risk-sym-sap',
    currency: 'EUR',
    name: 'SAP SE',
    price: 130,
    sector: 'Technology',
    symbol: 'DEMO-SAP'
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
    cashBalance: 2000,
    demonstrates: 'Mostly GREEN: diversified holdings, healthy cash ratio',
    holdings: [
      { quantity: 5, symbolId: 'demo-risk-sym-aapl' },
      { quantity: 5, symbolId: 'demo-risk-sym-msft' },
      { quantity: 8, symbolId: 'demo-risk-sym-jnj' },
      { quantity: 8, symbolId: 'demo-risk-sym-pg' },
      { quantity: 6, symbolId: 'demo-risk-sym-sap' }
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
        countries: [{ code: 'US', weight: 1 }],
        currency: symbol.currency,
        dataSource: 'MANUAL',
        name: symbol.name,
        sectors: [{ name: symbol.sector, weight: 1 }],
        symbol: symbol.symbol
      },
      update: { name: symbol.name },
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

  if (seedUser.cashBalance > 0) {
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
  }

  for (const [index, holding] of seedUser.holdings.entries()) {
    const symbol = symbolById.get(holding.symbolId);

    if (!symbol) {
      throw new Error(`Unknown seed symbol id: ${holding.symbolId}`);
    }

    const orderId = `${seedUser.id}-order-${index + 1}`;

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
      update: { quantity: holding.quantity, unitPrice: symbol.price },
      where: { id: orderId }
    });
  }

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
