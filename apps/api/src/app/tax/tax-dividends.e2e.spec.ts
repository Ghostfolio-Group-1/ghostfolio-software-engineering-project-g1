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
  FIXTURE_BASE_CURRENCY,
  FIXTURE_USER_ID,
  dividendFixture,
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
import request from 'supertest';

import { taxDividendsResponseSchema } from './contracts/tax-dividends.schema';
import { taxErrorResponseSchema } from './contracts/tax-realized-gains.schema';
import { TaxDataService } from './tax-data.service';
import { TaxController } from './tax.controller';
import { TaxService } from './tax.service';

const dividendActivity = {
  accountId: 'account-1',
  currency: 'USD',
  date: new Date('2026-11-05T23:30:00.000Z'),
  fee: '0.005',
  id: 'dividend-1',
  quantity: '3',
  symbolProfileId: 'asset-1',
  type: ActivityType.DIVIDEND,
  unitPrice: '0.1',
  withholdingTax: '0.07'
};

describe('GET /api/v1/tax/dividends (end to end)', () => {
  const ajv = new Ajv({ allErrors: true });
  const validateResponse = ajv.compile(taxDividendsResponseSchema);
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
              useValue: { toCurrencyAtDate: jest.fn() }
            },
            {
              provide: PrismaService,
              useValue: { order: { findMany } }
            }
          ]
        }),
        { baseCurrency: FIXTURE_BASE_CURRENCY, userId: FIXTURE_USER_ID }
      )
    );
  });

  afterAll(async () => app.close());

  beforeEach(() => {
    findMany.mockReset();
    findMany.mockResolvedValue([
      dividendActivity,
      { ...dividendActivity, id: 'dividend-zero', withholdingTax: '0' },
      { ...dividendActivity, id: 'dividend-unknown', withholdingTax: null }
    ]);
  });

  it('returns authenticated, filtered dividend records in a validated envelope', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/tax/dividends?year=2026')
      .expect(200);

    expect(validateResponse(response.body)).toBe(true);
    expect(validateResponse.errors ?? []).toEqual([]);
    expect(findMany).toHaveBeenCalledWith({
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
      select: {
        accountId: true,
        currency: true,
        date: true,
        fee: true,
        id: true,
        quantity: true,
        symbolProfileId: true,
        type: true,
        unitPrice: true,
        withholdingTax: true
      },
      where: {
        date: {
          gte: new Date('2026-01-01T00:00:00.000Z'),
          lt: new Date('2027-01-01T00:00:00.000Z')
        },
        isTaxRelevant: true,
        OR: [{ account: null }, { account: WHERE_ACCOUNT_NOT_EXCLUDED }],
        tags: {
          none: {
            id: { in: [TAG_ID_DRAFT, TAG_ID_EXCLUDE_FROM_ANALYSIS] }
          }
        },
        type: { in: [ActivityType.DIVIDEND] },
        userId: FIXTURE_USER_ID
      }
    });
    expect(response.body.data.records).toEqual([
      {
        accountId: 'account-1',
        activityFee: '0.005',
        date: '2026-11-05T23:30:00.000Z',
        grossDividend: '0.3',
        netDividend: '0.23',
        sourceActivityId: 'dividend-1',
        symbolProfileId: 'asset-1',
        transactionCurrency: 'USD',
        withholdingTax: '0.07'
      },
      expect.objectContaining({
        netDividend: '0.3',
        sourceActivityId: 'dividend-zero',
        withholdingTax: '0'
      }),
      expect.objectContaining({
        netDividend: null,
        sourceActivityId: 'dividend-unknown',
        withholdingTax: null
      })
    ]);
  });

  it('reconciles the shared MSFT dividend fixture with gross 4, withholding 0.6, net 3.4', async () => {
    const activity = ordersFixture.find(
      (order) => order.id === dividendFixture.orderId
    );
    if (!activity) {
      throw new Error('Shared MSFT dividend fixture is missing');
    }

    findMany.mockResolvedValue([activity]);
    const response = await request(app.getHttpServer())
      .get('/api/v1/tax/dividends?year=2026')
      .expect(200);

    expect(validateResponse(response.body)).toBe(true);
    expect(response.body.data.records).toEqual([
      expect.objectContaining({
        sourceActivityId: dividendFixture.orderId,
        grossDividend: String(dividendFixture.gross),
        withholdingTax: String(dividendFixture.withholdingTax),
        netDividend: String(dividendFixture.net)
      })
    ]);
  });

  it('returns an empty records array when no dividend activities match', async () => {
    findMany.mockResolvedValue([]);
    const response = await request(app.getHttpServer())
      .get('/api/v1/tax/dividends?year=2026')
      .expect(200);
    expect(response.body.data).toEqual({ records: [] });
  });

  it.each([
    '',
    '?year=xyz',
    '?year=0',
    '?year=2026.5',
    '?year=26',
    '?year=1969',
    '?year=2101'
  ])(
    'returns TAX_INVALID_QUERY 400 for missing or invalid year (%s)',
    async (query) => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/tax/dividends${query}`)
        .expect(400);
      expect(validateError(response.body)).toBe(true);
      expect(response.body.error.code).toBe('TAX_INVALID_QUERY');
      expect(findMany).not.toHaveBeenCalled();
    }
  );

  it.each([1970, 2100])('accepts boundary UTC year %s', async (year) => {
    findMany.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get(`/api/v1/tax/dividends?year=${year}`)
      .expect(200);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          date: {
            gte: new Date(`${year}-01-01T00:00:00.000Z`),
            lt: new Date(`${year + 1}-01-01T00:00:00.000Z`)
          }
        })
      })
    );
  });

  it('returns 422 on data failure with a safe TAX_ error envelope', async () => {
    findMany.mockRejectedValue(new Error('private internal database details'));
    const response = await request(app.getHttpServer())
      .get('/api/v1/tax/dividends?year=2026')
      .expect(422);
    expect(validateError(response.body)).toBe(true);
    expect(response.body.error.code).toBe('TAX_DIVIDENDS_FAILED');
    expect(JSON.stringify(response.body)).not.toContain(
      'private internal database'
    );
  });

  it('rejects requests without portfolio-read scope', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/tax/dividends?year=2026')
      .set(E2E_NO_SCOPES)
      .expect(403);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/tax/dividends?year=2026')
      .set(E2E_NO_LOGIN)
      .expect(401);
    expect(findMany).not.toHaveBeenCalled();
  });
});
