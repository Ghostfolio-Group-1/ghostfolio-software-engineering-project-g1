import { WHERE_ACCOUNT_NOT_EXCLUDED } from '@ghostfolio/api/helper/account.helper';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.service';
import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import {
  E2E_NO_LOGIN,
  E2E_NO_SCOPES,
  createE2eApp,
  withE2eUser
} from '@ghostfolio/api/testing/e2e/e2e-app';
import {
  FIXTURE_ACCOUNT_ID,
  FIXTURE_BASE_CURRENCY,
  FIXTURE_SYMBOL_PROFILE_IDS,
  FIXTURE_USER_ID,
  fifoActivitiesFrom,
  fifoRealizedGainActivitiesFrom,
  ordersFixture
} from '@ghostfolio/api/testing/fixtures/portfolio.fixtures';
import {
  TAG_ID_DRAFT,
  TAG_ID_EXCLUDE_FROM_ANALYSIS
} from '@ghostfolio/common/config';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Type as ActivityType } from '@prisma/client';
import Ajv from 'ajv';
import { Big } from 'big.js';
import request from 'supertest';

import { fifoRealizedGainActivitiesSchema } from './contracts/fifo-realized-gain-activity.schema';
import { taxLotsResponseSchema } from './contracts/tax-lots.schema';
import {
  taxErrorResponseSchema,
  taxRealizedGainsResponseSchema
} from './contracts/tax-realized-gains.schema';
import { TaxDataService } from './tax-data.service';
import { TaxController } from './tax.controller';
import { TaxService } from './tax.service';

// Fixture sale: SELL 12 AAPL @ 170, fee 1 (fixture-order-04).
//
// FIFO:
// lot 01: BUY 10 @ 150, fee 1
// lot 03: BUY 5 @ 160, fee 1
//
// FIFO consumes lot 01 fully, then 2 units from lot 03.
//   lot 01: basis 1500, proceeds 1700, gain 200,
//           buy fee 1, sell fee 10/12
//   lot 03: basis 320, proceeds 340, gain 20,
//           buy fee 2/5 = 0.4, sell fee = residual
//   sale:   basis 1820, proceeds 2040, gain 220,
//           buy fees 1.4, sell fee 1,
//           gain after fees 220 - 1.4 - 1 = 217.6 (DR-4)
//
// Average cost:
//   pool before sale:
//     quantity = 15
//     gross cost = 2300
//     acquisition fee pool = 2
//   disposal ratio = 12 / 15 = 0.8
//   basis disposed = 2300 * 0.8 = 1840
//   acquisition fees disposed = 2 * 0.8 = 1.6
//   proceeds = 12 * 170 = 2040
//   gross gain = 2040 - 1840 = 200
//   gain after fees = 200 - 1.6 - 1 = 197.4
//   pool after sale:
//     quantity = 3
//     gross cost = 460
//     acquisition fee pool = 0.4

