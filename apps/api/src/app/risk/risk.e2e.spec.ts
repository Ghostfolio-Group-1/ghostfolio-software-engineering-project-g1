import { PortfolioService } from '@ghostfolio/api/app/portfolio/portfolio.service';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.service';
import {
  E2E_NO_LOGIN,
  E2E_NO_SCOPES,
  createE2eApp,
  withE2eUser
} from '@ghostfolio/api/testing/e2e/e2e-app';
import {
  FIXTURE_BASE_CURRENCY,
  FIXTURE_USER_ID,
  holdingsFixture
} from '@ghostfolio/api/testing/fixtures/portfolio.fixtures';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import Ajv from 'ajv';
import request from 'supertest';

import {
  riskConcentrationResponseSchema,
  riskErrorResponseSchema
} from './contracts/risk-concentration.schema';
import { ExposureCalculatorService } from './exposure-calculator.service';
import { ExposureService } from './exposure.service';
import { RiskController } from './risk.controller';

// Fixture holdings in USD: AAPL 3 × 180 = 540, MSFT 5 × 320 = 1600,
// SAP 4 × 130 EUR × 1.1 = 572. Total 2712.
const EUR_TO_USD = 1.1;

describe('GET /api/v1/risk/concentration (end to end)', () => {
  const ajv = new Ajv({ allErrors: true });
  const validateResponse = ajv.compile(riskConcentrationResponseSchema);
  const validateError = ajv.compile(riskErrorResponseSchema);
  const getHoldings = jest.fn().mockResolvedValue(holdingsFixture);

  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp(
      withE2eUser(
        Test.createTestingModule({
          controllers: [RiskController],
          providers: [
            ExposureCalculatorService,
            ExposureService,
            {
              provide: ExchangeRateDataService,
              useValue: {
                toCurrency: (value: number, from: string, to: string) => {
                  return from === 'EUR' && to === 'USD'
                    ? value * EUR_TO_USD
                    : value;
                }
              }
            },
            { provide: PortfolioService, useValue: { getHoldings } }
          ]
        }),
        { baseCurrency: FIXTURE_BASE_CURRENCY, userId: FIXTURE_USER_ID }
      )
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    getHoldings.mockClear();
  });

  it('returns the concentration of the fixture portfolio in the contract shape', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/risk/concentration')
      .expect(200);

    validateResponse(response.body);

    expect(validateResponse.errors ?? []).toEqual([]);
    expect(getHoldings).toHaveBeenCalledWith({
      dateRange: 'max',
      userId: FIXTURE_USER_ID
    });

    const { stock, currency, country, sector } = response.body.data;

    expect(stock.buckets.map(({ value }) => value)).toEqual([
      'MSFT',
      'SAP',
      'AAPL'
    ]);
    expect(stock.buckets.map(({ name }) => name)).toEqual([
      'Microsoft Corp.',
      'SAP SE',
      'Apple Inc.'
    ]);
    expect(stock.buckets[0].percentage).toBeCloseTo(1600 / 2712, 4);
    expect(stock.buckets[1].percentage).toBeCloseTo(572 / 2712, 4);
    expect(stock.buckets[2].percentage).toBeCloseTo(540 / 2712, 4);
    expect(currency.buckets[0].value).toBe('USD');
    expect(currency.buckets[0].percentage).toBeCloseTo(2140 / 2712, 4);
    expect(country.buckets.map(({ value }) => value)).toEqual(['US', 'DE']);
    expect(sector.buckets[0]).toMatchObject({
      percentage: 1,
      value: 'Technology'
    });
  });

  it('applies the limit query parameter', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/risk/concentration?limit=1')
      .expect(200);

    expect(response.body.data.stock.buckets.map(({ value }) => value)).toEqual([
      'MSFT'
    ]);
  });

  it('rejects an invalid limit with the RISK_INVALID_QUERY envelope', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/risk/concentration?limit=0')
      .expect(400);

    expect(validateError(response.body)).toBe(true);
    expect(response.body.error.code).toBe('RISK_INVALID_QUERY');
    expect(getHoldings).not.toHaveBeenCalled();
  });

  it('returns 403 when the user lacks the portfolio:read scope', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/risk/concentration')
      .set(E2E_NO_SCOPES)
      .expect(403);

    expect(getHoldings).not.toHaveBeenCalled();
  });

  it('returns 401 when the request is not logged in', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/risk/concentration')
      .set(E2E_NO_LOGIN)
      .expect(401);

    expect(getHoldings).not.toHaveBeenCalled();
  });
});
