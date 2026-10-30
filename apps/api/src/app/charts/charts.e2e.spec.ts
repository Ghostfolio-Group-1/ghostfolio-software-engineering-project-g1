import { PortfolioService } from '@ghostfolio/api/app/portfolio/portfolio.service';
import { ImpersonationService } from '@ghostfolio/api/services/impersonation/impersonation.service';
import {
  E2E_NO_LOGIN,
  E2E_NO_SCOPES,
  createE2eApp,
  withE2eUser
} from '@ghostfolio/api/testing/e2e/e2e-app';
import {
  FIXTURE_BASE_CURRENCY,
  FIXTURE_USER_ID,
  performanceHistoryFixture
} from '@ghostfolio/api/testing/fixtures/portfolio.fixtures';

import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import Ajv from 'ajv';
import request from 'supertest';

import { ChartsApi } from './charts-api';
import { ChartsController } from './charts.controller';
import {
  chartSeriesResponseSchema,
  chartsErrorResponseSchema
} from './contracts/chart-series.schema';
import { drawdownResponseSchema } from './contracts/drawdown.schema';

// performanceHistoryFixture, first activity 2026-01-05:
//   date        netWorth  totalInvestment
//   2026-01-05  3000      3000
//   2026-02-02  3950      3800
//   2026-03-02  3970      1970
//   2026-04-01  4100      2450
// portfolioValue uses netWorth; investedCapital uses totalInvestment.
// Only fixed custom ranges are used: presets depend on today's date.

describe('GET /api/v1/charts/series (end to end)', () => {
  const ajv = new Ajv({ allErrors: true });
  const validateResponse = ajv.compile(chartSeriesResponseSchema);
  const validateError = ajv.compile(chartsErrorResponseSchema);
  const getPerformance = jest.fn();

  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp(
      withE2eUser(
        Test.createTestingModule({
          controllers: [ChartsController],
          providers: [
            ChartsApi,
            { provide: ImpersonationService, useValue: {} },
            { provide: PortfolioService, useValue: { getPerformance } }
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
    getPerformance.mockReset();
    getPerformance.mockResolvedValue({
      chart: performanceHistoryFixture,
      dateOfFirstActivity: new Date(2026, 0, 5)
    });
  });

  it('returns the fixture portfolio value series in the contract shape', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/charts/series')
      .query({ endDate: '2026-04-01', startDate: '2026-01-05' })
      .expect(200);

    validateResponse(response.body);

    expect(validateResponse.errors ?? []).toEqual([]);
    expect(getPerformance).toHaveBeenCalledWith({
      dateRange: 'max',
      userId: FIXTURE_USER_ID
    });
    expect(response.body.data).toEqual({
      endDate: '2026-04-01',
      granularity: 'daily',
      kind: 'portfolioValue',
      points: [
        { date: '2026-01-05', value: 3000 },
        { date: '2026-02-02', value: 3950 },
        { date: '2026-03-02', value: 3970 },
        { date: '2026-04-01', value: 4100 }
      ],
      startDate: '2026-01-05'
    });
  });

  it('returns invested capital when kind=investedCapital', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/charts/series')
      .query({
        endDate: '2026-04-01',
        kind: 'investedCapital',
        startDate: '2026-01-05'
      })
      .expect(200);

    expect(response.body.data.kind).toBe('investedCapital');
    expect(
      response.body.data.points.map(({ value }: { value: number }) => value)
    ).toEqual([3000, 3800, 1970, 2450]);
  });

  it('clamps a start date before the first activity to the first activity', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/charts/series')
      .query({ endDate: '2026-04-01', startDate: '2026-01-01' })
      .expect(200);

    expect(response.body.data.startDate).toBe('2026-01-05');
    expect(response.body.data.points[0]).toEqual({
      date: '2026-01-05',
      value: 3000
    });
  });

  it('returns only the points inside a window in the middle of the history', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/charts/series')
      .query({ endDate: '2026-03-31', startDate: '2026-02-01' })
      .expect(200);

    expect(response.body.data.points).toEqual([
      { date: '2026-02-02', value: 3950 },
      { date: '2026-03-02', value: 3970 }
    ]);
  });

  it('returns an empty series for a range that ends before the first activity', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/charts/series')
      .query({ endDate: '2025-12-31', startDate: '2025-01-01' })
      .expect(200);

    expect(validateResponse(response.body)).toBe(true);
    expect(response.body.data).toMatchObject({
      endDate: '2025-12-31',
      points: [],
      startDate: '2025-01-01'
    });
  });

  it('returns 400 CHARTS_INVALID_QUERY when range and a custom range are both sent', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/charts/series')
      .query({ endDate: '2026-04-01', range: '1y', startDate: '2026-01-05' })
      .expect(400);

    expect(validateError(response.body)).toBe(true);
    expect(response.body.error.code).toBe('CHARTS_INVALID_QUERY');
  });

  it('returns 400 CHARTS_INVALID_QUERY for an unknown kind', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/charts/series')
      .query({ endDate: '2026-04-01', kind: 'bogus', startDate: '2026-01-05' })
      .expect(400);

    expect(validateError(response.body)).toBe(true);
    expect(response.body.error.code).toBe('CHARTS_INVALID_QUERY');
  });

  it('returns 403 when the user lacks the portfolio:read scope', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/charts/series')
      .query({ endDate: '2026-04-01', startDate: '2026-01-05' })
      .set(E2E_NO_SCOPES)
      .expect(403);

    expect(getPerformance).not.toHaveBeenCalled();
  });

  it('returns 401 when the request is not logged in', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/charts/series')
      .query({ endDate: '2026-04-01', startDate: '2026-01-05' })
      .set(E2E_NO_LOGIN)
      .expect(401);

    expect(getPerformance).not.toHaveBeenCalled();
  });
  it('returns 500 CHARTS_SERIES_FAILED when the history cannot be loaded', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    getPerformance.mockRejectedValue(new Error('database unavailable'));

    const response = await request(app.getHttpServer())
      .get('/api/v1/charts/series')
      .query({ endDate: '2026-04-01', startDate: '2026-01-05' })
      .expect(500);

    expect(validateError(response.body)).toBe(true);
    expect(response.body.error.code).toBe('CHARTS_SERIES_FAILED');
    expect(JSON.stringify(response.body)).not.toContain('database unavailable');
  });
});