describe('GET /api/v1/tax/realized-gains (end to end)', () => {
  const ajv = new Ajv({ allErrors: true });
  const validateResponse = ajv.compile(taxRealizedGainsResponseSchema);
  const validateError = ajv.compile(taxErrorResponseSchema);
  const validateRows = ajv.compile(fifoRealizedGainActivitiesSchema);
  const findMany = jest.fn();

  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp(
      withE2eUser(
        Test.createTestingModule({
          controllers: [TaxController],
          providers: [
            TaxDataService,
            TaxService,
            {
              provide: ExchangeRateDataService,
              useValue: {
                toCurrencyAtDate: jest.fn()
              }
            },
            {
              provide: PrismaService,
              useValue: {
                order: {
                  findMany
                }
              }
            }
          ]
        }),
        {
          baseCurrency: FIXTURE_BASE_CURRENCY,
          userId: FIXTURE_USER_ID
        }
      )
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    findMany.mockReset();
    findMany.mockResolvedValue(fifoRealizedGainActivitiesFrom(ordersFixture));
  });

  it('uses fixture rows that match the realized-gain data contract', () => {
    validateRows(
      JSON.parse(JSON.stringify(fifoRealizedGainActivitiesFrom(ordersFixture)))
    );

    expect(validateRows.errors ?? []).toEqual([]);
  });

  // Issue #55: verify that the public response schema accepts
  // an incomplete result with the mixed-history diagnostic.
  it('accepts the incomplete mixed-history diagnostic in the response contract', () => {
    const response = {
      data: {
        diagnostics: [
          {
            affectedSellActivityIds: ['fixture-order-04'],
            code: 'TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY',
            excludedActivityIds: ['fixture-order-01'],
            message:
              'Excluded BUY or SELL activity exists in the same tax scope before or at a tax-relevant SELL; basis-dependent tax results may be incomplete.'
          }
        ],
        isComplete: false,
        method: 'FIFO',
        sales: []
      },
      error: null,
      meta: {}
    };

    expect(validateResponse(response)).toBe(true);
    expect(validateResponse.errors ?? []).toEqual([]);
  });

  it('returns the FIFO realized gain of the fixture sale in the contract shape', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/tax/realized-gains')
      .expect(200);

    expect(validateResponse(response.body)).toBe(true);
    expect(validateResponse.errors ?? []).toEqual([]);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isTaxRelevant: true,
          OR: [
            {
              account: null
            },
            {
              account: WHERE_ACCOUNT_NOT_EXCLUDED
            }
          ],
          tags: {
            none: {
              id: {
                in: [TAG_ID_DRAFT, TAG_ID_EXCLUDE_FROM_ANALYSIS]
              }
            }
          },
          type: {
            in: [ActivityType.BUY, ActivityType.SELL]
          },
          userId: FIXTURE_USER_ID
        }
      })
    );

    const { method, sales } = response.body.data;

    expect(method).toBe('FIFO');
    expect(sales).toHaveLength(1);

    expect(sales[0]).toMatchObject({
      allocatedAcquisitionFees: '1.4',
      allocatedBuyFees: '1.4',
      allocatedSellFee: '1',
      currency: 'USD',
      grossCostBasis: '1820',
      grossProceeds: '2040',
      grossRealizedGain: '220',
      matchedQuantity: '12',
      realizedGainAfterActivityFees: '217.6',
      sellActivityId: 'fixture-order-04',
      sellDate: '2026-03-02T00:00:00.000Z',
      sellFee: '1',
      sellQuantity: '12'
    });
  });

  it('supports explicit FIFO method selection', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/tax/realized-gains?method=FIFO')
      .expect(200);

    expect(validateResponse(response.body)).toBe(true);
    expect(validateResponse.errors ?? []).toEqual([]);

    expect(response.body.data.method).toBe('FIFO');
    expect(response.body.data.sales).toHaveLength(1);
    expect(response.body.data.sales[0].matches).toHaveLength(2);
  });

  it('returns average-cost realized gains when AVERAGE_COST is selected', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/tax/realized-gains?method=AVERAGE_COST')
      .expect(200);

    expect(validateResponse(response.body)).toBe(true);
    expect(validateResponse.errors ?? []).toEqual([]);

    expect(response.body.data).toEqual({
      method: 'AVERAGE_COST',
      sales: [
        {
          sellActivityId: 'fixture-order-04',
          sellDate: '2026-03-02T00:00:00.000Z',
          currency: 'USD',
          sellQuantity: '12',
          matchedQuantity: '12',
          grossProceeds: '2040',
          grossCostBasis: '1840',
          grossRealizedGain: '200',
          allocatedAcquisitionFees: '1.6',
          sellFee: '1',
          allocatedSellFee: '1',
          realizedGainAfterActivityFees: '197.4',
          poolBefore: {
            quantity: '15',
            grossCost: '2300',
            acquisitionFeePool: '2'
          },
          poolAfter: {
            quantity: '3',
            grossCost: '460',
            acquisitionFeePool: '0.4'
          }
        }
      ]
    });
  });

  it('rejects an unsupported realized-gain method with the TAX error envelope', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/tax/realized-gains?method=INVALID')
      .expect(422);

    expect(validateError(response.body)).toBe(true);
    expect(validateError.errors ?? []).toEqual([]);

    expect(response.body).toMatchObject({
      data: null,
      error: {
        code: 'TAX_REALIZED_GAINS_FAILED',
        message: 'Unsupported tax calculation method: INVALID'
      },
      meta: {}
    });
  });

  it('matches the sale against lots 01 and 03 in FIFO order with DR-4 fee allocation', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/tax/realized-gains')
      .expect(200);

    const [first, second] = response.body.data.sales[0].matches;

    expect(first).toMatchObject({
      buyActivityId: 'fixture-order-01',
      buyFeeAllocated: '1',
      grossAcquisitionValue: '1500',
      grossProceeds: '1700',
      grossRealizedGain: '200',
      lotId: 'fixture-order-01',
      matchedQuantity: '10'
    });

    expect(second).toMatchObject({
      buyActivityId: 'fixture-order-03',
      buyFeeAllocated: '0.4',
      grossAcquisitionValue: '320',
      grossProceeds: '340',
      grossRealizedGain: '20',
      lotId: 'fixture-order-03',
      matchedQuantity: '2'
    });

    expect(Number(first.sellFeeAllocated)).toBeCloseTo(10 / 12, 10);
    expect(Number(second.sellFeeAllocated)).toBeCloseTo(2 / 12, 10);

    expect(
      new Big(first.sellFeeAllocated).plus(second.sellFeeAllocated).toString()
    ).toBe('1');

    expect(
      new Big(first.realizedGainAfterActivityFees)
        .plus(second.realizedGainAfterActivityFees)
        .toString()
    ).toBe('217.6');
  });

  it('returns 422 with a TAX_ envelope when FIFO currencies cannot be matched', async () => {
    findMany.mockResolvedValue(
      fifoRealizedGainActivitiesFrom(ordersFixture).map((row) => {
        return row.id === 'fixture-order-04'
          ? {
              ...row,
              currency: 'EUR'
            }
          : row;
      })
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/tax/realized-gains')
      .expect(422);

    expect(validateError(response.body)).toBe(true);
    expect(response.body.error.code).toBe('TAX_REALIZED_GAINS_FAILED');
  });

  it('returns 422 with the same TAX_ envelope when average-cost currencies cannot be matched', async () => {
    findMany.mockResolvedValue(
      fifoRealizedGainActivitiesFrom(ordersFixture).map((row) => {
        return row.id === 'fixture-order-04'
          ? {
              ...row,
              currency: 'EUR'
            }
          : row;
      })
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/tax/realized-gains?method=AVERAGE_COST')
      .expect(422);

    expect(validateError(response.body)).toBe(true);
    expect(validateError.errors ?? []).toEqual([]);
    expect(response.body.error.code).toBe('TAX_REALIZED_GAINS_FAILED');
  });

  it('returns 403 when the user lacks the portfolio:read scope', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/tax/realized-gains')
      .set(E2E_NO_SCOPES)
      .expect(403);

    expect(findMany).not.toHaveBeenCalled();
  });

  it('returns 401 when the request is not logged in', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/tax/realized-gains')
      .set(E2E_NO_LOGIN)
      .expect(401);

    expect(findMany).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/tax/lots (end to end)', () => {
  const ajv = new Ajv({ allErrors: true });
  const validateResponse = ajv.compile(taxLotsResponseSchema);
  const validateError = ajv.compile(taxErrorResponseSchema);
  const findMany = jest.fn();

  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp(
      withE2eUser(
        Test.createTestingModule({
          controllers: [TaxController],
          providers: [
            TaxDataService,
            TaxService,
            {
              provide: ExchangeRateDataService,
              useValue: {
                toCurrencyAtDate: jest.fn()
              }
            },
            {
              provide: PrismaService,
              useValue: {
                order: {
                  findMany
                }
              }
            }
          ]
        }),
        {
          baseCurrency: FIXTURE_BASE_CURRENCY,
          userId: FIXTURE_USER_ID
        }
      )
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    findMany.mockReset();
    findMany.mockResolvedValue(fifoActivitiesFrom(ordersFixture));
  });

  // Issue #55: same mixed-history response contract for tax lots.
  // This is inside the tax-lots describe block; it is not a separate file.
  it('accepts the incomplete mixed-history diagnostic in the lot response contract', () => {
    const response = {
      data: {
        diagnostics: [
          {
            affectedSellActivityIds: ['fixture-order-04'],
            code: 'TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY',
            excludedActivityIds: ['fixture-order-01'],
            message:
              'Excluded BUY or SELL activity exists in the same tax scope before or at a tax-relevant SELL; basis-dependent tax results may be incomplete.'
          }
        ],
        isComplete: false,
        lots: []
      },
      error: null,
      meta: {}
    };

    expect(validateResponse(response)).toBe(true);
    expect(validateResponse.errors ?? []).toEqual([]);
  });

  it('returns derived FIFO tax lots in the contract shape', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/tax/lots')
      .expect(200);

    expect(validateResponse(response.body)).toBe(true);
    expect(validateResponse.errors ?? []).toEqual([]);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isTaxRelevant: true,
          OR: [
            {
              account: null
            },
            {
              account: WHERE_ACCOUNT_NOT_EXCLUDED
            }
          ],
          tags: {
            none: {
              id: {
                in: [TAG_ID_DRAFT, TAG_ID_EXCLUDE_FROM_ANALYSIS]
              }
            }
          },
          type: {
            in: [ActivityType.BUY, ActivityType.SELL]
          },
          userId: FIXTURE_USER_ID
        }
      })
    );

    expect(response.body.data.lots).toEqual([
      {
        lotId: 'fixture-order-01',
        sourceActivityId: 'fixture-order-01',
        accountId: FIXTURE_ACCOUNT_ID,
        symbolProfileId: FIXTURE_SYMBOL_PROFILE_IDS.AAPL,
        acquiredAt: '2026-01-05T00:00:00.000Z',
        currency: 'USD',
        originalQuantity: '10',
        consumedQuantity: '10',
        remainingQuantity: '0',
        status: 'CLOSED',
        relatedSellActivityIds: ['fixture-order-04']
      },
      {
        lotId: 'fixture-order-02',
        sourceActivityId: 'fixture-order-02',
        accountId: FIXTURE_ACCOUNT_ID,
        symbolProfileId: FIXTURE_SYMBOL_PROFILE_IDS.MSFT,
        acquiredAt: '2026-01-05T00:00:00.000Z',
        currency: 'USD',
        originalQuantity: '5',
        consumedQuantity: '0',
        remainingQuantity: '5',
        status: 'OPEN',
        relatedSellActivityIds: []
      },
      {
        lotId: 'fixture-order-03',
        sourceActivityId: 'fixture-order-03',
        accountId: FIXTURE_ACCOUNT_ID,
        symbolProfileId: FIXTURE_SYMBOL_PROFILE_IDS.AAPL,
        acquiredAt: '2026-02-02T00:00:00.000Z',
        currency: 'USD',
        originalQuantity: '5',
        consumedQuantity: '2',
        remainingQuantity: '3',
        status: 'PARTIALLY_CONSUMED',
        relatedSellActivityIds: ['fixture-order-04']
      },
      {
        lotId: 'fixture-order-06',
        sourceActivityId: 'fixture-order-06',
        accountId: FIXTURE_ACCOUNT_ID,
        symbolProfileId: FIXTURE_SYMBOL_PROFILE_IDS.SAP,
        acquiredAt: '2026-04-01T00:00:00.000Z',
        currency: 'EUR',
        originalQuantity: '4',
        consumedQuantity: '0',
        remainingQuantity: '4',
        status: 'OPEN',
        relatedSellActivityIds: []
      }
    ]);
  });

  it('does not expose the draft BUY as a tax lot', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/tax/lots')
      .expect(200);

    expect(
      response.body.data.lots.map(
        (lot: { sourceActivityId: string }) => lot.sourceActivityId
      )
    ).not.toContain('fixture-order-07');
  });

  it('supports multiple acquisition currencies in one lot view', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/tax/lots')
      .expect(200);

    const currencies = response.body.data.lots.map(
      (lot: { currency: string | null }) => lot.currency
    );

    expect(currencies).toContain('USD');
    expect(currencies).toContain('EUR');
  });

  it('serializes tiny quantities as normal decimal strings accepted by the schema', async () => {
    findMany.mockResolvedValue([
      {
        accountId: FIXTURE_ACCOUNT_ID,
        currency: 'USD',
        date: new Date('2026-05-01T00:00:00.000Z'),
        id: 'fixture-order-tiny',
        quantity: 0.00000001,
        symbolProfileId: FIXTURE_SYMBOL_PROFILE_IDS.AAPL,
        type: ActivityType.BUY,
        unitPrice: 1,
        userId: FIXTURE_USER_ID
      }
    ]);

    const response = await request(app.getHttpServer())
      .get('/api/v1/tax/lots')
      .expect(200);

    expect(validateResponse(response.body)).toBe(true);
    expect(validateResponse.errors ?? []).toEqual([]);

    expect(response.body.data.lots).toEqual([
      {
        lotId: 'fixture-order-tiny',
        sourceActivityId: 'fixture-order-tiny',
        accountId: FIXTURE_ACCOUNT_ID,
        symbolProfileId: FIXTURE_SYMBOL_PROFILE_IDS.AAPL,
        acquiredAt: '2026-05-01T00:00:00.000Z',
        currency: 'USD',
        originalQuantity: '0.00000001',
        consumedQuantity: '0',
        remainingQuantity: '0.00000001',
        status: 'OPEN',
        relatedSellActivityIds: []
      }
    ]);
  });

  it('returns an empty lot list when there are no eligible activities', async () => {
    findMany.mockResolvedValue([]);

    const response = await request(app.getHttpServer())
      .get('/api/v1/tax/lots')
      .expect(200);

    expect(validateResponse(response.body)).toBe(true);
    expect(validateResponse.errors ?? []).toEqual([]);

    expect(response.body.data).toEqual({
      lots: []
    });
  });

  it('fails the whole view with TAX_LOTS_FAILED when the activity history cannot be reconciled', async () => {
    const fixtureRows = fifoActivitiesFrom(ordersFixture);

    findMany.mockResolvedValue([
      ...fixtureRows,
      {
        accountId: FIXTURE_ACCOUNT_ID,
        currency: 'USD',
        date: new Date('2026-05-01T00:00:00.000Z'),
        id: 'fixture-order-over-sell',
        quantity: 100,
        symbolProfileId: FIXTURE_SYMBOL_PROFILE_IDS.AAPL,
        type: ActivityType.SELL,
        unitPrice: 170,
        userId: FIXTURE_USER_ID
      }
    ]);

    const response = await request(app.getHttpServer())
      .get('/api/v1/tax/lots')
      .expect(422);

    expect(validateError(response.body)).toBe(true);
    expect(validateError.errors ?? []).toEqual([]);

    expect(response.body).toMatchObject({
      data: null,
      error: {
        code: 'TAX_LOTS_FAILED'
      },
      meta: {}
    });
  });

  it('returns 403 when the user lacks the portfolio:read scope', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/tax/lots')
      .set(E2E_NO_SCOPES)
      .expect(403);

    expect(findMany).not.toHaveBeenCalled();
  });

  it('returns 401 when the request is not logged in', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/tax/lots')
      .set(E2E_NO_LOGIN)
      .expect(401);

    expect(findMany).not.toHaveBeenCalled();
  });
});
