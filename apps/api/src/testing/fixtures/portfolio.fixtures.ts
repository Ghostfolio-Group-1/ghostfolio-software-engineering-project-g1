import { TAG_ID_DRAFT } from '@ghostfolio/common/config';
import type { PortfolioPosition } from '@ghostfolio/common/interfaces';
import type { HistoricalDataItem } from '@ghostfolio/common/interfaces/historical-data-item.interface';

import { Type as ActivityType } from '@prisma/client';

// Shared, deterministic test data for the risk, tax and charts integration
// tests. One user, one account, three holdings. The orders are the source of
// truth; holdings and expected FIFO results are derived from them by hand.
//
//   01  2026-01-05  BUY  AAPL 10 @ 150  fee 1
//   02  2026-01-05  BUY  MSFT  5 @ 300  fee 1   (same-date tie, ordered by id)
//   03  2026-02-02  BUY  AAPL  5 @ 160  fee 1
//   04  2026-03-02  SELL AAPL 12 @ 170  fee 1   (closes lot 01, takes 2 from 03)
//   05  2026-03-16  DIV  MSFT  5 @ 0.8  withholding 0.6 (gross 4, net 3.4)
//   06  2026-04-01  BUY  SAP   4 @ 120  fee 1   (EUR)
//   07  2026-04-15  BUY  AAPL  2 @ 175  draft   (must be excluded everywhere)

export const FIXTURE_USER_ID = 'fixture-user-1';
export const FIXTURE_ACCOUNT_ID = 'fixture-account-1';
export const FIXTURE_BASE_CURRENCY = 'USD';

export const FIXTURE_SYMBOL_PROFILE_IDS = {
  AAPL: 'fixture-symbol-aapl',
  MSFT: 'fixture-symbol-msft',
  SAP: 'fixture-symbol-sap'
} as const;

export interface FixtureOrder {
  accountId: string;
  currency: string;
  date: Date;
  fee: number;
  id: string;
  quantity: number;
  symbolProfileId: string;
  tags: { id: string }[];
  type: ActivityType;
  unitPrice: number;
  userId: string;
  withholdingTax: number | null;
}

function order({
  draft = false,
  ...fields
}: Omit<FixtureOrder, 'accountId' | 'tags' | 'userId'> & {
  draft?: boolean;
}): FixtureOrder {
  return {
    ...fields,
    accountId: FIXTURE_ACCOUNT_ID,
    tags: draft ? [{ id: TAG_ID_DRAFT }] : [],
    userId: FIXTURE_USER_ID
  };
}

const { AAPL, MSFT, SAP } = FIXTURE_SYMBOL_PROFILE_IDS;

export const ordersFixture: FixtureOrder[] = [
  order({
    currency: 'USD',
    date: new Date('2026-01-05T00:00:00.000Z'),
    fee: 1,
    id: 'fixture-order-01',
    quantity: 10,
    symbolProfileId: AAPL,
    type: ActivityType.BUY,
    unitPrice: 150,
    withholdingTax: null
  }),
  order({
    currency: 'USD',
    date: new Date('2026-01-05T00:00:00.000Z'),
    fee: 1,
    id: 'fixture-order-02',
    quantity: 5,
    symbolProfileId: MSFT,
    type: ActivityType.BUY,
    unitPrice: 300,
    withholdingTax: null
  }),
  order({
    currency: 'USD',
    date: new Date('2026-02-02T00:00:00.000Z'),
    fee: 1,
    id: 'fixture-order-03',
    quantity: 5,
    symbolProfileId: AAPL,
    type: ActivityType.BUY,
    unitPrice: 160,
    withholdingTax: null
  }),
  order({
    currency: 'USD',
    date: new Date('2026-03-02T00:00:00.000Z'),
    fee: 1,
    id: 'fixture-order-04',
    quantity: 12,
    symbolProfileId: AAPL,
    type: ActivityType.SELL,
    unitPrice: 170,
    withholdingTax: null
  }),
  order({
    currency: 'USD',
    date: new Date('2026-03-16T00:00:00.000Z'),
    fee: 0,
    id: 'fixture-order-05',
    quantity: 5,
    symbolProfileId: MSFT,
    type: ActivityType.DIVIDEND,
    unitPrice: 0.8,
    withholdingTax: 0.6
  }),
  order({
    currency: 'EUR',
    date: new Date('2026-04-01T00:00:00.000Z'),
    fee: 1,
    id: 'fixture-order-06',
    quantity: 4,
    symbolProfileId: SAP,
    type: ActivityType.BUY,
    unitPrice: 120,
    withholdingTax: null
  }),
  order({
    currency: 'USD',
    date: new Date('2026-04-15T00:00:00.000Z'),
    draft: true,
    fee: 1,
    id: 'fixture-order-07',
    quantity: 2,
    symbolProfileId: AAPL,
    type: ActivityType.BUY,
    unitPrice: 175,
    withholdingTax: null
  })
];