describe('GET /api/v1/charts/drawdown (end to end)', () => {
  const ajv = new Ajv({ allErrors: true });
  const validateResponse = ajv.compile(drawdownResponseSchema);
  const validateError = ajv.compile(chartsErrorResponseSchema);
  const getPerformance = jest.fn();

  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp(
      withE2eUser(
        Test.createTestingModule({
          controllers: [ChartsController],
          providers: [
            ChartsApi,
            { provide: ImpersonationService, useValue: {} },
            { provide: PortfolioService, useValue: { getPerformance } }
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
    getPerformance.mockReset();
    getPerformance.mockResolvedValue({
      chart: [
        {
          date: '2026-01-05',
          netPerformanceInPercentageWithCurrencyEffect: 0
        },
        {
          date: '2026-02-02',
          netPerformanceInPercentageWithCurrencyEffect: 1
        },
        {
          date: '2026-03-02',
          netPerformanceInPercentageWithCurrencyEffect: 0.6
        },
        {
          date: '2026-04-01',
          netPerformanceInPercentageWithCurrencyEffect: 0.8
        }
      ],
      dateOfFirstActivity: new Date(2026, 0, 5)
    });
  });

  it('returns drawdown from the running peak in the contract shape', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/charts/drawdown')
      .query({ endDate: '2026-04-01', startDate: '2026-01-05' })
      .expect(200);

    validateResponse(response.body);

    expect(validateResponse.errors ?? []).toEqual([]);
    expect(getPerformance).toHaveBeenCalledWith({
      dateRange: 'max',
      userId: FIXTURE_USER_ID
    });

    const peak = 100 * (1 + 1);
    const marchDrawdown = (100 * (1 + 0.6) - peak) / peak;
    const aprilDrawdown = (100 * (1 + 0.8) - peak) / peak;

    expect(response.body.data).toEqual({
      endDate: '2026-04-01',
      granularity: 'daily',
      maxDrawdown: marchDrawdown,
      maxDrawdownDate: '2026-03-02',
      startDate: '2026-01-05',
      points: [
        { date: '2026-01-05', drawdown: 0, isNewPeak: true },
        { date: '2026-02-02', drawdown: 0, isNewPeak: true },
        {
          date: '2026-03-02',
          drawdown: marchDrawdown,
          isNewPeak: false
        },
        {
          date: '2026-04-01',
          drawdown: aprilDrawdown,
          isNewPeak: false
        }
      ]
    });
  });

  it('keeps the peak from history before the selected range', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/charts/drawdown')
      .query({ endDate: '2026-04-01', startDate: '2026-03-02' })
      .expect(200);

    const peak = 100 * (1 + 1);
    const marchDrawdown = (100 * (1 + 0.6) - peak) / peak;
    const aprilDrawdown = (100 * (1 + 0.8) - peak) / peak;

    expect(response.body.data.startDate).toBe('2026-03-02');
    expect(response.body.data.points).toEqual([
      {
        date: '2026-03-02',
        drawdown: marchDrawdown,
        isNewPeak: false
      },
      {
        date: '2026-04-01',
        drawdown: aprilDrawdown,
        isNewPeak: false
      }
    ]);
    expect(response.body.data.maxDrawdown).toBe(marchDrawdown);
    expect(response.body.data.maxDrawdownDate).toBe('2026-03-02');
  });
  it('returns 400 CHARTS_INVALID_QUERY for an inverted custom range', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/charts/drawdown')
      .query({ endDate: '2026-01-05', startDate: '2026-04-01' })
      .expect(400);

    expect(validateError(response.body)).toBe(true);
    expect(response.body.error.code).toBe('CHARTS_INVALID_QUERY');
  });

  it('returns 403 when the user lacks the portfolio:read scope', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/charts/drawdown')
      .query({ endDate: '2026-04-01', startDate: '2026-01-05' })
      .set(E2E_NO_SCOPES)
      .expect(403);

    expect(getPerformance).not.toHaveBeenCalled();
  });
});
