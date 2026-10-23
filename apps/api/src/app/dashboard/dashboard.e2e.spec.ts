import { PortfolioService } from '@ghostfolio/api/app/portfolio/portfolio.service';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.service';
import { ImpersonationService } from '@ghostfolio/api/services/impersonation/impersonation.service';
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
  fifoRealizedGainActivitiesFrom,
  holdingsFixture,
  ordersFixture,
  performanceHistoryFixture
} from '@ghostfolio/api/testing/fixtures/portfolio.fixtures';

import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import Ajv from 'ajv';
import request from 'supertest';

import { ChartsApi } from '../charts/charts-api';
import { ExposureService } from '../risk/exposure.service';
import { TaxDataService } from '../tax/tax-data.service';
import { TaxService } from '../tax/tax.service';
import {
  dashboardErrorResponseSchema,
  dashboardOverviewResponseSchema
} from './contracts/dashboard-overview.schema';
import { DashboardOverview } from './dashboard-overview';
import { DashboardController } from './dashboard.controller';

// Real controller, DashboardOverview, tax engine (TaxService/TaxDataService)
// and ChartsApi. Stubbed: Prisma rows, PortfolioService, and the risk source
// (its own e2e spec covers the real risk numbers).
const mockRiskSection = { section: 'risk' };

jest.mock('../risk/risk-concentration.mapper', () => {
  return {
    parseConcentrationLimit: jest.fn(() => 5),
    toRiskConcentrationResponse: jest.fn(() => mockRiskSection)
  };
});

describe('GET /api/v1/dashboard/overview (end to end)', () => {
  const ajv = new Ajv({ allErrors: true });
  const validateResponse = ajv.compile(dashboardOverviewResponseSchema);
  const validateError = ajv.compile(dashboardErrorResponseSchema);
  const findMany = jest.fn();
  const getHoldings = jest.fn();
  const getPerformance = jest.fn();
  const getRiskSummary = jest.fn();

  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp(
      withE2eUser(
        Test.createTestingModule({
          controllers: [DashboardController],
          providers: [
            ChartsApi,
            DashboardOverview,
            TaxDataService,
            TaxService,
            {
              provide: ExchangeRateDataService,
              useValue: {
                toCurrencyAtDate: jest.fn()
              }
            },
            { provide: ExposureService, useValue: { getRiskSummary } },
            { provide: ImpersonationService, useValue: {} },
            {
              provide: PortfolioService,
              useValue: { getHoldings, getPerformance }
            },
            { provide: PrismaService, useValue: { order: { findMany } } }
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
    jest.restoreAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    findMany.mockReset();
    findMany.mockResolvedValue(fifoRealizedGainActivitiesFrom(ordersFixture));
    getHoldings.mockReset();
    getHoldings.mockResolvedValue(holdingsFixture);
    getPerformance.mockReset();
    getPerformance.mockResolvedValue({
      chart: performanceHistoryFixture,
      dateOfFirstActivity: new Date(2026, 0, 5)
    });
    getRiskSummary.mockReset();
    getRiskSummary.mockReturnValue({ section: 'summary' });
  });

  const getOverview = () => {
    return request(app.getHttpServer()).get('/api/v1/dashboard/overview');
  };

  it('returns all three sections in the contract shape with the real tax result', async () => {
    const response = await getOverview().expect(200);

    validateResponse(response.body);

    expect(validateResponse.errors ?? []).toEqual([]);

    const { charts, risk, tax } = response.body.data;

    expect(risk).toEqual({ data: mockRiskSection, status: 'available' });
    expect(tax.status).toBe('available');
    expect(tax.data.method).toBe('FIFO');
    expect(tax.data.sales).toHaveLength(1);
    expect(tax.data.sales[0]).toMatchObject({
      realizedGainAfterActivityFees: '217.6',
      sellActivityId: 'fixture-order-04'
    });
    expect(charts.status).toBe('available');
    expect(charts.data.kind).toBe('portfolioValue');
  });

  it('loads every section for the token user in their base currency', async () => {
    await getOverview().expect(200);

    expect(getHoldings).toHaveBeenCalledWith({
      dateRange: 'max',
      userId: FIXTURE_USER_ID
    });
    expect(getRiskSummary).toHaveBeenCalledWith(
      holdingsFixture,
      FIXTURE_BASE_CURRENCY
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: FIXTURE_USER_ID })
      })
    );
    expect(getPerformance).toHaveBeenCalledWith({
      dateRange: 'max',
      userId: FIXTURE_USER_ID
    });
  });

  it('returns 200 with only the tax section unavailable when tax data fails', async () => {
    findMany.mockRejectedValue(new Error('orders table unavailable'));

    const response = await getOverview().expect(200);

    expect(validateResponse(response.body)).toBe(true);
    expect(response.body.data.tax).toEqual({
      error: {
        code: 'DASHBOARD_TAX_UNAVAILABLE',
        message: 'The tax section could not be loaded'
      },
      status: 'unavailable'
    });
    expect(response.body.data.risk.status).toBe('available');
    expect(response.body.data.charts.status).toBe('available');
    expect(JSON.stringify(response.body)).not.toContain(
      'orders table unavailable'
    );
  });

  it('returns 500 DASHBOARD_OVERVIEW_FAILED on an unexpected failure', async () => {
    jest
      .spyOn(app.get(DashboardOverview), 'getOverview')
      .mockRejectedValueOnce(new Error('unexpected internal failure'));

    const response = await getOverview().expect(500);

    expect(validateError(response.body)).toBe(true);
    expect(response.body.error.code).toBe('DASHBOARD_OVERVIEW_FAILED');
    expect(JSON.stringify(response.body)).not.toContain('unexpected internal');
  });

  it('returns 403 when the user lacks the portfolio:read scope', async () => {
    await getOverview().set(E2E_NO_SCOPES).expect(403);

    expect(getHoldings).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  it('returns 401 when the request is not logged in', async () => {
    await getOverview().set(E2E_NO_LOGIN).expect(401);

    expect(getHoldings).not.toHaveBeenCalled();
  });
});