// What TaxDataService.getFifoActivities() selects from the database for this
// user: non-draft BUY/SELL rows with the contract fields, in database order.
// Use as the mocked prisma.order.findMany result.
export function fifoActivitiesFrom(orders: FixtureOrder[]) {
  return orders
    .filter(({ tags, type }) => {
      return (
        (type === ActivityType.BUY || type === ActivityType.SELL) &&
        !tags.some(({ id }) => id === TAG_ID_DRAFT)
      );
    })
    .map(
      ({
        accountId,
        currency,
        date,
        id,
        quantity,
        symbolProfileId,
        type,
        unitPrice,
        userId
      }) => {
        return {
          accountId,
          currency,
          date,
          id,
          quantity,
          symbolProfileId,
          type,
          unitPrice,
          userId
        };
      }
    );
}

// Remaining quantity per FIFO lot (lot id = BUY order id) after all orders.
export const expectedFifoRemainingFixture: Record<string, number> = {
  'fixture-order-01': 0,
  'fixture-order-02': 5,
  'fixture-order-03': 3,
  'fixture-order-06': 4
};

export const dividendFixture = {
  gross: 4,
  net: 3.4,
  orderId: 'fixture-order-05',
  withholdingTax: 0.6
};

// Current holdings implied by the orders, with fixed market prices.
export const holdingsFixture = [
  {
    assetProfile: {
      assetClass: 'EQUITY',
      assetSubClass: 'STOCK',
      countries: [{ code: 'US', weight: 1 }],
      currency: 'USD',
      name: 'Apple Inc.',
      sectors: [{ name: 'Technology', weight: 1 }],
      symbol: 'AAPL'
    },
    marketPrice: 180,
    quantity: 3
  },
  {
    assetProfile: {
      assetClass: 'EQUITY',
      assetSubClass: 'STOCK',
      countries: [{ code: 'US', weight: 1 }],
      currency: 'USD',
      name: 'Microsoft Corp.',
      sectors: [{ name: 'Technology', weight: 1 }],
      symbol: 'MSFT'
    },
    marketPrice: 320,
    quantity: 5
  },
  {
    assetProfile: {
      assetClass: 'EQUITY',
      assetSubClass: 'STOCK',
      countries: [{ code: 'DE', weight: 1 }],
      currency: 'EUR',
      name: 'SAP SE',
      sectors: [{ name: 'Technology', weight: 1 }],
      symbol: 'SAP'
    },
    marketPrice: 130,
    quantity: 4
  }
] as unknown as PortfolioPosition[];

// Illustrative performance history on the order dates (not calculator output).
export const performanceHistoryFixture: HistoricalDataItem[] = [
  {
    date: '2026-01-05',
    netWorth: 3000,
    totalCashInBaseCurrency: 0,
    totalInvestment: 3000,
    valueWithCurrencyEffect: 3000
  },
  {
    date: '2026-02-02',
    netWorth: 3950,
    totalCashInBaseCurrency: 0,
    totalInvestment: 3800,
    valueWithCurrencyEffect: 3950
  },
  {
    date: '2026-03-02',
    netWorth: 3970,
    totalCashInBaseCurrency: 2039,
    totalInvestment: 1970,
    valueWithCurrencyEffect: 1931
  },
  {
    date: '2026-04-01',
    netWorth: 4100,
    totalCashInBaseCurrency: 1560,
    totalInvestment: 2450,
    valueWithCurrencyEffect: 2540
  }
];
